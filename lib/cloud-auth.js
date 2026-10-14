import { readJson } from './http-body.js';
const accessCookie='__Host-salvoai-access', refreshCookie='__Host-salvoai-refresh';
export function authConfig(env=process.env) {
  const url=env.SUPABASE_URL,key=env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY;
  if(!url||!key)throw Error('Configure a autenticação Supabase na hospedagem.');
  if(new URL(url).protocol!=='https:')throw Error('Supabase deve usar HTTPS.');
  return {url:url.replace(/\/$/,''),key};
}
export async function authRequest(path, {method='GET',body,token,config=authConfig()}={}) {
  const response=await fetch(config.url+'/auth/v1/'+path,{method,headers:{apikey:config.key,...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
  if(response.status===204)return {};
  let data;try{data=await response.json();}catch{throw Error('O serviço de autenticação não respondeu.');}
  if(!response.ok) {
    const error=Error(response.status===429?'Muitas tentativas. Aguarde antes de tentar novamente.':response.status>=500?'O serviço de autenticação está temporariamente indisponível.':'Não foi possível autenticar. Confira os dados e a confirmação do e-mail.');
    error.statusCode=response.status>=500?503:response.status===429?429:401;throw error;
  }
  return data;
}
export function sessionCookies(session) {
  const cookie=(name,value,age)=>`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
  if(!session?.access_token||!session?.refresh_token)throw Error('Sessão inválida.');
  const lifetime=Number(session.expires_in);
  return [cookie(accessCookie,session.access_token,Number.isFinite(lifetime)&&lifetime>0?Math.min(Math.floor(lifetime),86400):3600),cookie(refreshCookie,session.refresh_token,2592000)];
}
export function clearSessionCookies(){return [accessCookie,refreshCookie].map(name=>`${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);}
export function readCookies(header='') {
  const result={};for(const part of header.split(';')){const i=part.indexOf('=');if(i>0)try{result[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1));}catch{}}
  return result;
}
export async function authenticate(req, config=authConfig()) {
  const cookies=readCookies(req.headers.cookie),access=cookies[accessCookie],refresh=cookies[refreshCookie];
  if(access)try{return {user:await authRequest('user',{token:access,config}),cookies:[],token:access};}catch(error){if(error.statusCode!==401)throw error;}
  if(refresh) {
    const session=await authRequest('token?grant_type=refresh_token',{method:'POST',body:{refresh_token:refresh},config});
    const user=await authRequest('user',{token:session.access_token,config});
    return {user,cookies:sessionCookies(session),token:session.access_token};
  }
  return null;
}
export async function readAuthBody(req) {
  return readJson(req,16384);
}
