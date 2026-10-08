import { openDatabase } from './db.mjs';
const db=await openDatabase({dataDir:process.env.PGLITE_DIR || 'server/data/postgres'});
try {
  const metrics=await db.prepare(`SELECT algorithm,kind,COUNT(*) AS events,COUNT(DISTINCT product_id) AS products,COUNT(DISTINCT p.seller_id) AS sellers FROM feed_events e JOIN products p ON p.id=e.product_id WHERE e.created_at>now()-interval '7 days' GROUP BY algorithm,kind ORDER BY algorithm,kind`).all();
  const latency=await db.prepare('SELECT algorithm,SUM(requests) AS requests,SUM(total_ms)/NULLIF(SUM(requests),0) AS average_ms,MAX(max_ms) AS max_ms FROM feed_metrics GROUP BY algorithm').all();
  const budget=await db.prepare('SELECT month,spent_micros/1000000.0 AS spent_usd,reserved_micros/1000000.0 AS reserved_usd FROM ai_budgets ORDER BY month DESC LIMIT 3').all();
  const jobs=await db.prepare('SELECT status,COUNT(*) AS jobs FROM ai_jobs GROUP BY status').all();
  console.log(JSON.stringify({metrics,latency,budget,jobs},null,2));
} finally {await db.close();}
