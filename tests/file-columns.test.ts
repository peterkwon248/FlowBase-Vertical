/**
 * ③ **앱이 헤더를 저장한다** — 설계 합의의 빠진 한 칸 (마이그레이션 009).
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 이 테스트가 지키는 것 ★
 *
 * 「모든 파일의 헤더를 저장한다」에서 **모든**이 핵심이다. 매칭에 성공한 파일만
 * 남기면 정작 잃고 있던 쪽 — 프로파일이 없어 통째로 증발하던 파일 — 이 또 증발한다.
 * 그래서 여기서 가장 중요한 케이스는 `profileId: null · batchId: null`이다.
 *
 * ★ 왜 지금 이게 필요한지의 실물 ★
 * 사용자의 실제 파일 둘을 열어보니 **같은 11번가 양식이 한 파일에서 63열, 다른
 * 파일에서 60열**이었다(앱의 `HeaderDetection` 기준). 헤더를 안 남기니 오늘까지
 * 아무도 그 차이를 몰랐다.
 * 열 이름을 남기는 것이 §20 드리프트의 전제다.
 *
 * ★ 파서를 부르지 않는다 ★
 * 값(헤더 문자열 + 표본 행)만으로 도는 계층이라 SheetJS 없이 검증된다. 이 파일이
 * 그 경계를 실제로 지키는지도 함께 재는 셈이다 (ADR-011 계열).
 * ─────────────────────────────────────────────────────────────
 */

import { describe, it, expect, beforeEach } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import type { Driver } from "../src/core/store/driver.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository, type FileSightingRecord } from "../src/core/store/repository.js"
import { describeColumns, SAMPLE_MAX } from "../src/core/import/columns.js"
import type { RawRow } from "../src/core/import/types.js"
import { readFileSync, existsSync } from "node:fs"
import { analyzeImport } from "../src/core/import/analyze.js"
import { runImport } from "../src/core/import/run.js"
import type { MappingProfile } from "../src/core/import/mapping/index.js"
import { FIXTURES, fixturePath, CLEAN_DIR } from "./fixtures.js"

const LIB = "lib-1"
const CONN = "conn-1"
const AT = "2026-08-18T00:00:00Z"

async function seed(db: Driver): Promise<void> {
  await migrate(db)
  await db
    .prepare(`INSERT INTO library (id, name, created_at) VALUES (?,?,?)`)
    .run(LIB, "기본", AT)
  await db
    .prepare(
      `INSERT INTO connection (id, library_id, pack_id, marketplace_key, display_name, state, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)`,
    )
    .run(CONN, LIB, "kr-marketplace", "mk-a", "연결 1", "CONNECTED", AT, AT)
}

/** 실제 파일에서 뽑은 모양 — ESM 「매출정리 raw」의 앞부분이다. */
const HEADERS = ["날짜", "진행상태", "주문번호", "상품명", "구매금액"]
const ROWS: RawRow[] = [
  ["2026-07-01", "배송완료", "20260701119", "머레이 A형", 25000],
  ["2026-07-02", "배송완료", "20260702250", "머레이 B형", 31000],
]

function sighting(over: Partial<FileSightingRecord> = {}): FileSightingRecord {
  return {
    libraryId: LIB,
    sourceHash: "abc123",
    sourceName: "매출정리.xlsx",
    sourceBytes: 4096,
    containerFormat: "xlsx",
    sheetIndex: 5,
    sheetName: "매출정리 raw",
    headerRowIndex: 0,
    profileId: null,
    batchId: null,
    at: AT,
    columns: describeColumns(HEADERS, ROWS),
    ...over,
  }
}

