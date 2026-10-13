import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib';
import { decodeHTML } from 'entities';

export function publicIPv4(address){
  const n=address.split('.').map(Number);if(n.length!==4||n.some(v=>!Number.isInteger(v)||v<0||v>255))return false;
  const [a,b]=n;return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0))||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19)));
}
export async function publicFetch(input, limit=5000000, redirects=0){
  const u=new URL(input);if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443'))throw Error('A fonte precisa ser HTTPS pública.');
  const addresses=await lookup(u.hostname,{all:true,family:4});
  if(!addresses.length||addresses.some(x=>!publicIPv4(x.address)))throw Error('Endereços locais e privados não são fontes permitidas.');
  const result=await new Promise((resolve,reject)=>{
    const request=https.get(u,{headers:{'User-Agent':'Mozilla/5.0 SALVOAI/0.2 (+local personal archive)','Accept-Encoding':'identity'},lookup:(_h,opts,cb)=>cb(null,opts.all?[{address:addresses[0].address,family:4}]:addresses[0].address,4)},response=>{
      const chunks=[];let length=0;
      response.on('data',chunk=>{length+=chunk.length;if(length>limit){request.destroy(Error('Conteúdo maior que o limite de processamento.'));return;}chunks.push(chunk);});
      response.on('error',reject);response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,bytes:Buffer.concat(chunks)}));
    });request.setTimeout(15000,()=>request.destroy(Error('A fonte demorou demais para responder.')));request.on('error',reject);
  });
  if([301,302,303,307,308].includes(result.status)){
    if(redirects>=4||!result.headers.location)throw Error('Redirecionamentos demais.');
    return publicFetch(new URL(result.headers.location,u).href,limit,redirects+1);
  }
  if(result.status!==200)throw Error('A fonte não liberou o conteúdo público (HTTP '+result.status+').');
  const encoding=result.headers['content-encoding'];
  if(encoding==='gzip')result.bytes=gunzipSync(result.bytes,{maxOutputLength:limit});
  if(encoding==='br')result.bytes=brotliDecompressSync(result.bytes,{maxOutputLength:limit});
  if(encoding==='deflate')result.bytes=inflateSync(result.bytes,{maxOutputLength:limit});
  return result;
}
export const clean=s=>decodeHTML(String(s||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
export function parseMetadata(html,base){
  const meta={};
  for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){
    const attrs={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs[m[1].toLowerCase()]=m[2]??m[3];
    if(attrs.property||attrs.name)meta[(attrs.property||attrs.name).toLowerCase()]=clean(attrs.content);
  }
  const found=[];function visit(v){if(!v||typeof v!=='object')return;if([].concat(v['@type']||[]).some(t=>String(t).endsWith('Recipe')))found.push(v);for(const child of Object.values(v))if(child&&typeof child==='object')for(const entry of [].concat(child))visit(entry);}
  for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{visit(JSON.parse(m[1]));}catch{}}
  const recipe=found[0];const steps=v=>[].concat(v||[]).flatMap(x=>typeof x==='string'?[clean(x)]:x.itemListElement?steps(x.itemListElement):[clean(x.text||x.name)]).filter(Boolean);
  const image=meta['og:image']||meta['twitter:image']||[].concat(recipe?.image||[]).map(v=>typeof v==='string'?v:v.url)[0];
  return {title:meta['og:title']||clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]),description:meta['og:description']||meta.description||'',coverUrl:image?new URL(image,base).href:'',caption:meta['og:description']||meta.description||'',extractedText:clean(html.replace(/<(script|style|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi,'')).slice(0,60000),structured:recipe?{recipe:{name:clean(recipe.name),ingredients:steps(recipe.recipeIngredient),instructions:steps(recipe.recipeInstructions)}}:{}};
}
export async function metadata(item){
  const u=new URL(item.originalUrl),host=u.hostname.replace(/^www\./,'');
  if(host==='youtube.com'||host==='youtu.be'){
    const r=await publicFetch('https://www.youtube.com/oembed?format=json&url='+encodeURIComponent(item.originalUrl));const d=JSON.parse(r.bytes.toString());
    return {title:d.title,author:d.author_name,coverUrl:d.thumbnail_url,type:'Vídeo',caption:'',extractedText:'',structured:{}};
  }
  if(host==='tiktok.com'){
    const r=await publicFetch('https://www.tiktok.com/oembed?url='+encodeURIComponent(item.originalUrl));const d=JSON.parse(r.bytes.toString());
    return {title:d.title,author:d.author_name,coverUrl:d.thumbnail_url,caption:d.title,extractedText:d.title,structured:{}};
  }
  const r=await publicFetch(item.originalUrl);if(!String(r.headers['content-type']).includes('text/html'))throw Error('A fonte não retornou uma página HTML.');
  const data=parseMetadata(r.bytes.toString(),item.originalUrl);
  if(host==='instagram.com'&&/og:video|"is_video":true/.test(r.bytes.toString()))data.type='Vídeo';
  return data;
}
export async function imageData(url){
  const r=await publicFetch(url);const b=r.bytes;
  const mime=b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':b[0]===255&&b[1]===216?'image/jpeg':b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'?'image/webp':null;
  if(!mime)throw Error('A fonte não retornou uma imagem PNG, JPEG ou WebP.');
  return 'data:'+mime+';base64,'+b.toString('base64');
}
