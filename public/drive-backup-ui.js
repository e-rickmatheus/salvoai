const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const date=value=>value?new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Ainda não há uma cópia confirmada';
export async function updateBackupNotice(api) {
  let notice=document.querySelector('#drive-backup-notice');
  if(!notice){notice=document.createElement('p');notice.id='drive-backup-notice';notice.setAttribute('role','status');document.querySelector('#message')?.before(notice);}
  try{const status=await api('drive/status');notice.hidden=!(status.connected&&(status.pending||status.lastError));notice.textContent=status.lastError||'Uma alteração está aguardando cópia no Google Drive. Consulte Ajustes para acompanhar.';}
  catch{notice.hidden=true;}
}
export async function mountDriveBackup({api,message,load}) {
  const panel=document.querySelector('#drive-backup-panel');if(!panel)return;
  panel.innerHTML='<h2>Backup automático no Google Drive</h2><p>Conecte sua conta uma vez. O SALVOAI copia links, notas, organização e capas após alterações e tenta novamente se houver uma falha.</p><p id="drive-status" role="status">Conferindo o backup…</p><div id="drive-actions"></div><div id="drive-history"></div>';
  const render=async()=>{
    try {
      const status=await api('drive/status');if(!document.querySelector('#drive-status'))return;
      const text=document.querySelector('#drive-status'),actions=document.querySelector('#drive-actions');
      if(!status.configured){text.textContent='A conexão com o Drive está sendo preparada. A exportação em JSON continua disponível abaixo.';actions.replaceChildren();return;}
      if(!status.connected){text.textContent='Conecte o Google Drive para ativar as cópias automáticas.';actions.innerHTML='<button id="connect-drive" class="primary">Conectar Google Drive</button>';bindConnect();return;}
      text.textContent='Conta: '+status.account+' · Última cópia verificada: '+date(status.lastSuccess)+(status.pending?' · Cópia pendente.':'')+(status.lastError?' · '+status.lastError:'');
      actions.innerHTML='<button id="backup-drive" class="primary">Fazer cópia agora</button><button id="list-drive">Ver cópias e restaurar</button>'+(status.folderUrl?'<p><a href="'+escape(status.folderUrl)+'" target="_blank" rel="noopener noreferrer">Abrir pasta de backups no Drive</a></p>':'')+(status.needsReconnect?'<button id="connect-drive">Reconectar Google Drive</button>':'')+'<button id="disconnect-drive">Desconectar</button><p>As cópias ficam privadas no seu Drive em arquivos JSON compactados. Você também pode baixá-las pela pasta. A restauração acrescenta os itens ausentes e preserva as edições atuais.</p>';
      if(document.querySelector('#connect-drive'))bindConnect();
      document.querySelector('#backup-drive').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{const result=await api('drive/backup','POST',{});message(result.status==='saved'?'Cópia verificada e salva no Google Drive.':result.error||'A cópia está sendo processada.');await render();await updateBackupNotice(api);}catch(error){message(error.message);}finally{button.disabled=false;}};
      document.querySelector('#list-drive').onclick=async()=>{try{const data=await api('drive/list');const list=document.querySelector('#drive-history');list.innerHTML='<h3>Cópias disponíveis</h3>'+(data.backups.length?'<ul>'+data.backups.map(backup=>'<li><p><strong>'+escape(date(backup.date))+'</strong> · '+backup.items+' conteúdos</p><button data-drive-restore="'+escape(backup.id)+'">Restaurar esta cópia</button> <a href="/api/drive/download?id='+encodeURIComponent(backup.id)+'" download>Baixar arquivo</a> · <a href="'+escape(backup.url)+'" target="_blank" rel="noopener noreferrer">Abrir no Drive</a></li>').join('')+'</ul>':'<p>Faça a primeira cópia para começar.</p>');
        for(const button of list.querySelectorAll('[data-drive-restore]'))button.onclick=async()=>{if(!confirm('Itens novos serão acrescentados ao seu acervo. As edições que já existem serão preservadas. Continuar?'))return;button.disabled=true;try{const result=await api('drive/restore','POST',{id:button.dataset.driveRestore});await load();message('Restauração concluída: '+result.saved+' itens recuperados e '+result.duplicates+' links já existentes preservados.');}catch(error){message(error.message);}finally{button.disabled=false;}};
      }catch(error){message(error.message);}};
      document.querySelector('#disconnect-drive').onclick=async()=>{try{await api('drive/disconnect','POST',{});await render();await updateBackupNotice(api);message('Drive desconectado. As cópias anteriores continuam na sua pasta.');}catch(error){message(error.message);}};
    }catch(error){const text=document.querySelector('#drive-status');if(text)text.textContent=error.message;}
  };
  function bindConnect(){document.querySelector('#connect-drive').onclick=async event=>{event.currentTarget.disabled=true;try{const result=await api('drive/connect','POST',{});location.assign(result.url);}catch(error){message(error.message);event.currentTarget.disabled=false;}};}
  await render();
}
export async function readBackupFile(file) {
  if(!file.name.toLowerCase().endsWith('.gz'))return JSON.parse(await file.text());
  if(typeof DecompressionStream==='undefined')throw Error('Use a restauração pelo Drive ou descompacte o arquivo JSON primeiro.');
  const stream=file.stream().pipeThrough(new DecompressionStream('gzip')),reader=stream.getReader(),chunks=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>4*1024*1024){await reader.cancel();throw Error('Use a restauração pelo Drive para backups maiores que 4 MB.');}chunks.push(value);}
  return JSON.parse(await new Blob(chunks).text());
}
