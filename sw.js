// উল্লাপাড়া ভ্যারাইটি স্টোর ট্র্যাকিং অ্যাপ — Service Worker
// এই অ্যাপের সব ডাটা localStorage-এ থাকে (ব্যাকএন্ড সার্ভার নেই), তাই মূল কাজ হলো
// অ্যাপ শেল (index.html + আইকন) অফলাইনেও যেন খোলা যায় সেটা নিশ্চিত করা।

const CACHE_NAME = 'ullapara-tracking-v1';
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './icon-512-maskable.png'
];

// ইনস্টলের সময় অ্যাপ শেল ক্যাশে করে রাখা
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(APP_SHELL);
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

// পুরোনো ভার্সনের ক্যাশ মুছে ফেলা
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.filter(function (key) { return key !== CACHE_NAME; })
                    .map(function (key) { return caches.delete(key); })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

// ফেচ স্ট্র্যাটেজি:
// - অ্যাপ শেলের ফাইল (index.html, manifest, আইকন) → cache-first, তারপর নেটওয়ার্ক ফলব্যাক
//   (অফলাইনেও অ্যাপ খুলবে)
// - বাইরের CDN লাইব্রেরি (html2canvas/jsPDF/XLSX) → নেটওয়ার্ক-ফার্স্ট, ব্যর্থ হলে ক্যাশ থেকে
//   (অনলাইনে থাকলে সবসময় সবশেষ ভার্সন, অফলাইনে আগের ডাউনলোড করা কপি ব্যবহার হবে)
self.addEventListener('fetch', function (event) {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    const isSameOrigin = url.origin === self.location.origin;

    if (isSameOrigin) {
        event.respondWith(
            caches.match(req).then(function (cached) {
                if (cached) return cached;
                return fetch(req).then(function (res) {
                    const resClone = res.clone();
                    caches.open(CACHE_NAME).then(function (cache) { cache.put(req, resClone); });
                    return res;
                }).catch(function () {
                    // অফলাইনে মূল পেজের অনুরোধ এলে index.html ফলব্যাক হিসেবে দেখাও
                    if (req.mode === 'navigate') return caches.match('./index.html');
                });
            })
        );
    } else {
        event.respondWith(
            fetch(req).then(function (res) {
                const resClone = res.clone();
                caches.open(CACHE_NAME).then(function (cache) { cache.put(req, resClone); });
                return res;
            }).catch(function () {
                return caches.match(req);
            })
        );
    }
});
