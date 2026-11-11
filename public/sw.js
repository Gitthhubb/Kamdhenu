const CACHE_NAME='kamdhenu-pwa-v3';
const CORE_ASSETS=['/','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  await cache.addAll(CORE_ASSETS);
  const index=await cache.match('/');
  if(index){
   const html=await index.text();
   const assets=Array.from(html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g),match=>match[1]);
   if(assets.length)await cache.addAll(assets);
  }
 })());
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))));
 self.clients.claim();
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(response=>{
   if(response.ok)caches.open(CACHE_NAME).then(cache=>cache.put('/',response.clone()));
   return response;
  }).catch(()=>caches.match('/').then(response=>response||Response.error())));
  return;
 }
 event.respondWith(caches.match(request).then(cached=>{
  if(cached)return cached;
  return fetch(request).then(response=>{
   if(response.ok)caches.open(CACHE_NAME).then(cache=>cache.put(request,response.clone()));
   return response;
  });
 }));
});