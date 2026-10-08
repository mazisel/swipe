import { openDatabase } from './db.mjs';
import { runAnalysisJob } from './discovery/ai.mjs';
import { pruneDiscovery } from './discovery/feed.mjs';
export function startWorker(db,{interval=15000}={}) {
  let busy=false,stopped=false,ticks=0;
  async function tick() {
    if(busy || stopped)return;busy=true;
    try { if(ticks++%240===0)await pruneDiscovery(db); const result=await runAnalysisJob(db);if(!['idle','unconfigured'].includes(result.status))console.log(JSON.stringify({worker:'product-analysis',...result})); }
    catch(error){console.error('Discovery worker failed:',error.message);} finally {busy=false;}
  }
  const timer=setInterval(tick,interval);timer.unref();void tick();
  return async () => {stopped=true;clearInterval(timer);while(busy)await new Promise(r=>setTimeout(r,100));};
}
if(process.argv[1]?.endsWith('/server/worker.mjs')) {
  if(!process.env.DATABASE_URL)throw new Error('Standalone worker requires DATABASE_URL. Local PGlite shares the API process worker.');
  const db=await openDatabase();const stop=startWorker(db);
  process.on('SIGINT',async()=>{await stop();await db.close();process.exit(0);});
  process.on('SIGTERM',async()=>{await stop();await db.close();process.exit(0);});
  setInterval(()=>{},60000);
}
