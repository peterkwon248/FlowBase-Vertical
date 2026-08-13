/**
 * Tauri 스모크 판독 — 앱이 남긴 DB를 **밖에서** 열어 되센다.
 *
 * 웹뷰가 스스로 "80,137행 넣었다"고 말하는 것만으로는 부족하다. 같은 파일을
 * 다른 프로세스가 열어 `SELECT COUNT(*)`로 확인해야 실제로 디스크에 앉은 것이다.
 * 스모크 자신이 부른 `countInRange`와 여기서 세는 값이 **둘 다** 맞아야 한다.
 *
 *   npx tsx tools/harness/smoke-read.ts
 */

import { existsSync } from "node:fs"
import { openNodeDriver } from "../../src/core/store/driver-node.js"

const DB = ".tmp/tauri-smoke.sqlite"
const TIME_BUDGET_MS = 30_000

if (!existsSync(DB)) {
  console.error(`${DB}가 없다 — 스모크가 아직 돌지 않았거나 실패했다`)
  process.exit(1)
}

const db = openNodeDriver(DB, { pragmas: false })

const rows = await db.prepare(`SELECT k, v FROM smoke_result`).all()
const r = Object.fromEntries(rows.map((x) => [String(x["k"]), String(x["v"])]))

if (r["ok"] !== "true") {
  console.error("스모크가 실패로 끝났다:\n" + (r["error"] ?? "(사유 없음)"))
  await db.close()
  process.exit(1)
}

// ── 밖에서 되센다 ──────────────────────────────────────────────
const counted = await db.prepare(`SELECT COUNT(*) AS c FROM fact_ad_spend`).get()
const outside = Number(counted?.["c"] ?? -1)
const batches = await db.prepare(`SELECT COUNT(*) AS c FROM batch`).get()

const num = (k: string): number => Number(r[k] ?? 0)
const totalMs = num("totalMs")
const loaded = num("loaded")

console.log("Tauri 스모크 — #13 종단 1회 (IPC 경로)\n")
console.log(`  형식              ${r["format"]}`)
console.log(`  물리 행           ${num("physicalRowCount").toLocaleString()}`)
console.log(`  데이터 행         ${num("dataRowCount").toLocaleString()}`)
console.log(`  적재              ${loaded.toLocaleString()}`)
console.log(`  앱이 센 COUNT     ${num("countedBack").toLocaleString()}`)
console.log(`  ★ 밖에서 센 COUNT ${outside.toLocaleString()}`)
console.log(`  batch             ${Number(batches?.["c"] ?? 0)}`)
console.log(`  광고비 합계       ${num("totalSpend").toLocaleString()}원`)
console.log(`  매핑 오류         ${r["mappingErrors"]}   미매핑 컬럼 ${r["unmappedColumns"]}`)
console.log("")
console.log(`  fetch             ${num("fetchMs")}ms`)
console.log(`  파서 준비         ${num("parseMs")}ms`)
console.log(`  정규화+매핑+적재  ${num("loadMs")}ms`)
console.log(`  ─────────────────────────`)
console.log(`  합계              ${(totalMs / 1000).toFixed(1)}초 / ${TIME_BUDGET_MS / 1000}초`)
console.log(`  JS 힙 피크        ${r["heapPeakMb"]}MB (프로세스 RSS는 별도 폴링)`)

await db.close()

// ── 판정 ───────────────────────────────────────────────────────
const timeOk = totalMs <= TIME_BUDGET_MS
const rowsOk = loaded === outside && loaded === num("countedBack")
const noErrors = num("mappingErrors") === 0

console.log("")
console.log(`  시간   ${timeOk ? "통과" : "★ 초과"}`)
console.log(`  행수   ${rowsOk ? "일치" : "★ 불일치"} (적재=앱COUNT=밖COUNT)`)
console.log(`  오류   ${noErrors ? "없음" : `★ ${num("mappingErrors")}건`}`)

if (!timeOk || !rowsOk || !noErrors) {
  console.log("\n초과·불일치는 튜닝 대상이 아니라 **원인 분리 보고** 대상이다.")
  process.exit(1)
}
console.log("\n진짜 앱이 진짜 DB에 진짜 파일을 넣었다.")
