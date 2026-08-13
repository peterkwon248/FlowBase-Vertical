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
 * ★ 이 서버가 증명하는 것과 못 하는 것 ★
 * 마크업과 숫자는 증명한다 — 같은 Template · 같은 CSS · 같은 조회이기 때문이다.
 * **상호작용은 증명하지 못한다.** 렌더는 정적 HTML이고 핸들러가 붙어 있지 않다.
 * 클릭 동선은 여전히 사람이 실기기에서 본다 (작업-상태의 «검증층의 경계선»).
 */
export default defineConfig({
  root: ".tmp",
  server: { port: 5199, strictPort: true },
})
