const CACHE_NAME = "slide-pwa-v1";
const ASSETS = [
  "./slide.html",
  "./slides.webmanifest"
  // thêm icon sau nếu có:
  // "./icon-192.png",
  // "./icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Chỉ xử lý cache cho slide + các file liên quan (tránh ảnh hưởng trang khác)
  const isSlideRelated =
    url.pathname.endsWith("/slide.html") ||
    url.pathname.endsWith("/slides.webmanifest") ||
    url.pathname.endsWith("/sw-slide.js") ||
    url.pathname.endsWith("/icon-192.png") ||
    url.pathname.endsWith("/icon-512.png");

  if (!isSlideRelated) return;

  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
