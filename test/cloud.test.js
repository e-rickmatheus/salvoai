import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { schema,runStoreTransaction } from '../lib/postgres-store.js';
import { createCloudHandler,requestOrigin,responseBuffer } from '../api/index.js';
import { sessionCookies,readCookies,clearSessionCookies } from '../lib/cloud-auth.js';
import { exportCloudSnapshot,importCloudSnapshot } from '../scripts/cloud-backup.mjs';

test('PostgreSQL: persistência, isolamento de contas, categorias e rollback atômico',async()=>{
  const db=new PGlite();await db.exec(schema);
  const client={query:async(sql,values)=>{const result=await db.query(sql,values);return {...result,rowCount:result.rowCount??result.affectedRows??result.rows.length};}};
  const run=(owner,callback)=>runStoreTransaction(client,callback,owner);
  try {
    const [saved,duplicate,invalid]=await run('alice',store=>store.batch(['https://example.com/a','https://example.com/a','javascript:alert(1)']));
    assert.equal(saved.status,'saved');assert.equal(duplicate.id,saved.id);assert.equal(invalid.status,'invalid');
    await run('alice',store=>store.update(saved.id,{title:'Receita',notes:'Privado',category:'Pessoal/Receitas',collections:['Cozinha'],coverData:'data:image/png;base64,AA=='}));
    await run('alice',store=>store.renameCategory('Pessoal','Minha pasta','folders'));
    const library=await run('alice',store=>store.all());assert.equal(library[0].id,saved.id);assert.equal(library[0].category,'Minha pasta/Receitas');
    assert.deepEqual(await run('bob',store=>store.all()),[]);
    await assert.rejects(run('bob',store=>store.update(saved.id,{notes:'Invasão'})),/não encontrado/);
    await run('bob',store=>store.remove(saved.id));assert.equal((await run('alice',store=>store.all())).length,1);
    const bob=await run('bob',store=>store.batch(['https://example.com/a']));assert.notEqual(bob[0].id,saved.id);
    const backup=await run('alice',store=>store.export());assert.equal(backup.items[0].coverData,'data:image/png;base64,AA==');
    assert.deepEqual(await run('alice',store=>store.import(backup)),{saved:0,duplicates:1});
    await assert.rejects(run('alice',store=>store.import({...backup,categories:['Temporária','/inválida']})));
    assert.ok(!(await run('alice',store=>store.categories())).includes('Temporária'));
    await run('alice',async store=>{await store.remove(saved.id);return {statusCode:400};});
    assert.equal((await run('alice',store=>store.all())).length,1);
    await run('alice',store=>store.removeCategory('Minha pasta'));assert.equal((await run('alice',store=>store.all()))[0].category,'');
    // Supabase's public API roles must see no data even if table grants exist.
    await db.exec('CREATE ROLE public_reader; GRANT USAGE ON SCHEMA public TO public_reader; GRANT SELECT ON ALL TABLES IN SCHEMA public TO public_reader; SET ROLE public_reader;');
    assert.deepEqual((await db.query('SELECT * FROM salvoai_items')).rows,[]);
    await db.exec('RESET ROLE');
    const snapshot=await exportCloudSnapshot(client),destination=new PGlite();
    const target={query:async(sql,values)=>{if(sql===schema){await destination.exec(sql);return {rows:[]};}return destination.query(sql,values);}};
    try {
      await importCloudSnapshot(target,snapshot);
      const restored=await exportCloudSnapshot(target);assert.deepEqual(restored.tables,snapshot.tables);
      await assert.rejects(importCloudSnapshot(target,snapshot),/destino precisa estar vazio/);
      assert.deepEqual((await exportCloudSnapshot(target)).tables,snapshot.tables);
    }finally{await destination.close();}
  }finally{await db.close();}
});

