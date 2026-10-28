const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=process.argv.includes('--final')?path.join(__dirname,'..','assignment-2'):path.join(__dirname,'dist');
const port=Number(process.env.PORT)||4173;
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.zip':'application/zip','.json':'application/json','.md':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
  const target=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
  if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(target,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(data);});
}).listen(port,'127.0.0.1',()=>console.log(`Camera laser app: http://127.0.0.1:${port}`));
