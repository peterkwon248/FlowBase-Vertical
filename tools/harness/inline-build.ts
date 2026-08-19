/**
 * 단일 파일 빌드를 **HTML 하나**로 접는다 — 정적 호스팅 없이 열어 보기 위한 것.
 *
 * ```
 * npm run single      # vite(단일 설정) → dist-single → .tmp/flowbase.html
 * ```
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 필요한가 ★
 * 웹판은 섰는데(`driver-wasm`) 배포할 자리를 얻는 데 사람의 조치가 필요하다.
 * 그동안에도 **화면은 보여야 한다** — 그게 이 세션에서 결함 62를 잡아낸 방식이고,
 * 「안 보고 넘어가는 압력」을 없애는 것이 웹판을 만든 이유 자체다.
 *
 * ★ 앱 코드를 건드리지 않는다 ★
 * 폰트·wasm은 번들러가 이미 data URI로 접었다(`vite.single.config.ts`).
 * 남는 것은 DB 하나뿐이고, 그건 `fetch` **앞에서** 가로채 돌려준다. 앱에 «단일 파일
 * 모드» 분기를 심으면 그 분기가 영원히 남고 실제 배포와 다른 코드가 도는 자리가 된다.
 *
 * 이것은 **배포의 대체가 아니라 임시 경로**다. 배포가 서면 「폰에서 빠르게 열어
 * 보기」 용도로만 남는다.
 * ─────────────────────────────────────────────────────────────
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, "..", "..")
const DIST = join(ROOT, "dist-single")
const OUT = join(ROOT, ".tmp", "flowbase.html")

const assets = readdirSync(join(DIST, "assets"))
const one = (ext: string): string => {
  const hit = assets.filter((n) => n.endsWith(ext))
  if (hit.length !== 1) {
    // 여럿이면 조각이 남았다는 뜻이고, 그러면 이 도구의 전제가 깨진다.
    throw new Error(`${ext} 파일이 ${hit.length}개다 — 단일 빌드가 아니다`)
  }
  return join(DIST, "assets", hit[0]!)
}

const js = readFileSync(one(".js"), "utf-8")
const css = readFileSync(one(".css"), "utf-8")
const db = readFileSync(join(DIST, "demo.sqlite")).toString("base64")

const html = `<!doctype html>
<html lang="ko" data-theme="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>FlowBase 손익</title>
<style>
${css}
</style>
</head>
<body>
<div id="root"></div>
<script>
/* 접어 넣은 데모 DB — 비식별화 픽스처로 만든 것이지 실데이터가 아니다. */
(function () {
  var DB = "data:application/octet-stream;base64,${db}";
  var origin = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || String(input);
    return origin(url.indexOf("demo.sqlite") >= 0 ? DB : input, init);
  };
})();
</script>
<script type="module">
${js}
</script>
</body>
</html>
`

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, html)
console.log(`→ ${OUT}  (${(statSync(OUT).size / 1024 / 1024).toFixed(1)}MB)`)
