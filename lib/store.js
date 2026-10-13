import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { iconBank, defaultCategories } from './categories.js';
import { approvedCategories } from './approved-categories.js';

export function urlInfo(input) {
  if (typeof input !== 'string' || input.length > 8192) throw Error('URL inválida.');
  const originalUrl = input.trim();
  let u; try { u = new URL(originalUrl); } catch { throw Error('Informe uma URL completa com https:// ou http://.'); }
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || !u.hostname) throw Error('Somente links HTTP ou HTTPS, sem credenciais.');
  // Conservador: preserva query, sua ordem e fragmento; não remove identificadores.
  const canonicalUrl = u.href;
  const host = u.hostname.replace(/^www\./, '');
  const matches = domain => host === domain || host.endsWith('.' + domain);
  const platform = matches('instagram.com') ? 'Instagram' : matches('tiktok.com') ? 'TikTok' : matches('facebook.com') || matches('fb.watch') ? 'Facebook' : matches('youtube.com') || matches('youtu.be') ? 'YouTube' : matches('x.com')||matches('twitter.com')?'X':matches('linkedin.com')?'LinkedIn':matches('pinterest.com')?'Pinterest':'Site';
  const type=platform==='YouTube'||(platform==='Instagram'&&/^\/reels?\//.test(u.pathname))||(platform==='TikTok'&&u.pathname.includes('/video/'))?'Vídeo':platform==='TikTok'&&u.pathname.includes('/photo/')?'Imagem':'Link';
  return { originalUrl, canonicalUrl, platform, type, title: host + (u.pathname === '/' ? '' : u.pathname) };
}
const list = x => {
  if (!Array.isArray(x) || x.some(v => typeof v !== 'string' || v.length > 100)) throw Error('Coleções e etiquetas devem conter nomes de até 100 caracteres.');
  return [...new Set(x.map(v => v.trim()).filter(Boolean))];
};
export function validateItem(raw) {
  if (!raw || typeof raw !== 'object') throw Error('Item inválido.');
  const info = urlInfo(raw.originalUrl);
  const out = { ...info };
  for (const key of ['title','author','description','platform','notes','type','category','caption','extractedText','summary','transcript','visualText','processingError','coverUrl']) {
    const value = raw[key] ?? info[key] ?? '';
    if (typeof value !== 'string' || value.length > 100000) throw Error(`Campo ${key} inválido.`);
    out[key] = value;
  }
  if (!out.title.trim() || !out.platform.trim()) throw Error('Preencha título e plataforma.');
  if (!['Link','Vídeo','Artigo','Imagem','Outro'].includes(out.type)) throw Error('Tipo inválido.');
  out.collections = list(raw.collections ?? []); out.tags = list(raw.tags ?? []);
  out.favorite = raw.favorite === true;
  out.watchLater = raw.watchLater === true; out.completed = raw.completed === true;
  if(out.category.length>300)throw Error('Categoria muito longa.');
  out.categorySource=['ai','manual','metadata'].includes(raw.categorySource)?raw.categorySource:'';
  if(out.coverUrl && (new URL(out.coverUrl).protocol!=='https:' || new URL(out.coverUrl).username || new URL(out.coverUrl).password)) throw Error('A capa deve usar uma URL HTTPS pública.');
  out.coverData = raw.coverData ?? '';
  if(typeof out.coverData!=='string' || out.coverData.length>7000000 || (out.coverData && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(out.coverData))) throw Error('Capa inválida. Use PNG, JPEG ou WebP até 5 MB.');
  out.aiModel = typeof raw.aiModel==='string' ? raw.aiModel.slice(0,100) : '';
  out.savedAt = raw.savedAt ?? new Date().toISOString();
  if (typeof out.savedAt !== 'string' || !Number.isFinite(Date.parse(out.savedAt))) throw Error('Data inválida.');
  // Resultados derivados possuem esquema separado, sem aceitar instruções executáveis.
  out.processing = { status: ['ready','partial','failed'].includes(raw.processing?.status)?raw.processing.status:'not_configured', stored: 'link', summary: out.summary||null, transcript:out.transcript||null };
  out.automatic = {};
  const recipe=raw.structured?.recipe;
  out.structured = recipe ? {recipe:{name:String(recipe.name||'').slice(0,500),ingredients:list((recipe.ingredients||[]).map(v=>String(v).slice(0,100))),instructions:(recipe.instructions||[]).slice(0,200).map(v=>String(v).slice(0,3000))}} : {};
  return out;
}
export function openStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, owner TEXT NOT NULL, canonical TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(owner,canonical));
    CREATE TABLE IF NOT EXISTS collections (owner TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(owner,name));
    CREATE TABLE IF NOT EXISTS categories (owner TEXT NOT NULL, path TEXT NOT NULL, PRIMARY KEY(owner,path));
    CREATE TABLE IF NOT EXISTS category_icons (owner TEXT NOT NULL, path TEXT NOT NULL, icon TEXT NOT NULL, PRIMARY KEY(owner,path));
    CREATE TABLE IF NOT EXISTS preferences (owner TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(owner,key));
    PRAGMA user_version=1;`);
  const owner = 'local-owner';
  const all = () => db.prepare('SELECT id,data FROM items WHERE owner=?').all(owner).map(r => ({...JSON.parse(r.data),id:r.id}));
  const collections = () => db.prepare('SELECT name FROM collections WHERE owner=? ORDER BY name').all(owner).map(r=>r.name);
  const categories = () => db.prepare('SELECT path FROM categories WHERE owner=? ORDER BY path').all(owner).map(r=>r.path);
  function createCategory(path,icon){if(typeof path!=='string'||path.length>300||path.split('/').some(v=>!v.trim()))throw Error('Use uma categoria e subcategorias com nomes válidos.');if(icon&&!iconBank.some(x=>x.name===icon))throw Error('Escolha um ícone do catálogo.');const parts=path.split('/').map(v=>v.trim());for(let i=1;i<=parts.length;i++)db.prepare('INSERT OR IGNORE INTO categories VALUES (?,?)').run(owner,parts.slice(0,i).join('/'));if(icon)db.prepare('INSERT INTO category_icons VALUES (?,?,?) ON CONFLICT(owner,path) DO UPDATE SET icon=excluded.icon').run(owner,parts.join('/'),icon);}
  if(!db.prepare('SELECT value FROM preferences WHERE owner=? AND key=?').get(owner,'categories-seeded')){
    for(const [name,icon] of Object.entries(defaultCategories)){createCategory(name);db.prepare('INSERT OR IGNORE INTO category_icons VALUES (?,?,?)').run(owner,name,icon);}
    db.prepare('INSERT INTO preferences VALUES (?,?,?)').run(owner,'categories-seeded','1');
  }
  if(!db.prepare('SELECT value FROM preferences WHERE owner=? AND key=?').get(owner,'approved-categories-2026-10-12')){
    db.exec('BEGIN');try{
      for(const [name,icon] of Object.entries(approvedCategories)){
        if(!iconBank.some(x=>x.name===icon))throw Error('Ícone inválido na categoria '+name);
        createCategory(name);db.prepare('INSERT OR IGNORE INTO category_icons VALUES (?,?,?)').run(owner,name,icon);
      }
      db.prepare('INSERT INTO preferences VALUES (?,?,?)').run(owner,'approved-categories-2026-10-12','1');
      db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
  const categoryIcons=()=>Object.fromEntries(db.prepare('SELECT path,icon FROM category_icons WHERE owner=?').all(owner).map(x=>[x.path,x.icon]));
  function changeCategory(path,nextPath,icon){
    const existing=categories();if(!existing.includes(path))throw Error('Categoria não encontrada.');
    const affected=existing.filter(c=>c===path||c.startsWith(path+'/'));
    const removing=nextPath===null;
    if(!removing){
      if(typeof nextPath!=='string'||nextPath.length>300||nextPath.split('/').some(v=>!v.trim()))throw Error('Informe um caminho válido.');
      nextPath=nextPath.split('/').map(v=>v.trim()).join('/');
      if(nextPath.startsWith(path+'/'))throw Error('Não mova a categoria para dentro dela mesma.');
      if(icon&&!iconBank.some(x=>x.name===icon))throw Error('Escolha um ícone do catálogo.');
      for(const c of affected){const destination=nextPath+c.slice(path.length);if(destination.length>300)throw Error('Um caminho de subcategoria ficou muito longo.');if(destination!==c&&existing.includes(destination))throw Error('Já existe uma categoria com esse caminho.');}
    }
    const parent=path.includes('/')?path.slice(0,path.lastIndexOf('/')):'';
    const icons=categoryIcons();
    db.exec('BEGIN');try{
      for(const c of affected){db.prepare('DELETE FROM categories WHERE owner=? AND path=?').run(owner,c);db.prepare('DELETE FROM category_icons WHERE owner=? AND path=?').run(owner,c);}
      if(!removing)for(const c of affected)createCategory(nextPath+c.slice(path.length),c===path?icon||icons[c]:icons[c]);
      for(const item of all())if(item.category===path||item.category?.startsWith(path+'/')){
        item.category=removing?parent:nextPath+item.category.slice(path.length);item.categorySource='manual';
        db.prepare('UPDATE items SET data=? WHERE owner=? AND id=?').run(JSON.stringify(item),owner,item.id);
      }
      db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
  function add(raw) {
    const item = validateItem(raw);
    const existing = db.prepare('SELECT id FROM items WHERE owner=? AND canonical=?').get(owner,item.canonicalUrl);
    if (existing) return {status:'duplicate',id:existing.id,url:item.originalUrl};
    const id = randomUUID();
    db.prepare('INSERT INTO items VALUES (?,?,?,?)').run(id,owner,item.canonicalUrl,JSON.stringify(item));
    for (const name of item.collections) db.prepare('INSERT OR IGNORE INTO collections VALUES (?,?)').run(owner,name);
    return {status:'saved',id,url:item.originalUrl};
  }
  return {
    db, all, collections, categories, categoryIcons, createCategory,
    renameCategory(path,nextPath,icon){changeCategory(path,nextPath,icon);},
    removeCategory(path){changeCategory(path,null);},
    batch(lines) { return lines.map((line,index)=>{try{return {...add({originalUrl:line}),line:index+1}}catch(e){return {status:'invalid',line:index+1,url:line,error:e.message}}}); },
    update(id,raw) {
      const old = all().find(x=>x.id===id); if(!old) throw Error('Item não encontrado.');
      if(raw.category!==undefined&&raw.categorySource===undefined)raw={...raw,categorySource:'manual'};
      if(raw.originalUrl&&raw.originalUrl!==old.originalUrl)raw={...raw,coverData:'',coverUrl:'',summary:'',caption:'',transcript:'',visualText:'',extractedText:'',processingError:'',structured:{},aiModel:'',processing:{status:'not_configured'}};
      else if(raw.coverUrl!==undefined&&raw.coverUrl!==old.coverUrl&&!raw.coverData)raw={...raw,coverData:''};
      const item = validateItem({...old,...raw,savedAt:old.savedAt});
      const duplicate = db.prepare('SELECT id FROM items WHERE owner=? AND canonical=? AND id<>?').get(owner,item.canonicalUrl,id);
      if(duplicate) throw Error('Esta URL já está salva.');
      db.exec('BEGIN'); try {
        db.prepare('UPDATE items SET canonical=?,data=? WHERE owner=? AND id=?').run(item.canonicalUrl,JSON.stringify(item),owner,id);
        for(const name of item.collections) db.prepare('INSERT OR IGNORE INTO collections VALUES (?,?)').run(owner,name);
        if(item.category)createCategory(item.category);
        db.exec('COMMIT');
      } catch(e) {db.exec('ROLLBACK'); throw e;}
      return {...item,id};
    },
    remove(id) {db.prepare('DELETE FROM items WHERE owner=? AND id=?').run(owner,id);},
    createCollection(name) { const names=list([name]); if(!names.length) throw Error('Informe um nome.'); db.prepare('INSERT OR IGNORE INTO collections VALUES (?,?)').run(owner,names[0]); },
    export() {return {format:'salvoai',version:1,exportedAt:new Date().toISOString(),collections:collections(),categories:categories(),categoryIcons:categoryIcons(),items:all()};},
    import(data) {
      if(data?.format!=='salvoai'||data.version!==1||!Array.isArray(data.items)) throw Error('Formato SALVOAI versão 1 esperado.');
      const names=list(data.collections ?? []); const items=data.items.map(validateItem);
      db.exec('BEGIN'); try {
        for(const path of data.categories||[])createCategory(path);
        for(const [path,icon] of Object.entries(data.categoryIcons||{}))createCategory(path,icon);
        for(const name of names) db.prepare('INSERT OR IGNORE INTO collections VALUES (?,?)').run(owner,name);
        const results=items.map(add); db.exec('COMMIT');
        return {saved:results.filter(r=>r.status==='saved').length,duplicates:results.filter(r=>r.status==='duplicate').length};
      } catch(e) {db.exec('ROLLBACK');throw e;}
    },
    close(){db.close();}
  };
}
