// Network-first navigation. Do not cache auth, chats, API requests or user data.
const CACHE='vost-offline-v1',OFFLINE='/offline.html';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.add(OFFLINE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('vost-offline-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const r=event.request,u=new URL(r.url);
 if(r.method!=='GET'||r.mode!=='navigate'||u.origin!==self.location.origin||u.pathname!=='/'||u.search)return;
 event.respondWith(fetch(r).catch(async()=>await caches.match(OFFLINE)||new Response('Offline. Reconnect to continue.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})));
});
