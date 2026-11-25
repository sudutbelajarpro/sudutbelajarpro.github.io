// Sudut Belajar — service worker v3.2 (aset/ cache-dahulu; v3.2: halaman /latihan/ tidak ditimpa ke salinan index)
// Pembetulan penting berbanding v2:
//  1. Panggilan API (script.google.com) TIDAK PERNAH dipintas — ranking & simpan sentiasa data terkini.
//  2. Halaman disimpan di SATU kunci tetap sahaja, jadi cache tidak membengkak walau berapa banyak
//     pautan berparameter (?v=, ?r=) dibuka. v2 menyimpan salinan penuh bagi setiap URL unik.
//  3. HTML sentiasa internet-dahulu; hanya ikon/font guna cache-dahulu.
const CACHE = 'sb-v3';
const HALAMAN = './index.html';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  // --- API dan hos luar: biar browser uruskan sendiri, jangan cache ---
  if (url.origin !== self.location.origin) return;

  // --- Navigasi halaman: internet dahulu; simpan di satu kunci tetap ---
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => {
          // Hanya halaman utama disimpan sebagai salinan luar talian (halaman /latihan/ tidak boleh menimpanya)
          if (r && r.ok && (url.pathname === '/' || url.pathname === '/index.html')) { const salin = r.clone(); caches.open(CACHE).then(c => c.put(HALAMAN, salin)); }
          return r;
        })
        .catch(() => caches.match(HALAMAN).then(h => h || caches.match('./')))
    );
    return;
  }

  // --- Fail HTML yang diminta melalui fetch(): internet dahulu, jangan sesekali hidang versi lama ---
  if (/\.html?($|\?)/.test(url.pathname + url.search) || url.pathname === '/' ) {
    e.respondWith(fetch(req).catch(() => caches.match(HALAMAN)));
    return;
  }

  // --- Video: biar browser uruskan sendiri (permintaan Range/206 — Safari perlukannya; jangan cache) ---
  if (/\.(mp4|webm)$/i.test(url.pathname)) return;

  // --- Fail besar dalam aset/ (muzik, gambar): cache dahulu SAHAJA, jimat data murid.
  //     Nama fail mesti ditukar jika kandungannya berubah. ---
  if (url.pathname.includes('/aset/')) {
    e.respondWith(
      caches.open(CACHE).then(c => c.match(url.pathname).then(hit => hit || fetch(req).then(r => {
        if (r && r.ok && r.status === 200) c.put(url.pathname, r.clone());
        return r;
      })))
    );
    return;
  }

  // --- Aset statik (ikon, manifest): cache dahulu, segar di latar belakang ---
  e.respondWith(
    caches.open(CACHE).then(async c => {
      const hit = await c.match(url.pathname);
      const net = fetch(req)
        .then(r => { if (r && r.ok) c.put(url.pathname, r.clone()); return r; })
        .catch(() => hit);
      return hit || net;
    })
  );
});
