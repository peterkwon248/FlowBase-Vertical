/**
 * 앱 진입점.
 *
 * 스타일 순서가 중요하다 — 토큰 → 베이스 → 앱 킷 → 우리 것(`fb-`).
 * Vector DS 클래스는 그대로 살리고 `fb-` 접두만 우리가 소유한다 (핸드오프 §4-3·4-4).
 */
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

// vector-base가 나머지를 정해진 순서로 부른다 — 순서를 여기서 풀어쓰면
// numeric-typography가 마지막이라는 규칙이 깨진다.
import "./styles/vector-base.css"
import "./styles/flowbase-theme.css"

import { App } from "./App.js"
import { isWebDemo } from "./data.js"

/**
 * ★ 웹판은 **보기 전용**이라고 말한다 (2026-08-18) ★
 *
 * `sql.js`는 DB를 메모리에 들고 있어 새로고침하면 사라진다. 그 상태에서 가져오기를
 * 열어 두면 사용자가 파일을 넣고 «넣었는데 없어졌다»를 겪는다 — 데이터가 조용히
 * 사라지는 것은 LOCK 6이 막으려는 바로 그 모양이다.
 *
 * 그래서 **막고, 왜 막는지 말한다.** 화면 안이 아니라 문서 수준의 띠로 붙이는 이유는
 * 두 가지다 — 동결 목업에 이 표면이 없고(§21 개정 없이 가려면 목업 밖이어야 한다),
 * 그리고 이 사실은 어느 화면에 있든 참이라 한 화면에 매달 이유가 없다.
 */
function webDemoBanner(): void {
  const bar = document.createElement("div")
  bar.textContent =
    "보기 전용 데모 — 비식별화 예시 데이터입니다. 가져오기는 꺼져 있고, 새로고침하면 처음 상태로 돌아갑니다."
  bar.setAttribute(
    "style",
    [
      "position:fixed", "left:0", "right:0", "bottom:0", "z-index:9999",
      "padding:6px 12px", "text-align:center",
      "font:var(--fw-regular) 11px var(--font-sans)",
      "color:var(--fg-3)", "background:var(--bg-2)",
      "border-top:1px solid var(--border-1)",
    ].join(";"),
  )
  document.body.appendChild(bar)
}

const root = document.getElementById("root")
if (!root) throw new Error("#root가 없다")
if (isWebDemo()) webDemoBanner()
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