// ═══════════════════════════════════════════════════════════════
describe("describeColumns — 판단이 아니라 서술이다", () => {
  it("열마다 순번·이름·표본·추정 종류가 나온다", () => {
    const cols = describeColumns(HEADERS, ROWS)
    expect(cols).toHaveLength(5)
    expect(cols[0]).toMatchObject({ ordinal: 0, header: "날짜", sample: "2026-07-01" })
    expect(cols[0]?.kind).toBe("date")
    expect(cols[4]).toMatchObject({ ordinal: 4, header: "구매금액", sample: "25000" })
    expect(cols[4]?.kind).toBe("number")
  })

  it("★ 주문번호는 identifier로 남는다 — 숫자로 바꾸면 정밀도를 잃는다 (대조표 함정 #3)", () => {
    const cols = describeColumns(HEADERS, ROWS)
    expect(cols[2]?.kind).toBe("identifier")
  })

  it("근거가 %가 아니라 **문장**이다 (§20 규칙 2)", () => {
    const cols = describeColumns(HEADERS, ROWS)
    for (const c of cols) {
      expect(c.reason.length).toBeGreaterThan(0)
      expect(typeof c.reason).toBe("string")
    }
  })

  it("★ 열 수는 헤더가 정한다 — 데이터 행의 꼬리를 열로 세지 않는다", () => {
    const ragged: RawRow[] = [["2026-07-01", "배송완료", "1", "가", 1, "꼬리", "꼬리2"]]
    expect(describeColumns(HEADERS, ragged)).toHaveLength(5)
  })

  it("이름이 겹치는 열도 순번으로 갈린다 — 이름은 키가 못 된다", () => {
    const cols = describeColumns(["금액", "금액"], [[1, 2]])
    expect(cols.map((c) => c.ordinal)).toEqual([0, 1])
    expect(cols.map((c) => c.sample)).toEqual(["1", "2"])
  })

  it("빈 이름 열도 버리지 않는다 — 빼면 순번이 밀린다", () => {
    const cols = describeColumns(["날짜", "  ", "금액"], [["2026-07-01", null, 100]])
    expect(cols).toHaveLength(3)
    expect(cols[1]).toMatchObject({ ordinal: 1, header: "", sample: null })
    expect(cols[2]?.ordinal).toBe(2)
  })

  it("표본이 없는 열은 null이다 — 「빈 열」도 사실이다", () => {
    const cols = describeColumns(["비고"], [[null], ["   "]])
    expect(cols[0]?.sample).toBeNull()
  })

  it("긴 값은 잘린다 — 셀 하나가 DB를 부풀리지 않는다", () => {
    const long = "가".repeat(SAMPLE_MAX + 50)
    const cols = describeColumns(["옵션"], [[long]])
    expect(cols[0]?.sample).toHaveLength(SAMPLE_MAX)
  })
})

