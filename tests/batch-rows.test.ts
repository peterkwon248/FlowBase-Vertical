/**
 * 적재된 행 패널 — **「가져온 것들의 테이블」이 실재하는가.**
 *
 * ─────────────────────────────────────────────────────────────
 * 사용자가 물었다: *"가져오기로 가져온 것들 어디서 테이블을 볼 수 있다는 거야?"*
 * 답은 «어디서도 못 본다»였다 — `batch_id`로 Fact 행에 닿는 SQL이 **DELETE
 * 하나뿐**(되돌리기)이라, 앱은 넣은 것을 지울 줄만 알고 보여줄 줄은 몰랐다.
 *
 * 이 시험이 지키는 것 둘:
 *   ① **내부 키가 새지 않는다** (헌장 C-4)
 *   ② **값이 조용히 사라지지 않는다** (LOCK 6) — 거부 목록의 여집합은 전부
 *      라벨이 있어야 한다. 새 Fact 컬럼이 생기면 여기가 먼저 깨진다.
 * ─────────────────────────────────────────────────────────────
 */
import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { batchRowVals, FIELD_LABEL, ROWS_PER_PAGE, type OpenBatch } from "../src/app/history.js"
import { emptyVals } from "../src/app/generated/vals.js"
import { FACT_TABLES } from "@core/store/repository.js"

const NOOP = { toggle: () => {}, pickTable: () => {}, pickPage: () => {} }

const open = (o: Partial<OpenBatch> = {}): OpenBatch => ({
  kind: "batch",
  sourceName: "",
  sightingId: null,
  batchId: "batch-1",
  table: "fact_settlement",
  page: 0,
  columns: ["source_key", "settled_on", "net_amount"],
  rows: [
    ["20260731-001", "2026-07-31", 512721],
    ["20260731-002", "2026-07-31", null],
  ],
  total: 2,
  tables: { fact_settlement: 2 },
  busy: false,
  ...o,
})

const render = (o: OpenBatch | null) => {
  const v = emptyVals()
  batchRowVals(v, o, NOOP)
  return v
}

/**
 * Fact 표의 컬럼을 **마이그레이션 전부**에서 읽는다 — 손으로 옮겨 적지 않는다.
 *
 * ★ 처음에 001만 읽었다가 시험이 거짓말을 했다 (2026-08-21) ★
 * `date_precision`(003·005)과 `period_end`(005)는 `ALTER TABLE ADD COLUMN`으로
 * 나중에 붙은 열이라 001에 없다. 그래서 «전부 라벨이 있다»가 초록인 채로 화면에는
 * 「(이름 없는 열)」이 떴다 — 렌더해서 눈으로 잡았다. **틀린 실측은 틀린 추정보다
 * 위험하다**: 시험이 통과하면 아무도 다시 안 본다.
 */
function columnsOf(table: string): string[] {
  const dir = "src/core/store/migrations"
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
  const cols: string[] = []
  for (const f of files) {
    const sql = readFileSync(`${dir}/${f}`, "utf8")
    const m = new RegExp(`CREATE TABLE ${table} \\(([\\s\\S]*?)\\n\\) STRICT;`).exec(sql)
    if (m) cols.push(...[...m[1]!.matchAll(/^\s{2}([a-z_]+)\s+(TEXT|INTEGER|REAL)/gm)].map((x) => x[1]!))
    for (const a of sql.matchAll(
      new RegExp(`ALTER TABLE ${table} ADD COLUMN ([a-z_]+)`, "g"),
    )) {
      cols.push(a[1]!)
    }
  }
  if (cols.length === 0) throw new Error(`${table}을 마이그레이션에서 못 찾았다`)
  return cols
}

/** `repository.ts`의 거부 목록을 소스에서 읽는다 — 두 벌로 적으면 갈라진다. */
function hiddenColumns(): Set<string> {
  const src = readFileSync("src/core/store/repository.ts", "utf8")
  const m = /const HIDDEN_ROW_COLUMNS: ReadonlySet<string> = new Set\(\[([\s\S]*?)\]\)/.exec(src)
  if (!m) throw new Error("HIDDEN_ROW_COLUMNS를 못 찾았다")
  return new Set([...m[1]!.matchAll(/"([a-z_]+)"/g)].map((x) => x[1]!))
}

