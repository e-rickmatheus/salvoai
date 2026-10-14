export async function readJson(req, limit) {
  if(!req.headers['content-type']?.startsWith('application/json')){const error=Error('Envie JSON.');error.statusCode=415;throw error;}
  let raw;
  if(req.body!==undefined)raw=Buffer.isBuffer(req.body)?req.body:Buffer.from(typeof req.body==='string'?req.body:JSON.stringify(req.body));
  else {
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>limit){const error=Error('Envie arquivos ou lotes menores.');error.statusCode=413;throw error;}chunks.push(chunk);}
    raw=Buffer.concat(chunks);
  }
  if(raw.length>limit){const error=Error('Envie arquivos ou lotes menores.');error.statusCode=413;throw error;}
  const data=JSON.parse(raw.toString()||'{}');
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Envie um objeto JSON.');
  return data;
}
