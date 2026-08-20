/**
 * 내보내기 — **데이터 인질 금지** (LOCK 8 · 헌장 B-10).
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 오늘까지 전면 부재였다 ★
 * 화면에 XLSX·CSV 버튼이 다섯 쌍 그려져 있고 **전부 `onClick`이 없었다.**
 * 목업에도 없었으므로 이식에서 빠뜨린 게 아니라 처음부터 없던 것이고,
 * 배선 게이트는 그 다섯 자리를 「표가 60행이라 스크롤로 충분하다」는 **남의 사유**가
 * 달린 컷에 묶어 두고 초록이었다 (감사 A-2-2).
 *
 * ★ 이 시험이 지키는 것 ★
 * 「눌리는가」가 아니라 **「쓸 수 있는 파일이 나오는가」**다. 화면의 `8,285,200원`을
 * 그대로 쓰면 엑셀에서 문자열이 되어 합계도 못 낸다 — 그건 내보낸 것이 아니라
 * 그림을 준 것이다.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it } from "vitest"
import * as XLSX from "xlsx"
import { toCsv, toXlsx, type ExportTable } from "../src/app/export.js"
import { orderTable, historyTable } from "../src/app/export-tables.js"
import type { OrderRow } from "../src/core/order/rows.js"

const T: ExportTable<{ a: string; n: number; z: string | null }> = {
  file: "시험",
  scope: "2행",
  note: "",
  columns: [
    { header: "글", get: (r) => r.a },
    { header: "수", get: (r) => r.n },
    { header: "빈칸", get: (r) => r.z },
  ],
  rows: [
    { a: "가", n: 1000, z: null },
    { a: '쉼표, 그리고 "따옴표"', n: -5, z: "줄\n바꿈" },
  ],
}

describe("CSV — 엑셀이 열 수 있어야 한다", () => {
  /**
   * ★ BOM이 없으면 **엑셀이 한글을 깨뜨린다** ★
   * UTF-8을 자동으로 못 알아보고 로케일 코드페이지로 읽는다. 「내보냈는데 글자가
   * 깨진다」는 신고가 나오는 자리이고 3바이트로 막힌다.
   */
  it("★ UTF-8 BOM으로 시작한다 ★", () => {
    expect(toCsv(T).startsWith("﻿"), "BOM이 없다 — 엑셀에서 한글이 깨진다").toBe(true)
  })

  it("★ 쉼표·따옴표·줄바꿈을 감싼다 (RFC 4180) ★", () => {
    const line = toCsv(T).split("\r\n")[2] ?? ""
    expect(line).toContain('"쉼표, 그리고 ""따옴표"""')
    expect(line, "줄바꿈이 든 값도 감싸야 한 행이 유지된다").toContain('"줄\n바꿈"')
  })

  it("숫자는 따옴표 없이 — 엑셀이 수로 읽는다", () => {
    expect(toCsv(T)).toContain(",1000,")
    expect(toCsv(T), "천 단위 쉼표를 넣으면 문자열이 된다").not.toContain('"1,000"')
  })

  it("null은 빈 칸이다 — 「0」이 아니다 (§22)", () => {
    expect(toCsv(T).split("\r\n")[1]).toBe("가,1000,")
  })

  it("줄바꿈은 CRLF다", () => {
    expect(toCsv(T).split("\r\n").length).toBeGreaterThan(2)
  })
})

describe("XLSX — 다시 읽어서 같은 값이 나온다", () => {
  it("★ 쓴 것을 SheetJS로 되읽으면 값이 같다 ★", () => {
    const wb = XLSX.read(toXlsx(T), { type: "array" })
    const ws = wb.Sheets[wb.SheetNames[0]!]!
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })
    expect(aoa[0]).toEqual(["글", "수", "빈칸"])
    // 숫자가 **숫자로** 살아 있어야 한다 — 문자열이면 합계를 못 낸다
    expect(aoa[1]?.[1]).toBe(1000)
    expect(typeof aoa[1]?.[1]).toBe("number")
  })

  it("시트 이름이 엑셀 제약을 지킨다 — 31자 · 금지문자 없음", () => {
    const long: ExportTable<never> = { ...T, file: "정산/2026-07 [매우 긴 이름]".repeat(4), rows: [] }
    const wb = XLSX.read(toXlsx(long), { type: "array" })
    const name = wb.SheetNames[0]!
    expect(name.length).toBeLessThanOrEqual(31)
    expect(name, "엑셀이 거부하는 문자가 남았다").not.toMatch(/[[\]:*?/\\]/)
  })
})

describe("표 정의 — 화면이 아니라 값을 낸다", () => {
  const rows: readonly OrderRow[] = [
    {
      kind: "order", at: "2026-07-10T14:30:00", channel: "쿠팡", status: "결제완료",
      amount: 12_000, claimType: null, claimAmount: 0,
      dateEstimated: false, claimDateEstimated: false,
    } as OrderRow,
  ]

  it("★ 금액이 숫자다 — 「12,000원」이 아니다 ★", () => {
    const t = orderTable(rows, "2026-07")
    const cell = t.columns.find((c) => c.header === "금액")!.get(rows[0]!)
    expect(cell).toBe(12_000)
    expect(typeof cell).toBe("number")
  })

  it("★ 범위를 문장으로 말한다 — 「전부인가」를 사용자가 알아야 한다 (LOCK 6) ★", () => {
    expect(orderTable(rows, "2026-07").scope).toContain("1행")
    expect(orderTable(rows, "2026-07").scope).toContain("2026년 7월")
    // 기록은 달과 무관하다 — 달 이름을 넣으면 거짓이다
    expect(historyTable([]).scope, "기록에 달이 붙었다").not.toMatch(/\d+년/)
  })

  it("추정 날짜를 숨기지 않는다 (LOCK 6)", () => {
    const est = [{ ...rows[0]!, dateEstimated: true }] as readonly OrderRow[]
    const t = orderTable(est, "2026-07")
    expect(t.columns.find((c) => c.header === "날짜 추정")!.get(est[0]!)).toBe("추정")
  })
})
