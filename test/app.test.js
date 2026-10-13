import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore,urlInfo } from '../lib/store.js';
import { queryItems } from '../lib/query.js';
import { createApp } from '../server.js';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test('URLs, duplicatas conservadoras e falha individual no lote',()=>{
  const store=openStore(':memory:');
  try{
    const results=store.batch(['https://EXAMPLE.com/video?id=1','https://example.com/video?id=1','https://example.com/video?id=2','javascript:alert(1)','não é link','https://user:pass@example.com']);
    assert.deepEqual(results.map(x=>x.status),['saved','duplicate','saved','invalid','invalid','invalid']);
    assert.equal(store.all()[0].originalUrl,'https://EXAMPLE.com/video?id=1');
    assert.equal(store.all()[0].processing.stored,'link');
    assert.notEqual(urlInfo('https://example.com/?x=1#t=2').canonicalUrl,urlInfo('https://example.com/?x=1#t=3').canonicalUrl);
    assert.equal(urlInfo('https://notinstagram.com').platform,'Site');
  }finally{store.close();}
});
test('persistência ao reabrir, edição, busca textual e filtros combinados',()=>{
  const dir=mkdtempSync(join(tmpdir(),'salvoai-test-'));const path=join(dir,'test.sqlite');let store=openStore(path);
  try{
    const {id}=store.batch(['https://example.com/1'])[0];
    store.update(id,{title:'Organização',description:'Uma biblioteca',platform:'Site',author:'Ana',notes:'Rever composição',collections:['Design','Estudos'],tags:['tipografia','referência'],favorite:true,type:'Artigo'});
    store.close();store=openStore(path);
    const items=store.all();assert.equal(items.length,1);assert.equal(items[0].notes,'Rever composição');assert.deepEqual(items[0].collections,['Design','Estudos']);
    for(const q of ['organizacao','biblioteca','tipografia','composicao'])assert.equal(queryItems(items,{q}).length,1);
    assert.equal(queryItems(items,{q:'referencia',platform:'Site',author:'Ana',collection:'Design',tag:'tipografia',type:'Artigo',page:'favorites'}).length,1);
    assert.equal(queryItems(items,{platform:'TikTok'}).length,0);assert.equal(queryItems(items,{page:'inbox'}).length,0);
  }finally{store.close();rmSync(dir,{recursive:true});}
});
test('exportação versionada e restauração idempotente; importação inválida é atômica',()=>{
  const a=openStore(':memory:'),b=openStore(':memory:');try{
    a.createCollection('Vazia');const {id}=a.batch(['https://example.com/1'])[0];a.update(id,{title:'Título manual',notes:'Minhas notas',collections:['A','B'],tags:['x']});
    const backup=a.export();assert.equal(backup.version,1);assert.deepEqual(b.import(backup),{saved:1,duplicates:0});
    assert.deepEqual(b.import(backup),{saved:0,duplicates:1});assert.equal(b.all()[0].notes,'Minhas notas');assert.ok(b.collections().includes('Vazia'));
    const bad={...backup,items:[{originalUrl:'https://example.com/2'},{originalUrl:'inválida'}]};assert.throws(()=>b.import(bad));assert.equal(b.all().length,1);
    b.update(b.all()[0].id,{title:'Correção posterior'});b.import(backup);assert.equal(b.all()[0].title,'Correção posterior');
  }finally{a.close();b.close();}
});
test('API completa e proteção de origem/host, exportação e conteúdo hostil',async()=>{
  const app=createApp(':memory:');await new Promise(r=>app.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.address().port}`;
  const call=(path,method='GET',body)=>fetch(base+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  try{
    assert.equal((await call('/')).status,200);assert.equal((await call('/query.js')).status,200);
    const icon=await call('/icons/search.svg');assert.equal(icon.status,200);assert.equal(icon.headers.get('content-type'),'image/svg+xml');
    assert.equal((await call('/icons/does-not-exist.svg')).status,404);
    assert.equal((await call('/icons/..%2fserver.svg')).status,404);
    for(const path of ['/modelo-1','/modelo-2']){const redirect=await fetch(base+path,{redirect:'manual'});assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),'/');}
    const html=await(await call('/')).text();assert.ok(html.includes('SALVOAI · Seu acervo pessoal'));assert.ok(!html.includes('model-switch'));
    assert.equal((await call('/base.css')).status,200);
    assert.equal((await call('/premium.css')).status,200);
    for(const asset of ['/modelo-1/app.js','/modelo-1/styles.css'])assert.equal((await call(asset)).status,404);
    const result=await(await call('/api/links','POST',{links:['https://example.com/item','inválida']})).json();const id=result.results[0].id;
    const edit=await call('/api/items/'+id,'PATCH',{title:'<img src=x onerror=alert(1)>',collections:['A'],tags:['b'],notes:'buscar aqui'});assert.equal(edit.status,200);
    const backup=await(await call('/api/export')).json();assert.equal(backup.items.length,1);
    assert.equal((await call('/api/import','POST',backup)).status,200);
    const hostStatus=await new Promise((resolve,reject)=>{const req=http.get(base+'/api/library',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});
    assert.equal(hostStatus,403);
    assert.equal((await fetch(base+'/api/links',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'})).status,403);
    assert.equal((await fetch(base+'/api/links',{method:'POST',body:'{}'})).status,415);
    assert.equal((await call('/api/items/'+id,'DELETE',{})).status,200);assert.equal((await(await call('/api/library')).json()).items.length,0);
  }finally{await new Promise(r=>app.close(r));}
});

test('snapshot histórico permanece arquivado sem alterações',()=>{
  const base=new URL('../public/models/modelo-1/',import.meta.url);
  const manifest=JSON.parse(readFileSync(new URL('snapshot.json',base),'utf8'));
  for(const [file,hash] of Object.entries(manifest.files))assert.equal(createHash('sha256').update(readFileSync(new URL(file,base))).digest('hex'),hash);
});

test('editar e excluir categorias preserva salvos, níveis e mudanças ao reabrir',()=>{
  const dir=mkdtempSync(join(tmpdir(),'salvoai-categories-'));const path=join(dir,'test.sqlite');let store=openStore(path);
  try{
    const {id}=store.batch(['https://example.com/game'])[0];store.update(id,{category:'Jogos/RPG/Builds',notes:'Preservar'});store.createCategory('Jogos/RPG/Builds','swords');
    store.renameCategory('Jogos/RPG','Jogos/Aventura','compass');assert.equal(store.all()[0].category,'Jogos/Aventura/Builds');assert.equal(store.categoryIcons()['Jogos/Aventura/Builds'],'swords');assert.equal(store.categoryIcons()['Jogos/Aventura'],'compass');
    assert.throws(()=>store.renameCategory('Jogos','Jogos/Aventura/Novo'));assert.throws(()=>store.renameCategory('Jogos/Aventura','Comida'));assert.equal(store.all()[0].category,'Jogos/Aventura/Builds');
    store.removeCategory('Jogos/Aventura');assert.equal(store.all()[0].category,'Jogos');assert.equal(store.all()[0].notes,'Preservar');assert.ok(!store.categories().includes('Jogos/Aventura/Builds'));
    store.removeCategory('Jogos');assert.equal(store.all()[0].category,'');store.removeCategory('Beleza/Skin Food');store.renameCategory('Casa e decoração/Dicas de Limpeza','Casa e decoração/Limpeza','sparkles');store.close();store=openStore(path);assert.ok(!store.categories().includes('Jogos'));assert.ok(!store.categories().includes('Beleza/Skin Food'));assert.ok(!store.categories().includes('Casa e decoração/Dicas de Limpeza'));assert.ok(store.categories().includes('Casa e decoração/Limpeza'));assert.equal(store.all().length,1);
  }finally{store.close();rmSync(dir,{recursive:true});}
});
