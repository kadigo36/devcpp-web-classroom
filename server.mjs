import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';

const root=resolve(import.meta.dirname);
const mime={
  '.html':'text/html;charset=utf-8',
  '.css':'text/css;charset=utf-8',
  '.js':'text/javascript;charset=utf-8',
  '.mjs':'text/javascript;charset=utf-8',
  '.wasm':'application/wasm',
  '.json':'application/json;charset=utf-8'
};

function securityHeaders(pathname){
  if(pathname==='/drive-auth.html'){
    return {
      'Cross-Origin-Opener-Policy':'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy':'unsafe-none'
    };
  }
  return {
    'Cross-Origin-Opener-Policy':'same-origin',
    'Cross-Origin-Embedder-Policy':'require-corp'
  };
}

createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    const pathname=decodeURIComponent(url.pathname);

    if(pathname==='/api/drive-config'){
      res.writeHead(200,{
        'Content-Type':'application/json;charset=utf-8',
        'Cache-Control':'no-store, max-age=0',
        ...securityHeaders(pathname)
      }).end(JSON.stringify({
        clientId:process.env.GOOGLE_OAUTH_CLIENT_ID||''
      }));
      return;
    }

    const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(path!==root&&!path.startsWith(root+sep)){
      res.writeHead(403).end();
      return;
    }

    const bytes=await readFile(path);
    res.writeHead(200,{
      'Content-Type':mime[extname(path)]||'application/octet-stream',
      'X-Content-Type-Options':'nosniff',
      ...securityHeaders(pathname)
    }).end(bytes);
  }catch{
    res.writeHead(404).end('Não encontrado');
  }
}).listen(4173,'127.0.0.1',()=>console.log('http://localhost:4173'));