describe("적재된 행 — 저장 계층의 약속", () => {
  it("컬럼 수집이 **나중 마이그레이션까지** 본다 — 이 시험이 거짓말하지 않는 근거", () => {
    // 003·005가 ALTER TABLE로 붙인 열. 001만 읽으면 이 단언이 먼저 깨진다.
    expect(columnsOf("fact_claim")).toContain("date_precision")
    expect(columnsOf("fact_order")).toContain("period_end")
  })

  it("★ 보이는 컬럼은 **전부 라벨이 있다** — 새 컬럼이 생기면 여기가 먼저 깨진다 ★", () => {
    const hidden = hiddenColumns()
    const missing: string[] = []
    for (const t of FACT_TABLES) {
      for (const c of columnsOf(t)) {
        if (hidden.has(c)) continue
        if (FIELD_LABEL[c] === undefined) missing.push(`${t}.${c}`)
      }
    }
    expect(missing, `라벨 없는 컬럼: ${missing.join(" · ")}`).toEqual([])
  })

  it("★ 내부 키와 PII는 거부 목록에 있다 (헌장 C-4) ★", () => {
    const hidden = hiddenColumns()
    for (const c of ["id", "connection_id", "batch_id", "library_id", "version", "mapping_version", "buyer_ref"]) {
      expect(hidden.has(c), `${c}가 화면에 나갈 수 있다`).toBe(true)
    }
  })

  it("공통 6컬럼은 어느 Fact 표에서도 안 보인다", () => {
    const hidden = hiddenColumns()
    const common = ["connection_id", "batch_id", "library_id", "version", "updated_at", "mapping_version"]
    for (const t of FACT_TABLES) {
      const shown = columnsOf(t).filter((c) => !hidden.has(c))
      for (const c of common) expect(shown, `${t}에 ${c}가 보인다`).not.toContain(c)
    }
  })
})

