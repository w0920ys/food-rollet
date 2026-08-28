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
const CACHE_VERSION = "jeomechu-slot-v21";

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
//    - 없으면 인터넷에서 받아오고, 아이콘/글꼴 같은 외부 자원은 캐시에 저장해 둡니다.
//
//  ★ 아이콘이 글자로 보이던 문제 수정:
//    예전에는 '무엇이든' 실패하면 index.html(HTML)을 돌려줬는데, 그러면 아이콘 폰트
//    요청이 실패했을 때 폰트 자리에 HTML이 와서 아이콘이 글자로 깨졌습니다.
//    이제 (1) 폰트를 캐시에 저장해 두어 다음부턴 오프라인에서도 뜨고,
//         (2) 실패해도 '페이지 이동'일 때만 첫 화면을 보여주고 나머지는 그냥 실패시킵니다.
function isFontAsset(url) {
  return url.includes("fonts.googleapis.com")   // Material Symbols / 구글 폰트 CSS
      || url.includes("fonts.gstatic.com")       // 폰트 파일
      || url.includes("cdn.jsdelivr.net");       // Pretendard
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // GET 외에는 그냥 통과

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // 아이콘/글꼴 등 외부 자원을 런타임 캐시에 저장 (다음부턴 항상 뜸, 오프라인 포함)
          if (res && (res.ok || res.type === "opaque") && isFontAsset(req.url)) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          // 네트워크 실패 시: '페이지 이동' 요청만 첫 화면으로 대체.
          // 폰트/스크립트 등은 HTML로 덮어쓰지 않고 그대로 실패시킴 (아이콘 깨짐 방지).
          if (req.mode === "navigate") return caches.match("./index.html");
          return Response.error();
        });
    })
  );
});

// 4) [6단계] 푸시 알림 수신 → 알림 표시
//    서버(스케줄러)가 웹푸시를 보내면 여기서 받아 알림을 띄웁니다.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || "모먹지";
  const body = data.body || "오늘 먹을 메뉴 정했어?";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      data: { url: data.url || "./index.html" },
    })
  );
});

// 알림 클릭 → 앱 열기(이미 열려있으면 그 창으로 포커스)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "./index.html";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
