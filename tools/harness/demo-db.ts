/**
 * 웹판이 동봉할 **데모 DB**를 만든다.
 *
 * ```
 * npx tsx tools/harness/demo-db.ts            # → public/demo.sqlite
 * npx tsx tools/harness/demo-db.ts --out x.sqlite
 * ```
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 사용자의 실제 DB를 동봉하지 않는가 ★
 *
 * 8/17 결정은 실기기의 `dev-snapshot.sqlite`(1.7MB)를 정적 자산으로 넣는 것이었고,
 * 그때 «회사 숫자는 나간다 — 사용자가 알고 결정»으로 정리했다. 그런데 그 뒤에
 * 두 가지가 바뀌었다:
 *
 *   ① 클라우드 세션에는 그 파일이 **없다** (`.tmp/`는 gitignore다)
 *   ② `file_column.sample_value`가 생겼다 (마이그레이션 009) — 「구매자명」 열의
 *      표본은 **실명**이다. 스냅샷을 그대로 내보내면 그게 함께 나간다
 *
 * 그래서 **커밋된 비식별화 픽스처로 여기서 만든다.** 얻는 것이 셋이다:
 *
 *   · 개인정보가 구조적으로 없다 — 비식별화는 이미 끝나 있다(`fixtures/clean`)
 *   · 회사 실적이 안 나간다 — 픽스처는 예시 파일이다
 *   · **재현 가능하다** — 어느 기기에서든 같은 명령으로 같은 DB가 나온다
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 적재는 `runImport` 하나다 ★
 * `pnl.ts`가 그렇게 하는 이유와 같다 — 여기서 따로 루프를 쓰면 «웹판 숫자 ≠ CLI
 * 숫자»가 구조적 보장에서 검사 항목으로 내려간다.
 */

import { readFileSync, mkdirSync, rmSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { openNodeDriver } from "../../src/core/store/driver-node.js"
import { migrate } from "../../src/core/store/migrate-node.js"
import { Repository } from "../../src/core/store/repository.js"
import { runImport } from "../../src/core/import/run.js"
import { runReferenceImport } from "../../src/core/import/run-reference.js"
import { analyzeImport } from "../../src/core/import/analyze.js"
import type { MappingProfile } from "../../src/core/import/mapping/index.js"
import { FIXTURES, fixturePath, CLEAN_DIR } from "../../tests/fixtures.js"

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, "..", "..")
const PROFILE_DIR = join(ROOT, "src", "packs", "kr-marketplace", "profiles")

const arg = (name: string, dflt: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : dflt
}
const OUT = join(ROOT, arg("out", "public/demo.sqlite"))

/**
 * 담을 파일들.
 *
 * ★ 쿠팡 광고(#13 · 8만 행)는 **뺐다** ★ `pnl.ts`는 그걸 넣지만, 여기 목적은
 * «화면을 눈으로 보는 것»이고 8만 행은 DB를 수십 MB로 부풀려 **첫 로딩이
 * 네트워크로 넘어간다**. 광고비 층이 비면 커버리지 화면이 그 사실을 말하므로
 * (§22) 조용한 결손이 아니다.
 */
const TARGETS = [
  { fixture: 6, profile: "11st-settlement@1.json", conn: "conn-11st" },
  { fixture: 8, profile: "esm-order@1.json", conn: "conn-esm" },
  { fixture: 9, profile: "selfshop-order@1.json", conn: "conn-selfshop" },
]

const LIB = "lib-1"
const NOW = "2026-08-18T00:00:00.000Z"

mkdirSync(dirname(OUT), { recursive: true })
for (const s of ["", "-wal", "-shm"]) {
  try {
    rmSync(OUT + s)
  } catch {
    /* 없으면 그만 */
  }
}

const db = openNodeDriver(OUT)
await migrate(db)
const repo = new Repository(db)
await repo.ensureLibrary(LIB, "기본", NOW)

console.log("데모 DB 생성 — 비식별화 픽스처로 만든다 (실데이터 아님)\n")