describe("적재된 행 — 화면", () => {
  it("닫혀 있으면 아무것도 그리지 않는다", () => {
    const v = render(null)
    expect(v.rowsOpen).toBe(false)
    expect(v.rowsBody).toEqual([])
    expect(v.rowsTitle).toBe("")
  })

  it("★ 컬럼 머리글이 **사람 말**이다 — 코드값을 흘리지 않는다 ★", () => {
    const v = render(open())
    expect(v.rowsCols.map((c) => c.label)).toEqual(["마켓 번호", "정산일", "지급액"])
    // `screen-safety`가 잡는 문자열이 값에 섞이면 안 된다.
    expect(JSON.stringify(v.rowsCols)).not.toContain("source_key")
  })

  it("금액은 우측 정렬 + 천 단위 (§21-4)", () => {
    const v = render(open())
    const first = v.rowsBody[0] as { cells: { text: string; num: boolean }[] }
    expect(first.cells[2]).toMatchObject({ text: "512,721", num: true })
    expect(first.cells[1]).toMatchObject({ text: "2026-07-31", num: false })
  })

  it("★ 빈 값은 «—»이고 **흐리게** 표시된다 — 0과 구별된다 (§22) ★", () => {
    const v = render(open())
    const second = v.rowsBody[1] as { cells: { text: string; dim: boolean }[] }
    expect(second.cells[2]).toMatchObject({ text: "—", dim: true })
  })

  it("★ 그린 것이 전부가 아니라는 사실을 말한다 (LOCK 6) ★", () => {
    const v = render(open({ total: 80_137, page: 0 }))
    expect(v.rowsNote).toBe("80,137행 중 1–50")
    const v2 = render(open({ total: 80_137, page: 3 }))
    expect(v2.rowsNote).toBe("80,137행 중 151–200")
  })

  it("행 번호는 **이 batch 안에서 몇 번째**다 — 페이지를 넘겨도 이어진다", () => {
    const v = render(open({ page: 2 }))
    expect((v.rowsBody[0] as { no: string }).no).toBe(String(2 * ROWS_PER_PAGE + 1))
  })

  it("★ 페이지 버튼을 전부 그리지 않는다 — 8만 행이면 1,603쪽이다 ★", () => {
    const v = render(open({ total: 80_137, page: 800 }))
    expect(v.rowsPages.length).toBeLessThanOrEqual(5)
    // 처음·끝과 현재 주변이 든다 — 「어디쯤인가」는 문장이 이미 말했다.
    expect(v.rowsPages.map((p) => p.label)).toContain("1")
    expect(v.rowsPages.map((p) => p.label)).toContain("1,603")
    expect(v.rowsPages.find((p) => p.on === "active")?.label).toBe("801")
  })

  it("0행짜리 표는 탭이 되지 않는다 — 눌러도 빈 표다", () => {
    const v = render(open({ tables: { fact_settlement: 2, fact_claim: 0 } }))
    expect(v.rowsTabs).toHaveLength(1)
    expect(v.rowsTabs[0]!.label).toContain("정산")
  })

  it("★ 편집 어포던스가 없다 — Fact 행이다 (LOCK 9 · §21-1) ★", () => {
    const v = render(open())
    // 셀에도 머리글에도 핸들러가 없다. 「못 누르는 칸」조차 그리지 않는다.
    expect(JSON.stringify(v.rowsBody)).not.toMatch(/function|=>/)
    expect(JSON.stringify(v.rowsCols)).not.toMatch(/function|=>/)
  })

  it("★ 코드값도 사람 말로 바뀐다 — 「CANCEL」이 화면에 뜨면 안 된다 ★", () => {
    const v = render(
      open({
        table: "fact_claim",
        columns: ["claim_type", "claimed_at", "date_precision"],
        rows: [["CANCEL", "2026-07-25", "proxy"]],
        tables: { fact_claim: 1 },
      }),
    )
    const cells = (v.rowsBody[0] as { cells: { text: string }[] }).cells
    expect(cells[0]!.text).toBe("취소")
    expect(cells[2]!.text).toBe("추정")
    expect(JSON.stringify(v.rowsBody)).not.toContain("CANCEL")
    expect(JSON.stringify(v.rowsBody)).not.toContain("proxy")
  })

  it("사전은 **하나**다 — 주문 화면과 같은 말을 쓴다", async () => {
    const { CLAIM_LABEL } = await import("../src/app/order.js")
    const v = render(
      open({
        table: "fact_claim",
        columns: ["claim_type"],
        rows: [["RETURN"]],
        tables: { fact_claim: 1 },
      }),
    )
    expect((v.rowsBody[0] as { cells: { text: string }[] }).cells[0]!.text).toBe(CLAIM_LABEL["RETURN"])
  })

  it("제목이 «원본 파일»이라고 말하지 않는다 — 해석된 Fact 행이다", () => {
    const v = render(open())
    expect(v.rowsTitle).toBe("정산 — 넣은 결과")
    expect(v.rowsTitle).not.toContain("원본")
  })

  it("불러오는 중에는 표를 그리지 않는다 — 옛 행을 새 것처럼 보이면 안 된다", () => {
    const v = render(open({ busy: true }))
    expect(v.rowsBusy).toBe(true)
  })

  /**
   * ★★ 018 — 같은 패널이 **원본 표**도 연다 (ADR-028 결정 4) ★★
   *
   * 016·017이 파싱된 표를 담았고, 이 갈래가 그것을 꺼내 그린다. 위 시험
   * (「제목이 «원본 파일»이라고 말하지 않는다」)이 여전히 통과하는 것이 요점이다 —
   * **두 갈래가 서로 다른 것을 보여준다는 사실이 제목에서 갈린다.**
   */
  describe("원본 표 갈래 (018)", () => {
    const sheet = (o: Partial<OpenBatch> = {}): OpenBatch =>
      open({
        kind: "sheet",
        sourceName: "2026-01 통합 매출 대시보드.xlsx",
        sightingId: 7,
        table: "sheet",
        tables: {},
        columns: ["상품번호", "원가", ""],
        rows: [["A-1", 1200, null]],
        total: 253,
        ...o,
      })

    it("★ 제목이 **어느 파일의 원본 표**인지 말한다 ★", () => {
      const v = render(sheet())
      expect(v.rowsTitle).toBe("2026-01 통합 매출 대시보드.xlsx — 원본 표")
    })

    it("★★ 열 이름이 **파일이 쓴 글자 그대로**다 — 번역하면 원본이 아니다 ★★", () => {
      const v = render(sheet())
      const cols = v.rowsCols as { label: string }[]
      expect(cols[0]!.label).toBe("상품번호")
      expect(cols[1]!.label).toBe("원가")
      // 머리글이 빈 열은 파일에 실제로 그런 열이 있다는 뜻이다 — 숨기지 않는다
      expect(cols[2]!.label).toBe("(이름 없는 열)")
    })

    it("★ 숫자에 천단위 쉼표를 넣지 않는다 — 파일과 다른 글자가 보이면 원본이 아니다 ★", () => {
      const v = render(sheet())
      const cells = (v.rowsBody[0] as { cells: { text: string; num: boolean }[] }).cells
      expect(cells[1]!.text).toBe("1200")
      expect(cells[1]!.text).not.toContain(",")
      // 오른쪽 정렬은 한다 — 표기를 바꾸지 않는 것과 자리를 맞추는 것은 다르다
      expect(cells[1]!.num).toBe(true)
    })

    it("빈 칸은 «—»이고 흐리게 — Fact 쪽과 같은 규율이다", () => {
      const v = render(sheet())
      const cells = (v.rowsBody[0] as { cells: { text: string; dim: boolean }[] }).cells
      expect(cells[2]!.text).toBe("—")
      expect(cells[2]!.dim).toBe(true)
    })

    it("★ 탭이 없다 — 갈래가 없는 자리에 탭 하나를 그리면 «더 있는데 안 보여준다»가 된다 ★", () => {
      expect(render(sheet()).rowsTabs).toEqual([])
      // 대비: Fact 쪽은 탭이 선다
      expect((render(open()).rowsTabs as unknown[]).length).toBeGreaterThan(0)
    })

    it("★ 담기지 않은 파일은 그 사실을 말한다 — «행이 없다»로 뭉개지 않는다 (LOCK 6) ★", () => {
      const v = render(sheet({ rows: [], total: 0 }))
      expect(v.rowsNote).toBe("이 파일의 원본 표가 담기지 않았습니다")
      expect(v.rowsNote).not.toBe("이 표에 들어간 행이 없습니다")
    })

    it("페이지 나누기는 Fact와 같은 규율이다 — 253행이면 6쪽", () => {
      const v = render(sheet())
      expect(v.rowsNote).toContain("253")
      expect((v.rowsPages as unknown[]).length).toBeGreaterThan(0)
    })
  })
})
