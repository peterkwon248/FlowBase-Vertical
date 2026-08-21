import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"

/**
 * 앱 빌드 설정. 테스트는 `vitest.config.ts`가 따로 본다.
 *
 * ★ `@vitejs/plugin-react`가 v4에 묶여 있다 ★
 * vitest 2.1이 vite ^5를 peer로 요구하는데 plugin-react v6은 vite ^8을 요구해서
 * 충돌한다. 테스트 175개를 흔드는 vitest 업그레이드 대신 vite 5를 지원하는
 * plugin-react v4로 맞췄다. vitest를 올릴 때 함께 올린다.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@core": fileURLToPath(new URL("./src/core", import.meta.url)),
      "@packs": fileURLToPath(new URL("./src/packs", import.meta.url)),
      "@app": fileURLToPath(new URL("./src/app", import.meta.url)),
    },
  },
  server: { port: 5173, strictPort: true },
  build: { outDir: "dist", sourcemap: true },

  /**
   * 스모크 측정 전용 주입 (dev에서만 쓴다).
   *
   * ★ 이 첫 줄은 2026-08-21까지 **거짓이었다** (ADR-024 · 조사 2.9) ★
   * 주입된 경로가 실제로는 **앱의 유일한 DB 경로**였고, 그래서 다른 PC에 설치하면
   * 첫 열기에서 끝났다. 이제 앱은 `data.ts`의 `appDbPath()`로 갈라 릴리즈에서는
   * `appDataDir()`를 연다 — 프로덕션 번들에서 이 문자열은 **죽은 코드로 사라진다**
   * (실측: 전 청크에서 0건). 즉 이 주석은 이제 참이다.
   *
   * 웹뷰는 파일시스템 경로를 모르므로 픽스처와 DB 자리를 빌드 시점에 넣어준다.
   * vite dev가 프로젝트 루트 파일을 `/@fs/<절대경로>`로 서빙하는 것을 이용한다 —
   * 스모크는 **실제 앱과 같은 경로**(fetch → 파이프라인 → Tauri 드라이버)를
   * 타야 IPC 직렬화 비용이 드러나기 때문에, 파일을 Node에서 미리 읽어 넘기는
   * 우회는 쓰지 않는다.
   */
  define: {
    __PROJECT_ROOT__: JSON.stringify(fileURLToPath(new URL(".", import.meta.url))),
  },
})
