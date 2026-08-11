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
