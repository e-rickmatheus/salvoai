import { readFileSync } from 'node:fs';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { validateItem } from './store.js';
import { iconBank, defaultCategories } from './categories.js';
import { approvedCategories } from './approved-categories.js';
import { postgresConfig } from './postgres-config.js';

export const schema = readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8');
let pool, initialized;
function names(values) {
  if (!Array.isArray(values) || values.some(v => typeof v !== 'string' || v.length > 100)) throw Error('Coleções e etiquetas devem conter nomes de até 100 caracteres.');
  return [...new Set(values.map(v => v.trim()).filter(Boolean))];
}

// A single client owns the transaction. The owner lock serializes concurrent
// edits, imports and category changes across serverless instances.
export async function withPostgresStore(callback, { connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL, owner } = {}) {
  if (!connectionString) throw Error('Configure DATABASE_URL na hospedagem.');
  if (!owner) throw Error('Usuário autenticado obrigatório.');
  if (!pool) {
    pool = new pg.Pool({...postgresConfig(connectionString),max:3,connectionTimeoutMillis:10000,idleTimeoutMillis:10000,allowExitOnIdle:true});
    pool.on('error', () => console.error('SALVOAI: conexão PostgreSQL interrompida.'));
  }
  if (!initialized) initialized = pool.query(schema).catch(error => {initialized = undefined;throw error;});
  await initialized;
  const client = await pool.connect();
  try {return await runStoreTransaction(client,callback,owner);}
  finally {client.release();}
}

