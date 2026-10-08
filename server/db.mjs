import { readFile, readdir, mkdir, open, unlink } from 'node:fs/promises';
import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';
import path from 'node:path';

pg.types.setTypeParser(20, Number);
const context = new AsyncLocalStorage();
const normalize = value => typeof value === 'bigint' ? Number(value) : value;

// All runtime SQL is PostgreSQL, including offline development and integration tests.
export async function openDatabase({ databaseUrl = process.env.DATABASE_URL, dataDir = 'server/data/postgres' } = {}) {
  let pool, local, lock;
  if (databaseUrl) {
    pool = new pg.Pool({ connectionString: databaseUrl, max: 8, connectionTimeoutMillis: 10000, query_timeout: 15000, options: '-c search_path=swipe,public,extensions', ...(process.env.DATABASE_CA_CERT ? { ssl: { ca: process.env.DATABASE_CA_CERT, rejectUnauthorized: true } } : {}) });
  } else {
    if (process.env.NODE_ENV === 'production') throw new Error('DATABASE_URL is required in production.');
    if (dataDir !== ':memory:') {
      await mkdir(dataDir, { recursive: true });
      lock = path.join(dataDir, '.swipe-process-lock');
      try {
        const existing = Number(await readFile(lock, 'utf8'));
        try { process.kill(existing, 0); throw new Error('PGlite is already open. Stop the local API before running migration or metrics commands.'); }
        catch (e) { if (e.code !== 'ESRCH') throw e; await unlink(lock); }
      } catch (e) { if (e.code !== 'ENOENT') throw e; }
      const file = await open(lock, 'wx'); await file.writeFile(String(process.pid)); await file.close();
    }
    const { PGlite } = await import('@electric-sql/pglite');
    const { vector } = await import('@electric-sql/pglite-pgvector');
    local = new PGlite({ ...(dataDir === ':memory:' ? {} : { dataDir }), extensions: { vector } });
    await local.waitReady;
  }
  const db = {
    mode: pool ? 'postgres' : 'pglite',
    async query(sql, params = []) {
      const active = context.getStore();
      const engine = active?.owner === db ? active.engine : pool || local;
      const result = await engine.query(sql, params);
      return { rows: result.rows.map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, normalize(v)]))), rowCount: result.rowCount ?? result.affectedRows ?? result.rows.length };
    },
    prepare(sql) {
      // Compatibility at the repository boundary only; never accept SQL from clients.
      let i = 0; sql = sql.replace(/\?/g, () => `$${++i}`);
      return {
        get: async (...args) => (await db.query(sql, args)).rows[0],
        all: async (...args) => (await db.query(sql, args)).rows,
        run: async (...args) => ({ changes: (await db.query(sql, args)).rowCount }),
      };
    },
    async exec(sql) {
      const active = context.getStore();
      const engine = active?.owner === db ? active.engine : pool || local;
      if (pool) await engine.query(sql); else await engine.exec(sql);
    },
    async transaction(fn) {
      if (context.getStore()?.owner === db) return fn(db);
      if (local) return local.transaction(tx => context.run({ owner: db, engine: tx }, () => fn(db)));
      const client = await pool.connect();
      try { await client.query('BEGIN'); const value = await context.run({ owner: db, engine: client }, () => fn(db)); await client.query('COMMIT'); return value; }
      catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    async close() { try { if (pool) await pool.end(); else await local.close(); } finally { if (lock) await unlink(lock).catch(() => {}); } },
  };
  try {
    await db.transaction(async () => {
      await db.exec('SELECT pg_advisory_xact_lock(47291022)');
      await db.exec('CREATE SCHEMA IF NOT EXISTS swipe; SET search_path TO swipe, public, extensions; CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());');
      for (const file of (await readdir(new URL('./migrations/', import.meta.url))).filter(f => f.endsWith('.sql')).sort()) {
        if (await db.prepare('SELECT version FROM schema_migrations WHERE version=?').get(file)) continue;
        await db.exec(await readFile(new URL(`./migrations/${file}`, import.meta.url), 'utf8'));
        await db.prepare('INSERT INTO schema_migrations(version) VALUES (?)').run(file);
      }
    });
    return db;
  } catch (error) { await db.close(); throw error; }
}
