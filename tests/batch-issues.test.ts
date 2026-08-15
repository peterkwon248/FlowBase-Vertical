/**
 * 비치명 오류의 목적지 — **「적재됐지만 온전하지 않은 행」** (마이그레이션 008).
 *
 * ★ 왜 이 게이트가 필요한가 ★
 * `MappingError.fatal === false`는 `ImportRunResult.mappingErrors`에 담긴 채 함수가
 * 끝나면 사라졌다 — 앱 표면에 **한 곳도** 닿지 않았다. 「사전에 없는 상태값이 기본
 * 경로로 흘러 들어갔다」·「선언한 컬럼이 파일에 없어 그 값이 전 행에서 빈다」가
 * 아무 데도 안 남는다는 뜻이고, 적재는 됐으니 조용한 «실패»는 아니지만 **조용한
 * 결손**이다.
 *
 * ★ 오늘 픽스처 6종은 전부 0건이다 (실측) ★
 * 그래서 정상 경로가 답할 수 있는 것은 «거짓 경보를 울리지 않는다»뿐이고,
 * «계기판이 살아 있는가»는 합성이 답한다 (ADR-007). 합성은 이름에 「[합성]」을 단다.
 */

import { describe, expect, it } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository } from "../src/core/store/repository.js"
import { runImport } from "../src/core/import/run.js"
import { digestRows } from "../src/app/import.js"
import { ISSUE_KINDS, NONFATAL_CODES, type IssueCode } from "../src/core/import/issues.js"
import type { MappingProfile } from "../src/core/import/mapping/index.js"
import type { Driver } from "../src/core/store/driver.js"
import { FIXTURES, fixturePath, CLEAN_DIR } from "./fixtures.js"

const LIB = "lib-1"
const NOW = "2026-08-15T00:00:00"

const ESM = FIXTURES.find((x) => x.id === 8)
const ready = ESM !== undefined && existsSync(fixturePath(ESM, CLEAN_DIR))
const run = ready ? describe : describe.skip
if (!ready) console.warn("[batch-issues] ESM 픽스처가 없어 건너뛴다")

const profile = (): MappingProfile =>
  JSON.parse(
    readFileSync("src/packs/kr-marketplace/profiles/esm-order@1.json", "utf-8"),
  ) as MappingProfile

async function fresh(): Promise<{ db: Driver; repo: Repository }> {
  const db = openNodeDriver(":memory:")
  await migrate(db)
  const repo = new Repository(db)
  await repo.ensureLibrary(LIB, "기본", NOW)
  const p = profile()
  await repo.ensureConnection(
    {
      id: "c1",
      libraryId: LIB,
      packId: p.packId,
      marketplaceKey: p.marketplaceKey,
      displayName: p.displayName,
    },
    NOW,
  )
  return { db, repo }
}

async function importWith(repo: Repository, p: MappingProfile, batchId = "b1") {
  return runImport(repo, {
    bytes: new Uint8Array(readFileSync(fixturePath(ESM!, CLEAN_DIR))),
    fileName: ESM!.file,
    profile: p,
    sheetIndex: 0,
    libraryId: LIB,
    connectionId: "c1",
    batchId,
    now: NOW,
  })
}

// ─────────────────────────────────────────────────────────────
// 선언표 — 목적지가 코드에 붙어 있다
// ─────────────────────────────────────────────────────────────

