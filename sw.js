/* =========================================================================
   sw.js  —  서비스워커 (Service Worker)

   이게 하는 일: 앱 파일들을 폰에 저장(캐싱)해둬서
   → 인터넷이 없어도 앱이 열리게 하고, 두 번째부터는 더 빠르게 켜집니다.

   ★★ 비전공자용 안내 ★★
   앱(index.html 등)을 수정해서 다시 배포했는데 폰에서 옛날 화면만 보인다면,
   아래 CACHE_VERSION 의 숫자를 1 올리고 다시 배포하세요. (예: v1 → v2)
   그러면 폰이 "새 버전이네" 하고 파일을 새로 받아옵니다.
   ========================================================================= */

// 앱을 수정할 때마다 이 숫자를 올려주세요 (v1 → v2 → v3 ...)
const CACHE_VERSION = "jeomechu-slot-v15";

// 오프라인에서도 열리게 미리 저장해 둘 파일 목록
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

// 1) 설치: 위 파일들을 캐시에 저장
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting(); // 새 서비스워커를 곧바로 활성화
});

// 2) 활성화: 옛날 버전 캐시는 지워서 용량 낭비 방지
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// 3) 요청 가로채기:
//    - 저장해 둔 파일이 있으면 그걸 바로 주고(=오프라인/빠름),
//    - 없으면 인터넷에서 받아옵니다.
self.addEventListener("fetch", (event) => {
  // GET 요청만 처리 (그 외에는 그냥 통과)
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).catch(() => {
          // 인터넷도 없고 캐시에도 없을 때: 최소한 앱 첫 화면이라도 보여주기
          return caches.match("./index.html");
        })
      );
    })
  );
});
