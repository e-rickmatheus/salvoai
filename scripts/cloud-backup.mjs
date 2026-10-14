import pg from 'pg';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { schema } from '../lib/postgres-store.js';

const tables={salvoai_items:['id','owner','canonical','data'],salvoai_collections:['owner','name'],salvoai_categories:['owner','path'],salvoai_category_icons:['owner','path','icon'],salvoai_preferences:['owner','key','value']};
export async function exportCloudSnapshot(client) {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const snapshot={format:'salvoai-cloud',version:1,exportedAt:new Date().toISOString(),tables:{}};
    for(const [name,columns] of Object.entries(tables))snapshot.tables[name]=(await client.query(`SELECT ${columns.join(',')} FROM ${name}`)).rows;
    await client.query('COMMIT');return snapshot;
  }catch(error){await client.query('ROLLBACK');throw error;}
}
export async function importCloudSnapshot(client,snapshot) {
  if(snapshot?.format!=='salvoai-cloud'||snapshot.version!==1)throw Error('Backup SALVOAI Cloud versão 1 esperado.');
  for(const [table,columns] of Object.entries(tables)) {
    if(!Array.isArray(snapshot.tables?.[table]))throw Error('Tabela ausente: '+table);
    for(const row of snapshot.tables[table])if(!row||columns.some(column=>row[column]===undefined))throw Error('Linha inválida em '+table);
  }
  await client.query('BEGIN');
  try {
    await client.query(schema);
    for(const table of Object.keys(tables)) {
      await client.query(`LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE`);
      if((await client.query(`SELECT 1 FROM ${table} LIMIT 1`)).rows.length)throw Error('O destino precisa estar vazio. Nenhum dado será sobrescrito.');
    }
    for(const [table,columns] of Object.entries(tables))for(const row of snapshot.tables[table])await client.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map((_,i)=>'$'+(i+1)).join(',')})`,columns.map(column=>column==='data'?JSON.stringify(row[column]):row[column]));
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
}
async function main() {
  const [mode,path]=process.argv.slice(2);
  if(!['export','import'].includes(mode)||!path)throw Error('Uso: node scripts/cloud-backup.mjs export|import caminho.json');
  if(!process.env.DATABASE_URL)throw Error('Defina DATABASE_URL no ambiente privado.');
  const client=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000});
  await client.connect();
  try {
    if(mode==='export') {const snapshot=await exportCloudSnapshot(client);await mkdir(dirname(resolve(path)),{recursive:true});await writeFile(path,JSON.stringify(snapshot,null,2),{flag:'wx'});console.log('Backup criado em '+resolve(path));}
    else {await importCloudSnapshot(client,JSON.parse(await readFile(path,'utf8')));console.log('Backup restaurado no banco configurado.');}
  }finally{await client.end();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Backup não concluído. Confira a conexão, o arquivo e se o destino está vazio.');process.exitCode=1;});
