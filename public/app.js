import { queryItems } from '/query.js';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={items:[],collections:[],categories:[],categoryIcons:{},iconBank:[],semanticResults:null,category:'',page:'library',view:'grid',q:'',platform:'',author:'',collection:'',tag:'',type:'',sort:'new',selected:null,quickDraft:'',draft:{collections:[],tags:[]}};
async function api(path,method='GET',body) {
  const response=await fetch('/api/'+path,{method,headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();if(response.status===401)location.replace('/login');if(!response.ok)throw Error(data.error || 'Não foi possível concluir a operação.');return data;
}
function message(text){$('#message').textContent=text;}
async function load(){const data=await api('library');state.items=data.items;state.collections=data.collections;state.categories=data.categories||[];state.categoryIcons=data.categoryIcons||{};state.iconBank=data.iconBank||[];$('#collection-names').innerHTML=data.collections.map(n=>`<option value="${esc(n)}"></option>`).join('');render();}
function filtered(){const items=queryItems(state.items,{...state,q:state.semanticResults?'':state.q});return state.semanticResults?[...items].filter(x=>state.semanticResults.some(r=>r.id===x.id)).sort((a,b)=>state.semanticResults.findIndex(r=>r.id===a.id)-state.semanticResults.findIndex(r=>r.id===b.id)):items;}
const icon=(name,cls='')=>`<img class="${cls}" src="/icons/${name}.svg" alt="">`;
const mobileNavLabels={library:'Salvos',later:'Depois',favorites:'Favoritos',collections:'Coleções',categories:'Categorias',chat:'Chat'};
document.querySelectorAll('.app-nav nav [data-page]').forEach(b=>{const label=b.textContent;const image=b.querySelector('img').outerHTML;b.setAttribute('aria-label',label);b.innerHTML=image+'<span class="nav-desktop-label">'+esc(label)+'</span><span class="nav-mobile-label" aria-hidden="true">'+mobileNavLabels[b.dataset.page]+'</span>';});
$('.sidebar-bottom>button').setAttribute('aria-label','Ajustes e IA local');
const filterKeys=['platform','author','collection','tag','type','category'];
const option=(value,label=value)=>`<option value="${esc(value)}">${esc(label)}</option>`;


function renderSidebar(){
  $('#category-names').innerHTML=state.categories.map(n=>option(n)).join('');
  $('#quick-collections').hidden=!state.collections.length||!['library','inbox','favorites','later'].includes(state.page);
  $('#sidebar-collections').innerHTML=state.collections.map(n=>`<button data-quick-collection="${esc(n)}" aria-pressed="${state.collection===n}">${icon('folders')}<span>${esc(n)}</span><small>${state.items.filter(x=>x.collections.includes(n)).length}</small></button>`).join('');
  const tagCounts=new Map();
  for(const item of state.items)for(const tag of item.tags)tagCounts.set(tag,(tagCounts.get(tag)||0)+1);
  const topics=[...tagCounts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR')).slice(0,8);
  $('#quick-tags').hidden=!topics.length||!['library','inbox','favorites'].includes(state.page);
  $('#quick-tags').innerHTML='<span class="topic-label">ETIQUETAS</span><div>'+topics.map(([tag,count])=>`<button data-topic="${esc(tag)}" aria-pressed="${state.tag===tag}">${esc(tag)}<small>${count}</small></button>`).join('')+'</div>';
  document.querySelectorAll('[data-topic]').forEach(b=>b.onclick=()=>{state.tag=state.tag===b.dataset.topic?'':b.dataset.topic;renderActiveFilters();renderItems();});
  document.querySelectorAll('[data-quick-collection]').forEach(b=>b.onclick=()=>{state.page='library';filterKeys.forEach(k=>state[k]='');state.q='';state.collection=b.dataset.quickCollection;render();$('#search')?.focus();});
}
function render(){
  renderSidebar();
  const actionLabel=state.page==='categories'?'Nova categoria':'Salvar links';
  $('#add').innerHTML=icon('plus')+'<span class="action-desktop">'+actionLabel+'</span><span class="action-mobile" aria-hidden="true">'+(state.page==='categories'?'Nova':'Salvar')+'</span>';
  $('#add').setAttribute('aria-label',actionLabel);$('#add').title=actionLabel+' (Ctrl+Enter)';
  $('#add').hidden=!state.items.length&&state.page==='library';
  const titles={library:'Salvos',inbox:'Entrada',favorites:'Favoritos',later:'Ver depois',collections:'Coleções',categories:'Categorias',settings:'Ajustes',chat:'Pergunte ao acervo'};
  const subtitles={library:'Seu acervo, sempre ao seu alcance.',inbox:'Guarde agora. Organize no seu tempo.',favorites:'O que você quer ter sempre por perto.',collections:'Organize suas ideias do seu jeito.',categories:'Encontre por tema. Crie categorias e subcategorias do seu jeito.',settings:'Seus dados, sob seu controle.'};
  $('.section-kicker').textContent='SALVOAI / ACERVO PESSOAL';
  $('#page-title').textContent=state.category&&state.page==='library'?state.category.split('/').join(' / '):titles[state.page];$('#subtitle').textContent=subtitles[state.page]||'Encontre conexões entre seus conteúdos.';
  document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===state.page);if(b.dataset.page===state.page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  if(state.page==='settings'){renderSettings();return;}if(state.page==='collections'){renderCollections();return;}if(state.page==='chat'){renderChat();return;}if(state.page==='categories'){renderCategories();return;}
  $('#content').innerHTML=`<div class="toolbar"><label class="search">${icon('search')}<input id="search" type="search" aria-label="Buscar no acervo" placeholder="Buscar no seu acervo…" value="${esc(state.q)}"></label><button id="semantic-search" class="filter-button" title="Buscar por significado com IA local">Por tema</button><button id="filters" class="filter-button" aria-haspopup="dialog">${icon('sliders-horizontal')}Filtros <span id="filter-count"></span></button><div class="segmented" role="group" aria-label="Visualização"><button data-view="grid" aria-pressed="${state.view==='grid'}">${icon('grid-2x2')}Cartões</button><button data-view="list" aria-pressed="${state.view==='list'}">${icon('list')}Lista</button><button data-view="groups" aria-pressed="${state.view==='groups'}" title="Agrupar pela primeira etiqueta de cada conteúdo">${icon('folders')}Por etiqueta</button></div><label class="sort"><select id="sort" aria-label="Ordenar">${option('new','Mais recentes')}${option('old','Mais antigos')}${option('title','Título: A–Z')}</select></label></div><div id="active-filters" class="active-filters"></div><div id="items"></div>`;
  $('#sort').value=state.sort;
  $('#search').oninput=e=>{state.q=e.target.value;state.semanticResults=null;renderItems();};
  $('#sort').onchange=e=>{state.sort=e.target.value;renderItems();};
  $('#semantic-search').hidden=!!state.cloud;
  $('#semantic-search').onclick=async()=>{const b=$('#semantic-search');b.disabled=true;message('Buscando por significado no computador…');try{const d=await api('search/semantic','POST',{query:state.q});state.semanticResults=d.results;renderItems();message('Resultados por significado, em ordem de relevância. As palavras exatas podem ser diferentes.');}catch(e){message(e.message);}finally{b.disabled=false;}};
  $('#filters').onclick=openFilters;
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(v=>v.setAttribute('aria-pressed',v.dataset.view===state.view));renderItems();});
  renderActiveFilters();renderItems();
}
function filterOptions(){
  const values=key=>[...new Set(state.items.map(x=>x[key]).filter(Boolean))].sort();
  return [['category','Categoria',state.categories],['platform','Origem',values('platform')],['author','Criador',values('author')],['collection','Coleção',state.collections],['tag','Etiqueta',[...new Set(state.items.flatMap(x=>x.tags))].sort()],['type','Tipo',values('type')]];
}
function renderActiveFilters(){
  if(state.page==='library')$('#page-title').textContent=state.category?state.category.split('/').join(' / '):'Salvos';
  document.querySelectorAll('[data-topic]').forEach(b=>b.setAttribute('aria-pressed',String(state.tag===b.dataset.topic)));
  document.querySelectorAll('[data-quick-collection]').forEach(b=>{const active=state.page==='library'&&b.dataset.quickCollection===state.collection;b.setAttribute('aria-pressed',String(active));});
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
  $('#items').innerHTML=`<p class="count" role="status">${items.length} ${items.length===1?'conteúdo':'conteúdos'}${items.length!==state.items.length?(items.length===1?' encontrado · ':' encontrados · ')+state.items.length+' no acervo':''}</p>`+(items.length?`<div class="${state.view}">${items.map(x=>{
    const tags=[...x.collections,...x.tags.map(t=>'#'+t)];
    return `<article class="card">${coverMarkup(x)}<div class="card-body"><p class="origin"><span>${platformIcon(x.platform)}${esc(x.platform)}</span><span>${esc(x.type)}</span></p><h2><button class="item-title" data-item="${x.id}">${esc(x.title)}</button></h2><p class="author">${esc(x.author||'Criador não informado')}</p>${x.description?`<p class="excerpt">${esc(x.description)}</p>`:''}<div class="tags">${tags.slice(0,3).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}${tags.length>3?`<button class="more-tags" data-item="${x.id}" aria-label="Ver todas as coleções e etiquetas de ${esc(x.title)}">+${tags.length-3}</button>`:''}</div></div><div class="card-foot"><time datetime="${esc(x.savedAt)}">${new Date(x.savedAt).toLocaleDateString('pt-BR')}</time><div class="card-controls"><button class="icon-button" data-later="${x.id}" aria-label="${x.watchLater?"Remover de":"Adicionar a"} Ver depois: ${esc(x.title)}" aria-pressed="${!!x.watchLater}">${icon("inbox")}</button><button class="star icon-button" data-star="${x.id}" aria-label="${x.favorite?'Remover dos':'Adicionar aos'} favoritos: ${esc(x.title)}" aria-pressed="${x.favorite}">${icon('star')}</button><a class="original" href="${esc(x.originalUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir original: ${esc(x.title)}">${icon('arrow-up-right')}</a></div></div></article>`;
  }).join('')}</div>`:(state.items.length?`<div class="empty">${icon('search','empty-icon')}<h2>Nenhum conteúdo nesta seleção</h2><p>Ajuste os filtros ou tente outra palavra.</p><button id="empty-reset">Limpar busca e filtros</button></div>`:`<div class="capture-welcome"><div class="welcome-copy"><span class="welcome-label">SEU PRIMEIRO LINK</span><h2>Um bom achado.<br>Um lugar para ficar.</h2><p>Vídeos, leituras e ideias que você não quer perder. Guarde agora e organize no seu tempo.</p><div class="welcome-benefits"><span>${icon('bookmark')}Seu acervo, sem cotas artificiais</span><span>${icon('search')}Busca nas suas notas e etiquetas</span><span>${icon('folders')}Coleções do seu jeito</span></div></div><form id="quick-save-form" class="capture-card"><div class="capture-card-title">${icon('plus')}<h3>O que você encontrou?</h3></div><label for="quick-links">Cole seus links</label><textarea id="quick-links" rows="4" required placeholder="https://um-site.com/uma-boa-ideia">${esc(state.quickDraft)}</textarea><p class="hint">Um link por linha. Os detalhes podem ficar para depois.</p><button class="primary" id="quick-save">Guardar no meu acervo ${icon('arrow-up-right')}</button><div id="quick-results" aria-live="polite"></div></form></div>`));

  if(state.view==='groups'&&items.length){
    const container=$('#items > .groups'),cards=[...container.children],groups=new Map();
    items.forEach((item,index)=>{const label=item.tags[0]||'Sem etiqueta';if(!groups.has(label))groups.set(label,[]);groups.get(label).push(cards[index]);});
    container.replaceChildren();
    const note=document.createElement('p');note.className='group-note';note.textContent='Cada grupo usa a primeira etiqueta do conteúdo. A organização pode ser ajustada no detalhe.';container.append(note);
    for(const [label,nodes] of groups){
      const section=document.createElement('section');section.className='topic-group';
      const heading=document.createElement('h2');heading.textContent=label;
      const count=document.createElement('span');count.textContent=nodes.length+' '+(nodes.length===1?'conteúdo':'conteúdos');heading.append(count);
      const grid=document.createElement('div');grid.className='grid';grid.append(...nodes);
      section.append(heading,grid);container.append(section);
    }
  }
  document.querySelectorAll('[data-later]').forEach(b=>b.onclick=async()=>{try{const x=state.items.find(x=>x.id===b.dataset.later);await api('items/'+x.id,'PATCH',{watchLater:!x.watchLater});await load();}catch(e){message(e.message);}});
  document.querySelectorAll('.cover img').forEach(img=>img.onerror=()=>{img.closest('.cover').classList.add('cover-unavailable');img.remove();});
  document.querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>detail(b.dataset.item));
  document.querySelectorAll('[data-star]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const x=state.items.find(x=>x.id===b.dataset.star);await api('items/'+x.id,'PATCH',{favorite:!x.favorite});await load();document.querySelector(`[data-star="${x.id}"]`)?.focus();}catch(e){message(e.message);b.disabled=false;}});
  if($('#empty-reset'))$('#empty-reset').onclick=()=>{filterKeys.forEach(k=>state[k]='');state.q='';state.semanticResults=null;render();$('#search').focus();};
  if($('#quick-links'))$('#quick-links').oninput=e=>state.quickDraft=e.target.value;
  if($('#quick-save-form'))$('#quick-save-form').onsubmit=async e=>{
    e.preventDefault();const input=$('#quick-links'),button=$('#quick-save');button.disabled=true;
    try {
      const links=input.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),data=await api('links','POST',{links});
      const saved=data.results.filter(r=>r.status==='saved').length;
      const failures=data.results.filter(r=>r.status==='invalid');
      if(saved){state.quickDraft='';await load();message(`${saved} ${saved===1?'conteúdo guardado':'conteúdos guardados'}.${failures.length?' Algumas linhas não foram salvas. Abra Salvar links para corrigi-las.':''}`);$('#links').value=failures.map(r=>r.url).join('\n');if(failures.length){openAdd();$('#batch-results').innerHTML=data.results.map(r=>`<p class="result ${r.status}">Linha ${r.line}: ${r.status==='saved'?'Salvo':r.status==='duplicate'?'Já está no acervo':esc(r.error)} — ${esc(r.url)}</p>`).join('');}}
      else{$('#quick-results').innerHTML=data.results.map(r=>`<p class="result ${r.status}">Linha ${r.line}: ${r.status==='duplicate'?'Já está no acervo':esc(r.error)} — ${esc(r.url)}</p>`).join('');}
    }catch(e){$('#quick-results').textContent=e.message;}finally{button.disabled=false;}
  };
}
function renderCollections(){
  $('#content').innerHTML=`<div class="grid collections-grid">${state.collections.map(n=>`<button class="panel collection" data-collection="${esc(n)}">${icon('folders','collection-icon')}<strong>${esc(n)}</strong><span>${state.items.filter(x=>x.collections.includes(n)).length} conteúdos</span></button>`).join('')}</div><section class="panel collection-create"><h2>Um espaço para cada ideia</h2><p>Crie coleções para seus projetos e interesses. Um conteúdo pode fazer parte de várias.</p><form id="collection-form"><input aria-label="Nome da nova coleção" id="collection-name" maxlength="100" placeholder="Nome da coleção" required><button class="primary">Criar coleção</button></form></section>`;
  $('#collection-form').onsubmit=async e=>{e.preventDefault();try{await api('collections','POST',{name:$('#collection-name').value});await load();}catch(e){message(e.message);}};
  document.querySelectorAll('[data-collection]').forEach(b=>b.onclick=()=>{state.page='library';state.collection=b.dataset.collection;render();});
}
function renderSettings(){
  if(state.cloud){renderCloudSettings();return;}
  $('#content').innerHTML=`<section class="panel"><h2>Exportar e fazer backup</h2><p>Baixe um JSON versionado com seus links, campos editados, coleções, etiquetas e anotações. Guarde uma cópia em outro dispositivo.</p><a class="export" href="/api/export" download>Exportar acervo em JSON</a></section><section class="panel"><h2>Restaurar ou importar</h2><p>A importação acrescenta os itens novos. Links já existentes são preservados, sem sobrescrever suas correções. Arquivos inválidos não alteram o acervo.</p><label>Arquivo SALVOAI JSON<input id="import-file" type="file" accept=".json,application/json"></label><button id="import" class="primary">Importar arquivo</button></section><section class="panel"><h2>Privacidade e processamento</h2><p>Este servidor funciona somente em localhost, sem login externo e sem rastreamento. O banco SQLite fica em data/salvoai.sqlite. Capas e textos extraídos ficam no acervo local quando disponíveis. Ollama e Whisper processam no computador; as fontes externas são consultadas para obter metadados e mídia pública. Vídeos usados na transcrição são temporários.</p><p>Acesso pela rede ou internet depende de autenticação e autorização reais. Para usar o layout móvel agora, use o modo responsivo do navegador.</p></section>`;
  $('#import').onclick=async()=>{const file=$('#import-file').files[0];if(!file){message('Selecione um arquivo JSON.');return;}if(file.size>16*1024*1024){message('Divida a importação em arquivos menores que 16 MB.');return;}const b=$('#import');b.disabled=true;try{const result=await api('import','POST',JSON.parse(await file.text()));await load();message(`Importação concluída: ${result.saved} novos itens e ${result.duplicates} duplicatas preservadas.`);}catch(e){message('Importação não realizada: '+e.message);}finally{b.disabled=false;}};
  $('#content').insertAdjacentHTML('afterbegin',`<section class="panel"><h2>IA local · Sem assinatura</h2><p id="ai-status" class="ai-status">Verificando o modelo…</p><p>Gemma 3 1B para resumo e sugestões; Qwen 2.5 3B para chat; Whisper para transcrição; RapidOCR para texto nas imagens. Os modelos precisam estar disponíveis no computador. Não há envio a APIs pagas.</p><pre class="ai-commands">powershell -ExecutionPolicy Bypass -File scripts/start-local-ai.ps1</pre><button id="refresh-ai">Verificar IA</button><button id="process-all">Processar acervo com IA</button><div id="job-status" class="ai-status"></div></section>`);
  const status=async()=>{try{const s=await api('ai/status');$('#ai-status').textContent=s.online?'Ollama conectado · '+s.model+(s.models.includes(s.model)?' disponível':' ainda não baixado'):'Ollama offline. Execute o comando acima na pasta do projeto.';}catch(e){$('#ai-status').textContent=e.message;}};
  $('#refresh-ai').onclick=status;status();
  $('#process-all').onclick=async()=>{for(const item of state.items)await api('items/'+item.id+'/process','POST',{mode:'full'});message('Acervo adicionado à fila local. Você pode continuar navegando.');pollJobs();};
}
function renderCloudSettings(){
  $('#content').innerHTML='<section class="panel"><h2>Seu acervo privado</h2><p>Você está usando a versão online. Seus salvos ficam em um banco persistente e são acessíveis apenas pela sua conta.</p><button id="logout">Sair da conta</button></section><section class="panel"><h2>Exportar e fazer backup</h2><p>Baixe seus links, anotações, coleções e categorias em JSON. O arquivo pode ser importado em outra instalação do SALVOAI.</p><a class="export" href="/api/export" download>Exportar acervo em JSON</a></section><section class="panel"><h2>Importar acervo</h2><p>Itens novos são acrescentados. Links já salvos mantêm suas edições. Use um arquivo JSON de até 4 MB por importação.</p><label>Arquivo SALVOAI JSON<input id="import-file" type="file" accept=".json,application/json"></label><button id="import" class="primary">Importar arquivo</button></section><section class="panel"><h2>Processamento no computador</h2><p>Chat, transcrição e busca por significado estão disponíveis na versão local. A versão online permite salvar, buscar por palavras, organizar, editar e enviar capas.</p></section>';
  $('#logout').onclick=async()=>{try{await api('auth/logout','POST',{});location.replace('/login');}catch(e){message(e.message);}};
  $('#import').onclick=async()=>{const file=$('#import-file').files[0];if(!file){message('Selecione um arquivo JSON.');return;}if(file.size>4*1024*1024){message('Divida a importação em arquivos de até 4 MB.');return;}const b=$('#import');b.disabled=true;try{const result=await api('import','POST',JSON.parse(await file.text()));await load();message(`Importação concluída: ${result.saved} novos itens e ${result.duplicates} duplicatas preservadas.`);}catch(e){message('Importação não realizada: '+e.message);}finally{b.disabled=false;}};
}
function openAdd(){$('#batch-results').replaceChildren();$('#add-dialog').showModal();$('#links').focus();}
$('#add').onclick=()=>state.page==='categories'?openCategoryDialog():openAdd();
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
  return {...Object.fromEntries(new FormData(form)),favorite:form.elements.favorite.checked,watchLater:form.elements.watchLater.checked,completed:form.elements.completed.checked,collections:state.draft.collections,tags:state.draft.tags};
}
let detailBaseline='';
function detail(id){
  state.selected=id;const x=state.items.find(x=>x.id===id),form=$('#detail-form');
  for(const k of ['originalUrl','title','platform','author','type','description','notes','coverUrl','category'])form.elements[k].value=x[k];
  for(const k of ['collections','tags']){state.draft[k]=[...x[k]];$('#'+k+'-entry').value='';renderPicker(k);}
  $('#tag-names').innerHTML=[...new Set(state.items.flatMap(x=>x.tags))].sort().map(n=>`<option value="${esc(n)}"></option>`).join('');
  form.elements.favorite.checked=x.favorite;form.elements.watchLater.checked=!!x.watchLater;form.elements.completed.checked=!!x.completed;$('#source').href=x.originalUrl;$('#detail-preview').innerHTML=coverMarkup(x).replace('<button','<div').replace('</button>','</div>');$('#category-names').innerHTML=state.categories.map(n=>option(n)).join('');renderReading(x);$('#detail-title').textContent=x.title;
  $('#stored').textContent=x.summary?'Processado por '+(x.aiModel||'IA local'):'Link salvo · Processamento disponível no computador';
  $('#detail-error').textContent='';form.querySelector('details').open=false;
  $('#edit-metadata').open=false;$('#cover-upload').value='';pendingCover='';
  detailBaseline=JSON.stringify(draftData());if(!$('#detail-dialog').open)$('#detail-dialog').showModal();
}
function requestCloseDetail(){
  const changed=JSON.stringify(draftData())!==detailBaseline||pendingCover||$('#collections-entry').value.trim()||$('#tags-entry').value.trim();
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
  const raw=draftData(),button=e.target.querySelector('button.primary');if(pendingCover)raw.coverData=pendingCover;button.disabled=true;
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
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state.page=b.dataset.page;message('');render();window.scrollTo(0,0);});
$('#content').textContent='Carregando seu acervo…';
async function start(){
  const runtime=await api('runtime');state.cloud=runtime.cloud;
  $('#process-item').hidden=state.cloud;
  document.querySelectorAll('[data-page="chat"]').forEach(b=>b.hidden=state.cloud);
  if(state.cloud){
    const settings=$('.sidebar-bottom>button');settings.setAttribute('aria-label','Ajustes da conta');settings.lastChild.textContent='Ajustes da conta';
    $('.local-badge').textContent='ONLINE / ACERVO PRIVADO';
    $('.workspace-footer>span').lastChild.textContent=' Acervo online · Conta protegida';
  }
  await load();
}
start().catch(e=>{$('#content').innerHTML='<div class="empty"><h2>Não foi possível carregar o acervo</h2><p>Tente novamente em alguns instantes.</p><button id="retry">Tentar novamente</button></div>';message(e.message);$('#retry').onclick=()=>start().catch(e=>message(e.message));});

