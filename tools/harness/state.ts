/**
 * 상태 실측 — **인계 문서가 인용하는 숫자를 한 번에 잰다.**
 *
 *   npm run state
 *
 * ★ 왜 생겼나 (2026-08-20) ★
 *
 * `작업-상태.md`가 「실기기 DB는 13」이라 적었는데 실측은 **11**이었고,
 * 「리스팅 190건이 전부 미연결」이라 적었는데 실측은 **261건 중 linked 236 · 미연결 0**이었다.
 * 둘 다 문서를 쓴 기기와 읽는 기기가 달랐다 — 클라우드 컨테이너에서 잰 값이
 * 데스크톱의 사실인 척 인용됐다.
 *
 * 규칙이 없어서가 아니다. 작업 리듬 1번이 「지시서의 전제도 실측으로 확인한다」이고
 * `/before-work`도 같은 말을 적어 뒀다. 그런데 안 지켜졌다 —
 * **깨진 것만 재고(테스트가 붉었으니) 안 깨진 숫자는 믿었기 때문이다.**
 * 위험한 쪽은 언제나 안 깨진 쪽이다.
 *
 * > 규율은 「재라」로는 안 지켜지고 **한 줄로만** 지켜진다. 그게 이 도구다.
 *
 * ★ 그래서 지키는 성질 셋 ★
 *
 *   ① **문서가 인용하는 숫자만** 잰다. 더 재지 않는다 — 안 읽히는 출력은 없느니만 못하다
 *   ② **두 DB를 나란히** 잰다. 오늘의 혼란이 「지금 보는 게 실 DB냐 데모냐」였다
 *   ③ 마이그레이션이 밀려 있으면 **exit 1**. 조용히 지나가면 그 위에 작업이 쌓인다 (LOCK 6)
 *
 * ★ 여기서 재지 않는 것 ★
 * 게이트 결과(typecheck·test·wiring·perf·e2e)는 **자기 명령이 따로 있다.**
 * 이 도구가 그걸 흉내 내면 「state가 녹색이니 됐다」는 두 번째 거짓 게이트가 생긴다
 * (작업 리듬 7 — 게이트는 선언된 질문만 답한다).
 */

import { existsSync, readdirSync, statSync } from "node:fs"
import { openNodeDriver } from "../../src/core/store/driver-node.js"

/**
 * **로컬 시각으로 적는다.** `toISOString()`은 UTC라 「11:03」으로 나오는데
 * 같은 파일을 탐색기로 보면 「20:03」이다. 그 아홉 시간이 다음 사람에게
 * 「어제 것인가?」라는 헛질문을 만든다 — 재는 도구가 헷갈림을 만들면 안 된다.
 */
const stamp = (d: Date): string => {
  const p = (n: number): string => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 앱이 여는 실 DB. `src/app/data.ts`의 `DEV_DB_PATH`와 같은 파일이어야 한다. */
const REAL_DB = ".tmp/pnl.sqlite"
/** 브라우저(웹 데모)가 `fetch`로 가져가는 DB. `src/app/data.ts:235` 참조. */
const DEMO_DB = "public/demo.sqlite"
const MIGRATIONS = "src/core/store/migrations"

/** 마이그레이션 파일에서 읽는 **스키마 정본**. DB가 이보다 낮으면 밀린 것이다. */
function schemaHead(): number {
  const versions = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => Number(f.slice(0, 3)))
    .filter((n) => Number.isFinite(n))
  return versions.length === 0 ? 0 : Math.max(...versions)
}

type Snapshot = {
  path: string
  exists: boolean
  bytes: number
  mtime: string
  applied: number | null
  lines: string[]
}