describe("사유 코드 선언표", () => {
  it("치명 여부는 표가 정한다 — 부르는 자리가 아니다", () => {
    // `fatal`을 인자로 받던 시절에는 같은 사유가 두 곳에서 다르게 판정될 수 있었다.
    // 이제 코드값 하나가 목적지를 정하므로 그 상태 자체가 없다 (C 계열의 교훈).
    expect(ISSUE_KINDS.required_empty.fatal).toBe(true)
    expect(ISSUE_KINDS.unknown_route.fatal).toBe(false)
  })

  it("파일 사건은 행 좌표를 갖지 않는다", () => {
    // 「컬럼이 없다」를 행 사건으로 세면 «온전하지 않은 행 1건»이 되는데
    // 실제로는 전 행이 그 결손을 겪는다.
    expect(ISSUE_KINDS.missing_column.scope).toBe("file")
    expect(ISSUE_KINDS.item_key_missing.scope).toBe("file")
  })

  it("비치명 코드는 **전부** 화면 문구를 갖는다", () => {
    // 목적지만 만들고 문구를 안 붙이면 화면에 코드값이 그대로 뜬다 — 사용자에게는
    // «unknown_route»가 아무 말도 아니다.
    const shown = digestRows(
      {
        id: "b", sourceName: "f", containerFormat: "xlsx", sheetName: null,
        status: "committed", rowCount: 1, excludedCount: 0,
        startedAt: NOW, committedAt: NOW, exclusionsByReason: [],
        inserted: 1, updated: 0, merged: 0,
        incompleteRows: 1,
        issuesByCode: NONFATAL_CODES.filter((c) => ISSUE_KINDS[c].scope === "row").map((c) => ({
          code: c, rows: 1,
        })),
        fileIssues: NONFATAL_CODES.filter((c) => ISSUE_KINDS[c].scope === "file").map((c) => ({
          code: c, detail: "detail",
        })),
      },
      [],
    )
    // 줄 수 = 코드 수 + 합계 한 줄(행 사유가 둘 이상일 때만 뜬다).
    // 하나가 통째로 안 그려지는 것도 여기서 잡힌다
    expect(shown).toHaveLength(NONFATAL_CODES.length + 1)
    for (const code of NONFATAL_CODES) {
      // 문구가 없으면 `ISSUE_LABEL[code] ?? code`가 코드값을 그대로 내보낸다
      expect(shown.some((r) => r.label === code), `${code}의 화면 문구가 없다`).toBe(false)
    }
  })
})

// ─────────────────────────────────────────────────────────────
// 실파일 — 거짓 경보를 울리지 않는다
// ─────────────────────────────────────────────────────────────

run("정상 파일 — 할 말이 없으면 안 한다", () => {
  it("ESM 155행: 사건 0건이고 다이제스트에 줄이 없다", async () => {
    const { db, repo } = await fresh()
    try {
      await importWith(repo, profile())
      const d = (await repo.batchDigest("b1"))!

      expect(d.incompleteRows, "오늘 픽스처는 비치명 사건이 없다").toBe(0)
      expect(d.issuesByCode).toEqual([])
      expect(d.fileIssues).toEqual([])

      // 치명 5건은 여전히 **제외**로 간다 — 목적지가 갈렸을 뿐 옛 경로는 그대로다
      expect(d.excludedCount).toBe(5)
      expect(digestRows(d, []).some((r) => r.label.includes("온전하지"))).toBe(false)
    } finally {
      await db.close()
    }
  })

  it("사건 기록은 어떤 카운터도 올리지 않는다", async () => {
    const { db, repo } = await fresh()
    try {
      const p = profile() as unknown as { fieldMappings: { source?: string }[] }
      // 없는 컬럼 하나 → 파일 사건 1건. 그래도 항등식의 어느 항도 안 움직인다
      p.fieldMappings[p.fieldMappings.length - 1]!.source = "이_파일에_없는_컬럼"
      await importWith(repo, p as unknown as MappingProfile)
      const d = (await repo.batchDigest("b1"))!

      expect(d.fileIssues.length, "사건은 남았다").toBeGreaterThan(0)
      expect(d.excludedCount, "제외는 그대로 5다 — 사건은 제외가 아니다").toBe(5)
      expect(d.rowCount, "「가져온 행」도 그대로다").toBe(155)
      expect(d.inserted + d.merged, "적재 분해도 그대로다").toBe(164)
    } finally {
      await db.close()
    }
  })
})

// ─────────────────────────────────────────────────────────────
// 합성 — 픽스처가 도달 못 하는 세계 (ADR-007)
// ─────────────────────────────────────────────────────────────