// ═══════════════════════════════════════════════════════════════
describe("recordFileSighting — 적재와 무관하게 남는다", () => {
  let db: Driver
  let repo: Repository

  beforeEach(async () => {
    db = openNodeDriver()
    await seed(db)
    repo = new Repository(db)
  })

  it("★ 프로파일이 없어도 남는다 — 이게 이 표를 만든 이유다 ★", async () => {
    const id = await repo.recordFileSighting(sighting())

    const [seen] = await repo.fileSightings(LIB)
    expect(seen?.["profile_id"]).toBeNull()
    expect(seen?.["batch_id"]).toBeNull()
    expect(seen?.["source_name"]).toBe("매출정리.xlsx")
    expect(seen?.["sheet_name"]).toBe("매출정리 raw")
    expect(seen?.["column_count"]).toBe(5)

    const cols = await repo.fileColumns(id)
    expect(cols.map((c) => c["header"])).toEqual(HEADERS)
  })

  it("열은 순번 순서로 돌아온다 — 화면이 파일과 같은 순서로 그린다", async () => {
    const id = await repo.recordFileSighting(sighting())
    const cols = await repo.fileColumns(id)
    expect(cols.map((c) => c["ordinal"])).toEqual([0, 1, 2, 3, 4])
  })

  it("헤더를 못 찾았으면 null이다 — 0으로 넘겨짚지 않는다", async () => {
    const id = await repo.recordFileSighting(sighting({ headerRowIndex: null }))
    const [seen] = await repo.fileSightings(LIB)
    expect(seen?.["header_row_index"]).toBeNull()
    expect(await repo.fileColumns(id)).toHaveLength(5)
  })

  it("같은 (지문 · 시트)를 다시 보면 행이 늘지 않고 seen_count가 오른다", async () => {
    await repo.recordFileSighting(sighting())
    await repo.recordFileSighting(sighting({ at: "2026-08-19T00:00:00Z" }))

    const rows = await repo.fileSightings(LIB)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.["seen_count"]).toBe(2)
    expect(rows[0]?.["first_seen_at"]).toBe(AT)
    expect(rows[0]?.["last_seen_at"]).toBe("2026-08-19T00:00:00Z")
  })

  it("이름만 바꿔 다시 넣으면 마지막 이름으로 갱신된다 (006과 같은 상황)", async () => {
    await repo.recordFileSighting(sighting())
    await repo.recordFileSighting(sighting({ sourceName: "매출정리(사본).xlsx" }))

    const rows = await repo.fileSightings(LIB)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.["source_name"]).toBe("매출정리(사본).xlsx")
  })

  it("★ 다른 시트는 다른 목격이다 — 한 파일에 원가·매출·광고가 같이 있다", async () => {
    await repo.recordFileSighting(sighting({ sheetIndex: 5, sheetName: "매출정리 raw" }))
    await repo.recordFileSighting(
      sighting({
        sheetIndex: 8,
        sheetName: "상품별원가 raw",
        columns: describeColumns(["상품번호", "상품명", "원가"], [["1", "가", 1000]]),
      }),
    )

    const rows = await repo.fileSightings(LIB)
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r["sheet_name"]).sort()).toEqual(["매출정리 raw", "상품별원가 raw"])
  })

  it("열은 통째로 갈린다 — 시트를 다시 고르면 옛 열이 남지 않는다", async () => {
    const id = await repo.recordFileSighting(sighting())
    await repo.recordFileSighting(
      sighting({ columns: describeColumns(["날짜", "금액"], [["2026-07-01", 100]]) }),
    )

    const cols = await repo.fileColumns(id)
    expect(cols.map((c) => c["header"])).toEqual(["날짜", "금액"])
  })

  it("★ 뒤이은 «그냥 열어보기»가 batch_id를 지우지 않는다 ★", async () => {
    await db
      .prepare(
        `INSERT INTO batch (id, library_id, connection_id, source_name, source_bytes,
                            container_format, mapping_version, status, started_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .run("b-1", LIB, CONN, "매출정리.xlsx", 4096, "xlsx", "mk-a/order@1", "committed", AT)

    await repo.recordFileSighting(sighting({ profileId: "mk-a/order", batchId: "b-1" }))
    // 적재 뒤에 같은 파일을 위저드로 다시 열어본다 — 배치는 아직 없다는 얼굴로 온다.
    await repo.recordFileSighting(sighting({ profileId: "mk-a/order", batchId: null }))

    const rows = await repo.fileSightings(LIB)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.["batch_id"]).toBe("b-1")
  })

  it("★ 배치가 사라져도 배운 것은 남는다 — 되돌리기 한 번에 사전이 초기화되지 않는다", async () => {
    await db
      .prepare(
        `INSERT INTO batch (id, library_id, connection_id, source_name, source_bytes,
                            container_format, mapping_version, status, started_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .run("b-1", LIB, CONN, "매출정리.xlsx", 4096, "xlsx", "mk-a/order@1", "committed", AT)

    const id = await repo.recordFileSighting(sighting({ profileId: "mk-a/order", batchId: "b-1" }))
    await db.prepare(`DELETE FROM batch WHERE id = ?`).run("b-1")

    const rows = await repo.fileSightings(LIB)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.["batch_id"]).toBeNull()
    expect(rows[0]?.["profile_id"]).toBe("mk-a/order")
    expect(await repo.fileColumns(id)).toHaveLength(5)
  })

  it("목격을 지우면 열도 함께 간다 (CASCADE) — 고아 열이 남지 않는다", async () => {
    const id = await repo.recordFileSighting(sighting())
    await db.prepare(`DELETE FROM file_sighting WHERE id = ?`).run(id)
    expect(await repo.fileColumns(id)).toHaveLength(0)
  })

  it("열이 0개인 시트도 목격은 남는다 — 「빈 시트를 봤다」도 사실이다", async () => {
    const id = await repo.recordFileSighting(sighting({ columns: [] }))
    const rows = await repo.fileSightings(LIB)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.["column_count"]).toBe(0)
    expect(await repo.fileColumns(id)).toHaveLength(0)
  })

  it("★ 같은 양식의 열 수 차이가 보인다 — 63 vs 61 (드리프트의 전제)", async () => {
    const wide = Array.from({ length: 63 }, (_, i) => `열${i}`)
    const narrow = Array.from({ length: 61 }, (_, i) => `열${i}`)
    await repo.recordFileSighting(
      sighting({ sourceHash: "file-a", sheetIndex: 11, columns: describeColumns(wide, []) }),
    )
    await repo.recordFileSighting(
      sighting({ sourceHash: "file-b", sheetIndex: 7, columns: describeColumns(narrow, []) }),
    )

    const rows = await repo.fileSightings(LIB)
    expect(rows.map((r) => r["column_count"]).sort((a, b) => Number(a) - Number(b))).toEqual([
      61, 63,
    ])
  })
})

