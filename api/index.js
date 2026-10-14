import { readFile } from 'node:fs/promises';
import { createHandler } from '../server.js';
import { withPostgresStore } from '../lib/postgres-store.js';
import { authenticate,authConfig,authRequest,sessionCookies,clearSessionCookies,readAuthBody } from '../lib/cloud-auth.js';

// Buffer the response until the database transaction commits, so a failed
// write cannot be reported to the browser as a successful save.
export function responseBuffer() {
  return {statusCode:200,headers:{},body:null,
    setHeader(name,value){this.headers[name]=value;},
    writeHead(status,headers={}){this.statusCode=status;Object.assign(this.headers,headers);},
    end(body){this.body=body;}
  };
}
export function requestOrigin(req,env=process.env) {
  const configured=env.SALVOAI_PUBLIC_URL||(env.VERCEL_PROJECT_PRODUCTION_URL?'https://'+env.VERCEL_PROJECT_PRODUCTION_URL:undefined);
  if(!configured)throw Error('Configure SALVOAI_PUBLIC_URL na hospedagem.');
  const url=new URL(configured);
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/')throw Error('O endereço público deve ser uma origem HTTPS.');
  if(req.headers.host!==url.host)return null;
  return url.origin;
}
export function createCloudHandler({env=process.env,authenticateRequest=authenticate,storeRunner=withPostgresStore}={}) {
return async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  try {
    const origin=requestOrigin(req,env);if(!origin)return json(403,{error:'Host não autorizado.'});
    if(req.headers.origin&&req.headers.origin!==origin)return json(403,{error:'Origem não autorizada.'});
    const path=new URL(req.url,origin).pathname;
    if(['/login','/auth/callback'].includes(path)&&req.method==='GET') {
      res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(await readFile(new URL('../public/login.html',import.meta.url)));return;
    }
    if(path==='/login.js'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(await readFile(new URL('../public/login.js',import.meta.url)));return;}
    if(path==='/login.css'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/css; charset=utf-8'});res.end(await readFile(new URL('../public/login.css',import.meta.url)));return;}
    if(path.startsWith('/api/auth/')) {
      if(req.method!=='POST')return json(405,{error:'Método inválido.'});
      if(req.headers.origin!==origin)return json(403,{error:'Origem não autorizada.'});
      const config=authConfig(env);
      if(path==='/api/auth/logout') {
        try {const session=await authenticateRequest(req,config);if(session?.token)await authRequest('logout?scope=local',{method:'POST',token:session.token,config});}
        finally {res.setHeader('Set-Cookie',clearSessionCookies());}
        return json(200,{ok:true});
      }
      const body=await readAuthBody(req);
      if(path==='/api/auth/session') {
        if(typeof body.access_token!=='string'||typeof body.refresh_token!=='string')return json(400,{error:'Sessão inválida.'});
        const user=await authRequest('user',{token:body.access_token,config});
        const refreshed=await authRequest('token?grant_type=refresh_token',{method:'POST',body:{refresh_token:body.refresh_token},config});
        if(refreshed.user?.id!==user.id)return json(401,{error:'Sessão inválida.'});
        res.setHeader('Set-Cookie',sessionCookies(refreshed));return json(200,{ok:true});
      }
      if(!['/api/auth/login','/api/auth/signup'].includes(path))return json(404,{error:'Recurso não encontrado.'});
      if(typeof body.email!=='string'||!body.email.includes('@')||body.email.length>254||typeof body.password!=='string'||body.password.length<8||body.password.length>256)return json(400,{error:'Informe seu e-mail e uma senha de pelo menos 8 caracteres.'});
      const signup=path.endsWith('/signup');
      const session=await authRequest(signup?'signup?redirect_to='+encodeURIComponent(origin+'/auth/callback'):'token?grant_type=password',{method:'POST',body:{email:body.email.trim(),password:body.password},config});
      if(session.access_token)res.setHeader('Set-Cookie',sessionCookies(session));
      return json(200,{ok:true,confirmationRequired:!session.access_token});
    }
    // Static application files contain no library data and need no DB connection.
    if(!path.startsWith('/api/')&&path!=='/')return await createHandler(null,{cloud:true,origin})(req,res);
    const session=await authenticateRequest(req,authConfig(env));
    if(!session?.user?.id) {
      if(path==='/'){res.writeHead(302,{Location:'/login'});res.end();return;}
      return json(401,{error:'Entre na sua conta para acessar o acervo.'});
    }
    if(session.cookies.length)res.setHeader('Set-Cookie',session.cookies);
    if(path==='/')return await createHandler(null,{cloud:true,origin})(req,res);
    const output=await storeRunner(async store=>{
      const buffer=responseBuffer();await createHandler(store,{cloud:true,origin})(req,buffer);
      if(buffer.body&&Buffer.byteLength(buffer.body)>4*1024*1024){buffer.writeHead(413,{'Content-Type':'application/json; charset=utf-8'});buffer.end(JSON.stringify({error:'O resultado excedeu o limite online de 4 MB. Exporte o banco pelo painel ou reduza o tamanho das capas.'}));}
      return buffer;
    },{owner:session.user.id,connectionString:env.DATABASE_URL||env.POSTGRES_URL});
    for(const [name,value] of Object.entries(output.headers))res.setHeader(name,value);
    res.writeHead(output.statusCode);res.end(output.body);
  } catch(error) {
    console.error('SALVOAI: falha na requisição',error.code||error.statusCode||error.name);
    if(error.statusCode===401&&req.url==='/'){res.setHeader('Set-Cookie',clearSessionCookies());res.writeHead(302,{Location:'/login'});res.end();return;}
    return json(error.statusCode||503,{error:error.statusCode?error.message:'O serviço ainda não está disponível. Verifique a configuração do banco e da autenticação.'});
  }
};
}
export default createCloudHandler();
