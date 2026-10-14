import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { File } from 'node:buffer';
import { schema,runStoreTransaction } from '../lib/postgres-store.js';
import { createBackupService } from '../lib/drive-backup.js';
import { driveConfig,seal,unseal,oauthState,verifyState,packBackup,unpackBackup,createDriveClient,ownerKey } from '../lib/google-drive.js';
import { readCookies } from '../lib/cloud-auth.js';
import { validCron } from '../lib/drive-routes.js';
import { createCloudHandler,responseBuffer } from '../api/index.js';
import { readBackupFile } from '../public/drive-backup-ui.js';

const env={SALVOAI_PUBLIC_URL:'https://salvoai.example',SUPABASE_URL:'https://auth.example',SUPABASE_PUBLISHABLE_KEY:'test-only',GOOGLE_DRIVE_CLIENT_ID:'test-client',GOOGLE_DRIVE_CLIENT_SECRET:'test-client-secret',CRON_SECRET:'test-cron-secret-long'};
const alice={id:'alice',email:'alice@example.test'},bob={id:'bob',email:'bob@example.test'};
async function setup() {
  const database=new PGlite();await database.exec(schema);
  const client={query:async(sql,args)=>{const result=await database.query(sql,args);return {...result,rowCount:result.rowCount??result.affectedRows??result.rows.length};}};
  const stores=(callback,owner)=>runStoreTransaction(client,callback,owner);
  const copies=new Map();let unavailable=false,number=0,afterUpload;
  const drive={
    async refresh(session){return {...session,access_token:'refreshed-test-token',expires_at:Date.now()+3600000};},
    async folder(){return 'folder000001';},
    async upload(access,key,folder,snapshot){if(unavailable)throw Error('Falha simulada');const packed=packBackup(snapshot),id='backup'+String(++number).padStart(8,'0');copies.set(id,{id,key,snapshot:structuredClone(snapshot),bytes:packed.bytes,sha256:packed.sha256});if(afterUpload){const callback=afterUpload;afterUpload=undefined;await callback();}return {fileId:id,hash:packed.hash,date:snapshot.exportedAt};},
    async list(access,key){return [...copies.values()].filter(copy=>copy.key===key).map(copy=>({id:copy.id,name:'SALVOAI.json.gz',createdTime:copy.snapshot.exportedAt,appProperties:{itemCount:String(copy.snapshot.items.length)}}));},
    async download(access,id,key){const copy=copies.get(id);if(!copy||copy.key!==key)throw Error('Backup de outra conta');return unpackBackup(copy.bytes,copy.sha256);}
  };
  const service=createBackupService({env,database:callback=>callback(client),storeRunner:stores,drive});
  const connect=user=>service.connect(user,{access_token:'test-access',refresh_token:'test-refresh',expires_at:Date.now()+3600000,email:user.email});
  const save=(user,url)=>stores(async store=>{const result=await store.batch([url]);await store.markBackupDirty();return result;},user.id);
  return {database,client,stores,copies,service,connect,save,setUnavailable:value=>unavailable=value,setAfterUpload:callback=>afterUpload=callback};
}

test('Backup no Drive: tokens protegidos, cópia independente e restauração isolada',async()=>{
  const app=await setup();
  try {
    await app.connect(alice);await app.connect(bob);
    const [saved]=await app.save(alice,'https://example.com/receita');
    await app.stores(store=>store.update(saved.id,{notes:'Nota privada',category:'Comida/Receitas',coverData:'data:image/png;base64,AA==',summary:'Resumo preservado'}),alice.id);
    const result=await app.service.attempt(alice.id);assert.equal(result.status,'saved');
    const status=await app.service.status(alice.id);assert.equal(status.pending,false);assert.ok(status.lastSuccess);
    const raw=(await app.client.query('SELECT token_envelope FROM salvoai_drive_connections WHERE owner=$1',[alice.id])).rows[0].token_envelope;
    assert.ok(!raw.includes('test-refresh'));assert.throws(()=>unseal(raw,driveConfig(env).key,bob.id));
    const list=await app.service.list(alice.id);assert.equal(list.length,1);assert.deepEqual(await app.service.list(bob.id),[]);
    assert.equal((await app.service.attempt(alice.id)).status,'idle');assert.equal(app.copies.size,1);
    await assert.rejects(app.service.restore(bob.id,list[0].id));
    await app.stores(store=>store.remove(saved.id),alice.id);
    const restored=await app.service.restore(alice.id,list[0].id);assert.equal(restored.saved,1);
    const items=await app.stores(store=>store.all(),alice.id);assert.equal(items[0].notes,'Nota privada');assert.equal(items[0].coverData,'data:image/png;base64,AA==');
    const restoredAgain=await app.service.restore(alice.id,list[0].id);assert.equal(restoredAgain.duplicates,1);
    await app.service.disconnect(alice.id);assert.equal((await app.service.status(alice.id)).connected,false);assert.ok(app.copies.size>=1);
    await app.database.exec('CREATE ROLE drive_public_reader; GRANT USAGE ON SCHEMA public TO drive_public_reader; GRANT SELECT ON ALL TABLES IN SCHEMA public TO drive_public_reader; SET ROLE drive_public_reader');
    assert.deepEqual((await app.database.query('SELECT * FROM salvoai_drive_connections')).rows,[]);
    assert.deepEqual((await app.database.query('SELECT * FROM salvoai_backup_state')).rows,[]);
    await app.database.exec('RESET ROLE');
  }finally{await app.database.close();}
});

