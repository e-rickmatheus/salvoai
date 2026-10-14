import { randomUUID } from 'node:crypto';
import { withDatabaseClient,withPostgresStore } from './postgres-store.js';
import { createDriveClient,driveConfig,seal,unseal,ownerKey,packBackup } from './google-drive.js';

export function createBackupService({env=process.env,database,storeRunner,drive}={}) {
  const configured=Boolean(env.GOOGLE_DRIVE_CLIENT_ID&&env.GOOGLE_DRIVE_CLIENT_SECRET);
  const db=database||(callback=>withDatabaseClient(callback,{connectionString:env.DATABASE_URL||env.POSTGRES_URL}));
  const stores=storeRunner||((callback,owner)=>withPostgresStore(callback,{owner,connectionString:env.DATABASE_URL||env.POSTGRES_URL}));
  const config=()=>driveConfig(env);
  const provider=()=>drive||createDriveClient(config());
  const query=(sql,values=[])=>db(client=>client.query(sql,values));
  async function connection(owner) {
    const row=(await query('SELECT * FROM salvoai_drive_connections WHERE owner=$1',[owner])).rows[0];
    if(!row)return null;
    let session;try{session=unseal(row.token_envelope,config().key,owner);}catch{const error=Error('Reconecte o Google Drive para retomar os backups.');error.code='DRIVE_RECONNECT';throw error;}
    if(session.expires_at<Date.now()+60000) {
      session=await provider().refresh(session);
      await query('UPDATE salvoai_drive_connections SET token_envelope=$1 WHERE owner=$2 AND generation=$3',[seal(session,config().key,owner),owner,row.generation]);
    }
    return {...row,session};
  }
  async function status(owner) {
    if(!configured)return {configured:false,connected:false,dailyScheduled:false};
    const result=await query('SELECT c.account_email,c.folder_id,s.dirty,s.last_success,s.last_error,s.error_code FROM salvoai_drive_connections c LEFT JOIN salvoai_backup_state s USING(owner) WHERE c.owner=$1',[owner]);
    const row=result.rows[0];
    if(!row)return {configured:true,connected:false,dailyScheduled:Boolean(env.CRON_SECRET)};
    return {configured:true,connected:true,account:row.account_email,pending:Boolean(row.dirty),lastSuccess:row.last_success,lastError:row.last_error,needsReconnect:row.error_code==='DRIVE_RECONNECT',dailyScheduled:Boolean(env.CRON_SECRET),folderUrl:row.folder_id?'https://drive.google.com/drive/folders/'+encodeURIComponent(row.folder_id):null};
  }
  async function connect(user,session) {
    if(!session.refresh_token)throw Error('A autorização do Google não permite backup automático. Reconecte.');
    await db(async client=>{
      await client.query('BEGIN');
      try {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['salvoai:'+user.id]);
        await client.query('INSERT INTO salvoai_drive_connections (owner,token_envelope,account_email,owner_key,generation) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(owner) DO UPDATE SET token_envelope=excluded.token_envelope,account_email=excluded.account_email,owner_key=excluded.owner_key,generation=excluded.generation,folder_id=NULL,connected_at=now()',[user.id,seal(session,config().key,user.id),session.email,ownerKey(user),randomUUID()]);
        await client.query('INSERT INTO salvoai_backup_state (owner,dirty,revision) VALUES ($1,true,1) ON CONFLICT(owner) DO UPDATE SET dirty=true,revision=salvoai_backup_state.revision+1,last_success=NULL,last_checked=NULL,last_error=NULL,error_code=NULL,last_hash=NULL,last_file_id=NULL,lease_id=NULL,lease_until=NULL',[user.id]);
        await client.query('COMMIT');
      }catch(error){await client.query('ROLLBACK');throw error;}
    });
  }
  async function attempt(owner,{force=false}={}) {
    if(!configured)return {status:'not_configured'};
    const lease=randomUUID();
    try {
      const acquired=await query("UPDATE salvoai_backup_state s SET lease_id=$2,lease_until=now()+interval '4 minutes',last_checked=now() WHERE owner=$1 AND (lease_until IS NULL OR lease_until<now()) AND (dirty OR $3::boolean) AND EXISTS(SELECT 1 FROM salvoai_drive_connections c WHERE c.owner=s.owner) RETURNING *",[owner,lease,force]);
      if(!acquired.rowCount)return {status:'idle'};
      const account=await connection(owner);
      const capture=await stores(async store=>({snapshot:await store.export(),revision:await store.backupRevision()}),owner);
      const packed=packBackup(capture.snapshot),previous=acquired.rows[0];
      if(!force&&previous.last_hash===packed.hash) {
        await query('UPDATE salvoai_backup_state SET dirty=(revision<>$2),last_error=NULL,error_code=NULL,lease_id=NULL,lease_until=NULL WHERE owner=$1 AND lease_id=$3',[owner,capture.revision,lease]);
        return {status:'unchanged'};
      }
      const client=provider(),folder=await client.folder(account.session.access_token,account.owner_key);
      await query('UPDATE salvoai_drive_connections SET folder_id=$1 WHERE owner=$2 AND generation=$3',[folder,owner,account.generation]);
      const uploaded=await client.upload(account.session.access_token,account.owner_key,folder,capture.snapshot);
      const recorded=await query('UPDATE salvoai_backup_state SET dirty=(revision<>$2),last_success=$3,last_hash=$4,last_file_id=$5,last_error=NULL,error_code=NULL,lease_id=NULL,lease_until=NULL WHERE owner=$1 AND lease_id=$6',[owner,capture.revision,uploaded.date,uploaded.hash,uploaded.fileId,lease]);
      return recorded.rowCount?{status:'saved',date:uploaded.date}:{status:'superseded'};
    } catch(error) {
      const message=error.code==='DRIVE_RECONNECT'?'Reconecte sua conta Google para retomar os backups.':error.message?.includes('sem espaço')?'O Google Drive está sem espaço para uma nova cópia.':error.message?.includes('64 MB')?'O acervo ultrapassou o limite de 64 MB do backup.':'A cópia no Drive está pendente. Seus dados continuam no acervo e uma nova tentativa será feita.';
      await query('UPDATE salvoai_backup_state SET last_error=$2,error_code=$3,lease_id=NULL,lease_until=NULL WHERE owner=$1 AND lease_id=$4',[owner,message,error.code||'BACKUP_PENDING',lease]).catch(()=>{});
      return {status:'pending',error:message};
    }
  }
  async function list(owner) {
    const account=await connection(owner);if(!account)throw Error('Conecte sua conta Google primeiro.');
    return (await provider().list(account.session.access_token,account.owner_key)).map(file=>({id:file.id,name:file.name,date:file.createdTime,items:Number(file.appProperties?.itemCount||0),url:'https://drive.google.com/file/d/'+encodeURIComponent(file.id)+'/view'}));
  }
  async function read(owner,id) {
    const account=await connection(owner);if(!account)throw Error('Conecte sua conta Google primeiro.');
    return provider().download(account.session.access_token,id,account.owner_key);
  }
  async function restore(owner,id) {
    const snapshot=await read(owner,id);
    const result=await stores(async store=>{const restored=await store.import(snapshot);await store.markBackupDirty();return restored;},owner);
    const backup=await attempt(owner);return {...result,backup};
  }
  async function disconnect(owner) {
    // Existing Drive files are preserved. Reconnection re-enables backups.
    await query('DELETE FROM salvoai_drive_connections WHERE owner=$1',[owner]);
    return {ok:true};
  }
  async function cron() {
    if(!configured)return {enabled:false,processed:0,failed:0};
    const owners=(await query('SELECT c.owner FROM salvoai_drive_connections c JOIN salvoai_backup_state s USING(owner) WHERE s.dirty AND (s.lease_until IS NULL OR s.lease_until<now()) ORDER BY COALESCE(s.last_checked,c.connected_at),c.owner LIMIT 20')).rows;
    let processed=0,failed=0;const deadline=Date.now()+240000;
    for(const row of owners){if(Date.now()>deadline)break;const result=await attempt(row.owner);processed++;if(result.status==='pending')failed++;}
    return {enabled:true,processed,failed};
  }
  return {configured,config,status,connect,attempt,list,read,restore,disconnect,cron};
}
export function isLibraryMutation(req) {
  const path=req.url.split('?')[0];
  return ['POST','PATCH','DELETE'].includes(req.method)&&(/^\/api\/(links|collections|categories|import)$/.test(path)||/^\/api\/items\/[a-z0-9-]+$/.test(path));
}
