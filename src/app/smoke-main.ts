/**
 * 스모크 진입점. 창이 뜨면 바로 돈다.
 *
 * 앱 진입점(`main.tsx`)과 분리한 이유는 간단하다 — 측정 코드가 앱 코드에
 * 섞이면 나중에 "이건 왜 있지"가 된다. `tauri.conf.json`의 `devUrl`을 잠깐
 * 이 페이지로 돌려 재고, 끝나면 되돌린다.
 */

import { runSmoke } from "./smoke.js"

const out = document.getElementById("out")!
const lines: string[] = []
const log = (s: string): void => {
  lines.push(s)
  out.textContent = lines.join("\n")
}

log("Tauri 웹뷰에서 실행 중 — 실제 앱과 같은 경로다\n")

const result = await runSmoke(log)

log("")
if (!result.ok) {
  log(`★ 실패 ★\n${result.error ?? ""}`)
} else {
  log("─".repeat(52))
  log(`형식            ${result.format}`)
  log(`물리 행         ${result.physicalRowCount?.toLocaleString()}`)
  log(`데이터 행       ${result.dataRowCount?.toLocaleString()}`)
  log(`적재            ${result.loaded?.toLocaleString()}`)
  log(`SELECT COUNT    ${result.countedBack?.toLocaleString()}`)
  log(`합계(광고비)    ${result.totalSpend?.toLocaleString()}`)
  log(`매핑 오류       ${result.mappingErrors}`)
  log(`미매핑 컬럼     ${result.unmappedColumns}`)
  log("─".repeat(52))
  log(`fetch           ${result.fetchMs}ms`)
  log(`파서 준비       ${result.parseMs}ms`)
  log(`정규화+매핑+적재 ${result.loadMs}ms`)
  log(`합계            ${((result.totalMs ?? 0) / 1000).toFixed(1)}초 / 30초`)
  log(`JS 힙 피크      ${result.heapPeakMb}MB (프로세스 RSS는 밖에서 잰다)`)
  log("─".repeat(52))
  log("결과는 .tmp/tauri-smoke.sqlite의 smoke_result에 남겼다.")
}
