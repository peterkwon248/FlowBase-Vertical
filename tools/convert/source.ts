/**
 * 목업에서 **변환 대상 구간만** 잘라낸다.
 *
 * `FlowBase.dc.html`은 세 덩어리다:
 *
 * ```
 * L1~L41      head + <helmet>      → index.html이 이미 맡았다. 변환 대상 아님
 * L43~L3187   템플릿 본문           → ★ 변환 대상
 * L3190~L5883 <script type=text/x-dc> → renderVals 1,900줄. 변환기 스코프 밖
 * ```
 *
 * 스크립트를 건드리지 않는 것은 게으름이 아니라 **결정**이다. 계산을 옮기는
 * 순간 두 번째 진실이 생긴다 — 계산기는 `computePnl` 하나다 (단일 계산기 LOCK,
 * 작업-상태 §"renderVals 분해는 변환기 스코프 밖").
 *
 * 경계를 줄 번호로 박지 않고 **마커로 찾는다.** 줄 번호는 목업이 한 줄만
 * 움직여도 조용히 틀리지만, 마커는 못 찾으면 오류가 난다.
 */

import { readFileSync } from "node:fs"

export interface TemplateSource {
  /** 잘라낸 템플릿 본문. */
  html: string
  /** `html`의 첫 줄이 원본에서 몇 번째 줄인지. 오류 메시지를 원본에 맞추는 데 쓴다. */
  startLine: number
  /** 잘라내기 전 원본 전체. 스크립트 구간을 참조해야 할 때 쓴다. */
  whole: string
}

const OPEN = "<x-dc>"
const CLOSE = "</x-dc>"

/**
 * `<x-dc>` 안쪽에서 `<helmet>`을 뺀 나머지를 돌려준다.
 *
 * `<helmet>`은 head 주입이라 DC 런타임 전용이고 (§4-1), 안에 든 것은
 * 스타일시트 링크와 `<style>` 블록이다 — 앱 셸이 이미 `src/app/styles/`로
 * 가지고 있다. 여기서 잘라내지 않으면 변환기가 `<link>`를 JSX로 뱉는다.
 */
export function readTemplate(path: string): TemplateSource {
  const whole = readFileSync(path, "utf8")

  const openAt = whole.indexOf(OPEN)
  if (openAt === -1) throw new Error(`${OPEN}를 찾지 못했다 — 목업 구조가 바뀌었나`)
  const closeAt = whole.lastIndexOf(CLOSE)
  if (closeAt === -1) throw new Error(`${CLOSE}를 찾지 못했다 — 목업 구조가 바뀌었나`)
  if (closeAt < openAt) throw new Error("x-dc 태그 순서가 뒤집혀 있다")

  const inner = whole.slice(openAt + OPEN.length, closeAt)

  // <helmet> … </helmet> 제거
  const hOpen = inner.indexOf("<helmet>")
  const hClose = inner.indexOf("</helmet>")
  if (hOpen === -1 || hClose === -1) throw new Error("<helmet> 경계를 찾지 못했다")
  const body = inner.slice(hClose + "</helmet>".length)

  const startLine = countLines(whole.slice(0, openAt + OPEN.length + hClose + "</helmet>".length))

  return { html: body, startLine, whole }
}

function countLines(s: string): number {
  let n = 1
  for (let i = 0; i < s.length; i++) if (s[i] === "\n") n++
  return n
}
