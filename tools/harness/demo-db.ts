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

// VACUUM으로 조여서 정적 자산 크기를 줄인다. 웹판은 이 파일을 통째로 받는다.
await db.exec("VACUUM")
await db.close()

const mb = (statSync(OUT).size / 1024 / 1024).toFixed(2)
console.log(`\n→ ${OUT}  (${mb}MB)`)
