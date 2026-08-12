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

const root = document.getElementById("root")
if (!root) throw new Error("#root가 없다")
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
