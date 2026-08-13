/**
 * 앱 셸 — 3a-b 이식의 첫 단위. 목업 `FlowBase.dc.html` L305~339의 첫 실행
 * 화면(`<sc-if value="{{ firstRun }}">`)을 그린다.
 *
 * ★ 이 파일은 **첫 시험을 통과하지 못했다가 고친 것**이다 ★
 *
 * 처음에는 손으로 옮겼고, 주석에 "카피도 목업 문장 그대로"라고 적어뒀지만
 * 변환기가 나온 뒤 대조해 보니 실제로는 어긋나 있었다:
 *
 *   · 목업 문장 3개가 빠지고 없던 문장 2개가 들어갔다 (헌장 C-1 위반)
 *   · 색 결정이 데이터에서 뷰로 옮겨갔다 — 목업은 `{{ o.bg }}`인데
 *     삼항을 JSX에 심었다. 두 번째 진실이 생기는 전형적인 자리다
 *   · `onClick`이 사라져 드롭존 클릭이 죽어 있었다
 *   · style 선언 32개가 다르거나 없었다 (22px→17px, `--fg-2`→`--fg` 등)
 *
 * **시험의 정답은 항상 원본이다.** 그래서 지금 이 마크업은 손으로 다시 쓴 것이
 * 아니라 변환기 출력(`generated/Template.tsx`의 같은 블록)을 그대로 옮긴 것이다.
 * 값만 아래 `ONBOARD`로 바꿔 끼웠다.
 *
 * ★ 지금은 데이터가 없다 ★
 * 웹뷰용 드라이버가 아직 없어(ADR-008의 Tauri 커맨드가 미구현) 리포지토리에
 * 붙지 않았다. 그래서 이 화면은 **빈 DB일 때의 정직한 상태**만 그린다 —
 * 시드를 넣어 채워 보이지 않는다. 3a 게이트의 "빈 DB로 기동 → 온보딩 드롭존"이
 * 정확히 이 상태다.
 *
 * 배선이 끝나면 이 파일은 사라지고 `Template.tsx`가 그 자리를 받는다.
 */

import { Lic } from "./ds/icons"

/**
 * 온보딩 3단계. **시드 데이터가 아니라 제품 카피다** — DB에서 오지 않는다.
 * 목업 L5695~5704를 형태까지 그대로 옮겼다. 색을 여기서 정하는 것이 원본이며,
 * JSX에서 삼항으로 고르는 것이 아니다.
 */
const ONBOARD = [
  {
    n: "1",
    title: "정산서 넣기",
    desc: "쿠팡 Wing에서 내려받은 정산 파일을 여기에 끌어다 놓으세요. CSV·XLSX 모두 됩니다.",
    state: "now",
  },
  {
    n: "2",
    title: "양식 확인",
    desc: "컬럼을 자동으로 알아봅니다. 못 알아본 것만 골라주시면 다음부터는 기억합니다.",
    state: "next",
  },
  {
    n: "3",
    title: "원가 넣기",
    desc: "매입원가는 마켓이 주지 않습니다. SKU별로 넣으면 그때부터 순이익이 나옵니다.",
    state: "next",
  },
].map((s) => ({
  n: s.n,
  title: s.title,
  desc: s.desc,
  bg: s.state === "now" ? "var(--accent)" : "var(--bg-elevated-2)",
  fg: s.state === "now" ? "var(--fg-on-accent)" : "var(--fg-4)",
  border: s.state === "now" ? "var(--accent)" : "var(--border)",
}))

export function App(): React.JSX.Element {
  return (
    // 목업에서 이 블록을 감싸는 것은 앱 셸(nav + main)인데 아직 이식 전이다.
    // 배경과 최소 높이만 최소한으로 준다 — 목업 이탈이 아니라 미이식 구간이다.
    <div style={{ minHeight: "100vh", background: "var(--bg-app)" }}>
      <div style={{ padding: "40px 24px", display: "grid", justifyItems: "center" }}>
        <div style={{ width: "100%", maxWidth: "620px", display: "grid", gap: "22px" }}>
          <div style={{ display: "grid", gap: "7px", justifyItems: "center", textAlign: "center" }}>
            <span style={{ font: "var(--fw-semi) 22px var(--font-sans)", color: "var(--fg)", letterSpacing: "-0.02em" }}>
              정산서 한 장으로 시작합니다
            </span>
            {" "}
            <span style={{ font: "var(--fw-regular) 13px/1.7 var(--font-sans)", color: "var(--fg-3)", maxWidth: "440px", textWrap: "pretty" }}>
              마켓에서 내려받은 정산 파일을 넣으면 FlowBase가 읽어서 손익을 계산합니다. 계정 연결은 필요하지 않습니다.
            </span>
          </div>
          {" "}
          {/* 목업은 여기에 onClick={goImport}가 있다. 갈 화면(가져오기)이 아직
              없어서 달지 않았다 — 없는 화면으로 보내는 핸들러를 지금 발명하지
              않는다. 배선 때 Template.tsx가 그 자리를 그대로 가져간다. */}
          <div style={{ border: "1px dashed var(--border-strong)", borderRadius: "var(--r-lg)", padding: "34px 24px", display: "grid", gap: "12px", justifyItems: "center", background: "var(--bg-subtle)", cursor: "pointer" }}>
            <span style={{ width: "44px", height: "44px", borderRadius: "var(--r-md)", background: "var(--bg-elevated-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--fg-3)" }}>
              <Lic name="file-spreadsheet" size={20} />
            </span>
            {" "}
            <span style={{ display: "grid", gap: "4px", justifyItems: "center", textAlign: "center" }}>
              <span style={{ font: "var(--fw-semi) 14px var(--font-sans)", color: "var(--fg)" }}>
                정산 파일을 여기에 놓으세요
              </span>
              {" "}
              <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                CSV · XLSX · 쿠팡 · 네이버 · G마켓 · 옥션 · 11번가
              </span>
            </span>
            {" "}
            <button className="v-btn v-btn--primary" style={{ height: "30px", marginTop: "2px" }}>
              파일 선택
            </button>
          </div>
          {" "}
          <div style={{ display: "grid", gap: "1px", background: "var(--border)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
            {ONBOARD.map((o, $index) => (
              <span key={$index} style={{ display: "flex", alignItems: "flex-start", gap: "11px", padding: "13px 15px", background: "var(--bg-app)" }}>
                <span style={{ width: "21px", height: "21px", borderRadius: "999px", background: o.bg, border: `1px solid ${o.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center", font: "var(--fw-semi) 11px var(--font-sans)", color: o.fg, flex: "none", marginTop: "1px" }}>
                  {o.n}
                </span>
                {" "}
                <span style={{ display: "grid", gap: "3px", minWidth: "0" }}>
                  <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg-2)" }}>
                    {o.title}
                  </span>
                  {" "}
                  <span style={{ font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                    {o.desc}
                  </span>
                </span>
              </span>
            ))}
          </div>
          {" "}
          <span style={{ font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-4)", textAlign: "center", textWrap: "pretty" }}>
            데이터는 이 컴퓨터에만 저장됩니다. 서버로 올라가지 않습니다.
          </span>
        </div>
      </div>
    </div>
  )
}