for (const t of TARGETS) {
  const f = FIXTURES.find((x) => x.id === t.fixture)!
  const profile = JSON.parse(
    readFileSync(join(PROFILE_DIR, t.profile), "utf-8"),
  ) as MappingProfile

  await repo.ensureConnection(
    {
      id: t.conn,
      libraryId: LIB,
      packId: profile.packId,
      marketplaceKey: profile.marketplaceKey,
      displayName: profile.displayName,
    },
    NOW,
  )

  const r = await runImport(repo, {
    bytes: new Uint8Array(readFileSync(fixturePath(f, CLEAN_DIR))),
    fileName: f.file,
    profile,
    sheetIndex: 0,
    libraryId: LIB,
    connectionId: t.conn,
    batchId: `demo-${t.conn}`,
    now: NOW,
  })

  const per = [...r.perTable].map(([k, n]) => `${k} ${n}`).join(" · ")
  console.log(`  ${profile.displayName.padEnd(18)} ${per}`)
}

/**
 * ★ 원가 — **기준 데이터의 문으로 들어온다** (2026-08-18) ★
 *
 * 이게 없으면 데모 대시보드의 마진이 100%로 뜬다. 그건 「원가가 없다」는 뜻인데
 * 화면만 보면 「엄청 남는 장사」로 읽힌다 — 데모가 거짓말하는 자리다.
 *
 * 픽스처 #3의 워크북 안에 원가표 시트가 있고, **어느 시트인지는 판정이 찾는다**
 * (번호를 박아 두면 픽스처가 바뀔 때 조용히 엉뚱한 시트를 넣는다).
 */
{
  const f = FIXTURES.find((x) => x.id === 3)!
  const profile = JSON.parse(
    readFileSync(join(PROFILE_DIR, "cost-master@1.json"), "utf-8"),
  ) as MappingProfile
  const bytes = new Uint8Array(readFileSync(fixturePath(f, CLEAN_DIR)))
  const a = await analyzeImport(bytes, f.file, [profile])
  const hit = a.sheetMatches.find((m) => m.profiles.length > 0)

  if (hit === undefined) {
    console.log("  ⚠ 원가표 시트를 못 찾았다 — 원가 없이 만든다")
  } else {
    const r = await runReferenceImport(repo, {
      bytes,
      fileName: f.file,
      profile,
      sheetIndex: hit.sheetIndex,
      libraryId: LIB,
      // 데모 데이터가 2025-10 ~ 2026-07에 걸쳐 있다. 그 앞에 세워야 전 기간에 붙는다.
      effectiveFrom: "2025-01-01",
      now: NOW,
    })
    console.log(
      `  ${"내 원가표".padEnd(18)} 원가 ${r.inserted}건 · SKU ${r.createdSkus}개 신규 · ` +
        `못 찾음 ${r.unmatched} (아직 안 판 상품 — 정상)`,
    )
  }
}

/**
 * ★ 고정비 — **손익 3층의 마지막 줄** (2026-08-19) ★
 *
 * 이게 없으면 데모의 순이익이 채널 기여이익과 **한 푼도 다르지 않다.** 화면만
 * 보면 「고정비가 0원인 회사」로 읽히는데, 실제로는 넣을 자리가 없었던 것이다.
 *
 * 금액은 목업 시드와 같은 규모를 쓴다 — 예시 파일의 매출 규모에 맞춰 순이익이
 * 적자로 처박히지 않되, 고정비가 손익을 실제로 움직이는 것이 보이는 크기다.
 * **실데이터가 아니다** (픽스처와 같은 성격).
 */
{
  const items: readonly [string, number][] = [
    ["사무실 임대료", 1_800_000],
    ["인건비", 3_200_000],
    ["창고 보관료", 940_000],
    ["소프트웨어 · 통신", 380_000],
  ]
  for (const [label, amount] of items) {
    await repo.setOverhead({
      libraryId: LIB,
      kind: "FIXED",
      basis: "MONTH",
      label,
      amount,
      // 데모 데이터가 2025-10 ~ 2026-07에 걸쳐 있다. 원가와 같은 날에 세운다.
      effectiveFrom: "2025-01-01",
      now: NOW,
    })
  }
  const total = items.reduce((n, [, a]) => n + a, 0)
  console.log(`  ${"고정비".padEnd(18)} ${items.length}항목 · 월 ${total.toLocaleString("ko-KR")}원`)
}

// VACUUM으로 조여서 정적 자산 크기를 줄인다. 웹판은 이 파일을 통째로 받는다.
await db.exec("VACUUM")
await db.close()

const mb = (statSync(OUT).size / 1024 / 1024).toFixed(2)
console.log(`\n→ ${OUT}  (${mb}MB)`)
