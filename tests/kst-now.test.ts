/**
 * 「지금」은 KST다 — **매월 1일 아침 아홉 시간의 거짓말** (ADR-009 ④).
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 무엇이 아팠나 (2026-08-20 조사 1.2) ★
 *
 * ADR-009가 「기간 경계는 **KST(UTC+9) 자정**」이라 정했고 파서(`parseDateLike`)는
 * 그 규율을 지켰다. 그런데 **「지금」을 만드는 자리 다섯이 전부 UTC였다** —
 * `data.ts`의 `thisMonth`·`today`·`nowStamp`, 그리고 `App.tsx`가 초기 상태 두 곳에서
 * 같은 UTC 식을 **복제**하고 있었다.
 *
 * 사용자가 겪던 것:
 *   · 매월 1일 **아침 00~09시(KST)**에 앱을 열면 **지난달** 손익이 뜬다
 *   · 그 시간대에 저장한 원가는 `effective_from`이 **전날**로 박힌다.
 *     원가는 적용일이 키라(ADR-005), 하루 어긋나면 그날 손익이 통째로 다른 값이 된다
 *
 * ★ 갈린 규칙 — 셋을 다 KST로 바꾸지 않았다 ★
 *
 *   사람이 읽는 날짜  = KST   `thisMonth` · `today`
 *   기계가 정렬하는 시각 = UTC   `nowStamp`
 *
 * `nowStamp`가 UTC로 남은 이유는 같은 DB에 **트리거가 `datetime('now')`(UTC)로 쓰는
 * 시각**이 있기 때문이다(`row_shadow.created_at` 등, 마이그레이션 전체 21곳).
 * 한쪽만 KST로 바꾸면 **한 DB 안에 시계가 둘이 되고 9시간 어긋난다** — 되돌리기
 * 순서(ADR-004)가 그 둘을 나란히 놓는 날 조용히 뒤집힌다.
 *
 * ★ 이 시험이 무는 것 ★
 * 값 자체는 「지금」에 따라 변하므로 절대값을 걸 수 없다. 그래서 **관계**를 문다 —
 * KST와 UTC의 차이가 정확히 9시간인가, 그리고 화면이 UTC 식을 다시 복제하지 않는가.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { thisMonth, today, nowStamp } from "../src/app/data.js"

/** 같은 순간의 UTC 벽시계. 비교 기준이다. */
const utcNow = (): string => new Date().toISOString()

describe("「지금」은 KST다 (ADR-009 ④)", () => {
  it("★ today()가 UTC보다 정확히 9시간 앞선 날짜를 낸다 ★", () => {
    // 자정을 사이에 두고 돌면 두 값의 날짜가 다를 수 있다. 그래서 날짜를 직접
    // 비교하지 않고, **같은 규칙으로 만든 기대값**과 대조한다.
    const expected = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
    expect(today()).toBe(expected)
  })

  it("★ thisMonth()도 같은 시계를 쓴다 ★", () => {
    const expected = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7)
    expect(thisMonth()).toBe(expected)
  })

  it("today()와 thisMonth()가 서로 어긋나지 않는다", () => {
    // 두 함수가 각자 「지금」을 만들면 자정 경계에서 갈릴 수 있다. 한 헬퍼를 쓰는지 본다.
    expect(today().slice(0, 7)).toBe(thisMonth())
  })

  it("모양은 그대로다 — YYYY-MM-DD · YYYY-MM", () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(thisMonth()).toMatch(/^\d{4}-\d{2}$/)
  })

  /**
   * ★ 기기의 시간대를 읽지 않는다 ★
   * `getFullYear()`류는 실행 기기의 시간대를 읽어서 노트북을 들고 여행하면 답이
   * 달라진다 — ADR-002가 파서에서 UTC 게터를 강제한 이유와 같다.
   * 우리는 epoch에 +9시간을 더하고 UTC 게터로 읽는다.
   */
  it("★ 기기 시간대 게터(getFullYear·getMonth·getDate)를 쓰지 않는다 ★", () => {
    const src = readFileSync("src/app/data.ts", "utf8")
    expect(src, "기기 시간대를 읽으면 여행할 때 답이 달라진다").not.toMatch(
      /\.getFullYear\(\)|\.getMonth\(\)|\.getDate\(\)|toLocaleDateString/,
    )
  })
})

describe("nowStamp는 UTC로 남는다 — 트리거와 같은 시계", () => {
  /**
   * 여기를 KST로 바꾸면 `row_shadow.created_at`(트리거 · UTC)과 9시간 어긋난다.
   * 바꾸려면 트리거 21곳을 함께 옮기는 마이그레이션이 선행이다.
   */
  it("★ nowStamp가 UTC다 — KST로 바꾸려면 트리거 21곳이 함께 움직여야 한다 ★", () => {
    const expected = new Date().toISOString().slice(0, 19)
    // 초 단위 경계에서 1초 어긋날 수 있으므로 분까지만 대조한다.
    expect(nowStamp().slice(0, 16)).toBe(expected.slice(0, 16))
  })

  it("nowStamp가 today()보다 앞선다 (9시간 차이가 실재한다)", () => {
    // KST 날짜가 UTC 시각보다 앞서거나 같다. 같은 날일 수도 있어 부등호가 아니라 비교다.
    expect(today() >= nowStamp().slice(0, 10)).toBe(true)
  })

  it("모양은 그대로다 — YYYY-MM-DDTHH:MM:SS", () => {
    expect(nowStamp()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
  })
})

describe("화면이 「지금」을 다시 만들지 않는다", () => {
  /**
   * ★ 이 시험이 진짜 회귀를 막는 자리다 ★
   * 고치기 전 `App.tsx:199-200`이 `new Date().toISOString().slice(0, 7)`을 **두 줄에
   * 복제**하고 있었다. 그래서 `data.ts`만 고치면 화면은 그대로 UTC로 남는다.
   * 「지금」을 만드는 곳은 `data.ts` 한 곳이어야 한다.
   */
  it("★ App.tsx가 `new Date().toISOString()`으로 달·날짜를 만들지 않는다 ★", () => {
    const app = readFileSync("src/app/App.tsx", "utf8")
    expect(app, "App.tsx가 「지금」을 직접 만든다 — data.ts의 thisMonth/today를 써라").not.toMatch(
      /new Date\(\)\.toISOString\(\)\.slice/,
    )
  })

  it("App.tsx가 data.ts의 thisMonth를 쓴다", () => {
    const app = readFileSync("src/app/App.tsx", "utf8")
    expect(app).toMatch(/thisMonth/)
  })
})
