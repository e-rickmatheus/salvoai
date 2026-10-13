import { queryItems } from '/query.js';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={items:[],collections:[],page:'library',view:'grid',q:'',platform:'',author:'',collection:'',tag:'',type:'',sort:'new',selected:null,draft:{collections:[],tags:[]}};
async function api(path,method='GET',body) {
  const response=await fetch('/api/'+path,{method,headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw Error(data.error || 'Não foi possível concluir a operação.');return data;
}
function message(text){$('#message').textContent=text;}
async function load(){const data=await api('library');state.items=data.items;state.collections=data.collections;$('#collection-names').innerHTML=data.collections.map(n=>`<option value="${esc(n)}"></option>`).join('');render();}
function filtered(){return queryItems(state.items,state);}
const icon=(name,cls='')=>`<img class="${cls}" src="/icons/${name}.svg" alt="">`;
const filterKeys=['platform','author','collection','tag','type'];
const option=(value,label=value)=>`<option value="${esc(value)}">${esc(label)}</option>`;

function render(){
  const titles={library:'Biblioteca',inbox:'Caixa de entrada',favorites:'Favoritos',collections:'Coleções',settings:'Configurações'};
  const subtitles={library:'Suas descobertas, em um só lugar.',inbox:'Guarde agora. Organize no seu tempo.',favorites:'O que você quer ter sempre por perto.',collections:'Organize suas ideias do seu jeito.',settings:'Seus dados, sob seu controle.'};
  $('#page-title').textContent=titles[state.page];$('#subtitle').textContent=subtitles[state.page];
  document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===state.page);if(b.dataset.page===state.page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  if(state.page==='settings'){renderSettings();return;}if(state.page==='collections'){renderCollections();return;}
  $('#content').innerHTML=`<div class="toolbar"><label class="search">${icon('search')}<input id="search" type="search" aria-label="Buscar no acervo" placeholder="Buscar no seu acervo…" value="${esc(state.q)}"></label><button id="filters" class="filter-button" aria-haspopup="dialog">${icon('sliders-horizontal')}Filtros <span id="filter-count"></span></button><div class="segmented" role="group" aria-label="Visualização"><button data-view="grid" aria-pressed="${state.view==='grid'}">${icon('grid-2x2')}Cartões</button><button data-view="list" aria-pressed="${state.view==='list'}">${icon('list')}Lista</button></div><label class="sort"><select id="sort" aria-label="Ordenar">${option('new','Mais recentes')}${option('old','Mais antigos')}${option('title','Título: A–Z')}</select></label></div><div id="active-filters" class="active-filters"></div><div id="items"></div>`;
  $('#sort').value=state.sort;
  $('#search').oninput=e=>{state.q=e.target.value;renderItems();};
  $('#sort').onchange=e=>{state.sort=e.target.value;renderItems();};
  $('#filters').onclick=openFilters;
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(v=>v.setAttribute('aria-pressed',v.dataset.view===state.view));renderItems();});
  renderActiveFilters();renderItems();
}
function filterOptions(){
  const values=key=>[...new Set(state.items.map(x=>x[key]).filter(Boolean))].sort();
  return [['platform','Origem',values('platform')],['author','Criador',values('author')],['collection','Coleção',state.collections],['tag','Etiqueta',[...new Set(state.items.flatMap(x=>x.tags))].sort()],['type','Tipo',values('type')]];
}
function renderActiveFilters(){
  const active=filterKeys.filter(k=>state[k]);
  $('#filter-count').textContent=active.length?active.length:'';
  $('#active-filters').innerHTML=active.map(k=>`<button class="filter-chip" data-remove-filter="${k}" aria-label="Remover filtro ${esc(state[k])}">${esc(state[k])}${icon('x')}</button>`).join('')+(active.length?'<button id="reset-active" class="text-button">Limpar filtros</button>':'');
  document.querySelectorAll('[data-remove-filter]').forEach(b=>b.onclick=()=>{state[b.dataset.removeFilter]='';renderActiveFilters();renderItems();$('#filters').focus();});
  if($('#reset-active'))$('#reset-active').onclick=()=>{filterKeys.forEach(k=>state[k]='');renderActiveFilters();renderItems();$('#filters').focus();};
}
function openFilters(){
  $('#filter-fields').innerHTML=filterOptions().map(([key,label,values])=>`<label>${label}<select data-filter="${key}" aria-label="${label}">${option('','Todos')}${values.map(v=>option(v)).join('')}</select></label>`).join('');
  document.querySelectorAll('[data-filter]').forEach(el=>{el.value=state[el.dataset.filter];el.onchange=()=>{state[el.dataset.filter]=el.value;renderActiveFilters();renderItems();};});
  $('#filter-dialog').showModal();
}
$('#clear-filters').onclick=()=>{filterKeys.forEach(k=>state[k]='');document.querySelectorAll('[data-filter]').forEach(el=>el.value='');renderActiveFilters();renderItems();};
$('#done-filters').onclick=()=>$('#filter-dialog').close();
function renderItems(){
  const items=filtered();
  $('#items').innerHTML=`<p class="count" role="status">${items.length} ${items.length===1?'conteúdo':'conteúdos'}${items.length!==state.items.length?' encontrados · '+state.items.length+' no acervo':''}</p>`+(items.length?`<div class="${state.view}">${items.map(x=>{
    const tags=[...x.collections,...x.tags.map(t=>'#'+t)];
    return `<article class="card"><div class="card-body"><p class="origin"><span>${esc(x.platform)}</span><span>${esc(x.type)}</span></p><h2><button class="item-title" data-item="${x.id}">${esc(x.title)}</button></h2><p class="author">${esc(x.author||'Criador não informado')}</p>${x.description?`<p class="excerpt">${esc(x.description)}</p>`:''}<div class="tags">${tags.slice(0,3).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}${tags.length>3?`<button class="more-tags" data-item="${x.id}" aria-label="Ver todas as coleções e etiquetas de ${esc(x.title)}">+${tags.length-3}</button>`:''}</div></div><div class="card-foot"><time datetime="${esc(x.savedAt)}">${new Date(x.savedAt).toLocaleDateString('pt-BR')}</time><div class="card-controls"><button class="star icon-button" data-star="${x.id}" aria-label="${x.favorite?'Remover dos':'Adicionar aos'} favoritos: ${esc(x.title)}" aria-pressed="${x.favorite}">${icon('star')}</button><a class="original" href="${esc(x.originalUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir original: ${esc(x.title)}">${icon('arrow-up-right')}</a></div></div></article>`;
  }).join('')}</div>`:`<div class="empty">${icon('bookmark','empty-icon')}<h2>${state.items.length?'Nada por aqui ainda':'Um lugar para suas descobertas'}</h2><p>${state.items.length?'Tente outra busca ou ajuste os filtros.':'Vídeos, artigos e ideias. Salve o primeiro link e comece seu acervo.'}</p><button class="primary" id="empty-add">${icon('plus')}Salvar links</button></div>`);
  document.querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>detail(b.dataset.item));
  document.querySelectorAll('[data-star]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const x=state.items.find(x=>x.id===b.dataset.star);await api('items/'+x.id,'PATCH',{favorite:!x.favorite});await load();document.querySelector(`[data-star="${x.id}"]`)?.focus();}catch(e){message(e.message);b.disabled=false;}});
  if($('#empty-add'))$('#empty-add').onclick=openAdd;
}
function renderCollections(){
  $('#content').innerHTML=`<section class="panel"><h2>Crie espaço para suas ideias</h2><p>Um item pode estar em várias coleções. A caixa de entrada reúne os itens sem coleção.</p><form id="collection-form"><input aria-label="Nome da nova coleção" id="collection-name" maxlength="100" placeholder="Ex.: Ideias de design" required><button class="primary">Criar coleção</button></form></section><div class="grid">${state.collections.map(n=>`<button class="panel collection" data-collection="${esc(n)}"><strong>${esc(n)}</strong><span>${state.items.filter(x=>x.collections.includes(n)).length} itens</span></button>`).join('')}</div>`;
  $('#collection-form').onsubmit=async e=>{e.preventDefault();try{await api('collections','POST',{name:$('#collection-name').value});await load();}catch(e){message(e.message);}};
  document.querySelectorAll('[data-collection]').forEach(b=>b.onclick=()=>{state.page='library';state.collection=b.dataset.collection;render();});
}
function renderSettings(){
  $('#content').innerHTML=`<section class="panel"><h2>Exportar e fazer backup</h2><p>Baixe um JSON versionado com seus links, campos editados, coleções, etiquetas e anotações. Guarde uma cópia em outro dispositivo.</p><a class="export" href="/api/export" download>Exportar acervo em JSON</a></section><section class="panel"><h2>Restaurar ou importar</h2><p>A importação acrescenta os itens novos. Links já existentes são preservados, sem sobrescrever suas correções. Arquivos inválidos não alteram o acervo.</p><label>Arquivo SALVOAI JSON<input id="import-file" type="file" accept=".json,application/json"></label><button id="import" class="primary">Importar arquivo</button></section><section class="panel"><h2>Privacidade e processamento</h2><p>Este servidor funciona somente em localhost, sem login externo e sem rastreamento. O banco SQLite fica em data/salvoai.sqlite. Nenhum vídeo, imagem, transcrição ou resumo está armazenado. Extração e IA ainda não estão configuradas.</p><p>Acesso pela rede ou internet depende de autenticação e autorização reais. Para usar o layout móvel agora, use o modo responsivo do navegador.</p></section>`;
  $('#import').onclick=async()=>{const file=$('#import-file').files[0];if(!file){message('Selecione um arquivo JSON.');return;}if(file.size>16*1024*1024){message('Divida a importação em arquivos menores que 16 MB.');return;}const b=$('#import');b.disabled=true;try{const result=await api('import','POST',JSON.parse(await file.text()));await load();message(`Importação concluída: ${result.saved} novos itens e ${result.duplicates} duplicatas preservadas.`);}catch(e){message('Importação não realizada: '+e.message);}finally{b.disabled=false;}};
}
function openAdd(){$('#batch-results').replaceChildren();$('#add-dialog').showModal();$('#links').focus();}
$('#add').onclick=openAdd;
document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#add-form').onsubmit=async e=>{e.preventDefault();const button=$('#save-links');button.disabled=true;try{const links=$('#links').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);const data=await api('links','POST',{links});$('#batch-results').innerHTML=data.results.map(r=>`<p class="result ${r.status}">Linha ${r.line}: ${r.status==='saved'?'Salvo ✓':r.status==='duplicate'?'Já está no acervo':esc(r.error)} — ${esc(r.url)}</p>`).join('');await load();$('#links').value=data.results.filter(r=>r.status==='invalid').map(r=>r.url).join('\n');}catch(e){$('#batch-results').textContent=e.message;}finally{button.disabled=false;}};

