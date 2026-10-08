import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';

// Keep the SQL Editor installer identical to the Express migration history.
const migrations = new URL('../server/migrations/', import.meta.url);
const files = (await readdir(migrations)).filter(name => /^\d+_[a-z_]+\.sql$/.test(name)).sort();
let sql = `-- Swipe: Supabase SQL Editor kurulumu
-- Kaynak: server/migrations/*.sql. Yenilemek için: node scripts/build-schema.mjs
-- Supabase proje sahibi/postgres rolüyle çalıştırın.
-- Şemayı kurar; yerel verileri veya medya dosyalarını aktarmaz.
-- swipe şemasını Data API exposed schemas listesine eklemeyin.
-- Uygulama mevcut Express giriş sistemiyle çalışır; Supabase Auth kullanmaz.
-- Migration geçmişi sayesinde tekrar çalıştırılabilir. Kayıtları silmez.

BEGIN;
SELECT pg_advisory_xact_lock(47291022);
CREATE SCHEMA IF NOT EXISTS swipe;
REVOKE ALL ON SCHEMA swipe FROM PUBLIC;
SET LOCAL search_path TO swipe, public, extensions;
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
for (const file of files) {
  const body = await readFile(new URL(file, migrations), 'utf8');
  sql += `
-- ${file}
DO $swipe_migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM swipe.schema_migrations WHERE version = '${file}') THEN
${body.trim().split('\n').map(line => `    ${line}`).join('\n')}
    INSERT INTO swipe.schema_migrations(version) VALUES ('${file}');
  END IF;
END
$swipe_migration$;
`;
}
sql += `
COMMIT;

-- Başarılı kurulumda uygulanmış migration listesini gösterir.
SELECT version, applied_at FROM swipe.schema_migrations ORDER BY version;
`;
await mkdir(new URL('../supabase/', import.meta.url), { recursive: true });
await writeFile(new URL('../supabase/setup.sql', import.meta.url), sql);
console.log(`supabase/setup.sql: ${files.length} migrations`);
