import { createHash,timingSafeEqual } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { oauthState,verifyState,createDriveClient } from './google-drive.js';
import { readCookies } from './cloud-auth.js';
import { readJson } from './http-body.js';

const clearState='__Host-salvoai-drive-state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
export function validCron(req,env) {
  if(!env.CRON_SECRET||env.CRON_SECRET.length<16)return false;
  const a=createHash('sha256').update(req.headers.authorization||'').digest();
  const b=createHash('sha256').update('Bearer '+env.CRON_SECRET).digest();
  return timingSafeEqual(a,b);
}
export async function driveRoutes(req,res,{user,origin,service,sessionCookies=[]}) {
  const url=new URL(req.url,origin),path=url.pathname;
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  const redirect=path=>{res.writeHead(302,{Location:path});res.end();};
  if(req.method==='GET'&&path==='/api/drive/status'){json(200,await service.status(user.id));return true;}
  if(req.method==='GET'&&path==='/api/drive/list'){json(200,{backups:await service.list(user.id)});return true;}
  if(req.method==='GET'&&path==='/api/drive/callback') {
    res.setHeader('Set-Cookie',[...sessionCookies,clearState]);
    try {
      if(url.searchParams.get('error'))throw Error('Autorização cancelada.');
      const config=service.config(),state=verifyState(readCookies(req.headers.cookie)['__Host-salvoai-drive-state'],url.searchParams.get('state'),user.id,config);
      const code=url.searchParams.get('code');if(!code||code.length>4096)throw Error('Autorização inválida.');
      const session=await createDriveClient(config).exchange(code,state.verifier);
      await service.connect(user,session);await service.attempt(user.id,{force:true});
      redirect('/?drive=connected');
    }catch{redirect('/?drive=failed');}
    return true;
  }
  if(req.method==='GET'&&path==='/api/drive/download') {
    const snapshot=await service.read(user.id,url.searchParams.get('id')),bytes=gzipSync(Buffer.from(JSON.stringify(snapshot)));
    if(bytes.length>4*1024*1024){json(413,{error:'Baixe este backup diretamente pela pasta SALVOAI no Google Drive.'});return true;}
    res.writeHead(200,{'Content-Type':'application/gzip','Content-Disposition':'attachment; filename="salvoai-backup.json.gz"'});res.end(bytes);return true;
  }
  if(req.method!=='POST'){json(405,{error:'Método inválido.'});return true;}
  if(req.headers.origin!==origin){json(403,{error:'Origem não autorizada.'});return true;}
  const body=await readJson(req,16384);
  if(path==='/api/drive/connect') {
    const state=oauthState(user.id,service.config());res.setHeader('Set-Cookie',[...sessionCookies,state.cookie]);json(200,{url:state.url});return true;
  }
  if(path==='/api/drive/backup'){json(200,await service.attempt(user.id,{force:true}));return true;}
  if(path==='/api/drive/restore'){if(typeof body.id!=='string')throw Error('Escolha uma cópia do Drive.');json(200,await service.restore(user.id,body.id));return true;}
  if(path==='/api/drive/disconnect'){json(200,await service.disconnect(user.id));return true;}
  json(404,{error:'Recurso não encontrado.'});return true;
}
