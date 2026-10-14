import { readFileSync } from 'node:fs';

// Driver SSL options must not be replaced by sslmode parameters in the URI.
// Supabase uses its own public root CA; other providers use system trust or
// an explicitly configured CA, preserving verification when migrating.
export function postgresConfig(connectionString,env=process.env) {
  const url=new URL(connectionString);
  if(!['postgres:','postgresql:'].includes(url.protocol))throw Error('Conexão PostgreSQL esperada.');
  const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(local)return {connectionString:url.href};
  const supabase=/(^|\.)supabase\.(co|com)$/.test(url.hostname);
  const ca=env.DATABASE_CA_PEM?.replaceAll('\\n','\n')||(supabase?readFileSync(new URL('../db/supabase-ca.crt',import.meta.url),'utf8'):undefined);
  for(const key of ['sslmode','sslrootcert','sslcert','sslkey','uselibpqcompat'])url.searchParams.delete(key);
  return {connectionString:url.href,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})}};
}