/**
 * 오늘 프로파일 6종은 파일과 어긋난 데가 없다(실측: 비치명 사건 0건). 즉 이
 * 계기판이 가리키는 축이 상수 0으로 눌려 있어, **살아 있는지를 픽스처로는 물을 수
 * 없다.** 그래서 프로파일을 일부러 어긋나게 만든다 — 답하는 것은 «분기가 살아
 * 있는가»뿐이고 값의 정확성은 정상 경로 쪽 게이트가 답한다.
 */
run("[합성] 마켓이 새 상태를 내보내면 보인다", () => {
  it("[합성] knownValues에서 6종 중 둘을 빼면 그 행들이 사유별로 선다", async () => {
    const { db, repo } = await fresh()
    try {
      const p = profile() as unknown as {
        rowRouting: { routes: { match: string[] }[]; knownValues: string[] }
      }
      // 라우팅이 잡는 4종만 남긴다 → 기본 경로로 가는 행의 상태값이 «모르는 값»이 된다.
      // 쿠팡이 컬럼 값 표기를 바꾸는 날 실제로 일어나는 일이다.
      p.rowRouting.knownValues = p.rowRouting.routes.flatMap((r) => r.match)
      await importWith(repo, p as unknown as MappingProfile)
      const d = (await repo.batchDigest("b1"))!

      const hit = d.issuesByCode.find((x) => x.code === "unknown_route")
      expect(hit, "사유별 목록에 서야 한다").toBeDefined()
      expect(hit!.rows).toBe(d.incompleteRows)
      // 155행 중 클레임 9행은 라우팅이 잡으므로 나머지가 «모르는 값»이다
      expect(hit!.rows).toBe(146)

      // ★ 제외가 아니다 ★ 이 행들은 전부 적재됐다
      expect(d.excludedCount).toBe(5)
      expect(d.rowCount).toBe(155)

      const line = digestRows(d, []).find((r) => r.label.includes("새 상태"))
      expect(line, "다이제스트가 말해야 한다").toBeDefined()
      expect(line!.value).toBe("146행")
    } finally {
      await db.close()
    }
  })

  /**
   * ★ 한 행이 둘 다일 수 있다 ★
   * 라우팅 값이 사전에 없다고 보고한 **직후** 필수 필드가 비어 그 행이 통째로
   * 빠지는 경우다. 거르지 않으면 그 행이 「제외」와 「적재됐지만 온전하지 않은 행」에
   * 동시에 서고, 뒤 문장은 그 행에 대해 거짓이다.
   */
  it("[합성] 치명으로 빠진 행은 «온전하지 않은 행»에 들어가지 않는다", async () => {
    const { db, repo } = await fresh()
    try {
      const p = profile() as unknown as {
        rowRouting: { routes: { match: string[] }[]; knownValues: string[] }
        fieldMappings: { target: string; source?: string; required?: boolean }[]
      }
      // ① 기본 경로 행 전부가 «모르는 상태값»이 된다 (비치명 보고가 먼저 나간다)
      p.rowRouting.knownValues = p.rowRouting.routes.flatMap((r) => r.match)
      // ② 그리고 **그 직후** 같은 행이 필수 필드 없음으로 통째로 빠진다.
      //    두 사건이 한 행에서 겹치는 세계를 일부러 만든 것이다 — ESM 픽스처의
      //    치명 5행은 전부 클레임 경로라 이 겹침을 만들지 못한다
      const victim = p.fieldMappings.find((m) => m.source !== undefined)!
      victim.source = "없는_필수_컬럼"
      victim.required = true
      await importWith(repo, p as unknown as MappingProfile)

      const d = (await repo.batchDigest("b1"))!
      // 파일 160행 = 적재 155 + 원래 제외 5. 이제 그 155도 전부 빠진다
      expect(d.excludedCount, "파일의 모든 행이 빠진다").toBe(160)
      expect(d.rowCount, "적재된 행이 없다").toBe(0)
      expect(d.incompleteRows, "적재된 행이 없으면 «온전하지 않은 행»도 없다").toBe(0)

      // 두 목록이 **한 행도 겹치지 않는지**를 직접 묻는다. 거르지 않았다면 146이다
      const both = await db
        .prepare(
          `SELECT COUNT(*) AS n FROM batch_issue i
             JOIN batch_exclusion e
               ON e.batch_id = i.batch_id AND e.row_index = i.row_index
            WHERE i.batch_id = 'b1' AND i.scope = 'row'`,
        )
        .get()
      expect(Number(both?.["n"] ?? -1), "제외된 행이 사건 목록에도 있으면 두 번 세어진다").toBe(0)
    } finally {
      await db.close()
    }
  })
})

