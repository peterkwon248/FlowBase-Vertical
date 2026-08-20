import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: {
    alias: {
      "@core": fileURLToPath(new URL("./src/core", import.meta.url)),
      "@packs": fileURLToPath(new URL("./src/packs", import.meta.url)),
      "@app": fileURLToPath(new URL("./src/app", import.meta.url)),
    },
  },
  /**
   * ★ `src/app/data.ts`를 시험에서 열 수 있게 한다 (2026-08-20) ★
   *
   * `vite.config.ts:35`가 `__PROJECT_ROOT__`를 주입하는데 vitest는 그 define을
   * 안 받아서, `data.ts`를 import하는 순간 `ReferenceError`로 죽었다. 그래서
   * **686줄짜리 DB 열기·쓰기 경로에 실행되는 시험이 0개**였다 (조사 4.7).
   *
   * 대신 쓰던 방식이 `tests/tauri-conn-race.test.ts:92`처럼 「`data.ts`의 **모양**을
   * 복제」하는 것이었는데, **모양이 본체와 어긋나면 양쪽 다 초록이다.**
   * ADR-014의 WAL 사고가 정확히 그 틈에서 났다.
   *
   * 값은 vite와 같은 규칙(프로젝트 루트)으로 준다 — 시험이 실제로 여는 DB 경로가
   * 앱의 그것과 같아야 «모양 복제»로 돌아가지 않는다.
   */
  define: {
    __PROJECT_ROOT__: JSON.stringify(fileURLToPath(new URL(".", import.meta.url))),
  },
  test: {
    include: ["tests/**/*.test.ts"],
    /**
     * 픽스처 준비 단계 — 개발용 DB의 스냅샷을 **워커가 뜨기 전에 한 번** 뜬다.
     * 워커들이 같은 물리 파일을 동시에 열다 `database is locked`로 깨지던 자리다
     * (`tests/dev-db.ts`에 진단과 처방).
     */
    globalSetup: ["tests/global-setup.ts"],
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
