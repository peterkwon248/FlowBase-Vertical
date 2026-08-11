import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: {
    alias: {
      "@core": fileURLToPath(new URL("./src/core", import.meta.url)),
      "@packs": fileURLToPath(new URL("./src/packs", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // 픽스처 15개(#13은 80,138행)를 도는 하네스 테스트가 있다
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
})

// `node:sqlite`(Node 22.5 신규 빌트인)는 Vite의 내장 모듈 목록에 없어서
// 정적 import를 쓰면 `node:` 접두가 떨어져 나간다. `ssr.external`·
// `optimizeDeps.exclude`·`server.deps.external`을 전부 시도했지만 통하지 않았고,
// `src/core/store/sqlite.ts`에서 `createRequire`로 부르는 것으로 해결했다.
// 드라이버 접점을 한 파일로 좁히는 편이 ADR-003 관점에서도 낫다.
