/**
 * 앱 셸 — 3a-b 이식의 첫 단위.
 *
 * 목업 `FlowBase.dc.html` L313~331의 온보딩을 **재현**한 것이다. 인라인 style과
 * 토큰(`var(--…)`)을 그대로 옮겼고, Vector DS 클래스(`v-btn`)도 그대로 살렸다
 * (핸드오프 §4-3). 카피도 목업 문장 그대로다 — 다시 쓰지 않는다 (헌장 C-1).
 *
 * ★ 지금은 데이터가 없다 ★
 * 웹뷰용 드라이버가 아직 없어(ADR-008의 Tauri 커맨드가 미구현) 리포지토리에
 * 붙지 않았다. 그래서 이 화면은 **빈 DB일 때의 정직한 상태**만 그린다 —
 * 시드를 넣어 채워 보이지 않는다. 3a 게이트의 "빈 DB로 기동 → 온보딩 드롭존"이
 * 정확히 이 상태다.
 */

import { FileSpreadsheet } from "lucide-react"

/**
 * 온보딩 3단계. **시드 데이터가 아니라 제품 카피다** — DB에서 오지 않는다.
 * 목업 L5696~5704의 문장을 그대로 옮겼다.
 */
const ONBOARD = [
  {
    n: "1",
    title: "정산서 넣기",
    desc: "쿠팡 Wing에서 내려받은 정산 파일을 여기에 끌어다 놓으세요. CSV·XLSX 모두 됩니다.",
    now: true,
  },
  {
    n: "2",
    title: "양식 확인",
    desc: "컬럼을 자동으로 알아봅니다. 못 알아본 것만 골라주시면 다음부터는 기억합니다.",
    now: false,
  },
  {
    n: "3",
    title: "원가 넣기",
    desc: "매입원가는 마켓이 주지 않습니다. SKU별로 넣으면 그때부터 순이익이 나옵니다.",
    now: false,
  },
] as const

export function App(): React.JSX.Element {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-app)", display: "grid", placeItems: "center", padding: 24 }}>
      <main style={{ display: "grid", gap: 16, width: "min(560px, 100%)" }}>
        <header style={{ display: "grid", gap: 4, justifyItems: "center", textAlign: "center" }}>
          <span style={{ font: "var(--fw-semi) 17px var(--font-sans)", color: "var(--fg)" }}>
            FlowBase 손익
          </span>
          <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-4)" }}>
            아직 가져온 파일이 없습니다
          </span>
        </header>

        {/* 목업 L313 드롭존 — 마크업·토큰 그대로 */}
        <div
          style={{
            border: "1px dashed var(--border-strong)",
            borderRadius: "var(--r-lg)",
            padding: "34px 24px",
            display: "grid",
            gap: 12,
            justifyItems: "center",
            background: "var(--bg-subtle)",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--r-md)",
              background: "var(--bg-elevated-2)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--fg-3)",
            }}
          >
            <FileSpreadsheet size={20} />
          </span>
          <span style={{ display: "grid", gap: 4, justifyItems: "center", textAlign: "center" }}>
            <span style={{ font: "var(--fw-semi) 14px var(--font-sans)", color: "var(--fg)" }}>
              정산 파일을 여기에 놓으세요
            </span>
            <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
              CSV · XLSX · 쿠팡 · 네이버 · G마켓 · 옥션 · 11번가
            </span>
          </span>
          <button className="v-btn v-btn--primary" style={{ height: 30, marginTop: 2 }}>
            파일 선택
          </button>
        </div>

        {/* 목업 L324 온보딩 단계 목록 */}
        <div
          style={{
            display: "grid",
            gap: 1,
            background: "var(--border)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            overflow: "hidden",
          }}
        >
          {ONBOARD.map((o) => (
            <span
              key={o.n}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 11,
                padding: "13px 15px",
                background: "var(--bg-app)",
              }}
            >
              <span
                style={{
                  width: 21,
                  height: 21,
                  borderRadius: 999,
                  background: o.now ? "var(--accent)" : "var(--bg-elevated-2)",
                  border: `1px solid ${o.now ? "var(--accent)" : "var(--border)"}`,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  font: "var(--fw-semi) 11px var(--font-sans)",
                  color: o.now ? "var(--fg-on-accent)" : "var(--fg-4)",
                  flex: "none",
                  marginTop: 1,
                }}
              >
                {o.n}
              </span>
              <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
                <span style={{ font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg)" }}>
                  {o.title}
                </span>
                <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)", lineHeight: 1.5 }}>
                  {o.desc}
                </span>
              </span>
            </span>
          ))}
        </div>
      </main>
    </div>
  )
}