export async function runStoreTransaction(client,callback,owner) {
  if(!owner)throw Error('Usuário autenticado obrigatório.');
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '20s'");
    await client.query("SET LOCAL lock_timeout = '15s'");
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['salvoai:'+owner]);
    const store = await createPostgresStore(client,owner);
    const result = await callback(store);
    // Errors reported by the HTTP handler must not commit partial changes.
    await client.query(result?.statusCode >= 400 ? 'ROLLBACK' : 'COMMIT');
    return result;
  } catch(error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

export async function createPostgresStore(client, owner) {
  const query = (sql,values=[]) => client.query(sql,values);
  const all = async () => (await query('SELECT id,data FROM salvoai_items WHERE owner=$1',[owner])).rows.map(r=>({...r.data,id:r.id}));
  const collections = async () => (await query('SELECT name FROM salvoai_collections WHERE owner=$1 ORDER BY name',[owner])).rows.map(r=>r.name);
  const categories = async () => (await query('SELECT path FROM salvoai_categories WHERE owner=$1 ORDER BY path',[owner])).rows.map(r=>r.path);
  const categoryIcons = async () => Object.fromEntries((await query('SELECT path,icon FROM salvoai_category_icons WHERE owner=$1',[owner])).rows.map(r=>[r.path,r.icon]));
  async function createCategory(path,icon) {
    if(typeof path!=='string'||path.length>300||path.split('/').some(v=>!v.trim()))throw Error('Use uma categoria e subcategorias com nomes válidos.');
    if(icon&&!iconBank.some(x=>x.name===icon))throw Error('Escolha um ícone do catálogo.');
    const parts=path.split('/').map(v=>v.trim());
    for(let i=1;i<=parts.length;i++)await query('INSERT INTO salvoai_categories VALUES ($1,$2) ON CONFLICT DO NOTHING',[owner,parts.slice(0,i).join('/')]);
    if(icon)await query('INSERT INTO salvoai_category_icons VALUES ($1,$2,$3) ON CONFLICT(owner,path) DO UPDATE SET icon=excluded.icon',[owner,parts.join('/'),icon]);
  }
  for(const [key,values] of [['categories-seeded',defaultCategories],['approved-categories-2026-10-12',approvedCategories]]) {
    if(!(await query('SELECT value FROM salvoai_preferences WHERE owner=$1 AND key=$2',[owner,key])).rowCount) {
      const paths=new Set(),iconPaths=[],icons=[];
      for(const [path,icon] of Object.entries(values)) {
        if(!iconBank.some(x=>x.name===icon))throw Error('Ícone inválido na categoria '+path);
        const parts=path.split('/');for(let i=1;i<=parts.length;i++)paths.add(parts.slice(0,i).join('/'));
        iconPaths.push(path);icons.push(icon);
      }
      await query('INSERT INTO salvoai_categories (owner,path) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING',[owner,[...paths]]);
      await query('INSERT INTO salvoai_category_icons (owner,path,icon) SELECT $1,seed.path,seed.icon FROM unnest($2::text[],$3::text[]) AS seed(path,icon) ON CONFLICT DO NOTHING',[owner,iconPaths,icons]);
      await query('INSERT INTO salvoai_preferences VALUES ($1,$2,$3)',[owner,key,'1']);
    }
  }
  async function createCollection(name) {
    const values=names([name]);if(!values.length)throw Error('Informe um nome.');
    await query('INSERT INTO salvoai_collections VALUES ($1,$2) ON CONFLICT DO NOTHING',[owner,values[0]]);
  }
  async function add(raw) {
    const item=validateItem(raw);
    const existing=(await query('SELECT id FROM salvoai_items WHERE owner=$1 AND canonical=$2',[owner,item.canonicalUrl])).rows[0];
    if(existing)return {status:'duplicate',id:existing.id,url:item.originalUrl};
    const id=randomUUID();
    await query('INSERT INTO salvoai_items VALUES ($1,$2,$3,$4)',[id,owner,item.canonicalUrl,JSON.stringify(item)]);
    for(const name of item.collections)await createCollection(name);
    return {status:'saved',id,url:item.originalUrl};
  }
  async function changeCategory(path,nextPath,icon) {
    const existing=await categories();if(!existing.includes(path))throw Error('Categoria não encontrada.');
    const affected=existing.filter(c=>c===path||c.startsWith(path+'/')), removing=nextPath===null;
    if(!removing) {
      if(typeof nextPath!=='string'||nextPath.length>300||nextPath.split('/').some(v=>!v.trim()))throw Error('Informe um caminho válido.');
      nextPath=nextPath.split('/').map(v=>v.trim()).join('/');
      if(nextPath.startsWith(path+'/'))throw Error('Não mova a categoria para dentro dela mesma.');
      if(icon&&!iconBank.some(x=>x.name===icon))throw Error('Escolha um ícone do catálogo.');
      for(const c of affected) {const destination=nextPath+c.slice(path.length);if(destination.length>300)throw Error('Um caminho de subcategoria ficou muito longo.');if(destination!==c&&existing.includes(destination))throw Error('Já existe uma categoria com esse caminho.');}
    }
    const parent=path.includes('/')?path.slice(0,path.lastIndexOf('/')):'',icons=await categoryIcons();
    for(const c of affected) {
      await query('DELETE FROM salvoai_categories WHERE owner=$1 AND path=$2',[owner,c]);
      await query('DELETE FROM salvoai_category_icons WHERE owner=$1 AND path=$2',[owner,c]);
    }
    if(!removing)for(const c of affected)await createCategory(nextPath+c.slice(path.length),c===path?icon||icons[c]:icons[c]);
    for(const item of await all())if(item.category===path||item.category?.startsWith(path+'/')) {
      item.category=removing?parent:nextPath+item.category.slice(path.length);item.categorySource='manual';
      await query('UPDATE salvoai_items SET data=$1 WHERE owner=$2 AND id=$3',[JSON.stringify(item),owner,item.id]);
    }
  }
  return {
    all,collections,categories,categoryIcons,createCategory,createCollection,
    renameCategory:changeCategory,removeCategory:path=>changeCategory(path,null),
    async batch(lines) {
      const results=[];
      for(const [index,line] of lines.entries()) {
        // Validate before SQL so a rejected line cannot abort the transaction.
        try {validateItem({originalUrl:line});}catch(error){results.push({status:'invalid',line:index+1,url:line,error:error.message});continue;}
        results.push({...await add({originalUrl:line}),line:index+1});
      }
      return results;
    },
    async update(id,raw) {
      const old=(await all()).find(x=>x.id===id);if(!old)throw Error('Item não encontrado.');
      if(raw.category!==undefined&&raw.categorySource===undefined)raw={...raw,categorySource:'manual'};
      if(raw.originalUrl&&raw.originalUrl!==old.originalUrl)raw={...raw,coverData:'',coverUrl:'',summary:'',caption:'',transcript:'',visualText:'',extractedText:'',processingError:'',structured:{},aiModel:'',processing:{status:'not_configured'}};
      else if(raw.coverUrl!==undefined&&raw.coverUrl!==old.coverUrl&&!raw.coverData)raw={...raw,coverData:''};
      const item=validateItem({...old,...raw,savedAt:old.savedAt});
      if((await query('SELECT id FROM salvoai_items WHERE owner=$1 AND canonical=$2 AND id<>$3',[owner,item.canonicalUrl,id])).rowCount)throw Error('Esta URL já está salva.');
      await query('UPDATE salvoai_items SET canonical=$1,data=$2 WHERE owner=$3 AND id=$4',[item.canonicalUrl,JSON.stringify(item),owner,id]);
      for(const name of item.collections)await createCollection(name);
      if(item.category)await createCategory(item.category);
      return {...item,id};
    },
    async remove(id){await query('DELETE FROM salvoai_items WHERE owner=$1 AND id=$2',[owner,id]);},
    async export(){return {format:'salvoai',version:1,exportedAt:new Date().toISOString(),collections:await collections(),categories:await categories(),categoryIcons:await categoryIcons(),items:await all()};},
    async import(data) {
      if(data?.format!=='salvoai'||data.version!==1||!Array.isArray(data.items))throw Error('Formato SALVOAI versão 1 esperado.');
      const values=names(data.collections??[]),items=data.items.map(validateItem);
      for(const path of data.categories||[])await createCategory(path);
      for(const [path,icon] of Object.entries(data.categoryIcons||{}))await createCategory(path,icon);
      for(const name of values)await createCollection(name);
      const results=[];for(const item of items)results.push(await add(item));
      return {saved:results.filter(r=>r.status==='saved').length,duplicates:results.filter(r=>r.status==='duplicate').length};
    }
  };
}
