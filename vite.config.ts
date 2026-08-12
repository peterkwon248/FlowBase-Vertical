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
})
