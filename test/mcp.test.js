import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {openStore} from '../lib/store.js';
test('conector MCP oferece leitura do banco escolhido e não expõe ferramentas de escrita',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'salvoai-mcp-')),path=join(dir,'mcp.sqlite');const store=openStore(path);
 const {id}=store.batch(['https://example.com/test'])[0];store.update(id,{title:'Receita local',category:'Comida/Sobremesas',notes:'brigadeiro de limão'});store.close();
 const client=new Client({name:'qa',version:'1.0.0'});const transport=new StdioClientTransport({command:process.execPath,args:[resolve('scripts/mcp-server.js')],env:{...process.env,SALVOAI_DB:path},stderr:'pipe'});
 try{await client.connect(transport);const list=await client.listTools();assert.deepEqual(list.tools.map(x=>x.name).sort(),['list_folders','list_saved','read_saved','search_saved']);
 const result=await client.callTool({name:'search_saved',arguments:{query:'limao'}});assert.equal(JSON.parse(result.content[0].text)[0].id,id);
 }finally{await client.close();rmSync(dir,{recursive:true,force:true});}
});