run("[합성] 프로파일이 파일을 따라잡지 못하면 보인다", () => {
  it("[합성] 없는 컬럼은 **행 수가 아니라 파일 사건**으로 선다", async () => {
    const { db, repo } = await fresh()
    try {
      const p = profile() as unknown as { fieldMappings: { target: string; source?: string }[] }
      const victim = p.fieldMappings[p.fieldMappings.length - 1]!
      victim.source = "쿠팡이_이름을_바꾼_컬럼"
      await importWith(repo, p as unknown as MappingProfile)
      const d = (await repo.batchDigest("b1"))!

      expect(d.incompleteRows, "행 사건이 아니다 — 전 행이 겪는 결손이다").toBe(0)
      expect(d.fileIssues).toHaveLength(1)
      expect(d.fileIssues[0]!.code).toBe("missing_column")
      expect(d.fileIssues[0]!.detail).toContain("쿠팡이_이름을_바꾼_컬럼")

      const line = digestRows(d, []).find((r) => r.label.includes("없는 컬럼"))
      expect(line, "다이제스트가 말해야 한다").toBeDefined()
    } finally {
      await db.close()
    }
  })

  it("[합성] 한 컬럼이 여러 필드에 쓰여도 한 줄이다 — 사실은 «이 컬럼이 없다» 하나다", async () => {
    const { db, repo } = await fresh()
    try {
      const p = profile() as unknown as { fieldMappings: { source?: string }[] }
      const withSource = p.fieldMappings.filter((m) => m.source !== undefined)
      expect(withSource.length, "두 개 이상을 겨눌 수 있어야 한다").toBeGreaterThan(1)
      withSource[0]!.source = "사라진_컬럼"
      withSource[1]!.source = "사라진_컬럼"
      await importWith(repo, p as unknown as MappingProfile)
      const d = (await repo.batchDigest("b1"))!

      // 두 Canonical 필드가 비지만 사용자의 처방은 하나다 — 「그 컬럼을 확인하라」
      expect(d.fileIssues).toHaveLength(1)
      expect(d.fileIssues[0]!.detail).toContain("사라진_컬럼")
      // 화면에 나가는 문장이므로 우리 스키마의 컬럼명이 섞이지 않는다 (헌장 C-4)
      expect(d.fileIssues[0]!.detail).not.toContain(":")
    } finally {
      await db.close()
    }
  })

  /**
   * `mapRows`는 청크마다 새로 돌고 «컬럼당 한 번» 상태도 청크 안에서만 유지된다.
   * 155행/청크 1,000이라 이 파일은 청크가 하나지만, 8만 행 파일이면 같은 컬럼이
   * 80번 보고된다 — 그대로 넣으면 「없는 컬럼 80건」이 되어 수가 거짓말이 된다.
   */
  it("[합성] 청크가 여럿이어도 없는 컬럼은 한 줄이다", async () => {
    const { db, repo } = await fresh()
    try {
      const p = profile() as unknown as { fieldMappings: { source?: string }[] }
      p.fieldMappings[p.fieldMappings.length - 1]!.source = "없는_컬럼"
      await runImport(repo, {
        bytes: new Uint8Array(readFileSync(fixturePath(ESM!, CLEAN_DIR))),
        fileName: ESM!.file,
        profile: p as unknown as MappingProfile,
        sheetIndex: 0,
        libraryId: LIB,
        connectionId: "c1",
        batchId: "b1",
        now: NOW,
        chunkSize: 20, // 155행 → 8청크
      })
      const d = (await repo.batchDigest("b1"))!
      expect(d.fileIssues, "청크 수만큼 부풀면 안 된다").toHaveLength(1)
    } finally {
      await db.close()
    }
  })
})

