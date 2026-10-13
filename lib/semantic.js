import { createHash } from 'node:crypto';
import { ollama } from './local-ai.js';
const cache=new Map();
const cosine=(a,b)=>{let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]**2;bb+=b[i]**2;}return aa&&bb?dot/Math.sqrt(aa*bb):0;};
export async function semanticSearch(items,query){
  if(typeof query!=='string'||!query.trim()||query.length>4000)throw Error('Escreva o tema que deseja encontrar.');
  if(!items.length)return [];
  const documents=items.map(x=>[x.title,x.category,...x.tags,x.summary,x.caption,x.description,x.notes,(x.transcript||'').slice(0,5000),(x.extractedText||'').slice(0,2000)].join('\n'));
  const hashes=documents.map(t=>createHash('sha256').update(t).digest('hex'));
  const missing=hashes.map((key,i)=>({key,i})).filter(x=>!cache.has(x.key));
  if(missing.length){const r=await ollama('embed',{model:'embeddinggemma',input:missing.map(x=>documents[x.i]),truncate:true});missing.forEach((x,i)=>cache.set(x.key,r.embeddings[i]));}
  const r=await ollama('embed',{model:'embeddinggemma',input:query});
  const results=items.map((item,i)=>({id:item.id,score:cosine(r.embeddings[0],cache.get(hashes[i])||[])})).sort((a,b)=>b.score-a.score).slice(0,30);
  if(cache.size>10000)cache.clear();return results;
}
