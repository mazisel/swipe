import { startWorker } from './worker.mjs';
import { createApp } from './app.mjs';
const port = Number(process.env.PORT || 3001);
const { app, db } = await createApp({
  databaseUrl: process.env.DATABASE_URL,
  dataDir: process.env.PGLITE_DIR || 'server/data/postgres',
  uploadDir: process.env.UPLOAD_DIR || 'server/data/uploads',
  demo: process.env.CHECKOUT_MODE === 'demo',
  seed: process.env.SEED_DEMO !== 'false',
  origins: (process.env.ALLOWED_ORIGINS || 'http://localhost:8081,http://127.0.0.1:8081').split(','),
});
const stopWorker = process.env.AI_WORKER === 'false' ? async () => {} : startWorker(db);
const server = app.listen(port, '0.0.0.0', (error) => {
  if (error) { console.error(`Swipe API could not listen on port ${port}: ${error.message}`); process.exitCode = 1; return; }
  console.log(`Swipe API: http://localhost:${port} — checkout: ${process.env.CHECKOUT_MODE === 'demo' ? 'DEMO (no payments)' : 'disabled'}`);
});
const stop = () => server.close(async () => { await stopWorker(); await db.close(); process.exit(0); });
process.on('SIGINT', stop); process.on('SIGTERM', stop);
