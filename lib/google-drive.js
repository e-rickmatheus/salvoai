import { createHash,createCipheriv,createDecipheriv,randomBytes,timingSafeEqual } from 'node:crypto';
import { gzipSync,gunzipSync } from 'node:zlib';

export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
export const MAX_BACKUP_BYTES=64*1024*1024;
export function driveConfig(env=process.env) {
  if(!env.GOOGLE_DRIVE_CLIENT_ID||!env.GOOGLE_DRIVE_CLIENT_SECRET)throw Error('A integração com o Google Drive ainda não está configurada.');
  const origin=new URL(env.SALVOAI_PUBLIC_URL);
  if(origin.protocol!=='https:')throw Error('O Google Drive exige um endereço HTTPS.');
  const key=env.DRIVE_TOKEN_ENCRYPTION_KEY?Buffer.from(env.DRIVE_TOKEN_ENCRYPTION_KEY,'base64'):createHash('sha256').update('SALVOAI-Drive-v1\0'+env.GOOGLE_DRIVE_CLIENT_SECRET).digest();
  if(key.length!==32)throw Error('A chave de proteção dos tokens precisa ter 32 bytes.');
  return {clientId:env.GOOGLE_DRIVE_CLIENT_ID,clientSecret:env.GOOGLE_DRIVE_CLIENT_SECRET,redirectUri:origin.origin+'/api/drive/callback',key};
}
export function seal(value,key,owner) {
  const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);
  cipher.setAAD(Buffer.from(owner));
  const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return Buffer.concat([nonce,cipher.getAuthTag(),encrypted]).toString('base64url');
}
export function unseal(value,key,owner) {
  const bytes=Buffer.from(value,'base64url');
  if(bytes.length<29)throw Error('Credenciais do Drive inválidas. Reconecte sua conta.');
  const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));decipher.setAAD(Buffer.from(owner));decipher.setAuthTag(bytes.subarray(12,28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString());
}
export function oauthState(owner,config,now=Date.now()) {
  const state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for(const [key,value] of Object.entries({client_id:config.clientId,redirect_uri:config.redirectUri,response_type:'code',scope:DRIVE_SCOPE+' openid email',access_type:'offline',prompt:'consent',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}))url.searchParams.set(key,value);
  return {url:url.href,cookie:'__Host-salvoai-drive-state='+seal({owner,state,verifier,expires:now+15*60000},config.key,owner)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=900'};
}
export function verifyState(envelope,state,owner,config,now=Date.now()) {
  const value=unseal(envelope,config.key,owner);
  if(value.owner!==owner||value.expires<now||typeof state!=='string'||state.length!==value.state.length||!timingSafeEqual(Buffer.from(state),Buffer.from(value.state)))throw Error('A autorização expirou. Tente conectar o Google Drive novamente.');
  return value;
}
export function ownerKey(user) {
  if(!user?.id)throw Error('Usuário autenticado obrigatório.');
  return createHash('sha256').update('salvoai-library-v1:'+String(user.email||user.id).trim().toLowerCase()).digest('hex');
}
function canonical(value) {
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}
export function packBackup(snapshot) {
  if(snapshot?.format!=='salvoai'||snapshot.version!==1||!Array.isArray(snapshot.items))throw Error('Acervo inválido para backup.');
  const data=Buffer.from(JSON.stringify(snapshot));
  if(data.length>MAX_BACKUP_BYTES)throw Error('O acervo excede o limite de 64 MB deste backup. Use a exportação administrativa.');
  const content={...snapshot,exportedAt:undefined,items:[...snapshot.items].sort((a,b)=>String(a.id).localeCompare(String(b.id)))};
  return {bytes:gzipSync(data),hash:createHash('sha256').update(JSON.stringify(canonical(content))).digest('hex'),sha256:createHash('sha256').update(data).digest('hex')};
}
export function unpackBackup(bytes,expectedHash) {
  const data=gunzipSync(bytes,{maxOutputLength:MAX_BACKUP_BYTES});
  if(expectedHash&&createHash('sha256').update(data).digest('hex')!==expectedHash)throw Error('A integridade do backup não foi confirmada.');
  const snapshot=JSON.parse(data.toString('utf8'));
  if(snapshot?.format!=='salvoai'||snapshot.version!==1||!Array.isArray(snapshot.items))throw Error('Arquivo de backup inválido.');
  return snapshot;
}
function driveError(status,data) {
  const reason=data?.error?.errors?.[0]?.reason||data?.error;
  const error=Error(reason==='invalid_grant'?'Reconecte sua conta Google para retomar os backups.':reason==='storageQuotaExceeded'?'O Google Drive está sem espaço para uma nova cópia.':status===429?'O Drive limitou as solicitações. O backup será tentado novamente.':'Não foi possível concluir a operação no Google Drive.');
  error.code=reason==='invalid_grant'?'DRIVE_RECONNECT':'DRIVE_ERROR';return error;
}
export function createDriveClient(config,{request=fetch}={}) {
  async function json(url,options={}) {
    const response=await request(url,{...options,signal:AbortSignal.timeout(20000)});
    const data=response.status===204?{}:await response.json().catch(()=>({}));
    if(!response.ok)throw driveError(response.status,data);return {data,response};
  }
  async function token(body) {
    const {data}=await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...body,client_id:config.clientId,client_secret:config.clientSecret})});
    if(!data.access_token)throw Error('O Google não devolveu uma sessão válida.');return data;
  }
  const headers=access=>({Authorization:'Bearer '+access});
  async function metadata(access,id) {
    if(!/^[A-Za-z0-9_-]{10,200}$/.test(id))throw Error('Identificador de backup inválido.');
    return (await json('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,name,mimeType,size,md5Checksum,createdTime,appProperties,webViewLink',{headers:headers(access)})).data;
  }
  return {
    async exchange(code,verifier) {
      const data=await token({code,code_verifier:verifier,redirect_uri:config.redirectUri,grant_type:'authorization_code'});
      if(!String(data.scope||'').split(' ').includes(DRIVE_SCOPE)||!data.refresh_token)throw Error('Autorize o acesso aos arquivos do SALVOAI para permitir backups automáticos.');
      const user=(await json('https://openidconnect.googleapis.com/v1/userinfo',{headers:headers(data.access_token)})).data;
      if(!user.email||!user.email_verified)throw Error('Confirme sua conta Google antes de conectar.');
      return {...data,expires_at:Date.now()+Number(data.expires_in||3600)*1000,email:user.email};
    },
    async refresh(session) {const data=await token({refresh_token:session.refresh_token,grant_type:'refresh_token'});return {...session,...data,refresh_token:data.refresh_token||session.refresh_token,expires_at:Date.now()+Number(data.expires_in||3600)*1000};},
    async list(access,key,kind='backup') {
      const q="trashed=false and appProperties has { key='salvoaiKind' and value='"+kind+"' } and appProperties has { key='salvoaiOwner' and value='"+key+"' }";
      const url=new URL('https://www.googleapis.com/drive/v3/files');
      url.searchParams.set('q',q);url.searchParams.set('pageSize','100');url.searchParams.set('orderBy','createdTime desc');url.searchParams.set('fields','files(id,name,createdTime,size,mimeType,appProperties,webViewLink),nextPageToken');
      return (await json(url.href,{headers:headers(access)})).data.files||[];
    },
    async folder(access,key) {
      const existing=await this.list(access,key,'folder');if(existing.length)return existing[0].id;
      return (await json('https://www.googleapis.com/drive/v3/files?fields=id',{method:'POST',headers:{...headers(access),'Content-Type':'application/json'},body:JSON.stringify({name:'SALVOAI — Backups',mimeType:'application/vnd.google-apps.folder',appProperties:{salvoaiKind:'folder',salvoaiOwner:key}})})).data.id;
    },
    async upload(access,key,folder,snapshot) {
      const packed=packBackup(snapshot);
      const meta={name:'SALVOAI-'+snapshot.exportedAt.replace(/[:.]/g,'-')+'.json.gz',parents:[folder],mimeType:'application/gzip',appProperties:{salvoaiKind:'backup',salvoaiOwner:key,sha256:packed.sha256,itemCount:String(snapshot.items.length),format:'salvoai-v1'}};
      const {response}=await json('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',{method:'POST',headers:{...headers(access),'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':'application/gzip','X-Upload-Content-Length':String(packed.bytes.length)},body:JSON.stringify(meta)});
      const location=response.headers.get('location'),url=new URL(location);
      if(url.protocol!=='https:'||url.hostname!=='www.googleapis.com'||!url.pathname.startsWith('/upload/drive/'))throw Error('Destino de upload do Google inválido.');
      const uploaded=(await json(url.href,{method:'PUT',headers:{...headers(access),'Content-Type':'application/gzip','Content-Length':String(packed.bytes.length)},body:packed.bytes})).data;
      const confirmed=await metadata(access,uploaded.id);
      if(Number(confirmed.size)!==packed.bytes.length||confirmed.md5Checksum!==createHash('md5').update(packed.bytes).digest('hex'))throw Error('O Drive não confirmou a integridade da cópia.');
      return {fileId:uploaded.id,hash:packed.hash,date:snapshot.exportedAt};
    },
    metadata,
    async download(access,id,key) {
      const meta=await metadata(access,id);
      if(meta.appProperties?.salvoaiKind!=='backup'||meta.appProperties?.salvoaiOwner!==key||meta.mimeType!=='application/gzip')throw Error('Esse backup não pertence ao seu acervo.');
      if(Number(meta.size)>MAX_BACKUP_BYTES)throw Error('Arquivo de backup muito grande.');
      const response=await request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media',{headers:headers(access),signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw driveError(response.status,{});
      const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>MAX_BACKUP_BYTES)throw Error('Arquivo de backup muito grande.');chunks.push(Buffer.from(chunk));}
      return unpackBackup(Buffer.concat(chunks),meta.appProperties.sha256);
    }
  };
}
