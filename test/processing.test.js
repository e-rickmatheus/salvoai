import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../lib/store.js';
import {queryItems} from '../lib/query.js';
import {parseMetadata, publicIPv4, publicFetch} from '../lib/metadata.js';
import {createProcessor} from '../lib/local-ai.js';
import {detectTheme} from '../lib/categories.js';
test('temas claros nos metadados priorizam Jogos sobre Produto e mantêm categorias conhecidas',()=>{
 assert.equal(detectTheme({title:'Dawn of Defiance: jogo survival cooperativo'}),'Jogos');assert.equal(detectTheme({title:'Receita de brigadeiro de maracujá'}),'Comida/Sobremesas');assert.equal(detectTheme({title:'Prompts para ChatGPT'}),'Inteligência Artificial/Prompts');assert.equal(detectTheme({title:'Um conteúdo sem tema declarado'}),'');
});
async function finish(processor,id){for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,10));const job=processor.jobs().find(x=>x.id===id);if(job&&!['queued','running'].includes(job.status))return job;}throw Error('Fila não concluiu.');}
test('pedido de IA durante prévia é enfileirado e correções manuais não são substituídas',async()=>{
 const store=openStore(':memory:');try{
  const {id}=store.batch(['https://example.com/game'])[0];let release;const gate=new Promise(r=>release=r);
  const processor=createProcessor(store,{metadata:async()=>{await gate;return {title:'Título automático',caption:'Um jogo cooperativo',structured:{}};},aiStatus:async()=>({online:true,models:[process.env.SALVOAI_MODEL||'gemma3:1b']}),ollama:async()=>({response:JSON.stringify({summary:'Texto derivado',category:'Produto',tags:['jogo']})})});
  processor.enqueue(id,'preview');await Promise.resolve();processor.enqueue(id,'text');store.update(id,{title:'Minha correção',category:'Jogos/RPG'});release();
  const result=await finish(processor,id);assert.equal(result.mode,'text');assert.equal(result.status,'done');const item=store.all()[0];assert.equal(item.summary,'Texto derivado');assert.equal(item.title,'Minha correção');assert.equal(item.category,'Jogos/RPG');assert.equal(item.categorySource,'manual');
 }finally{store.close();}
});
test('trocar URL durante coleta impede gravar resultados da fonte antiga',async()=>{
 const store=openStore(':memory:');try{
  const {id}=store.batch(['https://example.com/old'])[0];let release;const gate=new Promise(r=>release=r);
  const processor=createProcessor(store,{metadata:async()=>{await gate;return {caption:'Texto da fonte antiga'};}});
  processor.enqueue(id,'preview');await Promise.resolve();store.update(id,{originalUrl:'https://example.com/new'});release();
  assert.equal((await finish(processor,id)).status,'failed');assert.equal(store.all()[0].caption,'');
 }finally{store.close();}
});
test('categorias em níveis, busca nos textos derivados e restauração preservam a organização',()=>{
  const a=openStore(':memory:'),b=openStore(':memory:');try{
    const {id}=a.batch(['https://example.com/recipe'])[0];
    a.update(id,{category:'Comida/Sobremesas/Brigadeiros',summary:'Receita com limão',transcript:'mexer até soltar da panela',visualText:'leite condensado',watchLater:true,completed:true,processing:{status:'ready'},aiModel:'modelo-local'});
    a.createCategory('Jogos/RPG/Builds','swords');assert.equal(a.categoryIcons()['Jogos/RPG/Builds'],'swords');assert.throws(()=>a.createCategory('Jogos/Outro','../../bad'));
    const items=a.all();assert.ok(a.categories().includes('Comida/Sobremesas/Brigadeiros'));
    assert.equal(queryItems(items,{category:'Comida',page:'later',q:'limao'}).length,1);
    assert.equal(queryItems(items,{category:'Comida/Fitness'}).length,0);
    assert.equal(queryItems(items,{q:'soltar da panela'}).length,1);assert.equal(queryItems(items,{q:'condensado'}).length,1);
    b.import(a.export());assert.equal(b.all()[0].summary,items[0].summary);assert.equal(b.all()[0].completed,true);assert.equal(b.categoryIcons()['Jogos/RPG/Builds'],'swords');
    a.update(id,{notes:'nota nova'});assert.equal(a.all()[0].summary,'Receita com limão');
    a.update(id,{originalUrl:'https://example.com/other'});assert.equal(a.all()[0].summary,'');assert.equal(a.all()[0].aiModel,'');
  }finally{a.close();b.close();}
});
test('metadados extraem a receita publicada, sem inventar ingredientes e sem executar scripts',()=>{
  const html='<title>Receita</title><meta property="og:image" content="/cover.jpg"><meta content="Uma sobremesa &amp; chocolate" property="og:description"><script type="application/ld+json">'+JSON.stringify({'@graph':[{'@type':'Recipe',name:'Brigadeiro',recipeIngredient:['1 lata de leite'],recipeInstructions:[{'@type':'HowToStep',text:'Mexa.'}]}]})+'</script>';
  const out=parseMetadata(html,'https://example.com/recipe');assert.equal(out.coverUrl,'https://example.com/cover.jpg');assert.equal(out.caption,'Uma sobremesa & chocolate');assert.deepEqual(out.structured.recipe.ingredients,['1 lata de leite']);assert.deepEqual(out.structured.recipe.instructions,['Mexa.']);assert.equal(parseMetadata('<title>Link</title>','https://example.com').structured.recipe,undefined);
});
test('coleta remota bloqueia rede privada, credenciais e esquemas executáveis',async()=>{
  for(const ip of ['127.0.0.1','10.2.3.4','172.16.0.1','192.168.1.2','169.254.169.254','0.0.0.0','100.64.1.2','224.0.0.1'])assert.equal(publicIPv4(ip),false);
  assert.equal(publicIPv4('8.8.8.8'),true);
  for(const url of ['https://127.0.0.1/','https://localhost/','http://example.com','https://u:p@example.com','file:///etc/passwd'])await assert.rejects(publicFetch(url));
});