function renderPicker(key){
  const root=$('#'+key+'-picker');
  root.querySelector('.selected-chips').innerHTML=state.draft[key].map((name,i)=>`<button type="button" data-remove="${i}" aria-label="Remover ${key==='collections'?'coleção':'etiqueta'} ${esc(name)}">${esc(name)}${icon('x')}</button>`).join('');
  root.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{state.draft[key].splice(Number(b.dataset.remove),1);renderPicker(key);$('#'+key+'-entry').focus();});
}
function addPick(key){
  const input=$('#'+key+'-entry'),name=input.value.trim();
  if(name.length>100){$('#detail-error').textContent='Use um nome de até 100 caracteres.';return false;}
  if(name&&!state.draft[key].includes(name))state.draft[key].push(name);
  input.value='';renderPicker(key);return true;
}
for(const key of ['collections','tags']){
  document.querySelector(`[data-picker-add="${key}"]`).onclick=()=>{addPick(key);$('#'+key+'-entry').focus();};
  $('#'+key+'-entry').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addPick(key);}};
}
function draftData(){
  const form=$('#detail-form');
  return {...Object.fromEntries(new FormData(form)),favorite:form.elements.favorite.checked,collections:state.draft.collections,tags:state.draft.tags};
}
let detailBaseline='';
function detail(id){
  state.selected=id;const x=state.items.find(x=>x.id===id),form=$('#detail-form');
  for(const k of ['originalUrl','title','platform','author','type','description','notes'])form.elements[k].value=x[k];
  for(const k of ['collections','tags']){state.draft[k]=[...x[k]];$('#'+k+'-entry').value='';renderPicker(k);}
  $('#tag-names').innerHTML=[...new Set(state.items.flatMap(x=>x.tags))].sort().map(n=>`<option value="${esc(n)}"></option>`).join('');
  form.elements.favorite.checked=x.favorite;$('#source').href=x.originalUrl;
  $('#stored').textContent='Guardado como link, com suas edições e anotações.';
  $('#detail-error').textContent='';form.querySelector('details').open=false;
  detailBaseline=JSON.stringify(draftData());$('#detail-dialog').showModal();
}
function requestCloseDetail(){
  const changed=JSON.stringify(draftData())!==detailBaseline||$('#collections-entry').value.trim()||$('#tags-entry').value.trim();
  if(!changed){$('#detail-dialog').close();return;}
  $('#discard-title').textContent='Descartar alterações?';
  $('#discard-dialog p').textContent='Suas mudanças ainda não foram salvas. Você pode continuar editando antes de sair.';
  $('#discard-changes').textContent='Descartar alterações';$('#keep-editing').textContent='Continuar editando';
  confirmationAction=()=>$('#detail-dialog').close();
  $('#discard-dialog').showModal();
}
let confirmationAction=null;
$('#detail-dialog').addEventListener('cancel',e=>{e.preventDefault();requestCloseDetail();});
$('#detail-dialog .close').onclick=requestCloseDetail;
$('#keep-editing').onclick=()=>$('#discard-dialog').close();
$('#discard-changes').onclick=async()=>{
  const button=$('#discard-changes');button.disabled=true;
  try{await confirmationAction?.();$('#discard-dialog').close();}
  catch(e){$('#discard-dialog').close();$('#detail-error').textContent=e.message;}
  finally{button.disabled=false;}
};
$('#detail-form').onsubmit=async e=>{
  e.preventDefault();
  if(!addPick('collections')||!addPick('tags'))return;
  const raw=draftData(),button=e.target.querySelector('button.primary');button.disabled=true;
  try{await api('items/'+state.selected,'PATCH',raw);await load();$('#detail-dialog').close();message('Alterações salvas.');document.querySelector(`[data-item="${state.selected}"]`)?.focus();}
  catch(e){$('#detail-error').textContent=e.message;if(!e.target.elements.originalUrl.checkValidity()){e.target.querySelector('details').open=true;e.target.elements.originalUrl.reportValidity();}}
  finally{button.disabled=false;}
};
$('#delete').onclick=()=>{
  $('#discard-title').textContent='Excluir conteúdo?';
  $('#discard-dialog p').textContent='A exclusão é definitiva. Exporte um backup antes se precisar recuperar este item.';
  $('#discard-changes').textContent='Excluir item';$('#keep-editing').textContent='Manter item';
  confirmationAction=async()=>{await api('items/'+state.selected,'DELETE',{});await load();$('#detail-dialog').close();message('Item excluído.');};
  $('#discard-dialog').showModal();
};
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state.page=b.dataset.page;message('');render();});
$('#content').textContent='Carregando seu acervo…';
load().catch(e=>{$('#content').innerHTML='<div class="empty"><h2>Não foi possível carregar o acervo</h2><p>Verifique se o servidor local está ativo.</p><button id="retry">Tentar novamente</button></div>';message(e.message);$('#retry').onclick=()=>load().catch(e=>message(e.message));});

$('#detail-form').elements.originalUrl.addEventListener('invalid',()=>{$('#detail-form details').open=true;});