$('#detail-form').elements.originalUrl.addEventListener('invalid',()=>{$('#detail-form details').open=true;});

document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!document.querySelector('dialog[open]')){
    e.preventDefault();openAdd();
  }
});

function coverMarkup(x){return '<button class="cover '+(x.hasCover?'':'cover-unavailable')+'" data-item="'+esc(x.id)+'" aria-label="Abrir '+esc(x.title)+'">'+(x.hasCover?'<img src="/api/items/'+x.id+'/cover" alt="Capa de '+esc(x.title)+'" loading="lazy">':'<span class="cover-status">'+icon('bookmark')+'Capa não disponível</span>')+categoryBadges(x)+(x.completed?'<span class="cover-done">Concluído</span>':'')+'</button>';}
let pendingCover='';
$('#cover-upload').onchange=async()=>{const f=$('#cover-upload').files[0];if(!f)return;if(f.size>(state.cloud?2000000:5000000)){$('#detail-error').textContent=state.cloud?'Use uma capa de até 2 MB.':'Use uma capa de até 5 MB.';return;}pendingCover=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(f);});$('#detail-error').textContent='Capa pronta. Salve as alterações para aplicar.';};
let editingCategory='';
function openCategoryDialog(path=''){if(typeof path!=='string')path='';editingCategory=path;$('#category-path').value=path;$('#category-path').readOnly=false;$('#category-title').textContent=path?'Editar categoria':'Nova categoria';$('#category-form .primary').textContent=path?'Salvar alterações':'Criar categoria';categoryIconSelection=state.categoryIcons[path]||'tag';$('#category-error').textContent='';$('#icon-search').value='';let remove=$('#delete-category');if(!remove){remove=document.createElement('button');remove.id='delete-category';remove.type='button';remove.className='danger';$('#category-form').append(remove);remove.onclick=async()=>{if(remove.dataset.confirm!=='yes'){remove.dataset.confirm='yes';remove.textContent='Confirmar exclusão';$('#category-error').textContent='Excluir esta categoria e suas subcategorias? Os salvos serão mantidos e movidos para a categoria superior, ou ficarão sem categoria.';return;}try{await api('categories','DELETE',{path:editingCategory});if(state.category===editingCategory||state.category.startsWith(editingCategory+'/'))state.category='';await load();$('#category-dialog').close();message('Categoria excluída. Seus conteúdos foram mantidos.');}catch(err){$('#category-error').textContent=err.message;}};}remove.hidden=!path;remove.dataset.confirm='';remove.textContent='Excluir categoria';renderIconBank('');$('#category-dialog').showModal();}
$('#category-form').onsubmit=async e=>{e.preventDefault();try{const path=$('#category-path').value;await api('categories',editingCategory?'PATCH':'POST',editingCategory?{path:editingCategory,nextPath:path,icon:categoryIconSelection}:{path,icon:categoryIconSelection});state.category='';await load();$('#category-dialog').close();}catch(err){$('#category-error').textContent=err.message;}};
$('#theme').value=localStorage.getItem('salvoai-theme')||'dark';
document.documentElement.dataset.theme=$('#theme').value;
$('#theme').onchange=e=>{document.documentElement.dataset.theme=e.target.value;localStorage.setItem('salvoai-theme',e.target.value);};
function markdown(x){return '# '+x.title+'\n\n'+x.originalUrl+'\n\nCategoria: '+(x.category||'Sem categoria')+'\n\n## Resumo\n'+(x.summary||'Não gerado')+'\n\n## Legenda\n'+(x.caption||x.description||'')+'\n\n## Transcrição\n'+(x.transcript||'Não disponível')+'\n\n## Texto visual\n'+(x.visualText||'Não disponível')+'\n\n## Notas\n'+x.notes;}
$('#copy-md').onclick=async()=>{try{await navigator.clipboard.writeText(markdown(state.items.find(x=>x.id===state.selected)));$('#detail-error').textContent='Markdown copiado.';}catch{$('#detail-error').textContent='O navegador não permitiu copiar. Use a exportação em Ajustes.';}};
function renderReading(x){
  const recipe=x.structured?.recipe;
  const tabs=[['summary','Resumo',x.summary||'Resumo ainda não gerado. Use Processar com IA local.'],['caption','Legenda',x.caption||x.description||'A fonte não disponibilizou uma legenda.'],['transcript','Transcrição',x.transcript||'Transcrição ainda não disponível. O processamento precisa de mídia pública acessível.'],['visual','Texto na tela',x.visualText||'Texto visual ainda não processado. O OCR lê a capa ou duas amostras do vídeo; não representa todos os frames.'],['recipe','Receita',recipe?recipe.name+'\n\nIngredientes\n'+recipe.ingredients.join('\n')+'\n\nModo de preparo\n'+recipe.instructions.join('\n'):'Não há receita estruturada extraída desta fonte.']];
  $('#reading').innerHTML='<div class="reading-tabs" role="tablist" aria-label="Conteúdo extraído">'+tabs.map(([key,label],i)=>`<button type="button" role="tab" id="readtab-${key}" data-reading="${key}" aria-controls="reading-panel" aria-selected="${i===0}" tabindex="${i===0?0:-1}">${label}</button>`).join('')+'</div><div id="reading-panel" class="reading-text" role="tabpanel"></div><p class="reading-note">'+esc((x.categorySource==='ai'?'Tema sugerido por IA. ':x.categorySource==='metadata'?'Tema detectado nos metadados. ':'')+(x.processingError||'Confira os resultados de IA com a fonte original.'))+'</p><p class="reading-note">Relacionados por etiquetas e categoria</p><div class="related"></div>';
  const select=key=>{document.querySelectorAll('[data-reading]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.reading===key));b.tabIndex=b.dataset.reading===key?0:-1;});$('#reading-panel').textContent=tabs.find(t=>t[0]===key)[2];$('#reading-panel').setAttribute('aria-labelledby','readtab-'+key);};select('summary');
  document.querySelectorAll('[data-reading]').forEach((b,i)=>{b.onclick=()=>select(b.dataset.reading);b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;const target=document.querySelectorAll('[data-reading]')[next];select(target.dataset.reading);target.focus();}};});
  const related=state.items.filter(y=>y.id!==x.id).map(y=>({y,score:y.tags.filter(t=>x.tags.includes(t)).length+(y.category&&y.category===x.category?1:0)})).filter(v=>v.score>0).sort((a,b)=>b.score-a.score).slice(0,5);
  $('#reading .related').innerHTML=related.map(({y})=>`<button type="button" data-related="${y.id}">${esc(y.title)}</button>`).join('');
  document.querySelectorAll('[data-related]').forEach(b=>b.onclick=()=>{if(JSON.stringify(draftData())!==detailBaseline||pendingCover){$('#detail-error').textContent='Salve suas alterações antes de abrir outro conteúdo.';return;}detail(b.dataset.related);});
}
$('#process-item').onclick=async()=>{try{await api('items/'+state.selected+'/process','POST',{mode:'full'});$('#detail-error').textContent='Adicionado à fila local. Pode continuar navegando.';pollJobs();}catch(e){$('#detail-error').textContent=e.message;}};
let jobsTimer;
async function pollJobs(){clearTimeout(jobsTimer);try{const jobs=await api('jobs');const active=jobs.filter(x=>['queued','running'].includes(x.status));const text=jobs.map(x=>(state.items.find(i=>i.id===x.id)?.title||'Conteúdo')+': '+x.stage).join('\n');if($('#job-status'))$('#job-status').textContent=text;if(active.length){message(active.length+' processamento(s) local(is) · '+active[0].stage);jobsTimer=setTimeout(pollJobs,4000);}else{await load();message('Processamento concluído. Consulte o detalhe para resultados e limitações.');if($('#detail-dialog').open){const x=state.items.find(i=>i.id===state.selected);if(x)renderReading(x);}}}catch(e){message(e.message);}}
function renderChat(){
  if(state.cloud){$('#content').innerHTML='<section class="panel"><h2>IA no computador</h2><p>Chat, transcrição e busca por significado estão disponíveis na versão local. A busca por palavras continua disponível no acervo online.</p></section>';return;}
  $('#content').innerHTML='<section class="panel chat-shell"><h2>Converse com o que você salvou</h2><p>Busque uma receita, compare conteúdos ou encontre uma ferramenta. A resposta usa os itens do seu acervo e indica as fontes.</p><form id="chat-form" class="chat-form"><label for="chat-question" class="sr-only">Pergunta ao acervo</label><textarea id="chat-question" rows="2" required maxlength="4000" placeholder="Quais receitas de brigadeiro de maracujá eu salvei?"></textarea><button id="chat-send" class="primary">Perguntar</button></form><div id="chat-answer" class="chat-response" role="status"></div><div id="chat-sources" class="related"></div><p class="reading-note">IA local. A busca seleciona fontes por significado quando o modelo de embeddings está disponível; usa palavras como alternativa. A resposta pode conter erros.</p></section>';
  $('#chat-form').onsubmit=async e=>{e.preventDefault();const button=$('#chat-send');button.disabled=true;$('#chat-answer').textContent='Consultando o modelo local…';try{const d=await api('chat','POST',{question:$('#chat-question').value});if(!$('#chat-answer'))return;$('#chat-answer').textContent=d.answer;$('#chat-sources').innerHTML=d.sources.map(s=>`<button data-chat-source="${s.id}">[${s.number}] ${esc(s.title)}</button>`).join('');document.querySelectorAll('[data-chat-source]').forEach(b=>b.onclick=()=>detail(b.dataset.chatSource));}catch(err){if($('#chat-answer'))$('#chat-answer').textContent='Não foi possível consultar a IA local: '+err.message;}finally{button.disabled=false;}};
}

