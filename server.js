import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { openStore } from './lib/store.js';
import { createProcessor, aiStatus, chat } from './lib/local-ai.js';
import { semanticSearch } from './lib/semantic.js';
import { iconBank } from './lib/categories.js';

export function createApp(dbPath = process.env.SALVOAI_DB || 'data/salvoai.sqlite') {
  const store = openStore(dbPath);
  const processor = createProcessor(store);
  const server = http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Cache-Control','no-store');
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    try {
      // Impede DNS rebinding e operações originadas em outros sites. Não é autenticação.
      const host = req.headers.host || '';
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return json(403,{error:'Acesso disponível somente em localhost.'});
      if(req.headers.origin && req.headers.origin !== `http://${host}`) return json(403,{error:'Origem não autorizada.'});
      const url=new URL(req.url,`http://${host}`);
      if(url.pathname.startsWith('/api/')) {
        let body={};
        if(['POST','PATCH','DELETE'].includes(req.method)) {
          if(!req.headers['content-type']?.startsWith('application/json')) return json(415,{error:'Envie JSON.'});
          const chunks=[];let size=0;
          for await (const chunk of req) {size+=chunk.length; if(size>16*1024*1024) return json(413,{error:'Envie lotes menores que 16 MB.'}); chunks.push(chunk);}
          body=JSON.parse(Buffer.concat(chunks).toString() || '{}');
        }
        if(req.method==='GET'&&url.pathname==='/api/library') return json(200,{items:store.all().map(({coverData,...item})=>({...item,hasCover:!!coverData})),collections:store.collections(),categories:store.categories(),categoryIcons:store.categoryIcons(),iconBank});
        if(req.method==='GET'&&url.pathname==='/api/ai/status') return json(200,await aiStatus());
        if(req.method==='GET'&&url.pathname==='/api/jobs') return json(200,processor.jobs());
        if(req.method==='POST'&&url.pathname==='/api/chat') return json(200,await chat(store.all(),body.question,body.model));
        if(req.method==='POST'&&url.pathname==='/api/search/semantic')return json(200,{results:await semanticSearch(store.all(),body.query)});
        if(req.method==='POST'&&url.pathname==='/api/categories'){store.createCategory(body.path,body.icon);return json(200,{ok:true});}
        if(req.method==='PATCH'&&url.pathname==='/api/categories'){store.renameCategory(body.path,body.nextPath,body.icon);return json(200,{ok:true});}
        if(req.method==='DELETE'&&url.pathname==='/api/categories'){store.removeCategory(body.path);return json(200,{ok:true});}
        if(req.method==='POST'&&url.pathname==='/api/links') {
          if(!Array.isArray(body.links)||body.links.some(x=>typeof x!=='string')) throw Error('Lista de links inválida.');
          const results=store.batch(body.links);
          if(dbPath!==':memory:')for(const result of results)if(result.status==='saved')processor.enqueue(result.id,process.env.SALVOAI_AUTO_PROCESS==='0'?'preview':'full');
          return json(200,{results});
        }
        if(req.method==='POST'&&url.pathname==='/api/collections') {store.createCollection(body.name);return json(200,{ok:true});}
        if(req.method==='GET'&&url.pathname==='/api/export') {
          res.setHeader('Content-Disposition','attachment; filename="salvoai-backup.json"'); return json(200,store.export());
        }
        if(req.method==='POST'&&url.pathname==='/api/import') return json(200,store.import(body));
        const match=url.pathname.match(/^\/api\/items\/([a-z0-9-]+)$/);
        const processMatch=url.pathname.match(/^\/api\/items\/([a-z0-9-]+)\/process$/);
        if(processMatch&&req.method==='POST'){
          if(!store.all().some(x=>x.id===processMatch[1]))return json(404,{error:'Item não encontrado.'});
          if(!['preview','full','text'].includes(body.mode||'full'))throw Error('Modo inválido.');
          processor.enqueue(processMatch[1],body.mode||'full');return json(202,{ok:true});
        }
        const coverMatch=url.pathname.match(/^\/api\/items\/([a-z0-9-]+)\/cover$/);
        if(coverMatch&&req.method==='GET'){
          const item=store.all().find(x=>x.id===coverMatch[1]);if(!item?.coverData)return json(404,{error:'Capa indisponível.'});
          const [header,encoded]=item.coverData.split(',');res.writeHead(200,{'Content-Type':header.slice(5).split(';')[0]});res.end(Buffer.from(encoded,'base64'));return;
        }
        if(match&&req.method==='PATCH') return json(200,store.update(match[1],body));
        if(match&&req.method==='DELETE') {store.remove(match[1]);return json(200,{ok:true});}
        return json(404,{error:'Recurso não encontrado.'});
      }
      if(req.method!=='GET') return json(405,{error:'Método inválido.'});
      const iconMatch=url.pathname.match(/^\/icons\/([a-z0-9-]+)\.svg$/);
      if(iconMatch){
        try {const asset=await readFile(new URL('./public/icons/'+iconMatch[1]+'.svg',import.meta.url));res.writeHead(200,{'Content-Type':'image/svg+xml'});res.end(asset);}catch{return json(404,{error:'Ícone não encontrado.'});}
        return;
      }
      if(['/modelo-1','/modelo-1/','/modelo-2','/modelo-2/'].includes(url.pathname)){res.writeHead(302,{Location:'/'});return res.end();}
      const files={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/styles.css':['styles.css','text/css'],'/premium.css':['premium.css','text/css'],'/base.css':['base.css','text/css']};
      if(url.pathname==='/query.js') {res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(await readFile(new URL('./lib/query.js',import.meta.url)));return;}
      const file=files[url.pathname]; if(!file)return json(404,{error:'Página não encontrada.'});
      res.writeHead(200,{'Content-Type':file[1]+'; charset=utf-8'});
      let asset=await readFile(new URL('./public/'+file[0],import.meta.url));
      res.end(asset);
    } catch(e){json(400,{error:e.message});}
  });
  server.on('close',()=>store.close());
  return server;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT || 3210);
  const server=createApp();
  server.listen(port,'127.0.0.1',()=>console.log(`SALVOAI aberto em http://127.0.0.1:${port}`));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
