// GitHub Pages 흉내: /<저장소 이름>/ 아래 정적 파일(기본 /wow-guide-kr/, 두 번째 인자로 바꿈), 폴더는 index.html, 없으면 404.html(상태 404)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=process.argv[2], PFX='/'+(process.argv[3]||'wow-guide-kr')+'/', PORT=+(process.argv[4]||8972);
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.pdf':'application/pdf'};
http.createServer((q,r)=>{
  let u=decodeURIComponent(new URL(q.url,'http://x').pathname);
  if(u===PFX.slice(0,-1)){r.writeHead(301,{Location:PFX});return r.end();}
  let f=u.startsWith(PFX)?path.join(ROOT,u.slice(PFX.length)):null;
  if(f&&fs.existsSync(f)&&fs.statSync(f).isDirectory()){ if(!u.endsWith('/')){r.writeHead(301,{Location:u+'/'});return r.end();} f=path.join(f,'index.html'); }
  if(f&&fs.existsSync(f)){r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});return fs.createReadStream(f).pipe(r);}
  r.writeHead(404,{'Content-Type':'text/html; charset=utf-8'}); fs.createReadStream(path.join(ROOT,'404.html')).pipe(r);
}).listen(PORT);