// ═══════════════════════════════════════════════════════════════
/**
 * 실파일 관통 — **배선된 두 자리가 진짜로 남기는지.**
 *
 * 위의 단위 테스트는 「저장 계층이 옳다」를 본다. 여기는 「가져오기가 실제로
 * 그걸 부른다」를 본다. 둘은 다른 질문이고, 후자가 빠지면 표만 있고 아무도
 * 안 쓰는 상태가 조용히 유지된다 — 배선 게이트(`npm run wiring`)를 만든 이유와 같다.
 */
const FIX = FIXTURES.find((f) => f.id === 6)!
const FIX_PATH = fixturePath(FIX, CLEAN_DIR)
const PROFILE_PATH = "src/packs/kr-marketplace/profiles/11st-settlement@1.json"
const FIX_CONN = "conn-11st"

const ready = existsSync(FIX_PATH)
const run = ready ? describe : describe.skip
if (!ready) console.warn("[file-columns] fixtures/clean이 없어 관통 검증을 건너뛴다")

run("실파일 관통 — 열 이름이 실제로 남는다", () => {
  let db: Driver
  let repo: Repository
  const bytes = (): Uint8Array => new Uint8Array(readFileSync(FIX_PATH))
  const profile = (): MappingProfile =>
    JSON.parse(readFileSync(PROFILE_PATH, "utf-8")) as MappingProfile

  beforeEach(async () => {
    db = openNodeDriver()
    await seed(db)
    repo = new Repository(db)
  })

  it("★ 프로파일이 하나도 없어도 열은 서술된다 — 「넣을 수 없다」의 반대편", async () => {
    // 프로파일 목록을 **비워서** 부른다. 미지의 양식을 만난 상황 그대로다.
    const a = await analyzeImport(bytes(), FIX.file, [])
    expect(a.profiles).toHaveLength(0)
    expect(a.columns.length).toBeGreaterThan(0)
    expect(a.columns.every((c) => typeof c.kind === "string")).toBe(true)
  })

  it("★ runImport가 목격을 남긴다 — 배치·프로파일이 붙는다", async () => {
    const p = profile()
    await repo.ensureConnection(
      {
        id: FIX_CONN,
        libraryId: LIB,
        packId: p.packId,
        marketplaceKey: p.marketplaceKey,
        displayName: p.displayName,
      },
      AT,
    )
    await runImport(repo, {
      bytes: bytes(),
      fileName: FIX.file,
      profile: p,
      sheetIndex: 0,
      libraryId: LIB,
      connectionId: FIX_CONN,
      batchId: "b-run",
      now: AT,
    })

    const rows = await repo.fileSightings(LIB)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.["batch_id"]).toBe("b-run")
    expect(rows[0]?.["profile_id"]).toBe(p.id)
    expect(rows[0]?.["source_name"]).toBe(FIX.file)
  })

  it("★ 매핑되지 않은 열의 **이름**이 남는다 — 지금까지 수 하나로 뭉개지던 것", async () => {
    const p = profile()
    await repo.ensureConnection(
      {
        id: FIX_CONN,
        libraryId: LIB,
        packId: p.packId,
        marketplaceKey: p.marketplaceKey,
        displayName: p.displayName,
      },
      AT,
    )
    const r = await runImport(repo, {
      bytes: bytes(),
      fileName: FIX.file,
      profile: p,
      sheetIndex: 0,
      libraryId: LIB,
      connectionId: FIX_CONN,
      batchId: "b-run",
      now: AT,
    })

    const [seen] = await repo.fileSightings(LIB)
    const cols = await repo.fileColumns(Number(seen?.["id"]))

    // 파일이 가진 열 전부가 남는다 — 매핑된 소수가 아니라.
    expect(cols.length).toBe(r.header.columns.length)
    // 그리고 그 수는 「매핑 안 된 열 수」보다 크다. 이 부등식이 곧 이번 작업이다:
    // 예전에는 이름 없이 **수만** 알았다.
    expect(cols.length).toBeGreaterThan(r.unmappedColumnCount)
    expect(cols.every((c) => typeof c["header"] === "string")).toBe(true)
  })
})
