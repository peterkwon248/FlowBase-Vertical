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
 * ★ 웹판은 **새로고침하면 사라진다**고 말한다 (2026-08-18 · 문구 개정 2026-08-19) ★
 *
 * `sql.js`는 DB를 메모리에 들고 있어 새로고침하면 사라진다. 처음에는 그 사실을 근거로
 * 가져오기를 **막았고** 이 띠가 «가져오기 꺼짐»이라고 말했다. 지금은 넣을 수 있다
 * (ADR-018) — 그래서 띠도 **막힘이 아니라 휘발**을 말해야 한다. 화면이 하는 말과
 * 앱이 하는 일이 어긋나면, 그 띠는 고지가 아니라 거짓말이 된다.
 *
 * LOCK 6이 요구하는 것은 «막아라»가 아니라 «숨기지 마라»다. 그 이행이 이 한 줄이다.
 *
 * 화면 안이 아니라 문서 수준의 띠로 붙이는 이유는 두 가지다 — 동결 목업에 이 표면이
 * 없고(§21 개정 없이 가려면 목업 밖이어야 한다), 그리고 이 사실은 어느 화면에 있든
 * 참이라 한 화면에 매달 이유가 없다.
 */
function webDemoBanner(): void {
  const bar = document.createElement("div")
  bar.textContent = "웹 데모 · 예시 데이터 · 넣은 것은 새로고침하면 사라집니다"
  /**
   * ★ 화면을 **가리지 않는다** ★
   * 처음엔 하단 전폭 띠였는데 표의 마지막 줄을 덮었다 — 고지하려다 데이터를
   * 가리면 그게 더 나쁘다. 구석의 작은 알약으로 줄이고 `pointer-events: none`으로
   * 클릭도 통과시킨다.
   */
  bar.setAttribute(
    "style",
    [
      "position:fixed", "right:10px", "bottom:10px", "z-index:9999",
      "padding:4px 10px", "border-radius:999px", "pointer-events:none",
      "font:var(--fw-medium) 10px var(--font-sans)", "letter-spacing:0.02em",
      "color:var(--fg-4)", "background:var(--bg-elevated)",
      "border:1px solid var(--border)", "opacity:0.9",
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