/**
 * 고아 품목은 **오늘 구조적으로 도달할 수 없다** — 부모가 치명으로 빠진 행은 품목도
 * 만들지 않기 때문이다. 그래서 저장소를 갈아 끼워 «부모를 못 찾는 세계»를 만든다.
 * 이 시험이 답하는 것은 딱 하나: **그 분기가 행을 조용히 버리지 않는가.**
 */
run("[합성] 고아 품목 — 행을 버리되 버렸다고 말한다", () => {
  it("[합성] 부모를 못 찾으면 그 행의 **물리 행 번호로** 남는다", async () => {
    const { db, repo } = await fresh()
    try {
      // 부모 조회만 비운다. 나머지 경로는 진짜 리포지토리다
      const blind = new Proxy(repo, {
        get(t, k, r) {
          if (k === "idsBySourceKey") return async () => new Map<string, string>()
          return Reflect.get(t, k, r) as unknown
        },
      }) as Repository
      await importWith(blind, profile())
      const d = (await repo.batchDigest("b1"))!

      const hit = d.issuesByCode.find((x) => x.code === "orphan_item")
      expect(hit, "146품목이 통째로 사라지고도 아무 말이 없었다").toBeDefined()
      expect(hit!.rows).toBe(146)

      // ★ 좌표계 ★ 행 번호는 **파일의 물리 행**이지 품목 순번이 아니다.
      // 전에는 청크 시작 번호(늘 0)를 달고 있어 사람을 첫 줄로 보냈다.
      const first = await db
        .prepare(
          `SELECT MIN(row_index) AS lo, MAX(row_index) AS hi FROM batch_issue
            WHERE batch_id = 'b1' AND code = 'orphan_item'`,
        )
        .get()
      expect(Number(first?.["lo"]), "머리글 다음 행부터다").toBeGreaterThan(0)
      expect(Number(first?.["hi"]), "파일 끝까지 흩어져 있다").toBeGreaterThan(140)
    } finally {
      await db.close()
    }
  })
})

// ─────────────────────────────────────────────────────────────
// 잠금 — DB의 코드는 선언표 밖으로 못 나간다
// ─────────────────────────────────────────────────────────────

run("코드 목록의 잠금은 타입이 진다 (008에 CHECK가 없는 대가)", () => {
  it("DB에 들어간 코드는 전부 `ISSUE_KINDS`에 있다", async () => {
    const { db, repo } = await fresh()
    try {
      const p = profile() as unknown as {
        rowRouting: { routes: { match: string[] }[]; knownValues: string[] }
        fieldMappings: { source?: string }[]
      }
      p.rowRouting.knownValues = p.rowRouting.routes.flatMap((r) => r.match)
      p.fieldMappings[p.fieldMappings.length - 1]!.source = "없는_컬럼"
      await importWith(repo, p as unknown as MappingProfile)

      const rows = await db
        .prepare(`SELECT DISTINCT code FROM batch_issue WHERE batch_id = 'b1'`)
        .all()
      expect(rows.length).toBeGreaterThan(0)
      for (const r of rows) {
        expect(Object.keys(ISSUE_KINDS), `선언되지 않은 코드: ${String(r["code"])}`).toContain(
          String(r["code"]),
        )
        expect(ISSUE_KINDS[String(r["code"]) as IssueCode].fatal, "치명은 제외로 간다").toBe(false)
      }
    } finally {
      await db.close()
    }
  })

  it("되돌리면 사건 기록도 사라진다 — 적재된 행이 없으면 붙을 자리가 없다", async () => {
    const { db, repo } = await fresh()
    try {
      const p = profile() as unknown as {
        rowRouting: { routes: { match: string[] }[]; knownValues: string[] }
      }
      p.rowRouting.knownValues = p.rowRouting.routes.flatMap((r) => r.match)
      await importWith(repo, p as unknown as MappingProfile)
      expect((await repo.batchDigest("b1"))!.incompleteRows).toBe(146)

      await repo.undoBatch("b1", NOW)
      const d = (await repo.batchDigest("b1"))!
      expect(d.incompleteRows).toBe(0)
      expect(d.issuesByCode).toEqual([])
    } finally {
      await db.close()
    }
  })
})