async function measure(path: string): Promise<Snapshot> {
  if (!existsSync(path)) {
    return { path, exists: false, bytes: 0, mtime: "-", applied: null, lines: ["(파일이 없다)"] }
  }
  const st = statSync(path)
  const db = openNodeDriver(path, { pragmas: false })
  const lines: string[] = []
  let applied: number | null = null

  try {
    // 스키마가 낮으면 **테이블 자체가 없다.** 있는 것만 센다 — 없는 것을 0으로
    // 적으면 「비어 있다」와 「그 개념이 아직 없다」가 구분되지 않는다 (§22).
    const present = new Set(
      (await db.prepare(`SELECT name FROM sqlite_master WHERE type IN ('table','view')`).all()).map(
        (r) => String(r["name"]),
      ),
    )
    const has = (t: string): boolean => present.has(t)

    if (has("schema_migration")) {
      const r = await db.prepare(`SELECT MAX(version) AS v FROM schema_migration`).get()
      applied = r?.["v"] === undefined || r["v"] === null ? null : Number(r["v"])
    }

    /** 한 줄 = 「이름 … 값」. 값이 없으면 그 줄을 아예 안 낸다. */
    const line = (label: string, text: string): void => {
      lines.push(`  ${label.padEnd(16)} ${text}`)
    }
    const count = async (table: string): Promise<number> => {
      const r = await db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get()
      return Number(r?.["c"] ?? 0)
    }
    /** `GROUP BY` 한 줄을 「a 3 · b 5」로. 0행이면 「0」. */
    const group = async (table: string, col: string): Promise<string> => {
      const rows = await db.prepare(`SELECT ${col} AS k, COUNT(*) AS c FROM ${table} GROUP BY ${col} ORDER BY 2 DESC`).all()
      if (rows.length === 0) return "0"
      return rows.map((r) => `${String(r["k"] ?? "(null)")} ${Number(r["c"])}`).join(" · ")
    }

    if (has("batch")) line("batch", await group("batch", "status"))
    if (has("fact_order")) line("주문", String(await count("fact_order")))
    if (has("fact_settlement")) line("정산", String(await count("fact_settlement")))
    if (has("fact_ad_spend")) {
      const n = await count("fact_ad_spend")
      // 014가 연 열이다. 광고비가 상품까지 내려가는지를 이 한 줄이 말한다 (ADR-022).
      const withKey = present.has("fact_ad_spend")
        ? Number(
            (
              await db
                .prepare(
                  `SELECT COUNT(*) AS c FROM pragma_table_info('fact_ad_spend') WHERE name = 'listing_key'`,
                )
                .get()
            )?.["c"] ?? 0,
          ) > 0
          ? Number((await db.prepare(`SELECT COUNT(listing_key) AS c FROM fact_ad_spend`).get())?.["c"] ?? 0)
          : null
        : null
      line("광고", withKey === null ? `${n}행 (listing_key 열 없음)` : `${n}행 · 상품 붙은 것 ${withKey}`)
    }
    if (has("marketplace_listing")) line("리스팅", await group("marketplace_listing", "link_state"))
    if (has("sku")) line("SKU", String(await count("sku")))
    if (has("cost_history")) line("원가 이력", await group("cost_history", "entered_by"))
    if (has("pending_cost")) line("원가 대기", await group("pending_cost", "state"))
    if (has("collection")) line("묶음", String(await count("collection")))
  } finally {
    await db.close()
  }

  return {
    path,
    exists: true,
    bytes: st.size,
    mtime: stamp(st.mtime),
    applied,
    lines,
  }
}

// ── 출력 ────────────────────────────────────────────────────────
const head = schemaHead()
const real = await measure(REAL_DB)
const demo = await measure(DEMO_DB)

const ver = (s: Snapshot): string =>
  s.applied === null ? "?" : s.applied === head ? `${s.applied}` : `${s.applied} ⚠ 정본 ${head}`

console.log(``)
console.log(`실측 — ${stamp(new Date())} · node ${process.version} · ${process.platform}`)
console.log(`스키마 정본 ${head} (${MIGRATIONS}의 파일에서 읽었다)`)
console.log(``)

for (const s of [real, demo]) {
  const what = s.path === REAL_DB ? "실 DB — 앱(Tauri 창)이 여는 것" : "데모 DB — 브라우저가 fetch로 가져가는 것"
  console.log(`${s.path}   ${what}`)
  if (!s.exists) {
    console.log(`  (파일이 없다)`)
    console.log(``)
    continue
  }
  console.log(`  ${(s.bytes / 1_048_576).toFixed(1)}MB · ${s.mtime} · 스키마 ${ver(s)}`)
  for (const l of s.lines) console.log(l)
  console.log(``)
}

// ★ 밀린 마이그레이션은 조용히 넘기지 않는다 ★
// 이 자리가 조용했던 탓에 2026-08-20 세션이 스키마 11 위에서 시험 30건을 붉히고
// 원인을 찾는 데 시간을 썼다. 다음 사람은 이 줄에서 바로 안다.
const behind = [real, demo].filter((s) => s.exists && s.applied !== null && s.applied < head)
if (behind.length > 0) {
  console.error(`⚠ 마이그레이션이 밀렸다 — 이 위에 작업을 쌓지 마라`)
  for (const s of behind) {
    console.error(`   ${s.path}  ${s.applied} → ${head}`)
    console.error(`   npx tsx tools/harness/migrate-db.ts ${s.path}`)
  }
  process.exit(1)
}