test('Vercel: exige login, bloqueia origem externa e aguarda commit antes de responder',async()=>{
  const db=new PGlite();await db.exec(schema);
  const client={query:async(sql,values)=>{const result=await db.query(sql,values);return {...result,rowCount:result.rowCount??result.affectedRows??result.rows.length};}};
  let failCommit=false,storeCalls=0;
  const env={SALVOAI_PUBLIC_URL:'https://salvoai.example',SUPABASE_URL:'https://auth.example',SUPABASE_PUBLISHABLE_KEY:'test-only'};
  const app=http.createServer(createCloudHandler({env,authenticateRequest:async req=>req.headers['x-test-user']?{user:{id:req.headers['x-test-user']},cookies:[]}:null,storeRunner:async(callback,options)=>{
    storeCalls++;return runStoreTransaction(client,async store=>{const result=await callback(store);if(failCommit)throw Error('Falha antes do commit');return result;},options.owner);
  }}));
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+app.address().port;
  const call=(path,method='GET',body,user='alice',extra={})=>new Promise((resolve,reject)=>{
    const request=http.request(base+path,{method,headers:{Host:'salvoai.example',...(user?{'x-test-user':user}:{}),...(body?{'Content-Type':'application/json',Origin:'https://salvoai.example'}:{}),...extra}},response=>{
      const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,headers:new Headers(response.headers),json:async()=>JSON.parse(Buffer.concat(chunks).toString())}));
    });request.on('error',reject);request.end(body?JSON.stringify(body):undefined);
  });
  try {
    assert.equal((await call('/api/library','GET',undefined,null)).status,401);assert.equal(storeCalls,0);
    const root=await call('/','GET',undefined,null);assert.equal(root.status,302);assert.equal(root.headers.get('location'),'/login');
    assert.equal((await call('/login','GET',undefined,null)).status,200);
    assert.equal((await call('/api/links','POST',{links:[]},'alice',{Origin:'https://evil.example'})).status,403);
    assert.equal((await call('/api/library','GET',undefined,'alice',{Host:'evil.example'})).status,403);
    assert.equal((await call('/api/auth/login','POST',{email:'a@example.com',password:'test-only'},null,{Origin:'https://evil.example'})).status,403);
    let result=await call('/api/links','POST',{links:['https://example.com/1']});assert.equal(result.status,200);
    const id=(await result.json()).results[0].id;
    assert.equal((await(await call('/api/library')).json()).items[0].id,id);
    assert.deepEqual((await(await call('/api/library','GET',undefined,'bob')).json()).items,[]);
    assert.equal((await call('/api/items/'+id,'PATCH',{notes:'Invadir'},'bob')).status,400);
    failCommit=true;assert.equal((await call('/api/links','POST',{links:['https://example.com/rollback']})).status,503);failCommit=false;
    assert.equal((await(await call('/api/library')).json()).items.length,1);
    const failedImport=await call('/api/import','POST',{format:'salvoai',version:1,items:[],categories:['Parcial','/inválida']});assert.equal(failedImport.status,400);
    assert.ok(!(await(await call('/api/library')).json()).categories.includes('Parcial'));
    assert.equal((await call('/api/chat','POST',{question:'Oi'})).status,503);
    assert.equal((await(await call('/api/runtime')).json()).cloud,true);
    const bodyResponse=responseBuffer();const req={method:'POST',url:'/api/links',headers:{host:'salvoai.example',origin:'https://salvoai.example','content-type':'application/json','x-test-user':'alice'},body:{links:['https://example.com/parsed']}};
    await createCloudHandler({env,authenticateRequest:async()=>({user:{id:'alice'},cookies:[]}),storeRunner:(callback,options)=>runStoreTransaction(client,callback,options.owner)})(req,bodyResponse);
    assert.equal(bodyResponse.statusCode,200);
  }finally{await new Promise(resolve=>app.close(resolve));await db.close();}
});

test('Cookies seguros e origem de produção não aceitam configuração insegura',()=>{
  const cookies=sessionCookies({access_token:'access',refresh_token:'refresh',expires_in:3600});
  for(const cookie of cookies){assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);assert.match(cookie,/Path=\//);assert.ok(cookie.startsWith('__Host-'));}
  assert.equal(readCookies(cookies.map(c=>c.split(';')[0]).join('; '))['__Host-salvoai-access'],'access');
  assert.ok(clearSessionCookies().every(c=>c.includes('Max-Age=0')));
  assert.equal(requestOrigin({headers:{host:'salvoai.example'}},{SALVOAI_PUBLIC_URL:'https://salvoai.example'}),'https://salvoai.example');
  assert.equal(requestOrigin({headers:{host:'evil.example'}},{SALVOAI_PUBLIC_URL:'https://salvoai.example'}),null);
  assert.throws(()=>requestOrigin({headers:{host:'salvoai.example'}},{SALVOAI_PUBLIC_URL:'http://salvoai.example'}));
});
