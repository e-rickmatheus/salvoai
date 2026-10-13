const norm=x=>String(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function queryItems(items,state) {
  return items.filter(x=>
    (state.page!=='inbox'||!x.collections.length)&&(state.page!=='favorites'||x.favorite)&&(state.page!=='later'||x.watchLater)&&
    (!state.q||norm([x.title,x.description,x.author,x.platform,x.originalUrl,...x.tags,x.notes,x.summary,x.transcript,x.visualText,x.caption,x.extractedText].join(' ')).includes(norm(state.q)))&&
    (!state.platform||x.platform===state.platform)&&(!state.author||x.author===state.author)&&(!state.collection||x.collections.includes(state.collection))&&(!state.tag||x.tags.includes(state.tag))&&(!state.type||x.type===state.type)&&(!state.category||x.category===state.category||x.category?.startsWith(state.category+'/'))
  ).sort((a,b)=>state.sort==='title'?a.title.localeCompare(b.title,'pt-BR'):state.sort==='old'?Date.parse(a.savedAt)-Date.parse(b.savedAt):Date.parse(b.savedAt)-Date.parse(a.savedAt));
}
