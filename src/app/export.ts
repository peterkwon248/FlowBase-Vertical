/**
 * 내보내기 — **데이터 인질 금지** (LOCK 8 · 헌장 B-10).
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 이 파일이 2026-08-20에야 생겼나 ★
 *
 * 헌장은 처음부터 「내보내기는 무료 전면 개방」이었는데 **전면 부재였다.**
 * 화면에는 XLSX·CSV 버튼이 다섯 쌍 그려져 있었고 **전부 `onClick`이 없었다** —
 * 목업에도 없었으므로 이식 과정에서 빠뜨린 것이 아니라 **처음부터 없던 것**이다.
 * 배선 게이트는 그 다섯 자리를 「표가 60행이라 스크롤로 충분하다」는 남의 사유가
 * 달린 컷에 묶어 두고 초록이었다 (감사 A-2-2).
 *
 * ★ 무엇을 내보내나 — 「지금 보고 있는 것」 ★
 * 화면이 그리는 행을 그대로 낸다. 다시 조회하지 않는다 — 그러면 사용자가 본 것과
 * 파일이 갈릴 수 있고, 「내보내기」는 «화면을 파일로»라는 뜻이기 때문이다.
 * 그래서 `expScope`가 **범위를 문장으로 말한다**: 몇 행인지, 어느 달인지.
 *
 * ★ 표시 문자열이 아니라 **값**을 낸다 ★
 * 화면의 `8,285,200원`을 그대로 쓰면 엑셀에서 문자열이 되어 합계도 못 낸다.
 * 숫자는 숫자로, 날짜는 `YYYY-MM-DD`로 낸다. 내보내기는 **다시 계산할 수 있는
 * 재료**여야지 그림이 아니다.
 * ─────────────────────────────────────────────────────────────
 */

import * as XLSX from "xlsx"

export interface ExportColumn<T> {
  readonly header: string
  readonly get: (row: T) => string | number | null
}

export interface ExportTable<T> {
  /** 확장자 없는 파일 이름. 공백은 두어도 된다 — 브라우저가 처리한다. */
  readonly file: string
  /** 팝오버가 보이는 「무엇을 내보내나」 한 문장. */
  readonly scope: string
  /** 팝오버 하단의 작은 글씨. */
  readonly note: string
  readonly columns: readonly ExportColumn<T>[]
  readonly rows: readonly T[]
}

/** 셀 하나를 CSV 값으로. */
function cell(v: string | number | null): string {
  if (v === null) return ""
  if (typeof v === "number") return String(v)
  // 쉼표·따옴표·줄바꿈이 있으면 감싸고, 안쪽 따옴표는 겹친다 (RFC 4180)
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/**
 * CSV 본문.
 *
 * ★ BOM을 붙인다 ★ 없으면 **엑셀이 한글을 깨뜨린다** — UTF-8을 자동으로 못 알아보고
 * 로케일 코드페이지로 읽기 때문이다. 「내보냈는데 글자가 깨진다」는 신고가 나오는
 * 자리이고, 3바이트로 막을 수 있다.
 *
 * 줄바꿈은 CRLF다. RFC 4180이 그렇고, 옛 엑셀이 LF만 있으면 한 줄로 읽는다.
 */
export function toCsv<T>(t: ExportTable<T>): string {
  const head = t.columns.map((c) => cell(c.header)).join(",")
  const body = t.rows.map((r) => t.columns.map((c) => cell(c.get(r))).join(","))
  return "﻿" + [head, ...body].join("\r\n") + "\r\n"
}

/**
 * XLSX 본문.
 *
 * 읽기용으로 이미 번들에 있는 SheetJS를 그대로 쓴다 (ADR-001 — CDN 타르볼 0.20.3 고정).
 * 쓰기 때문에 의존성이 하나 더 늘지 않는다.
 */
export function toXlsx<T>(t: ExportTable<T>): Uint8Array {
  const aoa: (string | number | null)[][] = [
    t.columns.map((c) => c.header),
    ...t.rows.map((r) => t.columns.map((c) => c.get(r))),
  ]
  const wb = XLSX.utils.book_new()
  // 시트 이름은 31자 제한 + `[]:*?/\` 금지. 파일 이름을 그대로 쓰면 터진다.
  const sheet = t.file.replace(/[[\]:*?/\\]/g, " ").slice(0, 31)
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheet)
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer)
}

/**
 * 파일을 사용자에게 준다.
 *
 * ★ IPC 표면 0 (ADR-013의 출력판) ★ 가져오기를 웹 표준 `<input type="file">`로 받은
 * 것과 같은 판단이다 — 내보내기도 `Blob` + `<a download>`면 되고, 그러면 웹판과
 * 데스크톱판이 **같은 코드로** 동작한다. 네이티브 저장 대화상자는 사용자가
 * «어디에 저장할지 고르고 싶다»고 말할 때 증축한다.
 */
function give(name: string, mime: string, data: string | Uint8Array): void {
  const blob = new Blob([data as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 즉시 풀면 브라우저가 아직 안 읽었을 수 있다. 한 틱 뒤에 놓는다.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function saveCsv<T>(t: ExportTable<T>): void {
  give(`${t.file}.csv`, "text/csv;charset=utf-8", toCsv(t))
}

export function saveXlsx<T>(t: ExportTable<T>): void {
  give(
    `${t.file}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    toXlsx(t),
  )
}

/** `2026-07-10T14:30:00` → `2026-07-10 14:30`. 엑셀이 날짜로 읽는 모양이다. */
export function stamp(iso: string): string {
  const t = iso.replace("T", " ")
  return t.length >= 16 ? t.slice(0, 16) : t
}
