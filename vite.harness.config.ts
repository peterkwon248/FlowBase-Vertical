import { defineConfig } from "vite"

/**
 * `tools/harness/render-screen.ts`가 만든 `.tmp/<뷰>.html`을 **눈으로 보기 위한**
 * 정적 서버. 앱을 띄우는 것이 아니다 — 앱은 `vite.config.ts`(5173)다.
 *
 * ★ 왜 따로 있나 ★
 * 렌더 산출물은 자체 완결 HTML이라 서버가 필요 없지만, 브라우저 도구가 `file://`을
 * 열지 못한다. 그래서 `.tmp/`를 루트로 하는 최소 서버를 둔다. 포트도 앱과 다르게
 * 잡아(5199) 앱 dev 서버가 떠 있어도 충돌하지 않는다.
 *
 * ★ 포트만 갈라서는 부족했다 — `cacheDir`도 갈라야 한다 (2026-08-14 실측) ★
 * `root: ".tmp"`에는 package.json이 없어 vite가 위로 올라가 **앱과 같은**
 * `node_modules/.vite`를 캐시로 잡는다. 두 config는 `configHash`가 다르므로
 * 이 서버가 뜨는 순간 vite가 "설정이 바뀌었다"며 **앱의 dep 번들을 지우고**
 * `optimized: {}`로 덮는다 — 여긴 최적화할 dep이 없기 때문이다.
 *
 * 그러면 이미 떠 있던 앱 서버는 메모리에 남은 것만 내주고, 브라우저가 옛 `?v=`로
 * 요청한 `xlsx`·`fflate`는 **504 Outdated Optimize Dep**이 된다. 화면은 백지가 되고
 * 원인은 이 파일에 있는데 증상은 저쪽에서 난다. 캐시 자리를 갈라 끊는다.
 *
 * ★ 이 서버가 증명하는 것과 못 하는 것 ★
 * 마크업과 숫자는 증명한다 — 같은 Template · 같은 CSS · 같은 조회이기 때문이다.
 * **상호작용은 증명하지 못한다.** 렌더는 정적 HTML이고 핸들러가 붙어 있지 않다.
 * 클릭 동선은 여전히 사람이 실기기에서 본다 (작업-상태의 «검증층의 경계선»).
 */
export default defineConfig({
  root: ".tmp",
  cacheDir: "node_modules/.vite-harness",
  server: { port: 5199, strictPort: true },
})