let categoryIconSelection='tag';
function renderIconBank(q){const selected=categoryIconSelection;const matches=state.iconBank.filter(x=>(x.label+' '+x.name+' '+(x.group||'')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()));$('#icon-bank').innerHTML=matches.map(x=>'<label class="icon-option" title="'+esc(x.label)+'"><input class="sr-only" type="radio" name="category-icon" aria-label="'+esc(x.label)+'" value="'+x.name+'" '+(x.name===selected?'checked':'')+'>'+icon(x.name)+'</label>').join('')||'<p class="icon-empty">Nenhum ícone encontrado.</p>';}
$('#icon-search').oninput=e=>renderIconBank(e.target.value);$('#icon-bank').onchange=e=>{if(e.target.name==='category-icon')categoryIconSelection=e.target.value;};

api('jobs').then(jobs=>{if(jobs.some(x=>['queued','running'].includes(x.status)))pollJobs();}).catch(()=>{});

function platformIcon(platform){return icon(({Instagram:'brand-instagram',TikTok:'brand-tiktok',Facebook:'brand-facebook',YouTube:'brand-youtube'})[platform]||'globe','source-icon');}
function categoryBadges(x){const parts=x.category?x.category.split('/'):['Sem categoria'];const labels=parts.length>1?[parts[0],parts.slice(1).join(' / ')]:parts;return '<span class="cover-categories" aria-label="Categoria: '+esc(x.category||'Sem categoria')+'">'+labels.map((label,i)=>'<span class="cover-category-chip" title="'+esc(x.category||'Sem categoria')+'">'+esc(label)+'</span>').join('<span class="category-separator" aria-hidden="true">/</span>')+'</span>';}
function renderCategories(){
  $('#content').innerHTML='<div class="toolbar"><label class="search">'+icon('search')+'<input id="category-search" type="search" aria-label="Buscar categoria" placeholder="Buscar categorias e subcategorias…"></label></div><div id="category-cards" class="category-cards"></div>';
  const count=path=>state.items.filter(x=>x.category===path||x.category?.startsWith(path+'/')).length;
  let expanded='';
  const draw=q=>{const norm=v=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const roots=state.categories.filter(c=>!c.includes('/')).filter(parent=>state.categories.some(c=>(c===parent||c.startsWith(parent+'/'))&&norm(c).includes(norm(q))));
    $('#category-cards').innerHTML=roots.map((parent,index)=>{const children=state.categories.filter(c=>c.startsWith(parent+'/')&&(!q||norm(c).includes(norm(q))||norm(parent).includes(norm(q))));const open=expanded===parent||!!q&&children.length>0;return '<section class="category-panel'+(open?' is-expanded':'')+'"><div class="category-head"><button class="category-open" '+(children.length?'data-category-toggle="'+esc(parent)+'" aria-expanded="'+open+'" aria-controls="subcategories-'+index+'"':'data-category-open="'+esc(parent)+'"')+'>'+icon(state.categoryIcons[parent]||'tag')+'<span><strong>'+esc(parent)+'</strong><small>'+count(parent)+' conteúdos'+(children.length?' · '+children.length+' subcategorias':'')+'</small></span>'+(children.length?icon('chevron-down','category-chevron'):'')+'</button><button class="icon-button" data-category-icon="'+esc(parent)+'" aria-label="Editar categoria '+esc(parent)+'">'+icon('settings')+'</button></div>'+(children.length?'<div id="subcategories-'+index+'" class="subcategory-list" '+(open?'':'hidden')+'><div><button class="category-all" data-category-open="'+esc(parent)+'">Ver todos os conteúdos'+icon('arrow-up-right')+'</button></div>'+children.map(c=>'<div><button data-category-open="'+esc(c)+'">'+icon(state.categoryIcons[c]||state.categoryIcons[parent]||'tag')+'<span>'+esc(c.split('/').slice(1).join(' / '))+'</span><small>'+count(c)+'</small></button><button class="icon-button" data-category-icon="'+esc(c)+'" aria-label="Editar categoria '+esc(c)+'">'+icon('settings')+'</button></div>').join('')+'</div>':'')+'</section>';}).join('')||'<p class="count">Nenhuma categoria encontrada.</p>';
    document.querySelectorAll('[data-category-toggle]').forEach(b=>b.onclick=()=>{expanded=expanded===b.dataset.categoryToggle?'':b.dataset.categoryToggle;draw($('#category-search').value);document.querySelector('[data-category-toggle="'+CSS.escape(b.dataset.categoryToggle)+'"]')?.focus();});
    document.querySelectorAll('[data-category-open]').forEach(b=>b.onclick=()=>{state.page='library';filterKeys.forEach(k=>state[k]='');state.q='';state.semanticResults=null;state.category=b.dataset.categoryOpen;render();window.scrollTo(0,0);});
    document.querySelectorAll('[data-category-icon]').forEach(b=>b.onclick=()=>openCategoryDialog(b.dataset.categoryIcon));
  };draw('');$('#category-search').oninput=e=>draw(e.target.value);
}