test('Falha do Drive mantém dados e pendência durável; cron tenta novamente',async()=>{
  const app=await setup();
  try {
    await app.connect(alice);await app.save(alice,'https://example.com/a');app.setUnavailable(true);
    assert.equal((await app.service.attempt(alice.id)).status,'pending');
    const pending=await app.service.status(alice.id);assert.equal(pending.pending,true);assert.equal(pending.lastSuccess,null);assert.ok(pending.lastError);
    assert.equal((await app.stores(store=>store.all(),alice.id)).length,1);
    app.setUnavailable(false);
    const cron=await app.service.cron();assert.equal(cron.processed,1);assert.equal(cron.failed,0);
    assert.equal((await app.service.status(alice.id)).pending,false);
    assert.equal((await app.service.cron()).processed,0);
  }finally{await app.database.close();}
});

test('Backup concorrente mantém a versão nova pendente e evita cópias simultâneas',async()=>{
  const app=await setup();
  try {
    await app.connect(alice);await app.save(alice,'https://example.com/primeiro');
    app.setAfterUpload(async()=>{
      assert.equal((await app.service.attempt(alice.id)).status,'idle');
      await app.save(alice,'https://example.com/segundo');
    });
    await app.service.attempt(alice.id);assert.equal((await app.service.status(alice.id)).pending,true);
    await app.service.cron();assert.equal((await app.service.status(alice.id)).pending,false);
    const copies=[...app.copies.values()];assert.equal(copies.length,2);assert.equal(copies[1].snapshot.items.length,2);
  }finally{await app.database.close();}
});

test('API mantém salvamento confirmado mesmo com backup offline e protege o cron',async()=>{
  const app=await setup();
  try {
    await app.connect(alice);app.setUnavailable(true);
    const handler=createCloudHandler({env,authenticateRequest:async()=>({user:alice,cookies:[]}),storeRunner:(callback,options)=>app.stores(callback,options.owner),backupService:app.service});
    const req={method:'POST',url:'/api/links',headers:{host:'salvoai.example',origin:'https://salvoai.example','content-type':'application/json'},body:{links:['https://example.com/api']}};
    const response=responseBuffer();await handler(req,response);
    assert.equal(response.statusCode,200);const body=JSON.parse(response.body);assert.equal(body.results[0].status,'saved');assert.equal(body.driveBackup.status,'pending');
    assert.equal((await app.service.status(alice.id)).pending,true);
    const denied=responseBuffer();await handler({method:'GET',url:'/api/backup/cron',headers:{host:'salvoai.example'}},denied);assert.equal(denied.statusCode,401);
    app.setUnavailable(false);
    const allowed=responseBuffer();await handler({method:'GET',url:'/api/backup/cron',headers:{authorization:'Bearer '+env.CRON_SECRET}},allowed);assert.equal(allowed.statusCode,200);assert.equal(JSON.parse(allowed.body).failed,0);
  }finally{await app.database.close();}
});

