const CACHE='commander-lab-v0.3.1';
const SHELL=['./manifest.json','./icon.svg','./modal-fix.css','./modal-fix.js','./rules-v02.css','./rules-v02.js','./effects-v03.css','./effects-v03.js'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

async function patchedNavigation(request){
  const response=await fetch(request,{cache:'no-store'});
  let html=await response.text();
  if(!html.includes('modal-fix.css'))html=html.replace('</head>','<link rel="stylesheet" href="./modal-fix.css?v=031"></head>');
  if(!html.includes('rules-v02.css'))html=html.replace('</head>','<link rel="stylesheet" href="./rules-v02.css?v=031"></head>');
  if(!html.includes('effects-v03.css'))html=html.replace('</head>','<link rel="stylesheet" href="./effects-v03.css?v=031"></head>');
  if(!html.includes('modal-fix.js'))html=html.replace('</body>','<script src="./modal-fix.js?v=031"></script></body>');
  if(!html.includes('rules-v02.js'))html=html.replace('</body>','<script src="./rules-v02.js?v=031"></script></body>');
  if(!html.includes('effects-v03.js'))html=html.replace('</body>','<script src="./effects-v03.js?v=031"></script></body>');
  html=html.replace(/MTG playtest prototype · v0\.[0-9]+\.[0-9]+/g,'MTG playtest prototype · v0.3.1');
  const headers=new Headers(response.headers);
  headers.delete('content-length');headers.delete('content-encoding');
  const patched=new Response(html,{status:response.status,statusText:response.statusText,headers});
  const cache=await caches.open(CACHE);await cache.put('./index.html',patched.clone());return patched;
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.hostname.includes('scryfall.com')||url.hostname.includes('scryfall.io'))return;
  if(event.request.mode==='navigate'){
    event.respondWith(patchedNavigation(event.request).catch(()=>caches.match('./index.html')));return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;
  })));
});
