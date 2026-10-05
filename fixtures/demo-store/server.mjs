import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
export function createDemoServer() {
 return createServer(async(req,res)=>{
  if(req.url?.startsWith('/api/tax')) {
   const country=new URL(req.url,'http://localhost').searchParams.get('country');
   const broken=country==='CA' && process.env.TRACECASE_DEMO_FIXED!=='1';
   res.writeHead(broken?500:200,{'content-type':'application/json'});
   res.end(JSON.stringify(broken?{error:'Tax service unavailable'}:{tax:8.5}));return;
  }
  if(req.url==='/' || req.url==='/checkout') {
   res.writeHead(200,{'content-type':'text/html'});res.end(await readFile(new URL('./index.html',import.meta.url)));return;
  }
  res.writeHead(404);res.end('Not found');
 });
}
if(process.argv[1] && import.meta.url===new URL(process.argv[1],'file:').href) {
 const port=Number(process.env.PORT||5173);
 createDemoServer().listen(port,'127.0.0.1',()=>console.log(`Demo checkout: http://127.0.0.1:${port}/checkout`));
}