test('OAuth usa PKCE, vincula estado à conta e recusa expiração e alteração',()=>{
  const config=driveConfig(env),pending=oauthState(alice.id,config,1000),params=new URL(pending.url).searchParams;
  assert.equal(params.get('scope'),'https://www.googleapis.com/auth/drive.file openid email');assert.equal(params.get('access_type'),'offline');
  const envelope=readCookies(pending.cookie)['__Host-salvoai-drive-state'],state=verifyState(envelope,params.get('state'),alice.id,config,2000);
  assert.equal(params.get('code_challenge'),createHash('sha256').update(state.verifier).digest('base64url'));
  assert.throws(()=>verifyState(envelope,'wrong-state',alice.id,config,2000));
  assert.throws(()=>verifyState(envelope,params.get('state'),bob.id,config,2000));
  assert.throws(()=>verifyState(envelope,params.get('state'),alice.id,config,10000000));
  const protectedValue=seal({refresh:'secret'},config.key,alice.id);assert.deepEqual(unseal(protectedValue,config.key,alice.id),{refresh:'secret'});
  assert.throws(()=>unseal(protectedValue.slice(0,-3)+'xxx',config.key,alice.id));
  assert.equal(validCron({headers:{authorization:'Bearer '+env.CRON_SECRET}},env),true);
  assert.equal(validCron({headers:{authorization:'Bearer wrong'}},env),false);
});

test('Cliente Drive confirma checksum e recusa arquivo de outra conta',async()=>{
  const config=driveConfig(env),snapshot={format:'salvoai',version:1,exportedAt:new Date().toISOString(),items:[],collections:[],categories:[],categoryIcons:{}},packed=packBackup(snapshot),key=ownerKey(alice);
  let metadataOwner=key,mediaReads=0;
  const meta={id:'backup000001',mimeType:'application/gzip',size:String(packed.bytes.length),md5Checksum:createHash('md5').update(packed.bytes).digest('hex'),appProperties:{salvoaiKind:'backup',salvoaiOwner:key,sha256:packed.sha256}};
  const json=(data,options={})=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json',...options.headers}});
  const client=createDriveClient(config,{request:async(url,options)=>{
    const address=String(url);
    if(address.includes('uploadType=resumable'))return json({}, {headers:{location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=test'}});
    if(options?.method==='PUT'){assert.deepEqual(Buffer.from(options.body),packed.bytes);return json({id:'backup000001'});}
    if(address.includes('alt=media')){mediaReads++;return new Response(packed.bytes);}
    return json({...meta,appProperties:{...meta.appProperties,salvoaiOwner:metadataOwner}});
  }});
  const uploaded=await client.upload('test-access',key,'folder000001',snapshot);assert.equal(uploaded.fileId,'backup000001');
  assert.deepEqual(await client.download('test-access','backup000001',key),snapshot);
  metadataOwner=ownerKey(bob);await assert.rejects(client.download('test-access','backup000001',key));assert.equal(mediaReads,1);
  await assert.rejects(createDriveClient(config,{request:async()=>json({}, {headers:{location:'https://evil.example/upload/drive/test'}})}).upload('test',key,'folder000001',snapshot));
  assert.throws(()=>unpackBackup(packed.bytes,'incorrect'));
});

test('Backup portátil pode ser aberto sem tokens ou dependência do banco',async()=>{
  const snapshot={format:'salvoai',version:1,exportedAt:new Date().toISOString(),items:[],collections:['Receitas'],categories:[],categoryIcons:{}};
  const packed=packBackup(snapshot);assert.deepEqual(unpackBackup(packed.bytes,packed.sha256),snapshot);
  const file=new File([packed.bytes],'salvoai-backup.json.gz',{type:'application/gzip'});
  assert.deepEqual(await readBackupFile(file),snapshot);
  const changedDate=packBackup({...snapshot,exportedAt:new Date(Date.now()+5000).toISOString()});assert.equal(changedDate.hash,packed.hash);
});

test('Reconectar durante uma cópia mantém a nova conta pendente',async()=>{
 const app=await setup();try {await app.connect(alice);await app.save(alice,'https://example.com/reconnect');app.setAfterUpload(()=>app.connect(alice));assert.equal((await app.service.attempt(alice.id)).status,'superseded');const status=await app.service.status(alice.id);assert.equal(status.pending,true);assert.equal(status.lastSuccess,null);assert.equal((await app.service.attempt(alice.id)).status,'saved');}finally{await app.database.close();}
});
