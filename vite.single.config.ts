import { defineConfig, mergeConfig } from "vite"
import base from "./vite.config.js"

/**
 * **파일 하나짜리 빌드** — 정적 호스팅 없이 열어 보기 위한 것.
 *
 * 배포 자리를 얻는 데 사람의 조치가 필요한 동안에도 화면은 보여야 한다.
 * `assetsInlineLimit`을 크게 두면 폰트·wasm이 data URI로 번들 안에 들어가고,
 * `inlineDynamicImports`가 지연 로드 조각까지 하나로 접는다.
 *
 * ★ 앱 코드는 그대로다 ★ 이 설정은 **번들러에게만** 하는 말이라, 실제 배포와
 * 다른 코드가 도는 자리가 생기지 않는다.
 */
export default mergeConfig(
  base,
  defineConfig({
    build: {
      outDir: "dist-single",
      sourcemap: false,
      assetsInlineLimit: 100_000_000,
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  }),
)
