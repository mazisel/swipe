import { readFile } from 'node:fs/promises';
for (const name of ['DATABASE_URL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[name]) throw new Error(`${name} must be configured in the stack.`);
}
// This is the public Supabase CA, never a private key. Allow an explicit PEM override.
if (!process.env.DATABASE_CA_CERT) process.env.DATABASE_CA_CERT = await readFile(new URL('../server/certs/prod-ca-2021.crt', import.meta.url), 'utf8');
const url = new URL(process.env.DATABASE_URL);
// pg connection-string SSL options replace the explicit CA object. Use only
// the verified CA configured by db.mjs; never accept sslmode=no-verify/disable.
for (const key of ['ssl','sslmode','sslcert','sslkey','sslrootcert']) url.searchParams.delete(key);
process.env.DATABASE_URL = url.toString();
await import('../server/index.mjs');
