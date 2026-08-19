/**
 * ★ 자동 생성 — 손으로 고치지 않는다 ★
 *
 * 만든 것: `tools/convert/convert.ts`
 * 원본:    `mockup/FlowBase.dc.html` (동결 목업, 본문 L41~)
 *
 * 이 파일은 목업 템플릿의 **기계 변환 결과**다. 목업과 다른 곳이 있으면 그건
 * 사고이지 의도가 아니다 — 보존 게이트(`npm run convert:gate`)가 지킨다.
 * §21 이탈(도넛→가로막대·스파크라인 제거)은 여기가 아니라 **별도 커밋**에서
 * 한다. 그 커밋의 diff가 곧 "목업과 의도적으로 다른 곳의 전체 목록"이다.
 *
 * 값은 전부 `vals`로 들어온다. 예전 `renderVals()`가 주던 것이고, 배선
 * 단계에서 리포지토리와 `computePnl`로 갈라 붙인다. **산수를 이 파일로
 * 가져오지 않는다** — 계산기는 `computePnl` 하나다 (단일 계산기 LOCK).
 */

import { Fragment } from "react"
import { VChart } from "../ds/charts"
import { Lic, PanelIcon } from "../ds/icons"
import type { TemplateVals } from "./vals.js"

export function Template({ vals }: { vals: TemplateVals }): React.JSX.Element {
  return (
    <div className={`app ${vals.appNavClass}`} style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-app)" }}>
      {vals.navScrim && (
          <div className="nav-scrim" onClick={vals.closeNav}></div>
      )}
      {" "}
      <nav className="sidebar" data-open={vals.navOpenAttr} style={{ display: "flex", flexDirection: "column", boxSizing: "border-box", borderRightWidth: vals.navBorder, padding: vals.navPad, gap: "1px", width: vals.navW, minWidth: vals.navW, maxWidth: vals.navW, overflow: "hidden", whiteSpace: "nowrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", height: "34px", padding: "0 7px", marginBottom: "8px" }}>
          <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
            <defs>
              <linearGradient id="fbMetal" gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="30" y2="30">
                <stop offset="0%" stopColor="#FFFFFF"></stop>
                {" "}
                <stop offset="20%" stopColor="#C8D0DA"></stop>
                {" "}
                <stop offset="42%" stopColor="#767F8C"></stop>
                {" "}
                <stop offset="56%" stopColor="#AEB8C4"></stop>
                {" "}
                <stop offset="76%" stopColor="#EDF1F5"></stop>
                {" "}
                <stop offset="100%" stopColor="#6B7481"></stop>
              </linearGradient>
              {" "}
              <linearGradient id="fbTile" x1="0" y1="0" x2="0.6" y2="1">
                <stop offset="0%" stopColor="#303338"></stop>
                {" "}
                <stop offset="100%" stopColor="#141618"></stop>
              </linearGradient>
              {" "}
              <clipPath id="fbClip">
                <circle cx="16" cy="16" r="10.6"></circle>
              </clipPath>
            </defs>
          </svg>
          {" "}
          <svg viewBox="0 0 32 32" width="20" height="20" style={{ display: "block", flex: "none" }}>
            <rect x="0" y="0" width="32" height="32" rx="8.4" fill="url(#fbTile)"></rect>
            {" "}
            <rect x="0.4" y="0.4" width="31.2" height="31.2" rx="8" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="0.8"></rect>
            {" "}
            <g transform="translate(4.8 4.8) scale(0.7)" stroke="url(#fbMetal)" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <g clipPath="url(#fbClip)">
                <path d="M0 9.5 c 5.44 -3, 10.56 -3, 16 0 s 10.56 3, 16 0" strokeWidth="4.5"></path>
                {" "}
                <path d="M0 16 c 5.44 -3, 10.56 -3, 16 0 s 10.56 3, 16 0" strokeWidth="4.5"></path>
                {" "}
                <path d="M0 22.5 c 5.44 -3, 10.56 -3, 16 0 s 10.56 3, 16 0" strokeWidth="4.5"></path>
              </g>
              {" "}
              <circle cx="16" cy="16" r="13" strokeWidth="2.7" fill="none"></circle>
            </g>
          </svg>
          {" "}
          <span style={{ font: "var(--fw-semi) var(--fs-base) var(--font-sans)", color: "var(--fg)" }}>
            FlowBase
          </span>
          {" "}
          <span style={{ flex: "1" }}></span>
          {" "}
          <span className="iconbtn" style={{ cursor: "pointer", flex: "none" }} onClick={vals.toggleNav} title="사이드바 접기">
            <PanelIcon side="left" size={15} />
          </span>
        </div>
        {" "}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", height: "30px", margin: "0 0 10px", padding: "0 8px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", color: "var(--fg-4)", cursor: "pointer" }} onClick={vals.openCmd}>
          <Lic name="search" size={14} />
          {" "}
          <span style={{ font: "var(--fw-medium) 12px var(--font-sans)" }}>
            검색
          </span>
          {" "}
          <span className="v-mono" style={{ marginLeft: "auto", fontSize: "11px" }}>
            ⌘K
          </span>
        </div>
        {" "}
        <div className="fb-scroll" style={{ flex: "1", minHeight: "0", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "6px 7px 3px", font: "var(--fw-semi) 11px var(--font-sans)", color: "var(--fg-4)" }}>
            현황
          </div>
          {" "}
          <div className={`nav-item ${vals.nav.dash}`} onClick={vals.go.dash}>
            <Lic name="layout-dashboard" size={15} />
            {" "}
            <span>
              대시보드
            </span>
          </div>
          {" "}
          <div className={`nav-item ${vals.nav.settlement}`} onClick={vals.go.settlement}>
            <Lic name="receipt" size={15} />
            {" "}
            <span>
              정산
            </span>
            {" "}
            <span className="count">
              {vals.pendingCount}
            </span>
          </div>
          {" "}
          <div className={`nav-item ${vals.nav.products}`} onClick={vals.go.products}>
            <Lic name="package" size={15} />
            {" "}
            <span>
              상품
            </span>
            {" "}
            <span className="count">
              {vals.unmappedCount}
            </span>
          </div>
          {" "}
          <div className={`nav-item ${vals.nav.diag}`} onClick={vals.go.diag}>
            <Lic name="target" size={15} />
            {" "}
            <span>
              진단
            </span>
            {" "}
            <span className="count">
              {vals.diagBadge}
            </span>
          </div>
          {" "}
          <div className={`nav-item ${vals.nav.costs}`} onClick={vals.go.costs}>
            <Lic name="wallet" size={15} />
            {" "}
            <span>
              비용
            </span>
          </div>
          {" "}
          <div className={`nav-item ${vals.nav.orders}`} onClick={vals.go.orders}>
            <Lic name="shopping-cart" size={15} />
            {" "}
            <span>
              주문
            </span>
          </div>
          {" "}
          <div style={{ padding: "12px 7px 3px", font: "var(--fw-semi) 11px var(--font-sans)", color: "var(--fg-4)" }}>
            연동
          </div>
          {" "}
          <div className={`nav-item ${vals.nav.connect}`} onClick={vals.go.connect}>
            <Lic name="plug" size={15} />
            {" "}
            <span>
              채널
            </span>
            {" "}
            <span className="count">
              {vals.connBadge}
            </span>
          </div>
          {" "}
          <div className={`nav-item ${vals.nav.import}`} onClick={vals.go.import}>
            <Lic name="file-up" size={15} />
            {" "}
            <span>
              가져오기
            </span>
          </div>
          {" "}
          <div className={`nav-item ${vals.nav.sync}`} onClick={vals.go.sync}>
            <Lic name="history" size={15} />
            {" "}
            <span>
              가져오기 기록
            </span>
          </div>
          {" "}
          <div style={{ padding: "12px 7px 3px", font: "var(--fw-semi) 11px var(--font-sans)", color: "var(--fg-4)" }}>
            기준
          </div>
          {" "}
          <div className={`nav-item ${vals.nav.linking}`} onClick={vals.go.linking}>
            <Lic name="link" size={15} />
            {" "}
            <span>
              상품 연결
            </span>
            {" "}
            <span className="count">
              {vals.linkBadge}
            </span>
          </div>
          {" "}
          <div className={`nav-item ${vals.nav.fieldmap}`} onClick={vals.go.fieldmap}>
            <Lic name="columns-3" size={15} />
            {" "}
            <span>
              필드 매핑
            </span>
            {" "}
            <span className="count">
              {vals.fmBadge}
            </span>
          </div>
          {" "}
          <div className={`nav-item ${vals.nav.myfields}`} onClick={vals.go.myfields}>
            <Lic name="square-pen" size={15} />
            {" "}
            <span>
              내 필드
            </span>
            {" "}
            <span className="count">
              {vals.cfBadge}
            </span>
          </div>
        </div>
        {" "}
        <div style={{ flex: "none", borderTop: "1px solid var(--border)", paddingTop: "6px" }}>
          <div className={`nav-item ${vals.nav.design}`} onClick={vals.go.design}>
            <Lic name="git-fork" size={15} />
            {" "}
            <span>
              데이터 구조
            </span>
          </div>
          {" "}
          <div className={`nav-item ${vals.nav.settings}`} onClick={vals.go.settings}>
            <Lic name="settings" size={15} />
            {" "}
            <span>
              설정
            </span>
          </div>
          {" "}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", height: "38px", padding: "0 7px", marginTop: "4px", borderTop: "1px solid var(--border)" }}>
            <svg viewBox="0 0 32 32" width="18" height="18" style={{ display: "block", flex: "none" }}>
              <rect x="0" y="0" width="32" height="32" rx="8.4" fill="url(#fbTile)"></rect>
              {" "}
              <rect x="0.4" y="0.4" width="31.2" height="31.2" rx="8" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="0.8"></rect>
              {" "}
              <g transform="translate(4.8 4.8) scale(0.7)" stroke="url(#fbMetal)" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <g clipPath="url(#fbClip)">
                  <path d="M0 9.5 c 5.44 -3, 10.56 -3, 16 0 s 10.56 3, 16 0" strokeWidth="4.5"></path>
                  {" "}
                  <path d="M0 16 c 5.44 -3, 10.56 -3, 16 0 s 10.56 3, 16 0" strokeWidth="4.5"></path>
                  {" "}
                  <path d="M0 22.5 c 5.44 -3, 10.56 -3, 16 0 s 10.56 3, 16 0" strokeWidth="4.5"></path>
                </g>
                {" "}
                <circle cx="16" cy="16" r="13" strokeWidth="2.7" fill="none"></circle>
              </g>
            </svg>
            {" "}
            <span style={{ minWidth: "0", display: "grid" }}>
              <span style={{ font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                FlowBase
              </span>
            </span>
            {" "}
            <span style={{ flex: "1" }}></span>
            {" "}
            <span style={{ font: "var(--fw-medium) 10px var(--font-mono)", color: "var(--fg-4)", flex: "none" }}>
              v1.0.0
            </span>
          </div>
        </div>
      </nav>
      {" "}
      <main style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column" }}>
        <header style={{ height: "44px", flex: "none", display: "flex", alignItems: "center", gap: "10px", padding: "0 14px", borderBottom: "1px solid var(--border)" }}>
          {vals.navClosed && (
              <span className="iconbtn" style={{ cursor: "pointer", flex: "none", marginLeft: "-4px" }} onClick={vals.toggleNav} title="사이드바 펼치기">
                <PanelIcon side="left" size={15} />
              </span>
          )}
          {" "}
          <span style={{ font: "var(--fw-semi) 15px var(--font-sans)", color: "var(--fg)" }}>
            {vals.title}
          </span>
          {" "}
          <span className="fb-head-sub" style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-4)" }}>
            {vals.subtitle}
          </span>
          {" "}
          {vals.periodPick && (
              <span data-s21="period-picker" style={{ position: "relative", flex: "none" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", height: "24px", padding: "0 8px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", background: "var(--bg-elevated)", font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg)", cursor: "pointer", whiteSpace: "nowrap" }} onClick={vals.periodPick.toggle} title="보는 달 바꾸기">
                  {vals.periodPick.label}
                  {" "}
                  <Lic name="chevron-down" size={12} />
                </span>
                {" "}
                {vals.periodPick.open && (
                    <span style={{ position: "absolute", zIndex: "120", top: "calc(100% + 6px)", left: "0", minWidth: "160px", textAlign: "left", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-popover)", display: "grid", padding: "4px" }} onClick={vals.stopEvt}>
                      {vals.periodPick.items.map((m: any, $index: number) => (
                          <span key={$index} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "7px 9px", borderRadius: "var(--r-sm)", background: m.bg, font: "var(--fw-medium) 12px var(--font-sans)", color: m.fg, cursor: "pointer" }} onClick={m.pick}>
                            {m.label}
                            {" "}
                            {m.sub && (
                                <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)", flex: "none" }}>
                                  {m.sub}
                                </span>
                            )}
                          </span>
                      ))}
                      {" "}
                      <span style={{ padding: "6px 9px 4px", font: "var(--fw-regular) 11px/1.5 var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                        {vals.periodPick.note}
                      </span>
                    </span>
                )}
              </span>
          )}
          {" "}
          <span style={{ flex: "1" }}></span>
          {" "}
          <span className="fb-head-state" style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "6px", font: "var(--fw-medium) 12px var(--font-sans)", color: vals.syncColor, cursor: "pointer" }} onClick={vals.toggleAttn}>
            <span style={{ width: "6px", height: "6px", borderRadius: "999px", background: vals.syncColor }}></span>
            {" "}
            <span>
              {vals.syncLine}
            </span>
            {" "}
            {vals.attnOpen && (
                <span style={{ position: "absolute", zIndex: "120", top: "calc(100% + 7px)", left: "0", width: "320px", textAlign: "left", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-popover)", display: "grid" }} onClick={vals.stopEvt}>
                  <span style={{ display: "block", padding: "9px 12px", borderBottom: "1px solid var(--border)", font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg)" }}>
                    확인이 필요한 것
                  </span>
                  {" "}
                  {vals.attnItems.map((a: any, $index: number) => (
                      <span key={$index} className="fb-row" style={{ display: "flex", alignItems: "flex-start", gap: "9px", padding: "10px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={a.go}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "999px", background: a.color, marginTop: "5px", flex: "none" }}></span>
                        {" "}
                        <span style={{ flex: "1", minWidth: "0", display: "grid", gap: "2px" }}>
                          <span style={{ font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg-2)" }}>
                            {a.title}
                          </span>
                          {" "}
                          <span style={{ font: "var(--fw-regular) 11px/1.5 var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                            {a.desc}
                          </span>
                        </span>
                        {" "}
                        <Lic name="chevron-right" size={13} />
                      </span>
                  ))}
                  {" "}
                  <span style={{ display: "block", padding: "9px 12px", font: "var(--fw-regular) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                    {vals.attnFoot}
                  </span>
                </span>
            )}
          </span>
          {" "}
          <span className="fb-head-actions" style={{ display: "inline-flex", alignItems: "center", gap: "6px", position: "relative" }}>
            <span className="toolbar-icons" style={{ position: "relative", flex: "none" }}>
              <span className="iconbtn" style={{ cursor: "pointer" }} onClick={vals.toggleTheme} title="테마 전환">
                <Lic name={vals.themeIcon} size={15} />
              </span>
              {" "}
              <span className="iconbtn" style={{ cursor: "pointer" }} onClick={vals.toggleFilter} title="필터">
                <Lic name="list-filter" size={15} />
              </span>
              {" "}
              {vals.filterOpen && (
                  <span>
                    <span className="overlay" onClick={vals.closeMenus}></span>
                    {" "}
                    <span className="panel" style={{ right: "0", top: "34px", width: "244px", maxHeight: "68vh", overflowY: "auto", display: "block" }}>
                      <span className="panel-caption" style={{ display: "block" }}>
                        채널
                      </span>
                      {" "}
                      {vals.filterChannels.map((f: any, $index: number) => (
                          <span key={$index} className="v-menu-item" onClick={f.pick}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: f.color, flex: "none" }}></span>
                            {" "}
                            <span>
                              {f.label}
                            </span>
                            {" "}
                            <span style={{ marginLeft: "auto", color: "var(--accent)" }}>
                              {f.check}
                            </span>
                          </span>
                      ))}
                      {" "}
                      <span className="panel-sep" style={{ display: "block" }}></span>
                      {" "}
                      <span className="panel-caption" style={{ display: "block" }}>
                        카테고리
                      </span>
                      {" "}
                      {vals.catItems.map((c: any, $index: number) => (
                          <span key={$index} className="v-menu-item" onClick={c.pick}>
                            <span>
                              {c.label}
                            </span>
                            {" "}
                            <span style={{ marginLeft: "auto", color: "var(--accent)" }}>
                              {c.check}
                            </span>
                          </span>
                      ))}
                    </span>
                  </span>
              )}
              {" "}
              {vals.v.dash && (
                  <span className="iconbtn" style={{ cursor: "pointer" }} onClick={vals.toggleDisp} title="표시 설정">
                    <Lic name="sliders-horizontal" size={15} />
                  </span>
              )}
              {" "}
              {vals.dispShown && (
                  <span>
                    <span className="overlay" onClick={vals.closeDisp}></span>
                    {" "}
                    <span className="panel" style={{ right: "0", top: "34px", width: "232px", display: "block" }}>
                      <span className="panel-caption" style={{ display: "block" }}>
                        레이아웃
                      </span>
                      {" "}
                      <span className="seg-toggle">
                        {vals.dispModes.map((m: any, $index: number) => (
                            <span key={$index} className={`st ${m.on}`} onClick={m.pick}>
                              <span>
                                {m.label}
                              </span>
                              {" "}
                              <span style={{ font: "var(--fw-semi) 9px var(--font-sans)", color: "var(--accent)", marginLeft: "4px" }}>
                                {m.lock}
                              </span>
                            </span>
                        ))}
                      </span>
                      {" "}
                      <span className="panel-sep" style={{ display: "block" }}></span>
                      {" "}
                      <span className="panel-caption" style={{ display: "block" }}>
                        사이드 카드
                      </span>
                      {" "}
                      <span className="prop-chips">
                        {vals.dispCards.map((d: any, $index: number) => (
                            <span key={$index} className={`prop-chip ${d.on}`} onClick={d.pick}>
                              {d.label}
                            </span>
                        ))}
                      </span>
                    </span>
                  </span>
              )}
            </span>
            {" "}
            <button className="v-btn" style={{ height: "28px" }} onClick={vals.syncAll}>
              가져오기
            </button>
            {" "}
            <span className="fb-head-more iconbtn" style={{ cursor: "pointer" }} onClick={vals.toggleHeadMore}>
              <Lic name="more-horizontal" size={16} />
            </span>
            {" "}
            {vals.headMoreOpen && (
                <span style={{ position: "absolute", zIndex: "130", top: "calc(100% + 7px)", right: "0", width: "200px", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-popover)", display: "grid" }} onClick={vals.stopEvt}>
                  {vals.headMoreItems.map((m: any, $index: number) => (
                      <span key={$index} className="fb-row" style={{ display: "flex", alignItems: "center", gap: "9px", padding: "10px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer", font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)" }} onClick={m.run}>
                        {m.label}
                      </span>
                  ))}
                </span>
            )}
          </span>
        </header>
        {" "}
        <div style={{ flex: "1", minHeight: "0", display: "flex" }}>
          <div className="fb-scroll" style={{ flex: "1", minWidth: "0", overflowY: "auto" }}>
            {/* ══════════ 손익 대시보드 ══════════ */}
            {" "}
            {vals.v.dash && (
                <section data-screen-label="손익 대시보드">
                  {vals.firstRun && (
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
                          <div style={{ border: "1px dashed var(--border-strong)", borderRadius: "var(--r-lg)", padding: "34px 24px", display: "grid", gap: "12px", justifyItems: "center", background: "var(--bg-subtle)", cursor: "pointer" }} onClick={vals.goImport}>
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
                            {vals.onboard.map((o: any, $index: number) => (
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
                  )}
                  {" "}
                  {vals.notFirstRun && (
                    <>
                      {vals.isReport && (
                        <>
                          <div style={{ padding: "26px 32px 20px", borderBottom: "1px solid var(--border)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <svg viewBox="0 0 32 32" width="17" height="17" style={{ display: "block", flex: "none" }}>
                                <rect x="0" y="0" width="32" height="32" rx="8.4" fill="url(#fbTile)"></rect>
                                {" "}
                                <rect x="0.4" y="0.4" width="31.2" height="31.2" rx="8" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="0.8"></rect>
                                {" "}
                                <g transform="translate(4.8 4.8) scale(0.7)" stroke="url(#fbMetal)" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                  <g clipPath="url(#fbClip)">
                                    <path d="M0 9.5 c 5.44 -3, 10.56 -3, 16 0 s 10.56 3, 16 0" strokeWidth="4.5"></path>
                                    {" "}
                                    <path d="M0 16 c 5.44 -3, 10.56 -3, 16 0 s 10.56 3, 16 0" strokeWidth="4.5"></path>
                                    {" "}
                                    <path d="M0 22.5 c 5.44 -3, 10.56 -3, 16 0 s 10.56 3, 16 0" strokeWidth="4.5"></path>
                                  </g>
                                  {" "}
                                  <circle cx="16" cy="16" r="13" strokeWidth="2.7" fill="none"></circle>
                                </g>
                              </svg>
                              {" "}
                              <span style={{ font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg-3)" }}>
                                키넛츠
                              </span>
                              {" "}
                              <span style={{ flex: "1" }}></span>
                              {" "}
                              <span className="no-print" style={{ display: "flex", alignItems: "center", gap: "6px", position: "relative" }}>
                                <span className="v-btn" style={{ height: "28px", cursor: "pointer" }} onClick={vals.toggleArchive}>
                                  지난 리포트
                                </span>
                                {" "}
                                <span className="v-btn" style={{ height: "28px", cursor: "pointer" }} onClick={vals.printReport}>
                                  {vals.printLabel}
                                </span>
                                {" "}
                                <span className="iconbtn" style={{ cursor: "pointer" }} onClick={vals.exitReport} title="리포트 닫기">
                                  <Lic name="x" size={15} />
                                </span>
                                {" "}
                                {vals.archiveOpen && (
                                    <span style={{ position: "absolute", zIndex: "50", top: "calc(100% + 6px)", right: "0", width: "268px", padding: "5px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-popover)" }}>
                                      <span style={{ display: "block", padding: "6px 9px 8px", font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                        매월 1일에 지난달 리포트가 자동으로 확정됩니다
                                      </span>
                                      {" "}
                                      {vals.archiveList.map((r: any, $index: number) => (
                                          <span key={$index} className="fb-row" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 9px", borderRadius: "var(--r-sm)", background: r.bg, cursor: "pointer" }}>
                                            <span style={{ display: "grid", gap: "2px", minWidth: "0", flex: "1" }}>
                                              <span style={{ font: "var(--fw-semi) 12px var(--font-sans)", color: r.color }}>
                                                {r.period}
                                              </span>
                                              {" "}
                                              <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                                {r.sub}
                                              </span>
                                            </span>
                                            {" "}
                                            <span className="v-num" style={{ font: "var(--fw-semi) 11px var(--font-mono)", color: "var(--fg-3)", whiteSpace: "nowrap" }}>
                                              {r.net}
                                            </span>
                                          </span>
                                      ))}
                                    </span>
                                )}
                              </span>
                            </div>
                            {" "}
                            <div className="rp-foot" style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)", marginTop: "10px", paddingBottom: "8px", borderBottom: "1px solid var(--border)" }}>
                              {vals.reportFoot}
                            </div>
                            {" "}
                            <div style={{ font: "var(--fw-semi) 28px var(--font-sans)", color: "var(--fg)", letterSpacing: "-0.02em", marginTop: "14px" }}>
                              2026년 8월 손익 리포트
                            </div>
                            {" "}
                            <div style={{ display: "grid", gap: "7px", marginTop: "8px", maxWidth: "760px" }}>
                              <div style={{ font: "var(--fw-regular) 13px/1.7 var(--font-sans)", color: "var(--fg-3)", textWrap: "pretty" }}>
                                {vals.reportLead}
                              </div>
                              {" "}
                              <div style={{ font: "var(--fw-regular) 13px/1.7 var(--font-sans)", color: "var(--fg-3)", textWrap: "pretty" }}>
                                {vals.reportLead2}
                              </div>
                              {" "}
                              <div style={{ font: "var(--fw-regular) 13px/1.7 var(--font-sans)", color: "var(--fg-3)", textWrap: "pretty" }}>
                                {vals.reportLead3}
                              </div>
                            </div>
                            {" "}
                            <div style={{ display: "flex", gap: "22px", marginTop: "16px", flexWrap: "wrap" }}>
                              {vals.reportMeta.map((m: any, $index: number) => (
                                  <span key={$index} style={{ display: "grid", gap: "2px" }}>
                                    <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                      {m.label}
                                    </span>
                                    {" "}
                                    <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)" }}>
                                      {m.value}
                                    </span>
                                  </span>
                              ))}
                            </div>
                            {" "}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginTop: "20px", background: "var(--bg-app)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                              {vals.comparisons.map((c: any, $index: number) => (
                                  <span key={$index} style={{ display: "grid", gap: "5px", padding: "12px 14px", minWidth: "0", boxShadow: "1px 0 0 var(--border)" }}>
                                    <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                      {c.label}
                                    </span>
                                    {" "}
                                    <span className="v-num" style={{ font: "var(--fw-semi) 17px var(--font-sans)", fontVariantNumeric: "tabular-nums", color: c.color }}>
                                      {c.delta}
                                    </span>
                                    {" "}
                                    <span className="v-num" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-3)" }}>
                                      {c.base}
                                    </span>
                                  </span>
                              ))}
                            </div>
                          </div>
                          {" "}
                          <div className="rp-keep" style={{ padding: "22px 32px 24px", borderBottom: "1px solid var(--border)" }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                              <span style={{ font: "var(--fw-semi) 15px var(--font-sans)", color: "var(--fg)" }}>
                                순이익 브리지
                              </span>
                              {" "}
                              <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                {vals.bridgeCaption}
                              </span>
                            </div>
                            {" "}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "32px 40px", marginTop: "18px", alignItems: "start" }}>
                              <div>
                                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "20px" }}>
                                  <span style={{ display: "grid", gap: "2px" }}>
                                    <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                      7월 1–8일
                                    </span>
                                    {" "}
                                    <span className="v-num" style={{ font: "var(--fw-medium) 14px var(--font-mono)", color: "var(--fg-3)" }}>
                                      {vals.bridgeFrom}
                                    </span>
                                  </span>
                                  {" "}
                                  <span className="v-num" style={{ font: "var(--fw-semi) 24px var(--font-sans)", color: "var(--pnl-pos)", letterSpacing: "-0.02em" }}>
                                    {vals.bridgeTitle}
                                  </span>
                                  {" "}
                                  <span style={{ display: "grid", gap: "2px", justifyItems: "end" }}>
                                    <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                      8월 1–8일
                                    </span>
                                    {" "}
                                    <span className="v-num" style={{ font: "var(--fw-semi) 14px var(--font-mono)", color: "var(--fg)" }}>
                                      {vals.bridgeTo}
                                    </span>
                                  </span>
                                </div>
                                {" "}
                                <div style={{ display: "grid", gap: "6px" }}>
                                  <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                                    <span style={{ font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg-2)" }}>
                                      올린 힘
                                    </span>
                                    {" "}
                                    <span className="v-num" style={{ font: "var(--fw-semi) 12px var(--font-mono)", color: "var(--pnl-pos)" }}>
                                      {vals.bridgeUp.total}
                                    </span>
                                  </span>
                                  {" "}
                                  <span style={{ display: "flex", gap: "2px", height: "22px", width: vals.bridgeUp.width }}>
                                    {vals.bridgeUp.segs.map((s: any, $index: number) => (
                                        <span key={$index} style={{ width: s.w, background: s.color, borderRadius: "2px" }}></span>
                                    ))}
                                  </span>
                                  {" "}
                                  <span style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
                                    {vals.bridgeUp.items.map((i: any, $index: number) => (
                                        <span key={$index} className="v-num" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-4)" }}>
                                          {i.label} {i.amount}
                                        </span>
                                    ))}
                                  </span>
                                </div>
                                {" "}
                                <div style={{ display: "grid", gap: "6px", marginTop: "20px" }}>
                                  <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                                    <span style={{ font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg-2)" }}>
                                      내린 힘
                                    </span>
                                    {" "}
                                    <span className="v-num" style={{ font: "var(--fw-semi) 12px var(--font-mono)", color: "var(--pnl-neg)" }}>
                                      {vals.bridgeDown.total}
                                    </span>
                                  </span>
                                  {" "}
                                  <span style={{ display: "flex", gap: "2px", height: "22px", width: vals.bridgeDown.width }}>
                                    {vals.bridgeDown.segs.map((s: any, $index: number) => (
                                        <span key={$index} style={{ width: s.w, background: s.color, borderRadius: "2px" }}></span>
                                    ))}
                                  </span>
                                  {" "}
                                  <span style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
                                    {vals.bridgeDown.items.map((i: any, $index: number) => (
                                        <span key={$index} className="v-num" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-4)" }}>
                                          {i.label} {i.amount}
                                        </span>
                                    ))}
                                  </span>
                                </div>
                              </div>
                              {" "}
                              <div style={{ display: "grid", gap: "14px", paddingTop: "4px" }}>
                                {vals.bridgeSentences.map((s: any, $index: number) => (
                                    <span key={$index} style={{ display: "grid", gridTemplateColumns: "minmax(0, 104px) minmax(0, 1fr)", alignItems: "baseline", gap: "12px" }}>
                                      <span className="v-num" style={{ font: "var(--fw-semi) 14px var(--font-mono)", color: s.color, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {s.amount}
                                      </span>
                                      {" "}
                                      <span style={{ font: "var(--fw-regular) 13px/1.6 var(--font-sans)", color: "var(--fg-2)", textWrap: "pretty", minWidth: "0" }}>
                                        <span style={{ fontWeight: "var(--fw-semi)" }}>
                                          {s.label}
                                        </span>
                                        {s.tail}
                                      </span>
                                    </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          {" "}
                          <div className="rp-break rp-keep" style={{ padding: "22px 32px 24px", borderBottom: "1px solid var(--border)" }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                              <span style={{ font: "var(--fw-semi) 15px var(--font-sans)", color: "var(--fg)" }}>
                                손익과 현금
                              </span>
                              {" "}
                              <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                번 돈과 들어온 돈은 정산 주기 때문에 다릅니다
                              </span>
                            </div>
                            {" "}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginTop: "14px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                              <span style={{ display: "grid", gap: "4px", padding: "12px 14px", boxShadow: "1px 0 0 var(--border)" }}>
                                <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                  이 기간 순이익
                                </span>
                                {" "}
                                <span className="v-num" style={{ font: "var(--fw-semi) 17px var(--font-sans)", color: "var(--fg)" }}>
                                  {vals.cashNet}
                                </span>
                                {" "}
                                <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                  발생 기준
                                </span>
                              </span>
                              {" "}
                              <span style={{ display: "grid", gap: "4px", padding: "12px 14px", boxShadow: "1px 0 0 var(--border)" }}>
                                <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                  이미 입금
                                </span>
                                {" "}
                                <span className="v-num" style={{ font: "var(--fw-semi) 17px var(--font-sans)", color: "var(--pnl-pos)" }}>
                                  {vals.cashPaid}
                                </span>
                                {" "}
                                <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                  정산 완료
                                </span>
                              </span>
                              {" "}
                              <span style={{ display: "grid", gap: "4px", padding: "12px 14px", boxShadow: "1px 0 0 var(--border)" }}>
                                <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                  입금 예정
                                </span>
                                {" "}
                                <span className="v-num" style={{ font: "var(--fw-semi) 17px var(--font-sans)", color: "var(--pnl-warn)" }}>
                                  {vals.cashDue}
                                </span>
                                {" "}
                                <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                  지급일 미도래
                                </span>
                              </span>
                              {" "}
                              <span style={{ display: "grid", gap: "4px", padding: "12px 14px" }}>
                                <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                  차액
                                </span>
                                {" "}
                                <span className="v-num" style={{ font: "var(--fw-semi) 17px var(--font-sans)", color: "var(--fg-2)" }}>
                                  {vals.cashGap}
                                </span>
                                {" "}
                                <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                  순이익 − 입금
                                </span>
                              </span>
                            </div>
                            {" "}
                            <div style={{ font: "var(--fw-regular) 12px/1.7 var(--font-sans)", color: "var(--fg-3)", marginTop: "12px", maxWidth: "760px", textWrap: "pretty" }}>
                              {vals.cashNote}
                            </div>
                            {" "}
                            <div style={{ display: "grid", gap: "9px", marginTop: "16px", maxWidth: "760px" }}>
                              {vals.cashByCh.map((c: any, $index: number) => (
                                  <span key={$index} style={{ display: "grid", gridTemplateColumns: "76px 64px 1fr 108px 108px", gap: "12px", alignItems: "center" }}>
                                    <span style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: "0" }}>
                                      <span style={{ width: "7px", height: "7px", borderRadius: "2px", background: c.color, flex: "none" }}></span>
                                      {" "}
                                      <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {c.name}
                                      </span>
                                    </span>
                                    {" "}
                                    <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                      {c.cycle}
                                    </span>
                                    {" "}
                                    <span style={{ display: "block", height: "8px", borderRadius: "2px", background: "var(--bg-active)", minWidth: "0" }}>
                                      <span style={{ display: "flex", height: "8px", borderRadius: "2px", width: c.bar, background: "var(--pnl-warn)" }}>
                                        <span style={{ height: "8px", borderRadius: "2px 0 0 2px", width: c.paidBar, background: c.color }}></span>
                                      </span>
                                    </span>
                                    {" "}
                                    <span className="v-num" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-3)", textAlign: "right" }}>
                                      입금 {c.paid}
                                    </span>
                                    {" "}
                                    <span className="v-num" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--pnl-warn)", textAlign: "right" }}>
                                      예정 {c.due}
                                    </span>
                                  </span>
                              ))}
                            </div>
                          </div>
                          {" "}
                          <div className="rp-keep" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "var(--border)", borderBottom: "1px solid var(--border)" }}>
                            <div style={{ background: "var(--bg-app)", padding: "20px 32px 22px" }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "14px" }}>
                                <span style={{ font: "var(--fw-semi) 15px var(--font-sans)", color: "var(--fg)" }}>
                                  짚어볼 것
                                </span>
                                {" "}
                                <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                  {vals.flagCount}건 · 규칙에 걸린 항목
                                </span>
                              </div>
                              {" "}
                              <div style={{ display: "grid", gap: "14px" }}>
                                {vals.flags.map((f: any, $index: number) => (
                                    <span key={$index} style={{ display: "grid", gridTemplateColumns: "8px 1fr", gap: "10px", alignItems: "start" }}>
                                      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: f.tone, marginTop: "5px" }}></span>
                                      {" "}
                                      <span style={{ display: "grid", gap: "3px", minWidth: "0" }}>
                                        <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                                          {f.title}
                                        </span>
                                        {" "}
                                        <span style={{ font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-3)", textWrap: "pretty" }}>
                                          {f.body}
                                        </span>
                                      </span>
                                    </span>
                                ))}
                              </div>
                            </div>
                            {" "}
                            <div style={{ background: "var(--bg-app)", padding: "20px 32px 22px" }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "14px" }}>
                                <span style={{ font: "var(--fw-semi) 15px var(--font-sans)", color: "var(--fg)" }}>
                                  움직인 상품
                                </span>
                                {" "}
                                <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                  전월 같은 기간 대비 기여이익 변화
                                </span>
                              </div>
                              {" "}
                              <div style={{ display: "grid", gap: "9px" }}>
                                {vals.moversUp.map((m: any, $index: number) => (
                                    <span key={$index} style={{ display: "grid", gridTemplateColumns: "1fr 96px", gap: "12px", alignItems: "baseline" }}>
                                      <span style={{ display: "grid", gap: "3px", minWidth: "0" }}>
                                        <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                          {m.name}
                                        </span>
                                        {" "}
                                        <span style={{ display: "block", height: "3px", borderRadius: "2px", background: "var(--bg-active)" }}>
                                          <span style={{ display: "block", height: "3px", borderRadius: "2px", width: m.bar, background: m.color }}></span>
                                        </span>
                                      </span>
                                      {" "}
                                      <span className="v-num" style={{ font: "var(--fw-semi) 12px var(--font-mono)", color: m.color, textAlign: "right" }}>
                                        {m.delta}
                                      </span>
                                    </span>
                                ))}
                                {" "}
                                <span style={{ height: "1px", background: "var(--border)", margin: "4px 0" }}></span>
                                {" "}
                                {vals.moversDown.map((m: any, $index: number) => (
                                    <span key={$index} style={{ display: "grid", gridTemplateColumns: "1fr 96px", gap: "12px", alignItems: "baseline" }}>
                                      <span style={{ display: "grid", gap: "3px", minWidth: "0" }}>
                                        <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                          {m.name}
                                        </span>
                                        {" "}
                                        <span style={{ display: "block", height: "3px", borderRadius: "2px", background: "var(--bg-active)" }}>
                                          <span style={{ display: "block", height: "3px", borderRadius: "2px", width: m.bar, background: m.color }}></span>
                                        </span>
                                      </span>
                                      {" "}
                                      <span className="v-num" style={{ font: "var(--fw-semi) 12px var(--font-mono)", color: m.color, textAlign: "right" }}>
                                        {m.delta}
                                      </span>
                                    </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      {" "}
                      {vals.showToolbar && (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
                            <span style={{ position: "relative", flex: "none" }}>
                              <span className="filter-pill" style={{ cursor: "pointer" }} onClick={vals.toggleViews}>
                                <span className="seg-part">
                                  <Lic name="layers" size={13} color="var(--fg-3)" />
                                  {" "}
                                  <span style={{ color: "var(--fg)" }}>
                                    {vals.viewName}
                                  </span>
                                  {" "}
                                  <span style={{ color: "var(--pnl-warn)", fontSize: "11px" }}>
                                    {vals.viewDirty}
                                  </span>
                                </span>
                                {" "}
                                <span className="seg-part" style={{ padding: "0 7px 0 0", color: "var(--fg-4)" }}>
                                  <Lic name="chevron-down" size={12} />
                                </span>
                              </span>
                              {" "}
                              {vals.viewsOpen && (
                                  <span style={{ position: "absolute", zIndex: "60", top: "calc(100% + 6px)", left: "0", width: "268px", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-popover)", overflow: "hidden" }}>
                                    <span style={{ display: "block", padding: "8px 11px 6px", font: "var(--fw-semi) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                      저장된 뷰
                                    </span>
                                    {" "}
                                    {vals.savedViews.map((sv: any, $index: number) => (
                                        <span key={$index} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 9px 7px 11px", cursor: "pointer", background: sv.bg }} onClick={sv.pick}>
                                          <span style={{ minWidth: "0", display: "grid", gap: "1px", flex: "1" }}>
                                            <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: sv.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                              {sv.name}
                                            </span>
                                            {" "}
                                            <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                              {sv.desc}
                                            </span>
                                          </span>
                                          {" "}
                                          {sv.canDelete && (
                                              <span className="iconbtn" style={{ cursor: "pointer", flex: "none" }} onClick={sv.remove} title="뷰 삭제">
                                                <Lic name="trash-2" size={13} />
                                              </span>
                                          )}
                                        </span>
                                    ))}
                                    {" "}
                                    <span style={{ display: "block", borderTop: "1px solid var(--border)", padding: "9px 11px" }}>
                                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                        <input className="v-input" style={{ flex: "1", minWidth: "0", height: "28px", fontSize: "12px" }} value={vals.newViewName} onChange={vals.setNewViewName} placeholder="현재 화면을 이름 붙여 저장" onClick={vals.stopEvt} />
                                        {" "}
                                        <button className="v-btn v-btn--primary" style={{ height: "28px" }} onClick={vals.saveView}>
                                          저장
                                        </button>
                                      </span>
                                      {" "}
                                      <span style={{ display: "block", marginTop: "7px", font: "var(--fw-regular) 10px/1.5 var(--font-sans)", color: "var(--fg-4)" }}>
                                        {vals.viewSaveNote}
                                      </span>
                                    </span>
                                  </span>
                              )}
                            </span>
                            {" "}
                            <span style={{ position: "relative", flex: "none" }}>
                              <span className="filter-pill" style={{ cursor: "pointer" }} onClick={vals.toggleRange}>
                                <span className="seg-part">
                                  <Lic name="calendar" size={13} color="var(--fg-3)" />
                                  {" "}
                                  <span style={{ color: "var(--fg)" }}>
                                    {vals.rangeLabel}
                                  </span>
                                </span>
                                {" "}
                                <span className="seg-part" style={{ padding: "0 7px 0 0", color: "var(--fg-4)" }}>
                                  <Lic name="chevron-down" size={12} />
                                </span>
                              </span>
                              {" "}
                              {vals.rangeOpen && (
                                  <span>
                                    <span className="overlay" onClick={vals.closeMenus}></span>
                                    {" "}
                                    <span className="panel" style={{ left: "0", top: "34px", width: "480px", display: "flex", padding: "0", overflow: "hidden" }}>
                                      <span style={{ width: "172px", flex: "none", borderRight: "1px solid var(--border)", padding: "6px 0" }}>
                                        {vals.presetItems.map((p: any, $index: number) => (
                                            <span key={$index} className="v-menu-item" onClick={p.pick}>
                                              <span>
                                                {p.label}
                                              </span>
                                              {" "}
                                              <span style={{ marginLeft: "auto", color: "var(--accent)" }}>
                                                {p.check}
                                              </span>
                                            </span>
                                        ))}
                                      </span>
                                      {" "}
                                      <span style={{ flex: "1", minWidth: "0", padding: "10px 12px 12px" }}>
                                        <span style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                                          <span className={`iconbtn ${vals.prevDis}`} style={{ cursor: "pointer", width: "24px", height: "24px" }} onClick={vals.prevMonth}>
                                            <Lic name="chevron-left" size={14} />
                                          </span>
                                          {" "}
                                          <span className="linklike" style={{ flex: "1", textAlign: "center", font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "4px" }} onClick={vals.toggleCalView}>
                                            <span>
                                              {vals.calTitle}
                                            </span>
                                            {" "}
                                            <Lic name={vals.calViewIcon} size={12} color="var(--fg-4)" />
                                          </span>
                                          {" "}
                                          <span className={`iconbtn ${vals.nextDis}`} style={{ cursor: "pointer", width: "24px", height: "24px" }} onClick={vals.nextMonth}>
                                            <Lic name="chevron-right" size={14} />
                                          </span>
                                        </span>
                                        {" "}
                                        {vals.calYearsView && (
                                            <span style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", padding: "6px 0 4px" }}>
                                              {vals.yearCells.map((y: any, $index: number) => (
                                                  <span key={$index} style={{ height: "34px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--r-sm)", background: y.bg, color: y.color, font: `${y.font} var(--font-sans)`, fontVariantNumeric: "tabular-nums", cursor: y.cursor }} onClick={y.pick}>
                                                    {y.label}
                                                  </span>
                                              ))}
                                            </span>
                                        )}
                                        {" "}
                                        {vals.calMonthsView && (
                                            <span style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", padding: "6px 0 4px" }}>
                                              {vals.monthCells.map((m: any, $index: number) => (
                                                  <span key={$index} style={{ height: "34px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--r-sm)", background: m.bg, color: m.color, font: `${m.font} var(--font-sans)`, cursor: m.cursor }} onClick={m.pick}>
                                                    {m.label}
                                                  </span>
                                              ))}
                                            </span>
                                        )}
                                        {" "}
                                        {vals.calDaysView && (
                                            <span style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px" }}>
                                              {vals.dowHead.map((w: any, $index: number) => (
                                                  <span key={$index} style={{ height: "22px", display: "flex", alignItems: "center", justifyContent: "center", font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                                    {w}
                                                  </span>
                                              ))}
                                              {" "}
                                              {vals.calCells.map((c: any, $index: number) => (
                                                  <span key={$index} style={{ height: "30px", display: "flex", alignItems: "center", justifyContent: "center", background: c.bg, borderRadius: c.radius }}>
                                                    <span style={{ width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--r-sm)", background: c.dotBg, color: c.color, font: `${c.font} var(--font-sans)`, fontVariantNumeric: "tabular-nums", cursor: c.cursor }} onClick={c.pick}>
                                                      {c.label}
                                                    </span>
                                                  </span>
                                              ))}
                                            </span>
                                        )}
                                        {" "}
                                        <span style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px", paddingTop: "9px", borderTop: "1px solid var(--border)" }}>
                                          <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                            {vals.calHint}
                                          </span>
                                          {" "}
                                          <span style={{ flex: "1" }}></span>
                                          {" "}
                                          <span className="linklike" style={{ fontSize: "12px" }} onClick={vals.resetRange}>
                                            이번 달
                                          </span>
                                        </span>
                                      </span>
                                    </span>
                                  </span>
                              )}
                            </span>
                            {" "}
                            <span style={{ flex: "1" }}></span>
                            {" "}
                            <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                              {vals.scopeLine}
                            </span>
                          </div>
                          {" "}
                          {vals.hasFilters && (
                              <div className="filterbar" style={{ borderTop: "0" }}>
                                {vals.filterPills.map((p: any, $index: number) => (
                                    <span key={$index} className="filter-pill">
                                      <span className="seg-part">
                                        {p.type}
                                      </span>
                                      {" "}
                                      <span className="seg-part op">
                                        is
                                      </span>
                                      {" "}
                                      <span className="seg-part" style={{ color: "var(--fg)" }}>
                                        {p.value}
                                      </span>
                                      {" "}
                                      <span className="x" onClick={p.remove}>
                                        <Lic name="x" size={13} />
                                      </span>
                                    </span>
                                ))}
                                {" "}
                                <span className="right">
                                  <span className="linklike" onClick={vals.clearPnlFilter}>
                                    전체 해제
                                  </span>
                                </span>
                              </div>
                          )}
                        </>
                      )}
                      {" "}
                      {vals.marketDown && (
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "9px", padding: "11px 14px", borderBottom: "1px solid var(--border)", background: "rgba(235,87,87,0.08)" }}>
                            <Lic name="cloud-off" size={15} color="var(--pnl-neg)" />
                            {" "}
                            <span style={{ flex: "1", minWidth: "0", display: "grid", gap: "3px" }}>
                              <span style={{ font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg)" }}>
                                {vals.downTitle}
                              </span>
                              {" "}
                              <span style={{ font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-3)", textWrap: "pretty" }}>
                                {vals.downBody}
                              </span>
                            </span>
                            {" "}
                            <button className="v-btn" style={{ height: "28px", flex: "none" }} onClick={vals.go.connect}>
                              연결 확인
                            </button>
                          </div>
                      )}
                      {" "}
                      {vals.partial && (
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "9px", padding: "11px 14px", borderBottom: "1px solid var(--border)", background: "rgba(242,201,76,0.09)" }}>
                            <Lic name="triangle-alert" size={15} color="var(--pnl-warn)" />
                            {" "}
                            <span style={{ flex: "1", minWidth: "0", display: "grid", gap: "3px" }}>
                              <span style={{ font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg)" }}>
                                {vals.partialTitle}
                              </span>
                              {" "}
                              <span style={{ font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-3)", textWrap: "pretty" }}>
                                {vals.partialBody}
                              </span>
                            </span>
                            {" "}
                            <button className="v-btn" style={{ height: "28px", flex: "none" }} onClick={vals.goFieldmap}>
                              양식 확인
                            </button>
                          </div>
                      )}
                      {" "}
                      {vals.showHero && (
                          <div style={{ display: "grid", gridTemplateColumns: "296px 1fr", borderBottom: "1px solid var(--border)" }}>
                            <div style={{ padding: "18px 18px 16px", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
                              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-4)" }}>
                                  {vals.heroLabel}
                                </span>
                                {" "}
                                {vals.partial && (
                                    <span style={{ display: "inline-flex", alignItems: "center", height: "18px", padding: "0 6px", borderRadius: "var(--r-pill)", background: "rgba(242,201,76,0.14)", font: "var(--fw-semi) 10px var(--font-sans)", color: "var(--pnl-warn)" }}>
                                      일부 제외
                                    </span>
                                )}
                              </span>
                              {" "}
                              <span className="v-num" style={{ font: "var(--fw-semi) 40px var(--font-sans)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em", color: "var(--fg)", marginTop: "6px", lineHeight: "1.05" }}>
                                {vals.heroNet}
                              </span>
                              {" "}
                              {vals.hasCompare && (
                                  <span style={{ display: "flex", alignItems: "center", gap: "7px", marginTop: "8px" }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", height: "20px", padding: "0 7px", borderRadius: "var(--r-pill)", background: vals.heroBg, font: "var(--fw-semi) 11px var(--font-sans)", color: vals.heroColor }}>
                                      <Lic name={vals.heroIcon} size={12} />
                                      {" "}
                                      <span>
                                        {vals.heroDelta}
                                      </span>
                                    </span>
                                    {" "}
                                    <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                      vs 7월 같은 기간
                                    </span>
                                  </span>
                              )}
                              {" "}
                              <span style={{ display: "flex", alignItems: "baseline", gap: "5px", marginTop: "9px", flexWrap: "wrap" }}>
                                <span style={{ font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                                  {vals.heroBasis}
                                </span>
                                {" "}
                                <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--accent)", cursor: "pointer", whiteSpace: "nowrap" }} onClick={vals.heroBasisGo}>
                                  계산 과정
                                </span>
                              </span>
                              {" "}
                              <span style={{ display: "flex", gap: "22px", marginTop: "22px", paddingTop: "14px", borderTop: "1px solid var(--border)" }}>
                                {vals.heroCompare.map((r: any, $index: number) => (
                                    <span key={$index} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                                      <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                        {r.label}
                                      </span>
                                      {" "}
                                      <span className="v-num" style={{ font: "var(--fw-semi) 13px var(--font-mono)", color: r.color }}>
                                        {r.delta}
                                      </span>
                                    </span>
                                ))}
                              </span>
                              {" "}
                              <span style={{ marginTop: "auto", paddingTop: "16px" }}>
                                <span style={{ display: "block", font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)", marginBottom: "10px" }}>
                                  매출 {vals.heroRev}원이 이렇게 나뉩니다
                                </span>
                                {" "}
                                <span data-s21="cost-bars" style={{ display: "grid", gap: "10px", position: "relative", minWidth: "0" }}>
                                  {vals.costDonutOk && (
                                      <span style={{ display: "grid", gap: "12px", justifyItems: "center", minWidth: "0" }}>
                                        <span style={{ width: "112px", height: "112px", flex: "none", borderRadius: "50%", position: "relative", background: vals.costDonut }}>
                                          <span style={{ position: "absolute", inset: "21px", borderRadius: "50%", background: "var(--bg-app)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1px" }}>
                                            <span style={{ font: "var(--fw-medium) 9px var(--font-sans)", color: "var(--fg-4)" }}>
                                              기여이익률
                                            </span>
                                            {" "}
                                            <span className="v-num" style={{ font: "var(--fw-semi) 17px var(--font-sans)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", color: vals.contribColor }}>
                                              {vals.contribMargin}
                                            </span>
                                          </span>
                                        </span>
                                        {" "}
                                        <span style={{ width: "100%", display: "grid", gap: "6px", minWidth: "0" }}>
                                          {vals.costMix.map((m: any, $index: number) => (
                                              <span key={$index} style={{ display: "flex", alignItems: "baseline", gap: "6px", minWidth: "0" }}>
                                                <span style={{ width: "7px", height: "7px", borderRadius: "2px", background: m.color, flex: "none", transform: "translateY(-1px)" }}></span>
                                                {" "}
                                                <span style={{ flex: "1 1 auto", minWidth: "0", font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                  {m.label}
                                                </span>
                                                {" "}
                                                <span className="v-num" style={{ flex: "none", font: "var(--fw-medium) 11px var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--fg-4)", whiteSpace: "nowrap" }}>
                                                  {m.amount}
                                                </span>
                                                {" "}
                                                <span className="v-num" style={{ flex: "none", font: "var(--fw-semi) 11px var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--fg-2)", whiteSpace: "nowrap", minWidth: "44px", textAlign: "right" }}>
                                                  {m.pct}
                                                </span>
                                              </span>
                                          ))}
                                        </span>
                                      </span>
                                  )}
                                  {!vals.costDonutOk && (
                                  <span style={{ display: "grid", gap: "10px", minWidth: "0" }}>
                                    {vals.costMix.map((m: any, $index: number) => (
                                        <span key={$index} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", columnGap: "10px", rowGap: "5px", alignItems: "baseline", minWidth: "0" }}>
                                          <span style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: "0" }}>
                                            <span style={{ width: "7px", height: "7px", borderRadius: "2px", background: m.color, flex: "none" }}></span>
                                            {" "}
                                            <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                              {m.label}
                                            </span>
                                          </span>
                                          {" "}
                                          <span style={{ display: "flex", alignItems: "baseline", gap: "8px", whiteSpace: "nowrap" }}>
                                            <span className="v-num" style={{ font: "var(--fw-semi) 11px var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--fg-2)" }}>
                                              {m.amount}
                                            </span>
                                            {" "}
                                            <span className="v-num" style={{ font: "var(--fw-medium) 11px var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--fg-4)", minWidth: "44px", textAlign: "right" }}>
                                              {m.pct}
                                            </span>
                                          </span>
                                          {" "}
                                          <span style={{ gridColumn: "1 / -1", height: "6px", borderRadius: "var(--r-pill)", background: "var(--bg-elevated-2)", overflow: "hidden" }}>
                                            <span style={{ display: "block", height: "100%", width: m.barW, background: m.color, borderRadius: "var(--r-pill)" }}></span>
                                          </span>
                                        </span>
                                    ))}
                                  </span>
                                  )}
                                </span>
                              </span>
                            </div>
                            {" "}
                            <div style={{ padding: "12px 16px 8px", minWidth: "0" }}>
                              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "4px" }}>
                                <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                                  일별 기여이익
                                </span>
                                {" "}
                                <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                  단위 백만원 · {vals.scopeLine}
                                </span>
                              </div>
                              {" "}
                              <div style={{ position: "relative" }}>
                                <VChart.Line data={vals.netTrend} area={true} />
                                {" "}
                                <div style={{ position: "absolute", left: "6.5%", right: "6.5%", top: "0", bottom: "15%", display: "grid", gridAutoFlow: "column", gridAutoColumns: "1fr" }}>
                                  {vals.trendCols.map((t: any, $index: number) => (
                                      <span key={$index} style={{ display: "block", width: "100%", height: "100%", background: t.bg }} onMouseEnter={t.enter} onMouseLeave={t.leave}></span>
                                  ))}
                                </div>
                                {" "}
                                {vals.trendTip && (
                                    <span style={{ position: "absolute", zIndex: "40", left: vals.trendTip.left, top: "8px", width: "180px", display: "flex", flexDirection: "column", gap: "3px", padding: "9px 11px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-popover)", pointerEvents: "none", textAlign: "left" }}>
                                      <span style={{ font: "var(--fw-semi) 11px var(--font-sans)", color: "var(--fg)", paddingBottom: "6px", marginBottom: "4px", borderBottom: "1px solid var(--border)" }}>
                                        {vals.trendTip.head}
                                      </span>
                                      {" "}
                                      {vals.trendTip.rows.map((r: any, $index: number) => (
                                          <span key={$index} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px" }}>
                                            <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-3)" }}>
                                              {r.name}
                                            </span>
                                            {" "}
                                            <span className="v-num" style={{ font: "var(--fw-semi) 12px var(--font-mono)", color: r.color }}>
                                              {r.val}
                                            </span>
                                          </span>
                                      ))}
                                    </span>
                                )}
                              </div>
                            </div>
                          </div>
                      )}
                      {" "}
                      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", padding: "8px 14px 0" }}>
                        <span style={{ font: "var(--fw-semi) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                          지표
                        </span>
                        {" "}
                        {vals.hasCompare && (
                            <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                              숫자 = 8월 누계 · 옆의 %는 전월 같은 기간 대비 · 막대는 8/1 → 8/8 일별 추이
                            </span>
                        )}
                      </div>
                      {" "}
                      <div style={{ position: "relative", display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(0, 1fr)", borderBottom: "1px solid var(--border)", marginTop: "6px" }}>
                        {vals.kpiTip && (
                            <span style={{ position: "absolute", zIndex: "40", left: vals.kpiTip.left, top: "6px", width: vals.kpiTip.w, display: "flex", flexDirection: "column", gap: "3px", padding: "9px 11px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-popover)", pointerEvents: "none", textAlign: "left" }}>
                              <span style={{ font: "var(--fw-semi) 11px var(--font-sans)", color: "var(--fg)", paddingBottom: "6px", marginBottom: "4px", borderBottom: "1px solid var(--border)" }}>
                                {vals.kpiTip.head}
                              </span>
                              {" "}
                              {vals.kpiTip.rows.map((r: any, $index: number) => (
                                  <span key={$index} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                                    <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-3)", whiteSpace: "nowrap" }}>
                                      {r.name}
                                    </span>
                                    {" "}
                                    <span className="v-num" style={{ font: "var(--fw-semi) 12px var(--font-mono)", color: r.color, whiteSpace: "nowrap" }}>
                                      {r.val}
                                    </span>
                                  </span>
                              ))}
                              {" "}
                              {vals.kpiTip.foot && (
                                  <span style={{ font: "var(--fw-regular) 11px/1.55 var(--font-sans)", color: "var(--fg-4)", marginTop: "5px", paddingTop: "6px", borderTop: "1px solid var(--border)", whiteSpace: "normal", textWrap: "pretty" }}>
                                    {vals.kpiTip.foot}
                                  </span>
                              )}
                            </span>
                        )}
                        {" "}
                        {vals.kpis.map((k: any, $index: number) => (
                            <div key={$index} style={{ display: "grid", gridTemplateRows: vals.kpiRows, rowGap: "5px", padding: "12px 12px 13px", borderRight: "1px solid var(--border)", minWidth: "0", overflow: "hidden", cursor: "default" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px", minWidth: "0" }}>
                                <span style={{ font: "var(--fw-medium) 11px/15px var(--font-sans)", color: "var(--fg-4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {k.label}
                                </span>
                                {" "}
                                <span style={{ display: "grid", placeItems: "center", width: "13px", height: "13px", flex: "none", borderRadius: "50%", border: "1px solid var(--border-strong)", font: "var(--fw-semi) 9px var(--font-sans)", color: k.qColor, cursor: "default", transition: "color .12s ease, border-color .12s ease" }} onMouseEnter={k.enter} onMouseLeave={k.leave}>
                                  ?
                                </span>
                              </div>
                              {" "}
                              <div className="v-num" style={{ fontFamily: "var(--font-sans)", fontWeight: "var(--fw-semi)", fontSize: "clamp(14px, 1.75vw, 20px)", lineHeight: "26px", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", color: k.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {k.value}
                              </div>
                              {" "}
                              {k.hasDelta && (
                                  <div style={{ display: "flex", alignItems: "center", gap: "4px", minWidth: "0" }}>
                                    <span className="v-num" style={{ font: "var(--fw-semi) 11px/15px var(--font-mono)", color: k.deltaColor }}>
                                      {k.delta}
                                    </span>
                                    {" "}
                                    <span style={{ font: "var(--fw-medium) 10px/15px var(--font-sans)", color: "var(--fg-4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                      전월 대비
                                    </span>
                                  </div>
                              )}
                              {" "}
                              <div style={{ font: "var(--fw-medium) 10px/14px var(--font-sans)", color: "var(--fg-4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {k.sub}
                              </div>
                            </div>
                        ))}
                      </div>
                      {" "}
                      {vals.showCal && (
                          <div style={{ padding: "14px" }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "8px" }}>
                              <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                                일별 손익
                              </span>
                              {" "}
                              <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                막대 높이 = 매출 · 아래 진한 부분 = 기여이익 · 클릭하면 해당 일자 주문
                              </span>
                            </div>
                            {" "}
                            <div style={{ position: "relative", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "14px 14px 10px" }}>
                              <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "1fr", gap: "8px", alignItems: "end", height: "132px" }}>
                                {vals.calendar.map((d: any, $index: number) => (
                                    <span key={$index} style={{ display: "block", position: "relative", height: d.h, background: d.barBg, borderRadius: "3px 3px 0 0", cursor: "pointer", transition: "background .12s ease" }} onMouseEnter={d.enter} onMouseLeave={d.leave} onClick={d.open}>
                                      <span style={{ position: "absolute", left: "0", right: "0", bottom: "0", height: d.inner, background: d.innerColor, borderRadius: "0 0 3px 3px" }}></span>
                                    </span>
                                ))}
                              </div>
                              {" "}
                              <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "1fr", gap: "8px", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid var(--border)" }}>
                                {vals.calendar.map((d: any, $index: number) => (
                                    <span key={$index} style={{ display: "grid", gap: "1px", justifyItems: "center" }}>
                                      <span style={{ font: "var(--fw-semi) 11px var(--font-sans)", color: d.dowColor }}>
                                        {d.label}
                                      </span>
                                      {" "}
                                      <span className="v-num" style={{ font: "var(--fw-medium) 10px var(--font-mono)", color: "var(--fg-4)" }}>
                                        {d.net}
                                      </span>
                                    </span>
                                ))}
                              </div>
                              {" "}
                              {vals.dayTip && (
                                  <span style={{ position: "absolute", zIndex: "40", left: vals.dayTip.left, top: "14px", marginLeft: "14px", width: "200px", display: "flex", flexDirection: "column", gap: "3px", padding: "9px 11px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-popover)", pointerEvents: "none", textAlign: "left" }}>
                                    <span style={{ font: "var(--fw-semi) 11px var(--font-sans)", color: "var(--fg)", paddingBottom: "6px", marginBottom: "4px", borderBottom: "1px solid var(--border)" }}>
                                      {vals.dayTip.head}
                                    </span>
                                    {" "}
                                    {vals.dayTip.rows.map((r: any, $index: number) => (
                                        <span key={$index} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px" }}>
                                          <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-3)", whiteSpace: "nowrap" }}>
                                            {r.name}
                                          </span>
                                          {" "}
                                          <span className="v-num" style={{ font: "var(--fw-semi) 12px var(--font-mono)", color: r.color, whiteSpace: "nowrap" }}>
                                            {r.val}
                                          </span>
                                        </span>
                                    ))}
                                    {" "}
                                    <span style={{ font: "var(--fw-medium) 10px var(--font-mono)", color: "var(--fg-4)", marginTop: "4px", paddingTop: "5px", borderTop: "1px solid var(--border)" }}>
                                      {vals.dayTip.foot}
                                    </span>
                                  </span>
                              )}
                            </div>
                          </div>
                      )}
                      {" "}
                      <div className="rp-break" style={{ display: "grid", gridTemplateColumns: "1fr", gap: vals.sectionGap, padding: vals.sectionPad, alignItems: "start" }}>
                        <div className="rp-keep" style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden", minWidth: "0" }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                            <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                              상품별 손익
                            </span>
                            {" "}
                            <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                              {vals.pnlCaption}
                            </span>
                            {" "}
                            <span style={{ flex: "1" }}></span>
                            {" "}
                            {vals.showToolbar && (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "26px", padding: "0 10px", border: "1px solid var(--border)", borderRadius: "var(--r-pill)", flex: "none" }}>
                                  <Lic name="search" size={13} color="var(--fg-4)" />
                                  {" "}
                                  <input value={vals.pnlQuery} onChange={vals.onPnlQuery} placeholder="상품 찾기" style={{ border: "0", background: "transparent", outline: "none", color: "var(--fg)", font: "var(--fw-medium) 12px var(--font-sans)", width: "116px" }} />
                                  {" "}
                                  {vals.hasQuery && (
                                      <span style={{ cursor: "pointer", color: "var(--fg-4)", display: "inline-flex" }} onClick={vals.clearQuery}>
                                        <Lic name="x" size={12} />
                                      </span>
                                  )}
                                </span>
                            )}
                            {" "}
                            <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)", flex: "none" }}>
                              {vals.sortNote}
                            </span>
                          </div>
                          {" "}
                          <div className="db-table-wrap fb-pnl-scroll">
                            <table className="db-table">
                              <thead>
                                <tr>
                                  {vals.sortCols.map((c: any, $index: number) => (
                                      <th key={$index}>
                                        <span className="db-th" style={{ justifyContent: c.align, color: c.color, cursor: "pointer", gap: "3px", userSelect: "none" }} onClick={c.pick}>
                                          <span>
                                            {c.label}
                                          </span>
                                          {" "}
                                          {c.showArrow && (
                                              <Lic name={c.arrow} size={12} />
                                          )}
                                        </span>
                                      </th>
                                  ))}
                                </tr>
                              </thead>
                              {" "}
                              <tbody>
                                {vals.pnlRows.map((r: any, $index: number) => (
                                    <tr key={$index} className="fb-row" style={{ cursor: "pointer", background: r.bg }} onClick={r.click}>
                                      <td className="db-td" style={{ minWidth: "260px" }}>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", paddingLeft: r.indent }}>
                                          {r.isProduct && (
                                            <>
                                              {r.isOpen && (
                                                  <Lic name="chevron-down" size={13} color="var(--fg-4)" />
                                              )}
                                              {" "}
                                              {r.isClosed && (
                                                  <Lic name="chevron-right" size={13} color="var(--fg-4)" />
                                              )}
                                            </>
                                          )}
                                          {" "}
                                          <span style={{ font: `${r.nameFont} var(--font-sans)`, color: r.nameColor }}>
                                            {r.name}
                                          </span>
                                          {" "}
                                          {r.isSku && (
                                              <span className="v-mono" style={{ fontSize: "10px", color: "var(--fg-4)" }}>
                                                {r.sku}
                                              </span>
                                          )}
                                        </span>
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell">
                                        {r.qty}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell" style={{ color: "var(--fg-2)" }}>
                                        {r.rev}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell">
                                        {r.disc}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell">
                                        {r.fee}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell">
                                        {r.ship}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell">
                                        {r.cogs}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell">
                                        {r.ad}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell" style={{ fontWeight: "var(--fw-semi)", color: r.netColor }}>
                                        {r.net}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell" style={{ color: r.netColor }}>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", justifyContent: "flex-end" }}>
                                          <span style={{ width: "34px", height: "4px", borderRadius: "2px", background: "var(--bg-elevated-2)", position: "relative", overflow: "hidden", flex: "none" }}>
                                            <span style={{ position: "absolute", left: "0", top: "0", bottom: "0", width: r.marginBar, background: r.netColor }}></span>
                                          </span>
                                          {" "}
                                          <span>
                                            {r.margin}
                                          </span>
                                        </span>
                                      </td>
                                    </tr>
                                ))}
                                {" "}
                                {vals.pnlEmpty && (
                                    <tr>
                                      <td className="db-td" colSpan={10} style={{ padding: "0" }}>
                                        <span className="empty" style={{ height: "152px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                                          <Lic name="package-search" size={20} color="var(--fg-4)" />
                                          {" "}
                                          <span className="etext" style={{ font: "var(--fw-medium) 13px var(--font-sans)", color: "var(--fg-3)" }}>
                                            {vals.emptyTitle}
                                          </span>
                                          {" "}
                                          <span style={{ font: "var(--fw-regular) 12px var(--font-sans)", color: "var(--fg-4)" }}>
                                            {vals.emptyHint}
                                          </span>
                                          {" "}
                                          <span className="linklike" style={{ fontSize: "12px" }} onClick={vals.clearPnlFilter}>
                                            필터 해제
                                          </span>
                                        </span>
                                      </td>
                                    </tr>
                                )}
                                {" "}
                                {vals.hasRest && (
                                    <tr className="fb-row" style={{ cursor: "pointer" }} onClick={vals.showAllProducts}>
                                      <td className="db-td">
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", color: "var(--fg-3)" }}>
                                          <Lic name="chevron-down" size={13} color="var(--fg-4)" />
                                          {" "}
                                          <span style={{ font: "var(--fw-medium) 13px var(--font-sans)" }}>
                                            {vals.rest.name}
                                          </span>
                                        </span>
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell">
                                        {vals.rest.qty}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell">
                                        {vals.rest.rev}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell">
                                        {vals.rest.disc}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell">
                                        {vals.rest.fee}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell">
                                        {vals.rest.ship}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell">
                                        {vals.rest.cogs}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell">
                                        {vals.rest.ad}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell" style={{ color: "var(--fg-3)" }}>
                                        {vals.rest.net}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell" style={{ color: "var(--fg-4)" }}>
                                        {vals.rest.margin}
                                      </td>
                                    </tr>
                                )}
                                {" "}
                                <tr style={{ background: "var(--bg-subtle)" }}>
                                  <td className="db-td" style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                                    합계
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell" style={{ fontWeight: "var(--fw-semi)" }}>
                                    {vals.tot.qty}
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell" style={{ fontWeight: "var(--fw-semi)", color: "var(--fg-2)" }}>
                                    {vals.tot.rev}
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell">
                                    {vals.tot.disc}
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell">
                                    {vals.tot.fee}
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell">
                                    {vals.tot.ship}
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell">
                                    {vals.tot.cogs}
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell">
                                    {vals.tot.ad}
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell" style={{ fontWeight: "var(--fw-semi)", color: "var(--pnl-pos)" }}>
                                    {vals.tot.net}
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell" style={{ fontWeight: "var(--fw-semi)", color: "var(--fg)" }}>
                                    {vals.tot.margin}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                        {" "}
                        {vals.showSide && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px", minWidth: "0", alignItems: "start" }}>
                              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                                  <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                                    채널별 손익
                                  </span>
                                  {" "}
                                  <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                    눌러서 해당 채널만 보기
                                  </span>
                                </div>
                                {" "}
                                <div style={{ display: "grid" }}>
                                  {vals.chRows.map((c: any, $index: number) => (
                                      <span key={$index} className="fb-row" style={{ display: "flex", alignItems: "center", gap: "9px", padding: "9px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer", minWidth: "0", overflow: "hidden", position: "relative", background: c.rowBg }} onClick={c.click}>
                                        <span style={{ position: "absolute", left: "0", top: "0", bottom: "0", width: c.barW, background: c.barBg }}></span>
                                        {" "}
                                        <span style={{ position: "relative", width: "8px", height: "8px", borderRadius: "2px", background: c.color, flex: "none" }}></span>
                                        {" "}
                                        <span style={{ position: "relative", flex: "1", minWidth: "0", overflow: "hidden" }}>
                                          <span style={{ display: "block", font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {c.name}
                                          </span>
                                          {" "}
                                          <span style={{ display: "block", font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)", marginTop: "2px" }}>
                                            {c.srcLine}
                                          </span>
                                        </span>
                                        {" "}
                                        <span style={{ position: "relative", textAlign: "right", flex: "none" }}>
                                          <span className="v-num" style={{ display: "block", font: "var(--fw-semi) 13px var(--font-mono)", color: c.netColor }}>
                                            {c.net}
                                          </span>
                                          {" "}
                                          <span className="v-num" style={{ display: "block", font: "var(--fw-medium) 10px var(--font-mono)", color: "var(--fg-4)", marginTop: "2px" }}>
                                            {c.margin}
                                          </span>
                                        </span>
                                      </span>
                                  ))}
                                </div>
                              </div>
                              {" "}
                              {vals.showCost && (
                                  <div style={{ position: "relative", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "12px" }}>
                                    <div style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)", marginBottom: "10px" }}>
                                      매출 대비 비용 구성
                                    </div>
                                    {" "}
                                    <div className="ins-dist-bar">
                                      {vals.costMix.map((m: any, $index: number) => (
                                          <span key={$index} style={{ width: m.pct, background: m.color, opacity: m.op, cursor: "default", transition: "opacity .12s ease" }} onMouseEnter={m.enter} onMouseLeave={m.leave}></span>
                                      ))}
                                    </div>
                                    {" "}
                                    <div className="ins-dist-legend">
                                      {vals.costMix.map((m: any, $index: number) => (
                                          <span key={$index} className="ins-leg" style={{ cursor: "default" }} onMouseEnter={m.enter} onMouseLeave={m.leave}>
                                            <span className="ins-leg-dot" style={{ background: m.color }}></span>
                                            {" "}
                                            <span className="ins-leg-lab">
                                              {m.label}
                                            </span>
                                            {" "}
                                            <span className="ins-leg-num">
                                              {m.pct}
                                            </span>
                                          </span>
                                      ))}
                                    </div>
                                    {" "}
                                    {vals.mixTip && (
                                        <span style={{ position: "absolute", zIndex: "40", left: vals.mixTip.x2, top: "34px", width: "180px", display: "flex", flexDirection: "column", gap: "3px", padding: "9px 11px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-popover)", pointerEvents: "none", textAlign: "left" }}>
                                          <span style={{ display: "flex", alignItems: "center", gap: "6px", font: "var(--fw-semi) 11px var(--font-sans)", color: "var(--fg)", paddingBottom: "6px", marginBottom: "4px", borderBottom: "1px solid var(--border)" }}>
                                            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: vals.mixTip.color, flex: "none" }}></span>
                                            {vals.mixTip.label}
                                          </span>
                                          {" "}
                                          <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px" }}>
                                            <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-3)" }}>
                                              금액
                                            </span>
                                            {" "}
                                            <span className="v-num" style={{ font: "var(--fw-semi) 12px var(--font-mono)", color: "var(--fg)" }}>
                                              {vals.mixTip.amount}
                                            </span>
                                          </span>
                                          {" "}
                                          <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px" }}>
                                            <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-3)" }}>
                                              매출 대비
                                            </span>
                                            {" "}
                                            <span className="v-num" style={{ font: "var(--fw-semi) 12px var(--font-mono)", color: "var(--fg)" }}>
                                              {vals.mixTip.pct}
                                            </span>
                                          </span>
                                          {" "}
                                          <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px" }}>
                                            <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-3)" }}>
                                              건당 평균
                                            </span>
                                            {" "}
                                            <span className="v-num" style={{ font: "var(--fw-semi) 12px var(--font-mono)", color: "var(--fg)" }}>
                                              {vals.mixTip.per}
                                            </span>
                                          </span>
                                        </span>
                                    )}
                                  </div>
                              )}
                              {" "}
                              {vals.showFresh && (
                                  <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "12px" }}>
                                    <div style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)", marginBottom: "10px" }}>
                                      이 숫자가 담지 못한 것
                                    </div>
                                    {" "}
                                    <div style={{ display: "grid", gap: "6px" }}>
                                      {vals.freshness.map((f: any, $index: number) => (
                                          <span key={$index} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                                            <span style={{ width: "6px", height: "6px", borderRadius: "999px", background: f.dot, flex: "none" }}></span>
                                            {" "}
                                            <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)" }}>
                                              {f.name}
                                            </span>
                                            {" "}
                                            <span style={{ flex: "1" }}></span>
                                            {" "}
                                            <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: f.color }}>
                                              {f.state}
                                            </span>
                                            {" "}
                                            <span className="v-num" style={{ font: "var(--fw-medium) 10px var(--font-mono)", color: "var(--fg-4)", minWidth: "44px", textAlign: "right" }}>
                                              {f.last}
                                            </span>
                                          </span>
                                      ))}
                                    </div>
                                    {" "}
                                    <div style={{ marginTop: "10px", paddingTop: "9px", borderTop: "1px solid var(--border)", font: "var(--fw-regular) 11px/1.5 var(--font-sans)", color: "var(--fg-4)" }}>
                                      여기 있는 항목은 위 숫자에 반영되지 않았습니다. 기준 데이터를 넣거나 빠진 파일을 가져오면 목록에서 사라집니다.
                                    </div>
                                  </div>
                              )}
                            </div>
                        )}
                      </div>
                    </>
                  )}
                </section>
            )}
            {" "}
            {/* ══════════ 정산 ══════════ */}
            {" "}
            {vals.v.settlement && (
                <section data-screen-label="정산">
                  {vals.firstRun && (
                      <div style={{ padding: "56px 24px", display: "grid", justifyItems: "center", gap: "13px" }}>
                        <span style={{ width: "40px", height: "40px", borderRadius: "var(--r-md)", background: "var(--bg-elevated-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--fg-4)" }}>
                          <Lic name="receipt" size={19} />
                        </span>
                        {" "}
                        <span style={{ display: "grid", gap: "5px", justifyItems: "center", textAlign: "center", maxWidth: "380px" }}>
                          <span style={{ font: "var(--fw-semi) 14px var(--font-sans)", color: "var(--fg)" }}>
                            아직 정산 내역이 없습니다
                          </span>
                          {" "}
                          <span style={{ font: "var(--fw-regular) 12px/1.7 var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                            마켓에서 정산서를 가져오면 언제 얼마가 들어오는지, 실제로 들어온 금액이 맞는지 여기서 확인합니다.
                          </span>
                        </span>
                        {" "}
                        <button className="v-btn v-btn--primary" style={{ height: "30px" }} onClick={vals.goImport}>
                          정산 파일 가져오기
                        </button>
                      </div>
                  )}
                  {" "}
                  {vals.notFirstRun && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                        <div className="segmented">
                          {vals.setTabs.map((t: any, $index: number) => (
                              <div key={$index} className={`seg ${t.on}`} onClick={t.pick}>
                                {t.label}
                                <span className="seg-count">
                                  {t.count}
                                </span>
                              </div>
                          ))}
                        </div>
                        {" "}
                        <span style={{ flex: "1" }}></span>
                        {" "}
                        {vals.hasFilters && (
                          <>
                            {vals.filterPills.map((p: any, $index: number) => (
                                <span key={$index} className="filter-pill">
                                  <span className="seg-part">
                                    {p.type}
                                  </span>
                                  {" "}
                                  <span className="seg-part op">
                                    is
                                  </span>
                                  {" "}
                                  <span className="seg-part" style={{ color: "var(--fg)" }}>
                                    {p.value}
                                  </span>
                                  {" "}
                                  <span className="x" onClick={p.remove}>
                                    <Lic name="x" size={13} />
                                  </span>
                                </span>
                            ))}
                          </>
                        )}
                        {" "}
                        <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                          {vals.setSummary}
                        </span>
                        {" "}
                        <span style={{ position: "relative", flex: "none" }}>
                          <span className="iconbtn" style={{ cursor: "pointer" }} onClick={vals.expSet.open}>
                            <Lic name="more-horizontal" size={15} />
                          </span>
                          {" "}
                          {vals.expSet.on && (
                              <span style={{ position: "absolute", zIndex: "90", top: "calc(100% + 6px)", right: "0", width: "258px", textAlign: "left", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-popover)", display: "grid" }} onClick={vals.stopEvt}>
                                <span style={{ display: "block", padding: "9px 12px", borderBottom: "1px solid var(--border)", font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg)" }}>
                                  내보내기
                                </span>
                                {" "}
                                <span style={{ display: "block", padding: "9px 12px", font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-4)", borderBottom: "1px solid var(--border)" }}>
                                  {vals.expScope}
                                </span>
                                {" "}
                                <span style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={vals.toggleExpHidden}>
                                  <span style={{ width: "13px", height: "13px", borderRadius: "3px", border: "1px solid var(--border-strong)", background: vals.expHiddenBg, flex: "none" }}></span>
                                  {" "}
                                  <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)" }}>
                                    숨긴 컬럼도 포함
                                  </span>
                                </span>
                                {" "}
                                <span style={{ display: "flex", gap: "6px", padding: "10px 12px" }}>
                                  <button className="v-btn" style={{ height: "27px", flex: "1" }}>
                                    XLSX
                                  </button>
                                  {" "}
                                  <button className="v-btn" style={{ height: "27px", flex: "1" }}>
                                    CSV
                                  </button>
                                </span>
                                {" "}
                                <span style={{ display: "block", padding: "0 12px 10px", font: "var(--fw-regular) 10px/1.5 var(--font-sans)", color: "var(--fg-4)" }}>
                                  {vals.expNote}
                                </span>
                              </span>
                          )}
                        </span>
                      </div>
                      {" "}
                      <div className="db-table-wrap">
                        <table className="db-table">
                          <thead>
                            <tr>
                              <th>
                                <span className="db-th">
                                  정산일
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th">
                                  채널
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th">
                                  건수
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                  정산 대상
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                  수수료
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                  수수료 VAT
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                  배송비
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                  조정
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                  지급액
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th">
                                  출처
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th">
                                  대사
                                </span>
                              </th>
                            </tr>
                          </thead>
                          {" "}
                          <tbody>
                            {vals.setEmpty && (
                                <tr>
                                  <td className="db-td" colSpan={11} style={{ padding: "0" }}>
                                    <span className="empty" style={{ height: "168px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                                      <Lic name="receipt" size={20} color="var(--fg-4)" />
                                      {" "}
                                      <span className="etext" style={{ font: "var(--fw-medium) 13px var(--font-sans)", color: "var(--fg-3)" }}>
                                        정산 내역이 없습니다
                                      </span>
                                      {" "}
                                      <span style={{ font: "var(--fw-regular) 12px var(--font-sans)", color: "var(--fg-4)" }}>
                                        선택한 기간의 주문이 아직 정산 대상이 아닙니다
                                      </span>
                                    </span>
                                  </td>
                                </tr>
                            )}
                            {" "}
                            {vals.setRows.map((s: any, $index: number) => (
                                <tr key={$index} className="fb-row" style={{ cursor: "pointer" }} onClick={s.click}>
                                  <td className="db-td" style={{ font: "var(--fw-medium) 12px var(--font-mono)", color: "var(--fg-3)", whiteSpace: "nowrap" }}>
                                    {s.date}
                                  </td>
                                  {" "}
                                  <td className="db-td">
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", whiteSpace: "nowrap" }}>
                                      <span style={{ width: "7px", height: "7px", borderRadius: "2px", background: s.color, flex: "none" }}></span>
                                      {" "}
                                      <span style={{ font: "var(--fw-medium) 13px var(--font-sans)", color: "var(--fg-2)" }}>
                                        {s.ch}
                                      </span>
                                    </span>
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell" style={{ textAlign: "left", whiteSpace: "nowrap" }}>
                                    {s.count}
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell" style={{ color: "var(--fg-2)" }}>
                                    {s.gross}
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell">
                                    {s.fee}
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell">
                                    {s.vat}
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell">
                                    {s.ship}
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell" style={{ position: "relative", color: s.adjColor, cursor: "pointer" }} onClick={s.openAdj} title={s.adjTip}>
                                    <span>
                                      {s.adj}
                                    </span>
                                    {" "}
                                    {s.hasAdj && (
                                        <span style={{ position: "absolute", top: "7px", right: "5px", width: "5px", height: "5px", borderRadius: "999px", background: "var(--accent)" }}></span>
                                    )}
                                    {" "}
                                    {s.adjOpen && (
                                        <span className="fb-adj-pop" style={{ position: "fixed", zIndex: "260", top: vals.adjPosTop, left: vals.adjPosLeft, width: "258px", textAlign: "left", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-popover)", display: "grid" }} onClick={vals.stopEvt}>
                                          <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px", padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                                            <span style={{ font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg)" }}>
                                              조정
                                            </span>
                                            {" "}
                                            <span className="v-num" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-4)" }}>
                                              원본 {s.origAdj} → {s.effAdjLabel}
                                            </span>
                                          </span>
                                          {" "}
                                          {s.adjStack.map((a: any, $index: number) => (
                                              <span key={$index} style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "9px 12px", borderBottom: "1px solid var(--border)" }}>
                                                <span style={{ flex: "1", minWidth: "0", display: "grid", gap: "2px" }}>
                                                  <span className="v-num" style={{ font: "var(--fw-semi) 12px var(--font-mono)", color: "var(--fg)" }}>
                                                    {a.head}
                                                  </span>
                                                  {" "}
                                                  <span style={{ font: "var(--fw-regular) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                                    {a.body}
                                                  </span>
                                                </span>
                                                {" "}
                                                <span className="iconbtn" style={{ cursor: "pointer", flex: "none" }} onClick={a.remove}>
                                                  <Lic name="trash-2" size={12} />
                                                </span>
                                              </span>
                                          ))}
                                          {" "}
                                          <span style={{ display: "grid", gap: "6px", padding: "10px 12px" }}>
                                            <span style={{ display: "flex", gap: "6px" }}>
                                              <input className="v-input" style={{ width: "96px", height: "27px", fontSize: "12px" }} value={vals.adjDraft} onChange={vals.setAdjDraft} placeholder="+/− 금액" />
                                              {" "}
                                              <input className="v-input" style={{ flex: "1", minWidth: "0", height: "27px", fontSize: "12px" }} value={vals.adjWhy} onChange={vals.setAdjWhy} placeholder="사유 (필수)" />
                                            </span>
                                            {" "}
                                            {vals.adjBlockWhy && (
                                                <span data-s21="settle-adj-guard" style={{ font: "var(--fw-medium) 10px/1.5 var(--font-sans)", color: "var(--pnl-warn)", textWrap: "pretty" }}>
                                                  {vals.adjBlockWhy}
                                                </span>
                                            )}
                                            {" "}
                                            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                              <button className="v-btn v-btn--primary" style={{ height: "27px", opacity: vals.adjAddOpacity }} onClick={s.addAdj} disabled={vals.adjBlocked}>
                                                조정 추가
                                              </button>
                                              {" "}
                                              {s.hasAdj && (
                                                  <button className="v-btn" style={{ height: "27px" }} onClick={s.resetAdj}>
                                                    원본으로 복원
                                                  </button>
                                              )}
                                            </span>
                                            {" "}
                                            <span style={{ font: "var(--fw-regular) 10px/1.5 var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                                              원본 값은 그대로 있고 조정만 얹힙니다. 다시 가져와도 유지되며, 대사 결과에는 영향을 주지 않습니다.
                                            </span>
                                          </span>
                                        </span>
                                    )}
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell" style={{ fontWeight: "var(--fw-semi)", color: "var(--fg)" }}>
                                    {s.payout}
                                  </td>
                                  {" "}
                                  <td className="db-td" style={{ whiteSpace: "nowrap" }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}>
                                      <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: s.srcColor }}>
                                        {s.src}
                                      </span>
                                      {" "}
                                      {s.needsMap && (
                                          <span className="v-btn" style={{ height: "21px", padding: "0 8px", fontSize: "10px", cursor: "pointer", color: "var(--pnl-warn)", borderColor: "var(--pnl-warn)" }} onClick={s.goMap}>
                                            매핑 확인
                                          </span>
                                      )}
                                    </span>
                                  </td>
                                  {" "}
                                  <td className="db-td" style={{ whiteSpace: "nowrap" }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}>
                                      <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: s.reconColor }}>
                                        {s.recon}
                                      </span>
                                      {" "}
                                      {s.canAck && (
                                          <span className="v-btn" style={{ height: "22px", padding: "0 8px", fontSize: "10px", cursor: "pointer" }} onClick={s.ack}>
                                            확인함으로
                                          </span>
                                      )}
                                      {" "}
                                      {s.ackWhy && (
                                          <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                            {s.ackWhy}
                                          </span>
                                      )}
                                    </span>
                                  </td>
                                </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </section>
            )}
            {" "}
            {/* ══════════ 상품 · SKU ══════════ */}
            {" "}
            {vals.v.products && (
                <section data-screen-label="상품 SKU">
                  {vals.prodReady && (
                  <>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                    <div className="segmented">
                      {vals.prodTabs.map((t: any, $index: number) => (
                          <div key={$index} className={`seg ${t.on}`} onClick={t.pick}>
                            {t.label}
                            <span className="seg-count">
                              {t.count}
                            </span>
                          </div>
                      ))}
                    </div>
                    {" "}
                    <span style={{ flex: "1" }}></span>
                    {" "}
                    <span data-s21="cost-gauge" style={{ display: "grid", gap: "3px", justifyItems: "end", minWidth: "0" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}>
                        <span style={{ width: "104px", height: "5px", borderRadius: "999px", background: "var(--bg-elevated-2)", overflow: "hidden", display: "inline-block" }}>
                          <span style={{ display: "block", height: "100%", width: vals.costGauge.pctWidth, background: vals.costGauge.color }}></span>
                        </span>
                        {" "}
                        <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                          {vals.costGauge.text}
                        </span>
                      </span>
                      {vals.costGauge.note !== "" && (
                          <span style={{ font: "var(--fw-regular) 10px/1.5 var(--font-sans)", color: "var(--label-orange, #F2994A)", textWrap: "pretty" }}>
                            {vals.costGauge.note}
                          </span>
                      )}
                    </span>
                    {" "}
                    <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                      {vals.prodHint}
                    </span>
                    {" "}
                    {vals.isDraftTab && (
                        <button className="v-btn v-btn--primary" style={{ height: "28px" }}>
                          SKU 등록
                        </button>
                    )}
                    {" "}
                    <span style={{ position: "relative", flex: "none" }}>
                      <span className="iconbtn" style={{ cursor: "pointer" }} onClick={vals.expPrd.open}>
                        <Lic name="more-horizontal" size={15} />
                      </span>
                      {" "}
                      {vals.expPrd.on && (
                          <span style={{ position: "absolute", zIndex: "90", top: "calc(100% + 6px)", right: "0", width: "258px", textAlign: "left", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-popover)", display: "grid" }} onClick={vals.stopEvt}>
                            <span style={{ display: "block", padding: "9px 12px", borderBottom: "1px solid var(--border)", font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg)" }}>
                              내보내기
                            </span>
                            {" "}
                            <span style={{ display: "block", padding: "9px 12px", font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-4)", borderBottom: "1px solid var(--border)" }}>
                              {vals.expScope}
                            </span>
                            {" "}
                            <span style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={vals.toggleExpHidden}>
                              <span style={{ width: "13px", height: "13px", borderRadius: "3px", border: "1px solid var(--border-strong)", background: vals.expHiddenBg, flex: "none" }}></span>
                              {" "}
                              <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)" }}>
                                숨긴 컬럼도 포함
                              </span>
                            </span>
                            {" "}
                            <span style={{ display: "flex", gap: "6px", padding: "10px 12px" }}>
                              <button className="v-btn" style={{ height: "27px", flex: "1" }}>
                                XLSX
                              </button>
                              {" "}
                              <button className="v-btn" style={{ height: "27px", flex: "1" }}>
                                CSV
                              </button>
                            </span>
                            {" "}
                            <span style={{ display: "block", padding: "0 12px 10px", font: "var(--fw-regular) 10px/1.5 var(--font-sans)", color: "var(--fg-4)" }}>
                              {vals.expNote}
                            </span>
                          </span>
                      )}
                    </span>
                  </div>
                  {" "}
                  {vals.prodListTab && (
                      <div className="db-table-wrap">
                        <table className="db-table">
                          <thead>
                            <tr>
                              <th>
                                <span className="db-th">
                                  SKU
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th">
                                  상품 · 옵션
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                  매입원가
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                  기준 판매가
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                  마진율
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th">
                                  연결된 마켓
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                  판매 수량
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                  기여이익
                                </span>
                              </th>
                            </tr>
                          </thead>
                          {" "}
                          <tbody>
                            {vals.skuRows.map((s: any, $index: number) => (
                                <tr key={$index} className="fb-row" style={{ cursor: "pointer" }} onClick={s.click}>
                                  <td className="db-td" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-4)", whiteSpace: "nowrap" }}>
                                    {s.sellerSku}
                                  </td>
                                  {" "}
                                  <td className="db-td db-td-title" style={{ font: "var(--fw-medium) 13px var(--font-sans)", color: "var(--fg-2)" }}>
                                    {s.name}
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell" style={{ padding: "4px 6px" }}>
                                    {s.costEmpty && (
                                        <span data-s21="cost-input" style={{ display: "grid", gap: "3px", justifyItems: "end" }} onClick={vals.stopEvt}>
                                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                            <input className="v-input" style={{ height: "26px", fontSize: "12px", width: "84px", textAlign: "right" }} value={s.costDraft} onChange={s.setCost} placeholder="원가" inputMode="numeric" />
                                            {" "}
                                            <input className="v-input" type="date" style={{ height: "26px", fontSize: "11px", width: "126px" }} value={s.dateDraft} onChange={s.setDate} />
                                            {" "}
                                            <button className="v-btn" style={{ height: "26px", padding: "0 8px", fontSize: "11px", opacity: s.saveOpacity }} onClick={s.saveCost} disabled={!s.canSave}>
                                              저장
                                            </button>
                                          </span>
                                          {s.saveWhy !== "" && (
                                              <span style={{ font: "var(--fw-regular) 10px/1.4 var(--font-sans)", color: "var(--pnl-neg, #EB5757)" }}>
                                                {s.saveWhy}
                                              </span>
                                          )}
                                          {s.costFilled && (
                                              <span style={{ display: "inline-flex", alignItems: "baseline", gap: "5px" }}>
                                                <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg)" }}>
                                                  {s.cost}
                                                </span>
                                                <span style={{ font: "var(--fw-regular) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                                  {s.costSince}
                                                </span>
                                              </span>
                                          )}
                                          {s.histNote !== "" && (
                                              <span style={{ font: "var(--fw-regular) 10px/1.4 var(--font-sans)", color: "var(--fg-4)" }}>
                                                {s.histNote}
                                              </span>
                                          )}
                                        </span>
                                    )}
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell" style={{ color: "var(--fg-2)" }}>
                                    {s.price}
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell" style={{ color: s.marginColor }}>
                                    {s.margin}
                                  </td>
                                  {" "}
                                  <td className="db-td">
                                    <span style={{ display: "inline-flex", gap: "4px" }}>
                                      {s.chips.map((ch: any, $index: number) => (
                                          <span key={$index} style={{ height: "18px", padding: "0 6px", borderRadius: "var(--r-xs)", background: "var(--bg-elevated-2)", display: "inline-flex", alignItems: "center", font: "var(--fw-semi) 10px var(--font-sans)", color: ch.color }}>
                                            {ch.label}
                                          </span>
                                      ))}
                                    </span>
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell">
                                    {s.qty}
                                  </td>
                                  {" "}
                                  <td className="db-td fb-cell" style={{ fontWeight: "var(--fw-semi)", color: s.netColor }}>
                                    {s.net}
                                  </td>
                                </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                  )}
                  </>
                  )}
                </section>
            )}
            {" "}
            {/* ══════════ 진단 ══════════ */}
            {" "}
            {vals.v.diag && (
                <section data-screen-label="진단" style={{ padding: "14px", maxWidth: "1180px" }}>
                  {vals.diagUnbuilt && (
                      <div data-s21="unbuilt-diag" style={{ padding: "56px 24px", display: "grid", justifyItems: "center", gap: "13px" }}>
                        <span style={{ width: "40px", height: "40px", borderRadius: "var(--r-md)", background: "var(--bg-elevated-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--fg-4)" }}>
                          <Lic name="target" size={19} />
                        </span>
                        {" "}
                        <span style={{ display: "grid", gap: "5px", justifyItems: "center", textAlign: "center", maxWidth: "380px" }}>
                          <span style={{ font: "var(--fw-semi) 14px var(--font-sans)", color: "var(--fg)" }}>
                            진단은 원가 입력 후에 의미가 생깁니다
                          </span>
                          {" "}
                          <span style={{ font: "var(--fw-regular) 12px/1.7 var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                            지금은 모든 상품이 원가 없음 상태입니다. 원가가 들어오면 어떤 상품을 밀고 어떤 상품을 손봐야 하는지 여기서 알려드립니다.
                          </span>
                        </span>
                      </div>
                  )}
                  {" "}
                  {vals.diagOnboard && (
                      <div style={{ padding: "56px 24px", display: "grid", justifyItems: "center", gap: "13px" }}>
                        <span style={{ width: "40px", height: "40px", borderRadius: "var(--r-md)", background: "var(--bg-elevated-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--fg-4)" }}>
                          <Lic name="target" size={19} />
                        </span>
                        {" "}
                        <span style={{ display: "grid", gap: "5px", justifyItems: "center", textAlign: "center", maxWidth: "380px" }}>
                          <span style={{ font: "var(--fw-semi) 14px var(--font-sans)", color: "var(--fg)" }}>
                            진단할 데이터가 없습니다
                          </span>
                          {" "}
                          <span style={{ font: "var(--fw-regular) 12px/1.7 var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                            주문과 원가가 들어오면 어떤 상품을 밀고 어떤 상품을 손봐야 하는지 여기서 알려드립니다.
                          </span>
                        </span>
                        {" "}
                        <button className="v-btn v-btn--primary" style={{ height: "30px" }} onClick={vals.goImport}>
                          정산 파일 가져오기
                        </button>
                      </div>
                  )}
                  {" "}
                  {vals.diagReady && (
                    <>
                      <div style={{ display: "flex", gap: "2px", marginBottom: "14px" }}>
                        {vals.diagTabs.map((t: any, $index: number) => (
                            <span key={$index} className={`tab ${t.on}`} onClick={t.pick}>
                              {t.label}
                              <span className="count">
                                {t.count}
                              </span>
                            </span>
                        ))}
                      </div>
                      {" "}
                      {vals.dtQuad && (
                        <>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--bg-subtle)", border: "1px solid var(--border)", marginBottom: "14px" }}>
                            <Lic name="target" size={14} />
                            {" "}
                            <span style={{ flex: "1", font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-2)", textWrap: "pretty" }}>
                              순이익 순으로 줄만 세우면
                              <span style={{ fontWeight: "var(--fw-semi)" }}>
                                매출은 큰데 이익이 안 나는 상품
                              </span>
                              과
                              <span style={{ fontWeight: "var(--fw-semi)" }}>
                                작지만 알짜인 상품
                              </span>
                              이 구분되지 않습니다. 매출과 이익률 두 축으로 나누면 무엇을 밀고 무엇을 손봐야 하는지가 갈립니다.
                            </span>
                          </div>
                          {" "}
                          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: "14px", alignItems: "start" }}>
                            <span className="fb-quad-open" style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "13px 14px", alignItems: "center", gap: "11px", cursor: "pointer" }} onClick={vals.openQuadFull}>
                              <span style={{ flex: "1", display: "grid", gap: "3px" }}>
                                <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                                  포지셔닝 차트
                                </span>
                                {" "}
                                <span style={{ font: "var(--fw-regular) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                  가로로 펼쳐서 봅니다
                                </span>
                              </span>
                              {" "}
                              <Lic name="maximize-2" size={15} />
                            </span>
                            {" "}
                            <div className="fb-quad-chart" style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", padding: "11px 13px", borderBottom: "1px solid var(--border)" }}>
                                <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                                  포지셔닝
                                </span>
                                {" "}
                                <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                  가로 매출 · 세로 이익률 · 원 크기 판매량
                                </span>
                                {" "}
                                <span style={{ flex: "1" }}></span>
                                {" "}
                                <span className="v-btn" style={{ height: "24px", padding: "0 9px", fontSize: "11px", cursor: "pointer" }} onClick={vals.diagToTable}>
                                  표로 보기
                                </span>
                              </div>
                              {" "}
                              <div style={{ position: "relative", padding: "16px 16px 14px" }}>
                                <div style={{ position: "relative", height: "320px", borderLeft: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
                                  <span style={{ position: "absolute", left: "0", right: "0", top: vals.quadHy, borderTop: "1px dashed var(--border-strong)" }}></span>
                                  {" "}
                                  <span style={{ position: "absolute", top: "0", bottom: "0", left: vals.quadVx, borderLeft: "1px dashed var(--border-strong)" }}></span>
                                  {" "}
                                  {vals.quadLabels.map((q: any, $index: number) => (
                                      <span key={$index} style={{ position: "absolute", left: q.x, top: q.y, font: "var(--fw-semi) 10px var(--font-sans)", color: q.color, opacity: "0.75", pointerEvents: "none" }}>
                                        {q.label}
                                      </span>
                                  ))}
                                  {" "}
                                  {vals.quadDots.map((d: any, $index: number) => (
                                      <span key={$index} style={{ position: "absolute", left: d.x, top: d.y, width: d.size, height: d.size, marginLeft: d.off, marginTop: d.off, borderRadius: "999px", background: d.bg, border: `1.5px solid ${d.color}`, cursor: "pointer", transition: "opacity .12s ease", opacity: d.op }} onMouseEnter={d.enter} onMouseLeave={d.leave} onClick={d.pick}></span>
                                  ))}
                                  {" "}
                                  {vals.quadTip && (
                                      <span style={{ position: "absolute", zIndex: "40", left: vals.quadTip.x, top: vals.quadTip.y, width: "200px", display: "grid", gap: "3px", padding: "9px 11px", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-popover)", pointerEvents: "none" }}>
                                        <span style={{ font: "var(--fw-semi) 11px var(--font-sans)", color: "var(--fg)", paddingBottom: "5px", marginBottom: "3px", borderBottom: "1px solid var(--border)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                          {vals.quadTip.name}
                                        </span>
                                        {" "}
                                        {vals.quadTip.rows.map((r: any, $index: number) => (
                                            <span key={$index} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                                              <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-3)" }}>
                                                {r.k}
                                              </span>
                                              {" "}
                                              <span className="v-num" style={{ font: "var(--fw-semi) 11px var(--font-mono)", color: r.color }}>
                                                {r.v}
                                              </span>
                                            </span>
                                        ))}
                                      </span>
                                  )}
                                </div>
                                {" "}
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "7px", paddingLeft: "2px" }}>
                                  <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                    매출 낮음
                                  </span>
                                  {" "}
                                  <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                    매출 높음
                                  </span>
                                </div>
                              </div>
                            </div>
                            {" "}
                            <div style={{ display: "grid", gap: "10px" }}>
                              {vals.quadGroups.map((g: any, $index: number) => (
                                  <div key={$index} style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "7px", padding: "9px 12px", borderBottom: "1px solid var(--border)" }}>
                                      <span style={{ width: "7px", height: "7px", borderRadius: "999px", background: g.color, flex: "none" }}></span>
                                      {" "}
                                      <span style={{ font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg)" }}>
                                        {g.label}
                                      </span>
                                      {" "}
                                      <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                        {g.count}
                                      </span>
                                      {" "}
                                      <span style={{ flex: "1" }}></span>
                                      {" "}
                                      <span className="v-num" style={{ font: "var(--fw-semi) 11px var(--font-mono)", color: g.netColor }}>
                                        {g.net}
                                      </span>
                                    </div>
                                    {" "}
                                    <div style={{ padding: "9px 12px", display: "grid", gap: "6px" }}>
                                      <span style={{ font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                                        {g.desc}
                                      </span>
                                      {" "}
                                      {g.items.map((it: any, $index: number) => (
                                          <span key={$index} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span style={{ minWidth: "0", flex: "1", font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                              {it.name}
                                            </span>
                                            {" "}
                                            <span className="v-num" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-4)", flex: "none" }}>
                                              {it.margin}
                                            </span>
                                          </span>
                                      ))}
                                    </div>
                                  </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                      {" "}
                      {vals.dtAd && (
                        <>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--bg-subtle)", border: "1px solid var(--border)", marginBottom: "14px" }}>
                            <Lic name="megaphone" size={14} />
                            {" "}
                            <span style={{ flex: "1", font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-2)", textWrap: "pretty" }}>
                              두 광고는 잣대가 다릅니다.
                              <span style={{ fontWeight: "var(--fw-semi)" }}>
                                매출성장
                              </span>
                              캠페인은 전환매출이 잡히므로 ROAS로 봅니다.
                              <span style={{ fontWeight: "var(--fw-semi)" }}>
                                신규구매
                              </span>
                              캠페인은 전환매출 데이터 자체가 없어서 ROAS를 계산할 수 없고, 고객 한 명을 데려오는 데 든 비용(CAC)으로 봅니다. 둘을 섞어 평균 내면 판단이 망가집니다.
                            </span>
                          </div>
                          {" "}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", alignItems: "start" }}>
                            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", padding: "11px 13px", borderBottom: "1px solid var(--border)" }}>
                                <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                                  매출성장
                                </span>
                                {" "}
                                <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                  ROAS로 판단
                                </span>
                                {" "}
                                <span style={{ flex: "1" }}></span>
                                {" "}
                                <span className="v-num" style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: vals.growthColor }}>
                                  {vals.growthRoas}
                                </span>
                              </div>
                              {" "}
                              <div style={{ padding: "11px 13px", display: "grid", gap: "10px" }}>
                                <span style={{ font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                                  {vals.growthNote}
                                </span>
                                {" "}
                                {vals.growthRows.map((r: any, $index: number) => (
                                    <span key={$index} style={{ display: "grid", gap: "5px" }}>
                                      <span style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                                        <span style={{ minWidth: "0", flex: "1", font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                          {r.name}
                                        </span>
                                        {" "}
                                        <span className="v-num" style={{ font: "var(--fw-semi) 12px var(--font-mono)", color: r.color, flex: "none" }}>
                                          {r.roas}
                                        </span>
                                        {" "}
                                        <span style={{ font: "var(--fw-semi) 10px var(--font-sans)", color: r.color, flex: "none", width: "34px", textAlign: "right" }}>
                                          {r.verdict}
                                        </span>
                                      </span>
                                      {" "}
                                      <span style={{ display: "block", height: "6px", borderRadius: "2px", background: "var(--bg-active)" }}>
                                        <span style={{ display: "block", height: "6px", borderRadius: "2px", width: r.bar, background: r.color }}></span>
                                      </span>
                                      {" "}
                                      <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                        {r.detail}
                                      </span>
                                    </span>
                                ))}
                              </div>
                            </div>
                            {" "}
                            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", padding: "11px 13px", borderBottom: "1px solid var(--border)" }}>
                                <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                                  신규구매
                                </span>
                                {" "}
                                <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                  CAC로 판단
                                </span>
                                {" "}
                                <span style={{ flex: "1" }}></span>
                                {" "}
                                <span className="v-num" style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: vals.cacColor }}>
                                  {vals.cacAvg}
                                </span>
                              </div>
                              {" "}
                              <div style={{ padding: "11px 13px", display: "grid", gap: "10px" }}>
                                <span style={{ font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                                  {vals.cacNote}
                                </span>
                                {" "}
                                {vals.cacRows.map((r: any, $index: number) => (
                                    <span key={$index} style={{ display: "grid", gap: "5px" }}>
                                      <span style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                                        <span style={{ minWidth: "0", flex: "1", font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                          {r.name}
                                        </span>
                                        {" "}
                                        <span className="v-num" style={{ font: "var(--fw-semi) 12px var(--font-mono)", color: r.color, flex: "none" }}>
                                          {r.cac}
                                        </span>
                                      </span>
                                      {" "}
                                      <span style={{ display: "block", height: "6px", borderRadius: "2px", background: "var(--bg-active)" }}>
                                        <span style={{ display: "block", height: "6px", borderRadius: "2px", width: r.bar, background: r.color }}></span>
                                      </span>
                                      {" "}
                                      <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                        {r.detail}
                                      </span>
                                    </span>
                                ))}
                                {" "}
                                <span style={{ display: "flex", alignItems: "flex-start", gap: "7px", padding: "9px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", background: "var(--bg-subtle)" }}>
                                  <Lic name="info" size={13} />
                                  {" "}
                                  <span style={{ flex: "1", font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-3)", textWrap: "pretty" }}>
                                    {vals.cacBreakeven}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      {" "}
                      {vals.dtNew && (
                        <>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--bg-subtle)", border: "1px solid var(--border)", marginBottom: "14px" }}>
                            <Lic name="sprout" size={14} />
                            {" "}
                            <span style={{ flex: "1", font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-2)", textWrap: "pretty" }}>
                              등록한 지 3개월이 안 된 상품은
                              <span style={{ fontWeight: "var(--fw-semi)" }}>
                                잣대가 다릅니다.
                              </span>
                              초기에는 광고비가 앞서고 리뷰가 쌓이기 전이라 적자가 정상입니다. 여기서는 이익률 대신 리뷰·재구매·주간 성장으로 봅니다. 위 포지셔닝에서는 이 상품들이 빠져 있습니다.
                            </span>
                          </div>
                          {" "}
                          <div style={{ display: "grid", gap: "10px" }}>
                            {vals.newProds.map((p: any, $index: number) => (
                                <div key={$index} style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "11px 13px", borderBottom: "1px solid var(--border)" }}>
                                    <span style={{ width: "7px", height: "7px", borderRadius: "2px", background: p.chColor, flex: "none" }}></span>
                                    {" "}
                                    <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {p.name}
                                    </span>
                                    {" "}
                                    <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)", flex: "none" }}>
                                      {p.age}
                                    </span>
                                    {" "}
                                    <span style={{ flex: "1" }}></span>
                                    {" "}
                                    <span style={{ display: "inline-flex", alignItems: "center", height: "20px", padding: "0 8px", borderRadius: "var(--r-pill)", background: p.stageBg, font: "var(--fw-semi) 11px var(--font-sans)", color: p.stageColor, flex: "none" }}>
                                      {p.stage}
                                    </span>
                                  </div>
                                  {" "}
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "1px", background: "var(--border)" }}>
                                    {p.metrics.map((m: any, $index: number) => (
                                        <span key={$index} style={{ display: "grid", gap: "3px", padding: "11px 13px", background: "var(--bg-app)" }}>
                                          <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                            {m.k}
                                          </span>
                                          {" "}
                                          <span className="v-num" style={{ font: "var(--fw-semi) 14px var(--font-sans)", color: m.color }}>
                                            {m.v}
                                          </span>
                                          {" "}
                                          <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                            {m.sub}
                                          </span>
                                        </span>
                                    ))}
                                  </div>
                                  {" "}
                                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 13px", borderTop: "1px solid var(--border)" }}>
                                    <span style={{ display: "flex", alignItems: "center", gap: "4px", flex: "none" }}>
                                      {p.weeks.map((w: any, $index: number) => (
                                          <span key={$index} style={{ display: "inline-block", width: "22px", borderRadius: "2px 2px 0 0", height: w.h, background: w.color }} title={w.title}></span>
                                      ))}
                                    </span>
                                    {" "}
                                    <span style={{ font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-3)", textWrap: "pretty", flex: "1" }}>
                                      {p.verdict}
                                    </span>
                                  </div>
                                </div>
                            ))}
                          </div>
                        </>
                      )}
                      {" "}
                      {vals.dtAct && (
                        <>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--bg-subtle)", border: "1px solid var(--border)", marginBottom: "14px" }}>
                            <Lic name="list-checks" size={14} />
                            {" "}
                            <span style={{ flex: "1", font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-2)", textWrap: "pretty" }}>
                              앞의 세 탭이 찾아낸 것을 할 일로 내놓습니다.
                              <span style={{ fontWeight: "var(--fw-semi)" }}>
                                앱이 정하지 않습니다
                              </span>
                              — 채택하거나, 이유를 달아 기각합니다. 기각한 이유는 남아서 다음 달에 같은 제안을 반복하지 않습니다.
                            </span>
                          </div>
                          {" "}
                          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: "14px", alignItems: "start" }}>
                            <div style={{ display: "grid", gap: "10px" }}>
                              {vals.actions.map((a: any, $index: number) => (
                                  <div key={$index} style={{ border: `1px solid ${a.border}`, borderRadius: "var(--r-md)", overflow: "hidden", opacity: a.op }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "11px 13px" }}>
                                      <span style={{ display: "inline-flex", alignItems: "center", height: "20px", padding: "0 8px", borderRadius: "var(--r-pill)", background: a.kindBg, font: "var(--fw-semi) 10px var(--font-sans)", color: a.kindColor, flex: "none" }}>
                                        {a.kind}
                                      </span>
                                      {" "}
                                      <span style={{ minWidth: "0", flex: "1", display: "grid", gap: "3px" }}>
                                        <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                          {a.title}
                                        </span>
                                        {" "}
                                        <span style={{ font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-3)", textWrap: "pretty" }}>
                                          {a.why}
                                        </span>
                                      </span>
                                      {" "}
                                      <span style={{ display: "grid", gap: "3px", textAlign: "right", flex: "none" }}>
                                        <span className="v-num" style={{ font: "var(--fw-semi) 13px var(--font-mono)", color: a.impactColor }}>
                                          {a.impact}
                                        </span>
                                        {" "}
                                        <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                          예상 월 효과
                                        </span>
                                      </span>
                                    </div>
                                    {" "}
                                    <div style={{ display: "flex", alignItems: "center", gap: "7px", padding: "0 13px 11px" }}>
                                      <span style={{ font: "var(--fw-medium) 10px var(--font-mono)", color: "var(--fg-4)", flex: "1", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {a.source}
                                      </span>
                                      {" "}
                                      {a.pending && (
                                        <>
                                          <button className="v-btn v-btn--primary" style={{ height: "26px" }} onClick={a.accept}>
                                            채택
                                          </button>
                                          {" "}
                                          <button className="v-btn" style={{ height: "26px" }} onClick={a.reject}>
                                            기각
                                          </button>
                                        </>
                                      )}
                                      {" "}
                                      {a.accepted && (
                                        <>
                                          <span style={{ font: "var(--fw-semi) 11px var(--font-sans)", color: a.stateColor }}>
                                            {a.stateLabel}
                                          </span>
                                          {" "}
                                          <button className="v-btn" style={{ height: "26px" }} onClick={a.done}>
                                            완료 표시
                                          </button>
                                        </>
                                      )}
                                      {" "}
                                      {a.closed && (
                                        <>
                                          <span style={{ font: "var(--fw-semi) 11px var(--font-sans)", color: a.stateColor }}>
                                            {a.stateLabel}
                                          </span>
                                          {" "}
                                          <span className="iconbtn" style={{ cursor: "pointer" }} onClick={a.undo} title="되돌리기">
                                            <Lic name="rotate-ccw" size={13} />
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    {" "}
                                    {a.asking && (
                                        <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg-subtle)", padding: "11px 13px", display: "grid", gap: "8px" }}>
                                          <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-3)" }}>
                                            왜 하지 않기로 했나요 — 다음에 같은 제안을 반복하지 않습니다
                                          </span>
                                          {" "}
                                          <span style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                            {a.reasons.map((r: any, $index: number) => (
                                                <span key={$index} className="v-chip" style={{ height: "26px", padding: "0 10px", fontSize: "11px", cursor: "pointer" }} onClick={r.pick}>
                                                  {r.label}
                                                </span>
                                            ))}
                                          </span>
                                        </div>
                                    )}
                                  </div>
                              ))}
                            </div>
                            {" "}
                            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", padding: "11px 13px", borderBottom: "1px solid var(--border)" }}>
                                <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                                  지난달 결과
                                </span>
                                {" "}
                                <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                  7월
                                </span>
                              </div>
                              {" "}
                              <div style={{ padding: "12px 13px", display: "grid", gap: "12px" }}>
                                <span style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "var(--border)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>
                                  <span style={{ display: "grid", gap: "3px", padding: "10px 12px", background: "var(--bg-app)" }}>
                                    <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                      완료
                                    </span>
                                    {" "}
                                    <span className="v-num" style={{ font: "var(--fw-semi) 17px var(--font-sans)", color: "var(--fg)" }}>
                                      {vals.lastDone}
                                    </span>
                                  </span>
                                  {" "}
                                  <span style={{ display: "grid", gap: "3px", padding: "10px 12px", background: "var(--bg-app)" }}>
                                    <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                      이익 변화
                                    </span>
                                    {" "}
                                    <span className="v-num" style={{ font: "var(--fw-semi) 17px var(--font-sans)", color: "var(--pnl-pos)" }}>
                                      {vals.lastImpact}
                                    </span>
                                  </span>
                                </span>
                                {" "}
                                {vals.lastActions.map((l: any, $index: number) => (
                                    <span key={$index} style={{ display: "grid", gap: "4px", paddingBottom: "10px", borderBottom: "1px solid var(--border)" }}>
                                      <span style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                                        <span style={{ minWidth: "0", flex: "1", font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                          {l.title}
                                        </span>
                                        {" "}
                                        <span className="v-num" style={{ font: "var(--fw-semi) 11px var(--font-mono)", color: l.color, flex: "none" }}>
                                          {l.result}
                                        </span>
                                      </span>
                                      {" "}
                                      <span style={{ font: "var(--fw-regular) 11px/1.5 var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                                        {l.note}
                                      </span>
                                    </span>
                                ))}
                                {" "}
                                <span style={{ font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                                  {vals.lastNote}
                                </span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </section>
            )}
            {" "}
            {/* ══════════ 비용 ══════════ */}
            {" "}
            {vals.v.costs && (
                <section data-screen-label="비용" style={{ padding: "14px", maxWidth: "1180px" }}>
                  {vals.firstRun && (
                      <div style={{ padding: "56px 24px", display: "grid", justifyItems: "center", gap: "13px" }}>
                        <span style={{ width: "40px", height: "40px", borderRadius: "var(--r-md)", background: "var(--bg-elevated-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--fg-4)" }}>
                          <Lic name="wallet" size={19} />
                        </span>
                        {" "}
                        <span style={{ display: "grid", gap: "5px", justifyItems: "center", textAlign: "center", maxWidth: "380px" }}>
                          <span style={{ font: "var(--fw-semi) 14px var(--font-sans)", color: "var(--fg)" }}>
                            상품이 아직 없습니다
                          </span>
                          {" "}
                          <span style={{ font: "var(--fw-regular) 12px/1.7 var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                            원가는 SKU에 붙습니다. 정산서를 먼저 가져오면 상품이 만들어지고, 그다음 원가를 넣으면 순이익이 나옵니다.
                          </span>
                        </span>
                        {" "}
                        <button className="v-btn v-btn--primary" style={{ height: "30px" }} onClick={vals.goImport}>
                          정산 파일 가져오기
                        </button>
                      </div>
                  )}
                  {" "}
                  {vals.notFirstRun && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "2px", marginBottom: "14px" }}>
                        {vals.costTabs.map((t: any, $index: number) => (
                            <span key={$index} className={`tab ${t.on}`} onClick={t.pick}>
                              {t.label}
                            </span>
                        ))}
                        {" "}
                        <span style={{ flex: "1" }}></span>
                        {" "}
                        <span style={{ position: "relative", flex: "none" }}>
                          <span className="iconbtn" style={{ cursor: "pointer" }} onClick={vals.expCst.open}>
                            <Lic name="more-horizontal" size={15} />
                          </span>
                          {" "}
                          {vals.expCst.on && (
                              <span style={{ position: "absolute", zIndex: "90", top: "calc(100% + 6px)", right: "0", width: "258px", textAlign: "left", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-popover)", display: "grid" }} onClick={vals.stopEvt}>
                                <span style={{ display: "block", padding: "9px 12px", borderBottom: "1px solid var(--border)", font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg)" }}>
                                  내보내기
                                </span>
                                {" "}
                                <span style={{ display: "block", padding: "9px 12px", font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-4)", borderBottom: "1px solid var(--border)" }}>
                                  {vals.expScope}
                                </span>
                                {" "}
                                <span style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={vals.toggleExpHidden}>
                                  <span style={{ width: "13px", height: "13px", borderRadius: "3px", border: "1px solid var(--border-strong)", background: vals.expHiddenBg, flex: "none" }}></span>
                                  {" "}
                                  <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)" }}>
                                    숨긴 컬럼도 포함
                                  </span>
                                </span>
                                {" "}
                                <span style={{ display: "flex", gap: "6px", padding: "10px 12px" }}>
                                  <button className="v-btn" style={{ height: "27px", flex: "1" }}>
                                    XLSX
                                  </button>
                                  {" "}
                                  <button className="v-btn" style={{ height: "27px", flex: "1" }}>
                                    CSV
                                  </button>
                                </span>
                                {" "}
                                <span style={{ display: "block", padding: "0 12px 10px", font: "var(--fw-regular) 10px/1.5 var(--font-sans)", color: "var(--fg-4)" }}>
                                  {vals.expNote}
                                </span>
                              </span>
                          )}
                        </span>
                      </div>
                      {" "}
                      {vals.ctCogs && (
                        <>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--bg-subtle)", border: "1px solid var(--border)", marginBottom: "14px" }}>
                            <Lic name="square-pen" size={14} />
                            {" "}
                            <span style={{ flex: "1", font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-2)", textWrap: "pretty" }}>
                              원가는 마켓이 주지 않습니다. 회사만 아는 값이라 여기서 직접 입력하고, 가져오기가 덮어쓰지 않습니다. 단가는
                              <span style={{ fontWeight: "var(--fw-semi)" }}>
                                적용 시작일
                              </span>
                              과 함께 쌓입니다 — 8월 4일부터 단가가 올랐다면 그 이전 주문은 옛 단가로 계산됩니다.
                            </span>
                          </div>
                          {" "}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", marginBottom: "14px" }}>
                            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "12px 14px", display: "grid", gap: "4px" }}>
                              <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                이번 기간 매입원가
                              </span>
                              {" "}
                              <span className="v-num" style={{ font: "var(--fw-semi) 19px var(--font-sans)", color: "var(--fg)" }}>
                                {vals.costTotal}
                              </span>
                              {" "}
                              <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                주문일 기준 단가 적용
                              </span>
                            </div>
                            {" "}
                            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "12px 14px", display: "grid", gap: "4px" }}>
                              <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                기간 중 단가 변경
                              </span>
                              {" "}
                              <span className="v-num" style={{ font: "var(--fw-semi) 19px var(--font-sans)", color: "var(--pnl-warn)" }}>
                                {vals.costChanges}
                              </span>
                              {" "}
                              <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                이 기간 안에서 단가가 바뀐 SKU
                              </span>
                            </div>
                            {" "}
                            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "12px 14px", display: "grid", gap: "4px" }}>
                              <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                원가 미입력
                              </span>
                              {" "}
                              <span className="v-num" style={{ font: "var(--fw-semi) 19px var(--font-sans)", color: vals.costMissColor }}>
                                {vals.costMissing}
                              </span>
                              {" "}
                              <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                손익 계산에서 제외됨
                              </span>
                            </div>
                          </div>
                          {" "}
                          <div className="db-wrap">
                            <table className="db-table">
                              <thead>
                                <tr>
                                  <th>
                                    <span className="db-th">
                                      SKU
                                    </span>
                                  </th>
                                  {" "}
                                  <th>
                                    <span className="db-th">
                                      상품 · 옵션
                                    </span>
                                  </th>
                                  {" "}
                                  <th>
                                    <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                      현재 단가
                                    </span>
                                  </th>
                                  {" "}
                                  <th>
                                    <span className="db-th">
                                      적용 시작
                                    </span>
                                  </th>
                                  {" "}
                                  <th>
                                    <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                      이력
                                    </span>
                                  </th>
                                  {" "}
                                  <th>
                                    <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                      기간 매입원가
                                    </span>
                                  </th>
                                  {" "}
                                  <th>
                                    <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                      이익률
                                    </span>
                                  </th>
                                  {" "}
                                  <th></th>
                                </tr>
                              </thead>
                              {" "}
                              <tbody>
                                {vals.costRows.map((c: any, $index: number) => (
                                  <Fragment key={$index}>
                                    <tr className="db-row" style={{ cursor: "pointer" }} onClick={c.toggle}>
                                      <td className="db-td" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-4)", whiteSpace: "nowrap" }}>
                                        {c.sellerSku}
                                      </td>
                                      {" "}
                                      <td className="db-td db-td-title" style={{ font: "var(--fw-medium) 13px var(--font-sans)", color: "var(--fg-2)" }}>
                                        {c.name}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell" style={{ color: "var(--fg)" }}>
                                        {c.cost}
                                      </td>
                                      {" "}
                                      <td className="db-td" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-4)", whiteSpace: "nowrap" }}>
                                        {c.from}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell" style={{ color: c.histColor }}>
                                        {c.hist}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell" style={{ color: "var(--fg-3)" }}>
                                        {c.spend}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell" style={{ color: c.marginColor }}>
                                        {c.margin}
                                      </td>
                                      {" "}
                                      <td className="db-td" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                        <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                          {c.hint}
                                        </span>
                                      </td>
                                    </tr>
                                    {" "}
                                    {c.open && (
                                        <tr>
                                          <td colSpan={8} style={{ padding: "0", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
                                            <div style={{ padding: "14px 16px", display: "grid", gap: "12px" }}>
                                              <div style={{ display: "grid", gap: "6px", maxWidth: "620px" }}>
                                                {c.rows.map((hr: any, $index: number) => (
                                                    <span key={$index} style={{ display: "grid", gridTemplateColumns: "88px 96px 1fr 60px", gap: "12px", alignItems: "center", padding: "7px 10px", borderRadius: "var(--r-sm)", background: hr.bg, border: "1px solid var(--border)" }}>
                                                      <span className="v-num" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-3)" }}>
                                                        {hr.from}
                                                      </span>
                                                      {" "}
                                                      <span className="v-num" style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)", textAlign: "right" }}>
                                                        {hr.cost}
                                                      </span>
                                                      {" "}
                                                      <span style={{ font: "var(--fw-regular) 12px var(--font-sans)", color: "var(--fg-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {hr.memo}
                                                      </span>
                                                      {" "}
                                                      <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: hr.deltaColor, textAlign: "right" }}>
                                                        {hr.delta}
                                                      </span>
                                                    </span>
                                                ))}
                                              </div>
                                              {" "}
                                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                                <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                                  단가 변경
                                                </span>
                                                {" "}
                                                <input className="v-input" style={{ width: "116px", height: "28px" }} value={vals.cdFrom} onChange={vals.setCdFrom} placeholder="2026-08-10" />
                                                {" "}
                                                <input className="v-input" style={{ width: "104px", height: "28px" }} value={vals.cdCost} onChange={vals.setCdCost} placeholder="단가" />
                                                {" "}
                                                <input className="v-input" style={{ flex: "1", minWidth: "160px", height: "28px" }} value={vals.cdMemo} onChange={vals.setCdMemo} placeholder="사유 (환율, 재협상 등)" />
                                                {" "}
                                                <button className="v-btn v-btn--primary" style={{ height: "28px" }} onClick={c.add}>
                                                  추가
                                                </button>
                                              </div>
                                              {" "}
                                              <span style={{ font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-4)" }}>
                                                추가하면 그 날짜 이후 주문부터 새 단가로 계산됩니다. 이전 주문의 손익은 그대로 남습니다.
                                              </span>
                                            </div>
                                          </td>
                                        </tr>
                                    )}
                                  </Fragment>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                      {" "}
                      {vals.ctAd && (
                        <>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--bg-subtle)", border: "1px solid var(--border)", marginBottom: "14px" }}>
                            <Lic name="megaphone" size={14} />
                            {" "}
                            <span style={{ flex: "1", font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-2)", textWrap: "pretty" }}>
                              광고보고서는
                              <span style={{ fontWeight: "var(--fw-semi)" }}>
                                캠페인
                              </span>
                              단위로 들어옵니다. 캠페인 하나가 여러 SKU를 팔기 때문에 상품별 손익에 넣으려면 배분 규칙이 필요합니다. 브랜드 검색광고처럼 특정 상품에 붙지 않는 캠페인은 배분하지 않고 회사 손익에만 넣습니다.
                            </span>
                          </div>
                          {" "}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px", marginBottom: "14px" }}>
                            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "12px 14px", display: "grid", gap: "4px" }}>
                              <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                기간 광고비
                              </span>
                              {" "}
                              <span className="v-num" style={{ font: "var(--fw-semi) 19px var(--font-sans)", color: "var(--fg)" }}>
                                {vals.adTotal}
                              </span>
                              {" "}
                              <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                캠페인 {vals.adCount}
                              </span>
                            </div>
                            {" "}
                            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "12px 14px", display: "grid", gap: "4px" }}>
                              <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                상품에 배분됨
                              </span>
                              {" "}
                              <span className="v-num" style={{ font: "var(--fw-semi) 19px var(--font-sans)", color: "var(--pnl-pos)" }}>
                                {vals.adAlloc}
                              </span>
                              {" "}
                              <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                상품별 손익에 반영
                              </span>
                            </div>
                            {" "}
                            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "12px 14px", display: "grid", gap: "4px" }}>
                              <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                미배분 (전사)
                              </span>
                              {" "}
                              <span className="v-num" style={{ font: "var(--fw-semi) 19px var(--font-sans)", color: "var(--pnl-warn)" }}>
                                {vals.adUnalloc}
                              </span>
                              {" "}
                              <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                회사 손익에만 반영
                              </span>
                            </div>
                            {" "}
                            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "12px 14px", display: "grid", gap: "4px" }}>
                              <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                매출성장 ROAS
                              </span>
                              {" "}
                              <span className="v-num" style={{ font: "var(--fw-semi) 19px var(--font-sans)", color: "var(--fg)" }}>
                                {vals.adRoas}
                              </span>
                              {" "}
                              <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                신규구매 캠페인 제외
                              </span>
                            </div>
                          </div>
                          {" "}
                          <div className="db-wrap">
                            <table className="db-table">
                              <thead>
                                <tr>
                                  <th>
                                    <span className="db-th">
                                      캠페인
                                    </span>
                                  </th>
                                  {" "}
                                  <th>
                                    <span className="db-th">
                                      채널
                                    </span>
                                  </th>
                                  {" "}
                                  <th>
                                    <span className="db-th">
                                      유형
                                    </span>
                                  </th>
                                  {" "}
                                  <th>
                                    <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                      광고비
                                    </span>
                                  </th>
                                  {" "}
                                  <th>
                                    <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                      클릭
                                    </span>
                                  </th>
                                  {" "}
                                  <th>
                                    <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                      전환매출
                                    </span>
                                  </th>
                                  {" "}
                                  <th>
                                    <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                      ROAS
                                    </span>
                                  </th>
                                  {" "}
                                  <th>
                                    <span className="db-th">
                                      배분 규칙
                                    </span>
                                  </th>
                                </tr>
                              </thead>
                              {" "}
                              <tbody>
                                {vals.adRows.map((a: any, $index: number) => (
                                    <tr key={$index} className="db-row">
                                      <td className="db-td db-td-title" style={{ font: "var(--fw-medium) 13px var(--font-sans)", color: "var(--fg-2)" }}>
                                        {a.name}
                                      </td>
                                      {" "}
                                      <td className="db-td" style={{ whiteSpace: "nowrap" }}>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                          <span style={{ width: "7px", height: "7px", borderRadius: "2px", background: a.color }}></span>
                                          {" "}
                                          <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-3)" }}>
                                            {a.ch}
                                          </span>
                                        </span>
                                      </td>
                                      {" "}
                                      <td className="db-td" style={{ whiteSpace: "nowrap" }}>
                                        <span className="v-chip" style={{ height: "20px", padding: "0 7px", fontSize: "10px", color: a.typeColor }}>
                                          {a.type}
                                        </span>
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell" style={{ color: "var(--fg)" }}>
                                        {a.spend}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell" style={{ color: "var(--fg-4)" }}>
                                        {a.clicks}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell" style={{ color: "var(--fg-3)" }}>
                                        {a.convRev}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell" style={{ color: a.roasColor }}>
                                        {a.roas}
                                      </td>
                                      {" "}
                                      <td className="db-td" style={{ whiteSpace: "nowrap" }}>
                                        <select className="v-input" style={{ height: "26px", padding: "0 6px", fontSize: "11px", minWidth: "132px" }} value={a.rule} onChange={a.setRule}>
                                          {a.opts.map((o: any, $index: number) => (
                                              <option key={$index} value={o.v}>
                                                {o.label}
                                              </option>
                                          ))}
                                        </select>
                                      </td>
                                    </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {" "}
                          <div style={{ font: "var(--fw-regular) 11px/1.7 var(--font-sans)", color: "var(--fg-4)", marginTop: "10px", maxWidth: "760px", textWrap: "pretty" }}>
                            신규구매 캠페인은 전환매출 데이터가 없어 ROAS를 계산하지 않습니다. 클릭당 비용으로만 봅니다. 배분 규칙을 바꾸면 상품별 손익이 즉시 다시 계산됩니다.
                          </div>
                        </>
                      )}
                      {" "}
                      {vals.ctOps && (
                        <>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--bg-subtle)", border: "1px solid var(--border)", marginBottom: "14px" }}>
                            <Lic name="package" size={14} />
                            {" "}
                            <span style={{ flex: "1", font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-2)", textWrap: "pretty" }}>
                              운영비는 주문이나 개수에 따라 실제로 나가는 돈이라
                              <span style={{ fontWeight: "var(--fw-semi)" }}>
                                상품 기여이익
                              </span>
                              에 들어갑니다. 고정비는 얼마를 팔든 나가는 돈이라 상품에 배분하지 않고
                              <span style={{ fontWeight: "var(--fw-semi)" }}>
                                회사 순이익
                              </span>
                              에서만 뺍니다. 상품 손익을 다 더해도 회사 순이익이 되지 않는 이유입니다.
                            </span>
                          </div>
                          {" "}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", alignItems: "start" }}>
                            <div>
                              <div style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)", marginBottom: "8px" }}>
                                운영비
                                <span style={{ fontWeight: "var(--fw-medium)", color: "var(--fg-4)" }}>
                                  · 상품에 배분
                                </span>
                              </div>
                              {" "}
                              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                                {vals.opsRows.map((o: any, $index: number) => (
                                    <span key={$index} style={{ display: "grid", gridTemplateColumns: "1fr 56px 96px", gap: "10px", alignItems: "center", padding: "9px 12px", borderBottom: "1px solid var(--border)" }}>
                                      <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)" }}>
                                        {o.name}
                                      </span>
                                      {" "}
                                      <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                        {o.note}
                                      </span>
                                      {" "}
                                      <input className="v-input" style={{ height: "26px", fontSize: "12px", textAlign: "right" }} value={o.amount} onChange={o.set} />
                                    </span>
                                ))}
                                {" "}
                                <span style={{ display: "grid", gridTemplateColumns: "1fr 96px", gap: "10px", padding: "10px 12px", background: "var(--bg-subtle)" }}>
                                  <span style={{ font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg-2)" }}>
                                    기간 운영비 합계
                                  </span>
                                  {" "}
                                  <span className="v-num" style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)", textAlign: "right" }}>
                                    {vals.opsTotal}
                                  </span>
                                </span>
                              </div>
                            </div>
                            {" "}
                            <div>
                              <div style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)", marginBottom: "8px" }}>
                                고정비
                                <span style={{ fontWeight: "var(--fw-medium)", color: "var(--fg-4)" }}>
                                  · 월 단위, 배분 안 함
                                </span>
                              </div>
                              {" "}
                              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                                {vals.fixRows.map((f: any, $index: number) => (
                                    <span key={$index} style={{ display: "grid", gridTemplateColumns: "1fr 112px", gap: "10px", alignItems: "center", padding: "9px 12px", borderBottom: "1px solid var(--border)" }}>
                                      <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)" }}>
                                        {f.name}
                                      </span>
                                      {" "}
                                      <input className="v-input" style={{ height: "26px", fontSize: "12px", textAlign: "right" }} value={f.amount} onChange={f.set} />
                                    </span>
                                ))}
                                {" "}
                                <span style={{ display: "grid", gridTemplateColumns: "1fr 112px", gap: "10px", padding: "10px 12px", background: "var(--bg-subtle)" }}>
                                  <span style={{ font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg-2)" }}>
                                    이 기간 몫
                                    <span style={{ fontWeight: "var(--fw-medium)", color: "var(--fg-4)" }}>
                                      {vals.fixDays}
                                    </span>
                                  </span>
                                  {" "}
                                  <span className="v-num" style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)", textAlign: "right" }}>
                                    {vals.fixTotal}
                                  </span>
                                </span>
                              </div>
                              {" "}
                              <div data-s21="cost-fixed-save" style={{ marginTop: "10px", display: "grid", gap: "8px" }}>
                                <span style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                  <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-3)" }}>
                                    언제부터
                                  </span>
                                  {" "}
                                  <input className="v-input" type="date" style={{ height: "26px", fontSize: "11px", width: "138px" }} value={vals.fixDate} onChange={vals.setFixDate} />
                                  {" "}
                                  <span style={{ flex: "1" }}></span>
                                  {" "}
                                  <button className="v-btn v-btn--primary" style={{ height: "26px", padding: "0 10px", fontSize: "11px", opacity: vals.fixSaveOpacity }} onClick={vals.fixSave} disabled={!vals.fixCanSave}>
                                    저장
                                  </button>
                                </span>
                                {vals.fixSaveWhy !== "" && (
                                    <span style={{ font: "var(--fw-regular) 10px/1.4 var(--font-sans)", color: "var(--pnl-neg)" }}>
                                      {vals.fixSaveWhy}
                                    </span>
                                )}
                                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <input className="v-input" style={{ height: "26px", fontSize: "12px", flex: "1", minWidth: "0" }} value={vals.fixNewName} onChange={vals.setFixNewName} placeholder="새 항목 (임대료 · 인건비 …)" />
                                  {" "}
                                  <input className="v-input" style={{ height: "26px", fontSize: "12px", width: "92px", textAlign: "right" }} value={vals.fixNewAmount} onChange={vals.setFixNewAmount} placeholder="월 금액" inputMode="numeric" />
                                  {" "}
                                  <button className="v-btn" style={{ height: "26px", padding: "0 9px", fontSize: "11px", opacity: vals.fixAddOpacity }} onClick={vals.fixAdd} disabled={!vals.fixCanAdd}>
                                    추가
                                  </button>
                                </span>
                                {vals.fixAddWhy !== "" && (
                                    <span style={{ font: "var(--fw-regular) 10px/1.4 var(--font-sans)", color: "var(--pnl-neg)" }}>
                                      {vals.fixAddWhy}
                                    </span>
                                )}
                                <span style={{ display: "flex", alignItems: "center", gap: "7px", marginTop: "2px", cursor: "pointer" }} onClick={vals.toggleFixNone}>
                                  <span style={{ width: "13px", height: "13px", borderRadius: "3px", border: "1px solid var(--border-strong)", background: vals.fixNoneBg, flex: "none" }}></span>
                                  {" "}
                                  <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)" }}>
                                    고정비를 두지 않습니다
                                  </span>
                                  {vals.fixNone && (
                                      <select className="v-input" style={{ height: "24px", fontSize: "11px" }} value={vals.fixNoneReason} onChange={vals.setFixNoneReason} onClick={vals.stopEvt}>
                                        <option value="in-cogs">
                                          원가에 이미 포함
                                        </option>
                                        <option value="not-applicable">
                                          해당 없음
                                        </option>
                                      </select>
                                  )}
                                </span>
                                {vals.fixNoneNote !== "" && (
                                    <span style={{ font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                                      {vals.fixNoneNote}
                                    </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {" "}
                          <div style={{ marginTop: "18px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "16px 18px" }}>
                            <div style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)", marginBottom: "3px" }}>
                              손익 3층
                            </div>
                            {" "}
                            <div style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)", marginBottom: "14px" }}>
                              어느 층까지 뺐는지에 따라 이익이 다릅니다
                            </div>
                            {" "}
                            <div style={{ display: "grid", gap: "2px", maxWidth: "620px" }}>
                              {vals.layerRows.map((l: any, $index: number) => (
                                  <span key={$index} style={{ display: "grid", gridTemplateColumns: "1fr 132px 64px", gap: "12px", alignItems: "baseline", padding: l.pad, borderTop: l.rule }}>
                                    <span style={{ font: l.font, color: l.fg, paddingLeft: l.indent }}>
                                      {l.label}
                                    </span>
                                    {" "}
                                    <span className="v-num" style={{ font: l.numFont, color: l.numColor, textAlign: "right" }}>
                                      {l.value}
                                    </span>
                                    {" "}
                                    <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)", textAlign: "right" }}>
                                      {l.pct}
                                    </span>
                                  </span>
                              ))}
                            </div>
                            {" "}
                            <div style={{ font: "var(--fw-regular) 11px/1.7 var(--font-sans)", color: "var(--fg-4)", marginTop: "14px", maxWidth: "620px", textWrap: "pretty" }}>
                              {vals.layerNote}
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </section>
            )}
            {" "}
            {/* ══════════ 주문 ══════════ */}
            {" "}
            {vals.v.orders && (
                <section data-screen-label="주문">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
                    <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-3)" }}>
                      {vals.orderScope}
                    </span>
                    {" "}
                    <span style={{ flex: "1" }}></span>
                    {" "}
                    {vals.hasFilters && (
                      <>
                        {vals.filterPills.map((p: any, $index: number) => (
                            <span key={$index} className="filter-pill">
                              <span className="seg-part">
                                {p.type}
                              </span>
                              {" "}
                              <span className="seg-part op">
                                is
                              </span>
                              {" "}
                              <span className="seg-part" style={{ color: "var(--fg)" }}>
                                {p.value}
                              </span>
                              {" "}
                              <span className="x" onClick={p.remove}>
                                <Lic name="x" size={13} />
                              </span>
                            </span>
                        ))}
                      </>
                    )}
                    {" "}
                    {vals.hasOrderFilter && (
                        <span className="v-chip" onClick={vals.clearOrderFilter}>
                          <span>
                            {vals.orderFilterLabel}
                          </span>
                          {" "}
                          <Lic name="x" size={12} />
                        </span>
                    )}
                    {" "}
                    <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                      최대 60건 표시
                    </span>
                    {" "}
                    <span style={{ position: "relative", flex: "none" }}>
                      <span className="iconbtn" style={{ cursor: "pointer" }} onClick={vals.expOrd.open}>
                        <Lic name="more-horizontal" size={15} />
                      </span>
                      {" "}
                      {vals.expOrd.on && (
                          <span style={{ position: "absolute", zIndex: "90", top: "calc(100% + 6px)", right: "0", width: "258px", textAlign: "left", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-popover)", display: "grid" }} onClick={vals.stopEvt}>
                            <span style={{ display: "block", padding: "9px 12px", borderBottom: "1px solid var(--border)", font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg)" }}>
                              내보내기
                            </span>
                            {" "}
                            <span style={{ display: "block", padding: "9px 12px", font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-4)", borderBottom: "1px solid var(--border)" }}>
                              {vals.expScope}
                            </span>
                            {" "}
                            <span style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={vals.toggleExpHidden}>
                              <span style={{ width: "13px", height: "13px", borderRadius: "3px", border: "1px solid var(--border-strong)", background: vals.expHiddenBg, flex: "none" }}></span>
                              {" "}
                              <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)" }}>
                                숨긴 컬럼도 포함
                              </span>
                            </span>
                            {" "}
                            <span style={{ display: "flex", gap: "6px", padding: "10px 12px" }}>
                              <button className="v-btn" style={{ height: "27px", flex: "1" }}>
                                XLSX
                              </button>
                              {" "}
                              <button className="v-btn" style={{ height: "27px", flex: "1" }}>
                                CSV
                              </button>
                            </span>
                            {" "}
                            <span style={{ display: "block", padding: "0 12px 10px", font: "var(--fw-regular) 10px/1.5 var(--font-sans)", color: "var(--fg-4)" }}>
                              {vals.expNote}
                            </span>
                          </span>
                      )}
                    </span>
                  </div>
                  {" "}
                  <div className="db-table-wrap">
                    <table className="db-table">
                      <thead>
                        <tr>
                          <th>
                            <span className="db-th">
                              결제일시
                            </span>
                          </th>
                          {" "}
                          <th>
                            <span className="db-th">
                              마켓 주문번호
                            </span>
                          </th>
                          {" "}
                          <th>
                            <span className="db-th">
                              채널
                            </span>
                          </th>
                          {" "}
                          <th>
                            <span className="db-th">
                              상품
                            </span>
                          </th>
                          {" "}
                          <th>
                            <span className="db-th" style={{ justifyContent: "flex-end" }}>
                              수량
                            </span>
                          </th>
                          {" "}
                          <th>
                            <span className="db-th" style={{ justifyContent: "flex-end" }}>
                              매출
                            </span>
                          </th>
                          {" "}
                          <th>
                            <span className="db-th" style={{ justifyContent: "flex-end" }}>
                              기여이익
                            </span>
                          </th>
                          {" "}
                          <th>
                            <span className="db-th">
                              클레임
                            </span>
                          </th>
                          {" "}
                          <th>
                            <span className="db-th">
                              출처
                            </span>
                          </th>
                        </tr>
                      </thead>
                      {" "}
                      <tbody>
                        {vals.ordersEmpty && (
                            <tr>
                              <td className="db-td" colSpan={9} style={{ padding: "0" }}>
                                <span className="empty" style={{ height: "168px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                                  <Lic name="shopping-cart" size={20} color="var(--fg-4)" />
                                  {" "}
                                  <span className="etext" style={{ font: "var(--fw-medium) 13px var(--font-sans)", color: "var(--fg-3)" }}>
                                    주문이 없습니다
                                  </span>
                                  {" "}
                                  <span style={{ font: "var(--fw-regular) 12px var(--font-sans)", color: "var(--fg-4)" }}>
                                    선택한 조건에 해당하는 주문이 아직 들어오지 않았습니다
                                  </span>
                                </span>
                              </td>
                            </tr>
                        )}
                        {" "}
                        {vals.orderRows.map((o: any, $index: number) => (
                            <tr key={$index} className="fb-row" style={{ cursor: "pointer" }} onClick={o.click}>
                              <td className="db-td" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-4)", whiteSpace: "nowrap" }}>
                                {o.at}
                              </td>
                              {" "}
                              <td className="db-td" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-3)", whiteSpace: "nowrap" }}>
                                {o.extId}
                              </td>
                              {" "}
                              <td className="db-td" style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: o.color, whiteSpace: "nowrap" }}>
                                {o.ch}
                              </td>
                              {" "}
                              <td className="db-td db-td-title" style={{ font: "var(--fw-regular) 12px var(--font-sans)", color: o.itemColor }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", minWidth: "0" }}>
                                  <span style={{ minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {o.item}
                                  </span>
                                  {" "}
                                  {o.unlinked && (
                                      <span className="v-btn" style={{ height: "21px", padding: "0 8px", fontSize: "10px", cursor: "pointer", flex: "none", color: "var(--accent)", borderColor: "var(--accent)" }} onClick={o.link}>
                                        연결하기
                                      </span>
                                  )}
                                </span>
                              </td>
                              {" "}
                              <td className="db-td fb-cell">
                                {o.qty}
                              </td>
                              {" "}
                              <td className="db-td fb-cell" style={{ color: "var(--fg-2)" }}>
                                {o.rev}
                              </td>
                              {" "}
                              <td className="db-td fb-cell" style={{ fontWeight: "var(--fw-semi)", color: o.netColor }}>
                                {o.net}
                              </td>
                              {" "}
                              <td className="db-td" style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: o.claimColor }}>
                                {o.claim}
                              </td>
                              {" "}
                              <td className="db-td" style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                {o.src}
                              </td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
            )}
            {" "}
            {/* ══════════ 데이터 연결 ══════════ */}
            {" "}
            {vals.v.connect && (
                <section data-screen-label="채널" style={{ padding: "14px", maxWidth: "1060px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
                    <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-4)" }}>
                      상태 미리보기
                    </span>
                    {" "}
                    <div className="segmented">
                      {vals.stateTabs.map((t: any, $index: number) => (
                          <div key={$index} className={`seg ${t.on}`} onClick={t.pick}>
                            {t.label}
                          </div>
                      ))}
                    </div>
                    {" "}
                    <span style={{ flex: "1" }}></span>
                    {" "}
                    <button className="v-btn" style={{ height: "28px" }} onClick={vals.toggleFirstRun}>
                      {vals.firstRunLabel}
                    </button>
                  </div>
                  {" "}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--bg-subtle)", border: "1px solid var(--border)", marginBottom: "12px" }}>
                    <Lic name="file-spreadsheet" size={14} />
                    {" "}
                    <span style={{ flex: "1", font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-2)", textWrap: "pretty" }}>
                      v1은
                      <span style={{ fontWeight: "var(--fw-semi)" }}>
                        파일로 가져오기
                      </span>
                      가 기본입니다. 마켓에서 정산서를 내려받아 넣으면 됩니다. 마켓 계정을 직접 연결해 자동으로 받아오는 방식은 v1.5에서 열립니다 — 아래 카드의 API 표기는 그때를 위한 자리입니다.
                    </span>
                  </div>
                  {" "}
                  <div style={{ display: "grid", gap: "10px" }}>
                    {vals.conns.map((c: any, $index: number) => (
                        <div key={$index} style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "11px", padding: "13px 14px" }}>
                            <span style={{ width: "30px", height: "30px", borderRadius: "var(--r-sm)", background: "var(--bg-elevated-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", font: "var(--fw-semi) 12px var(--font-sans)", color: c.color, flex: "none" }}>
                              {c.abbr}
                            </span>
                            {" "}
                            <span style={{ minWidth: "0" }}>
                              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ font: "var(--fw-semi) 14px var(--font-sans)", color: "var(--fg)" }}>
                                  {c.name}
                                </span>
                                {" "}
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", height: "20px", padding: "0 8px", borderRadius: "var(--r-pill)", background: c.bg, font: "var(--fw-semi) 11px var(--font-sans)", color: c.sc }}>
                                  <span style={{ width: "5px", height: "5px", borderRadius: "999px", background: c.sc }}></span>
                                  {" "}
                                  <span>
                                    {c.stateLabel}
                                  </span>
                                </span>
                              </span>
                              {" "}
                              <span style={{ display: "flex", alignItems: "center", gap: "7px", marginTop: "3px", font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                <span style={{ fontFamily: "var(--font-mono)" }}>
                                  {c.account}
                                </span>
                                {" "}
                                <span>
                                  ·
                                </span>
                                {" "}
                                <span>
                                  {c.mode}
                                </span>
                                {" "}
                                <span>
                                  ·
                                </span>
                                {" "}
                                <span>
                                  {c.lastLine}
                                </span>
                              </span>
                            </span>
                            {" "}
                            <span style={{ flex: "1" }}></span>
                            {" "}
                            <span style={{ display: "flex", gap: "6px" }}>
                              {c.showLock && (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", height: "28px", padding: "0 9px", borderRadius: "var(--r-sm)", border: "1px solid var(--accent)", font: "var(--fw-semi) 11px var(--font-sans)", color: "var(--accent)", cursor: "pointer" }} onClick={c.upgrade}>
                                    <Lic name="lock" size={11} />
                                    {" "}
                                    <span>
                                      Pro 필요
                                    </span>
                                  </span>
                              )}
                              {" "}
                              <button className="v-btn" style={{ height: "28px" }} onClick={c.primary}>
                                {c.primaryLabel}
                              </button>
                              {" "}
                              {c.canDisconnect && (
                                  <button className="v-btn" style={{ height: "28px" }} onClick={c.disconnect}>
                                    연결 해제
                                  </button>
                              )}
                              {" "}
                              <button className="v-btn" style={{ height: "28px" }} onClick={c.manage}>
                                연결 관리
                              </button>
                            </span>
                          </div>
                          {" "}
                          {c.hasNote && (
                              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", margin: "0 14px 11px", padding: "9px 11px", borderRadius: "var(--r-sm)", background: c.bg, font: "var(--fw-regular) 12px/1.5 var(--font-sans)", color: "var(--fg-2)" }}>
                                <Lic name="info" size={14} />
                                {" "}
                                <span>
                                  {c.note}
                                </span>
                              </div>
                          )}
                          {" "}
                          {vals.showCoverage && (
                              <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "9px 14px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
                                {c.coverage.map((cv: any, $index: number) => (
                                    <span key={$index} style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                      <span style={{ width: "6px", height: "6px", borderRadius: "999px", background: cv.color }}></span>
                                      {" "}
                                      <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-3)" }}>
                                        {cv.label}
                                      </span>
                                      {" "}
                                      <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                        {cv.via}
                                      </span>
                                    </span>
                                ))}
                                {" "}
                                <span style={{ flex: "1" }}></span>
                                {" "}
                                {c.hasChannels && (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                      <span>
                                        채널 분리
                                      </span>
                                      {" "}
                                      {c.channels.map((cc: any, $index: number) => (
                                          <span key={$index} style={{ height: "18px", padding: "0 7px", borderRadius: "var(--r-pill)", border: "1px solid var(--border-strong)", display: "inline-flex", alignItems: "center", color: "var(--fg-3)" }}>
                                            {cc}
                                          </span>
                                      ))}
                                    </span>
                                )}
                              </div>
                          )}
                        </div>
                    ))}
                    {" "}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
                      <Lic name="users" size={14} />
                      {" "}
                      <span style={{ flex: "1", font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-2)", textWrap: "pretty" }}>
                        한 마켓에 계정이 여럿인 경우(본점·2호점)는
                        <span style={{ fontWeight: "var(--fw-semi)" }}>
                          v1.5
                        </span>
                        에서 열립니다. 다만 지금 들어오는 모든 주문·정산 행은 이미
                        <span style={{ fontFamily: "var(--font-mono)" }}>
                          connection_id
                        </span>
                        를 달고 저장되므로, 그때 기존 데이터를 계정별로 나눠 볼 수 있습니다.
                      </span>
                    </div>
                    {" "}
                    <div style={{ border: "1px dashed var(--border-strong)", borderRadius: "var(--r-md)", padding: "13px 14px", display: "flex", alignItems: "center", gap: "11px" }}>
                      <span style={{ width: "30px", height: "30px", borderRadius: "var(--r-sm)", background: "var(--bg-elevated-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--fg-3)", flex: "none" }}>
                        <Lic name="file-spreadsheet" size={15} />
                      </span>
                      {" "}
                      <span>
                        <span style={{ display: "block", font: "var(--fw-semi) 14px var(--font-sans)", color: "var(--fg)" }}>
                          파일 가져오기
                        </span>
                        {" "}
                        <span style={{ display: "block", marginTop: "3px", font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                          CSV · XLSX — API가 주지 않는 정산 · 광고 · 과거 데이터를 같은 파이프라인으로 처리합니다
                        </span>
                      </span>
                      {" "}
                      <span style={{ flex: "1" }}></span>
                      {" "}
                      <button className="v-btn" style={{ height: "28px" }} onClick={vals.go.import}>
                        파일 선택
                      </button>
                    </div>
                  </div>
                </section>
            )}
            {" "}
            {/* ══════════ 파일 가져오기 ══════════ */}
            {" "}
            {vals.v.import && (
                <section data-screen-label="가져오기" style={{ padding: "14px", maxWidth: "1000px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "14px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                    {vals.impSteps.map((s: any, $index: number) => (
                        <span key={$index} style={{ flex: "1", minWidth: "0", display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", background: s.bg, boxShadow: "1px 0 0 var(--border)" }}>
                          <span style={{ width: "19px", height: "19px", borderRadius: "999px", background: s.dot, border: `1px solid ${s.dotBorder}`, display: "inline-flex", alignItems: "center", justifyContent: "center", font: "var(--fw-semi) 10px var(--font-sans)", color: s.numColor, flex: "none" }}>
                            {s.n}
                          </span>
                          {" "}
                          <span style={{ minWidth: "0", display: "grid", gap: "1px" }}>
                            <span style={{ font: "var(--fw-semi) 12px var(--font-sans)", color: s.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {s.label}
                            </span>
                            {" "}
                            <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {s.sub}
                            </span>
                          </span>
                        </span>
                    ))}
                  </div>
                  {" "}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
                    <div className="segmented">
                      {vals.srcTabs.map((s: any, $index: number) => (
                          <div key={$index} className={`seg ${s.on}`} onClick={s.pick}>
                            {s.label}
                          </div>
                      ))}
                    </div>
                    {" "}
                    {vals.impChannelName && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "26px", padding: "0 4px 0 9px", borderRadius: "var(--r-pill)", border: "1px solid var(--accent)", font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--accent)" }}>
                          <span>
                            {vals.impChannelName} 매핑 적용됨
                          </span>
                          {" "}
                          <span className="iconbtn" style={{ cursor: "pointer", width: "18px", height: "18px" }} onClick={vals.clearImpChannel}>
                            <Lic name="x" size={11} />
                          </span>
                        </span>
                    )}
                  </div>
                  {" "}
                  {vals.srcUrl && (
                      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "13px 14px", marginBottom: "12px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                          <input className="v-input" style={{ flex: "1", minWidth: "0", height: "30px", fontSize: "12px" }} value={vals.urlValue} onChange={vals.setUrl} placeholder="https://docs.google.com/spreadsheets/..." />
                          {" "}
                          <button className="v-btn v-btn--primary" style={{ height: "30px" }} onClick={vals.fetchUrl}>
                            가져오기
                          </button>
                        </span>
                        {" "}
                        <span style={{ display: "block", marginTop: "7px", font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                          CSV·XLSX 파일 주소 또는 구글 시트 공유 링크
                        </span>
                        {" "}
                        {vals.urlBusy && (
                            <span style={{ display: "flex", alignItems: "center", gap: "7px", marginTop: "10px", font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-3)" }}>
                              <Lic name="loader" size={13} />
                              {" "}
                              <span>
                                주소 확인 중...
                              </span>
                            </span>
                        )}
                        {" "}
                        {vals.urlError && (
                            <span style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginTop: "10px", padding: "10px 12px", borderRadius: "var(--r-sm)", background: "rgba(235,87,87,0.08)", border: "1px solid var(--pnl-neg)" }}>
                              <Lic name="triangle-alert" size={14} color="var(--pnl-neg)" />
                              {" "}
                              <span style={{ flex: "1", font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-2)" }}>
                                {vals.urlError}
                              </span>
                            </span>
                        )}
                      </div>
                  )}
                  {" "}
                  {vals.srcManual && (
                      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "11px 13px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
                          <div className="segmented">
                            {vals.manTargets.map((t: any, $index: number) => (
                                <div key={$index} className={`seg ${t.on}`} onClick={t.pick}>
                                  {t.label}
                                </div>
                            ))}
                          </div>
                          {" "}
                          <span style={{ flex: "1" }}></span>
                          {" "}
                          <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                            채널
                          </span>
                          {" "}
                          <select className="v-input" style={{ height: "28px", padding: "0 7px", fontSize: "12px", minWidth: "168px" }} value={vals.manChannel}>
                            {vals.manChannels.map((c: any, $index: number) => (
                                <option key={$index} value={c}>
                                  {c}
                                </option>
                            ))}
                          </select>
                        </div>
                        {" "}
                        <div className="db-wrap">
                          <table className="db-table">
                            <thead>
                              <tr>
                                <th>
                                  <span className="db-th" style={{ width: "22px" }}></span>
                                </th>
                                {" "}
                                {vals.manCols.map((c: any, $index: number) => (
                                    <th key={$index}>
                                      <span className="db-th">
                                        {c}
                                      </span>
                                    </th>
                                ))}
                                {" "}
                                <th></th>
                              </tr>
                            </thead>
                            {" "}
                            <tbody>
                              {vals.manRows.map((r: any, $index: number) => (
                                <Fragment key={$index}>
                                  <tr className="db-row">
                                    <td className="db-td" style={{ color: "var(--fg-4)", font: "var(--fw-medium) 11px var(--font-mono)" }}>
                                      {$index}
                                    </td>
                                    {" "}
                                    {r.cells.map((v: any, $index: number) => (
                                        <td key={$index} className="db-td" style={{ padding: "4px 6px" }}>
                                          <input className="v-input" style={{ height: "26px", fontSize: "12px", width: "100%", minWidth: "84px" }} value={v} />
                                        </td>
                                    ))}
                                    {" "}
                                    <td className="db-td" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                      <span className="iconbtn" style={{ cursor: "pointer" }}>
                                        <Lic name="trash-2" size={13} />
                                      </span>
                                    </td>
                                  </tr>
                                  {" "}
                                  {r.err && (
                                      <tr>
                                        <td colSpan={7} style={{ padding: "6px 12px 8px 40px", background: "rgba(235,87,87,0.06)", borderBottom: "1px solid var(--border)", font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--pnl-neg)" }}>
                                          {r.err}
                                        </td>
                                      </tr>
                                  )}
                                </Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {" "}
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "11px 13px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
                          <button className="v-btn" style={{ height: "28px" }}>
                            행 추가
                          </button>
                          {" "}
                          <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                            여러 줄을 붙여넣으면 행이 자동으로 늘어납니다
                          </span>
                          {" "}
                          <span style={{ flex: "1" }}></span>
                          {" "}
                          <button className="v-btn v-btn--primary" style={{ height: "28px" }}>
                            3건 확정
                          </button>
                        </div>
                        {" "}
                        <div style={{ padding: "11px 13px", borderTop: "1px solid var(--border)", display: "grid", gap: "5px", background: "var(--bg-subtle)" }}>
                          <span style={{ font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-3)", textWrap: "pretty" }}>
                            {vals.manNote}
                          </span>
                          {" "}
                          <span style={{ font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                            {vals.manScope}
                          </span>
                        </div>
                      </div>
                  )}
                  {" "}
                  {!vals.srcWizard && (
                      <div data-s21="import-pick" style={{ border: "1px dashed var(--border-strong)", borderRadius: "var(--r-lg)", padding: "34px 24px", display: "grid", gap: "12px", justifyItems: "center", background: "var(--bg-subtle)" }}>
                        <span style={{ width: "44px", height: "44px", borderRadius: "var(--r-md)", background: "var(--bg-elevated-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--fg-3)" }}>
                          <Lic name="file-spreadsheet" size={20} />
                        </span>
                        {" "}
                        <span style={{ display: "grid", gap: "4px", justifyItems: "center", textAlign: "center" }}>
                          <span style={{ font: "var(--fw-semi) 14px var(--font-sans)", color: "var(--fg)" }}>
                            정산 파일을 고르세요
                          </span>
                          {" "}
                          <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                            CSV · XLSX · XLS — 넣기 전에 무엇이 들어갈지 먼저 보여드립니다
                          </span>
                        </span>
                        {" "}
                        <label className="v-btn v-btn--primary" style={{ height: "30px", marginTop: "2px", cursor: "pointer", display: "inline-flex", alignItems: "center", padding: "0 12px" }}>
                          파일 선택
                          <input type="file" style={{ display: "none" }} onChange={vals.impPick} />
                        </label>
                      </div>
                  )}
                  {" "}
                  {vals.impHasError && (
                      <div data-s21="import-error" style={{ marginTop: "12px", display: "flex", alignItems: "flex-start", gap: "8px", padding: "11px 12px", borderRadius: "var(--r-sm)", background: "rgba(235,87,87,0.1)", font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-2)" }}>
                        <Lic name="triangle-alert" size={14} color="var(--pnl-neg)" />
                        {" "}
                        <span>
                          {vals.impError}
                        </span>
                      </div>
                  )}
                  {" "}
                  {vals.srcWizard && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "11px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "13px 14px" }}>
                        <span style={{ width: "30px", height: "30px", borderRadius: "var(--r-sm)", background: "var(--bg-elevated-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--pnl-pos)", flex: "none" }}>
                          <Lic name="file-spreadsheet" size={15} />
                        </span>
                        {" "}
                        <span style={{ minWidth: "0" }}>
                          <span style={{ display: "block", font: "var(--fw-semi) 14px var(--font-sans)", color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {vals.srcName}
                          </span>
                          {" "}
                          <span style={{ display: "block", marginTop: "3px", font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                            {vals.srcMeta}
                          </span>
                        </span>
                        {" "}
                        <span style={{ flex: "1" }}></span>
                        {" "}
                        <button className="v-btn" style={{ height: "28px" }} onClick={vals.impReset}>
                          {vals.srcSwap}
                        </button>
                      </div>
                      {" "}
                      {vals.impBig && (
                          <div data-s21="import-big" style={{ marginTop: "12px", display: "flex", alignItems: "flex-start", gap: "8px", padding: "11px 12px", borderRadius: "var(--r-sm)", background: "rgba(242,201,76,0.1)", font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-2)" }}>
                            <Lic name="triangle-alert" size={14} />
                            {" "}
                            <span>
                              큰 파일입니다. 가져오는 동안 화면이 잠시 멈출 수 있습니다 — 앱이 멈춘 것이 아니라 파일을 읽고 있는 중입니다. 창을 닫지 말고 기다려 주세요.
                            </span>
                          </div>
                      )}
                      {" "}
                      {vals.impManySheets && (
                          <div data-s21="import-sheets" style={{ marginTop: "12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                              <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                                시트 고르기
                              </span>
                              {" "}
                              <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                이 파일에는 시트가 여럿입니다. 수식으로 계산된 시트를 사실로 넣으면 숫자가 두 번 더해집니다.
                              </span>
                            </div>
                            {" "}
                            {vals.impSheetAutoNote !== "" && (
                              <div style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", font: "var(--fw-medium) 11px/1.6 var(--font-sans)", color: "var(--ok, #2f9e63)", background: "rgba(47,158,99,0.08)" }}>
                                {vals.impSheetAutoNote}
                              </div>
                            )}
                            {" "}
                            <div style={{ display: "grid" }}>
                              {vals.impSheets.map((s: any, $index: number) => (
                                  <span key={$index} className={`fb-row ${s.on}`} style={{ display: "flex", alignItems: "baseline", gap: "10px", padding: "9px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={s.pick}>
                                    <span style={{ font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg)", minWidth: "140px" }}>
                                      {s.label}
                                    </span>
                                    {" "}
                                    <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: s.color }}>
                                      {s.note}
                                    </span>
                                  </span>
                              ))}
                            </div>
                            {" "}
                            {vals.impAllSheetsLabel !== "" && (
                              <label style={{ display: "flex", alignItems: "baseline", gap: "8px", padding: "10px 12px", borderTop: "1px solid var(--border)", cursor: "pointer", font: "var(--fw-medium) 12px/1.6 var(--font-sans)", color: "var(--fg-2)" }}>
                                <input type="checkbox" checked={vals.impAllSheets} onChange={vals.toggleImpAllSheets} style={{ position: "relative", top: "1px" }} />
                                {" "}
                                <span>
                                  {vals.impAllSheetsLabel}
                                </span>
                              </label>
                            )}
                          </div>
                      )}
                      {" "}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginTop: "12px", padding: "11px 12px", borderRadius: "var(--r-sm)", background: "rgba(242,201,76,0.1)", font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-2)" }}>
                        <Lic name="triangle-alert" size={14} />
                        {" "}
                        <span>
                          이 매핑은 아직 확인되지 않은 추정입니다. 마켓별 실제 컬럼명은 판매자 계정에서만 확인할 수 있어 FlowBase는 컬럼명을 고정하지 않고, 감지 → 확인 →
                          <strong style={{ color: "var(--fg)" }}>
                            매핑 프로파일 저장
                          </strong>
                          순서로 처리합니다. 한 번 확인하면 다음 파일부터 자동 적용됩니다.
                        </span>
                      </div>
                      {" "}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px" }}>
                        <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-3)" }}>
                          매핑 프로파일
                        </span>
                        {" "}
                        <div className="segmented">
                          {vals.profileTabs.map((p: any, $index: number) => (
                              <div key={$index} className={`seg ${p.on}`} onClick={p.pick}>
                                {p.label}
                              </div>
                          ))}
                        </div>
                        {" "}
                        <span style={{ flex: "1" }}></span>
                        {" "}
                        <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                          {vals.profileMeta}
                        </span>
                      </div>
                      {" "}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginTop: "12px" }}>
                        {vals.importCounts.map((ic: any, $index: number) => (
                            <div key={$index} style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
                              <div style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                {ic.label}
                              </div>
                              {" "}
                              <div className="v-num" style={{ font: "var(--fw-semi) 24px var(--font-sans)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", color: ic.color, marginTop: "3px" }}>
                                {ic.value}
                              </div>
                            </div>
                        ))}
                      </div>
                      {" "}
                      <div style={{ marginTop: "12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                          <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                            컬럼 매핑
                          </span>
                          {" "}
                          <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                            파일에서 읽은 헤더 → Canonical 필드
                          </span>
                        </div>
                        {" "}
                        <div className="db-table-wrap">
                          <table className="db-table">
                            <thead>
                              <tr>
                                <th>
                                  <span className="db-th">
                                    파일 헤더
                                  </span>
                                </th>
                                {" "}
                                <th>
                                  <span className="db-th">
                                    샘플 값
                                  </span>
                                </th>
                                {" "}
                                <th>
                                  <span className="db-th">
                                    Canonical 필드
                                  </span>
                                </th>
                                {" "}
                                <th>
                                  <span className="db-th">
                                    추론 근거
                                  </span>
                                </th>
                                {" "}
                                <th>
                                  <span className="db-th">
                                    확신도
                                  </span>
                                </th>
                              </tr>
                            </thead>
                            {" "}
                            <tbody>
                              {vals.colRows.map((c: any, $index: number) => (
                                  <tr key={$index} className="fb-row">
                                    <td className="db-td" style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)", whiteSpace: "nowrap" }}>
                                      {c.header}
                                    </td>
                                    {" "}
                                    <td className="db-td" style={{ font: "var(--fw-regular) 11px var(--font-mono)", color: "var(--fg-4)", whiteSpace: "nowrap" }}>
                                      {c.sample}
                                    </td>
                                    {" "}
                                    <td className="db-td" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: c.fieldColor, whiteSpace: "nowrap" }}>
                                      {c.field}
                                    </td>
                                    {" "}
                                    <td className="db-td" style={{ font: "var(--fw-regular) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                      {c.why}
                                    </td>
                                    {" "}
                                    <td className="db-td" style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: c.color }}>
                                      {c.conf}
                                    </td>
                                  </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      {" "}
                      <div style={{ marginTop: "12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                          <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                            {vals.impExcludedLabel}
                          </span>
                          {" "}
                          <span style={{ flex: "1" }}></span>
                          {" "}
                          <button className="v-btn" style={{ height: "26px" }}>
                            오류 행 내려받기
                          </button>
                        </div>
                        {" "}
                        <div style={{ display: "grid" }}>
                          {vals.errRows.map((e: any, $index: number) => (
                              <span key={$index} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderBottom: "1px solid var(--border)" }}>
                                <span className="v-mono" style={{ fontSize: "11px", color: "var(--fg-4)", minWidth: "54px" }}>
                                  {e.row}
                                </span>
                                {" "}
                                <span style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--pnl-neg)" }}>
                                  {e.code}
                                </span>
                                {" "}
                                <span style={{ font: "var(--fw-regular) 12px var(--font-sans)", color: "var(--fg-3)" }}>
                                  {e.msg}
                                </span>
                              </span>
                          ))}
                        </div>
                      </div>
                      {" "}
                      {vals.impRefer && (
                          <div data-s21="import-reference" style={{ marginTop: "12px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", padding: "12px 14px", display: "grid", gap: "8px", background: "var(--bg-subtle)" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <Lic name="calendar" size={14} color="var(--accent)" />
                              {" "}
                              <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                                언제부터 적용되나요
                              </span>
                              {" "}
                              <input className="v-input" type="date" style={{ height: "28px", fontSize: "12px", width: "150px" }} value={vals.impReferDate} onChange={vals.setImpReferDate} />
                            </span>
                            {" "}
                            <span style={{ font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-3)" }}>
                              {vals.impReferNote}
                            </span>
                          </div>
                      )}
                      {" "}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "14px" }}>
                        <span style={{ font: "var(--fw-regular) 12px var(--font-sans)", color: "var(--fg-4)" }}>
                          {vals.impDupNote}
                        </span>
                        {" "}
                        {vals.urlImported && (
                            <span style={{ display: "flex", alignItems: "center", gap: "7px", padding: "0 4px" }}>
                              <span style={{ width: "13px", height: "13px", borderRadius: "3px", border: "1px solid var(--border-strong)", flex: "none" }}></span>
                              {" "}
                              <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-4)" }}>
                                이 URL 기억하기
                              </span>
                              {" "}
                              <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                지원 예정
                              </span>
                            </span>
                        )}
                        {" "}
                        <span style={{ flex: "1" }}></span>
                        {" "}
                        <button className="v-btn" onClick={vals.impEditMap}>
                          매핑 수정
                        </button>
                        {" "}
                        {vals.impCanRun && (
                            <button className="v-btn v-btn--primary" onClick={vals.impRun}>
                              {vals.impRunLabel}
                            </button>
                        )}
                      </div>
                      {" "}
                      {vals.impDone && (
                          <div data-s21="import-digest" style={{ marginTop: "14px", border: "1px solid var(--pnl-pos)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
                              <Lic name="check" size={15} color="var(--pnl-pos)" />
                              {" "}
                              <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                                {vals.impDigestTitle}
                              </span>
                              {" "}
                              <span style={{ flex: "1" }}></span>
                              {" "}
                              <button className="v-btn" style={{ height: "26px" }} onClick={vals.impReset}>
                                다른 파일 가져오기
                              </button>
                            </div>
                            {" "}
                            <div style={{ padding: "10px 14px", display: "grid", gap: "6px" }}>
                              <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                읽지 못해 뺀 행 — 사유별
                              </span>
                              {" "}
                              {vals.impDigest.map((x: any, $index: number) => (
                                  <span key={$index} style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                                    <span className="v-num" style={{ font: "var(--fw-semi) 12px var(--font-mono)", color: x.color, minWidth: "48px" }}>
                                      {x.value}
                                    </span>
                                    {" "}
                                    <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)" }}>
                                      {x.label}
                                    </span>
                                  </span>
                              ))}
                            </div>
                          </div>
                      )}
                    </>
                  )}
                </section>
            )}
            {" "}
            {/* ══════════ 가져오기 기록 ══════════ */}
            {" "}
            {vals.v.sync && (
                <section data-screen-label="가져오기 기록">
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", margin: "12px 14px", padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
                    <Lic name="history" size={14} />
                    {" "}
                    <span style={{ flex: "1", font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-2)", textWrap: "pretty" }}>
                      가져오기는 덮어쓰기가 아니라 쌓기입니다. 각 실행에
                      <span style={{ fontWeight: "var(--fw-semi)" }}>
                        batch_id
                      </span>
                      가 붙어서, 잘못 올린 파일 하나만 골라 되돌릴 수 있습니다. 그 배치로 들어온 행만 사라지고 나머지는 그대로입니다.
                    </span>
                    {" "}
                    <span style={{ position: "relative", flex: "none" }}>
                      <span className="iconbtn" style={{ cursor: "pointer" }} onClick={vals.expSyn.open}>
                        <Lic name="more-horizontal" size={15} />
                      </span>
                      {" "}
                      {vals.expSyn.on && (
                          <span style={{ position: "absolute", zIndex: "90", top: "calc(100% + 6px)", right: "0", width: "258px", textAlign: "left", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-popover)", display: "grid" }} onClick={vals.stopEvt}>
                            <span style={{ display: "block", padding: "9px 12px", borderBottom: "1px solid var(--border)", font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg)" }}>
                              내보내기
                            </span>
                            {" "}
                            <span style={{ display: "block", padding: "9px 12px", font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-4)", borderBottom: "1px solid var(--border)" }}>
                              {vals.expScope}
                            </span>
                            {" "}
                            <span style={{ display: "flex", gap: "6px", padding: "10px 12px" }}>
                              <button className="v-btn" style={{ height: "27px", flex: "1" }}>
                                XLSX
                              </button>
                              {" "}
                              <button className="v-btn" style={{ height: "27px", flex: "1" }}>
                                CSV
                              </button>
                            </span>
                          </span>
                      )}
                    </span>
                  </div>
                  {" "}
                  <div className="db-table-wrap">
                    <table className="db-table">
                      <thead>
                        <tr>
                          <th>
                            <span className="db-th">
                              시각
                            </span>
                          </th>
                          {" "}
                          <th>
                            <span className="db-th">
                              연결
                            </span>
                          </th>
                          {" "}
                          <th>
                            <span className="db-th">
                              유형
                            </span>
                          </th>
                          {" "}
                          <th>
                            <span className="db-th">
                              대상
                            </span>
                          </th>
                          {" "}
                          <th>
                            <span className="db-th" style={{ justifyContent: "flex-end" }}>
                              조회
                            </span>
                          </th>
                          {" "}
                          <th>
                            <span className="db-th" style={{ justifyContent: "flex-end" }}>
                              신규
                            </span>
                          </th>
                          {" "}
                          <th>
                            <span className="db-th" style={{ justifyContent: "flex-end" }}>
                              갱신
                            </span>
                          </th>
                          {" "}
                          <th>
                            <span className="db-th" style={{ justifyContent: "flex-end" }}>
                              실패
                            </span>
                          </th>
                          {" "}
                          <th>
                            <span className="db-th">
                              결과
                            </span>
                          </th>
                          {" "}
                          <th>
                            <span className="db-th">
                              소요
                            </span>
                          </th>
                          {" "}
                          <th></th>
                        </tr>
                      </thead>
                      {" "}
                      <tbody>
                        {vals.syncRows.map((s: any, $index: number) => (
                            <tr key={$index} className="fb-row" style={{ cursor: "pointer" }} onClick={s.click}>
                              <td className="db-td" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-4)", whiteSpace: "nowrap" }}>
                                {s.at}
                              </td>
                              {" "}
                              <td className="db-td" style={{ font: "var(--fw-medium) 13px var(--font-sans)", color: "var(--fg-2)", whiteSpace: "nowrap" }}>
                                {s.conn}
                              </td>
                              {" "}
                              <td className="db-td" style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                {s.type}
                              </td>
                              {" "}
                              <td className="db-td" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-4)" }}>
                                {s.entity}
                              </td>
                              {" "}
                              <td className="db-td fb-cell">
                                {s.fetched}
                              </td>
                              {" "}
                              <td className="db-td fb-cell">
                                {s.created}
                              </td>
                              {" "}
                              <td className="db-td fb-cell">
                                {s.updated}
                              </td>
                              {" "}
                              <td className="db-td fb-cell" style={{ color: s.failColor }}>
                                {s.failed}
                              </td>
                              {" "}
                              <td className="db-td" style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: s.statusColor }}>
                                {s.status}
                              </td>
                              {" "}
                              <td className="db-td fb-cell" style={{ color: "var(--fg-4)" }}>
                                {s.dur}
                              </td>
                              {" "}
                              <td className="db-td" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                {s.canUndo && (
                                    <span className="v-btn" style={{ height: "24px", padding: "0 9px", fontSize: "11px", cursor: "pointer" }} onClick={s.undo}>
                                      되돌리기
                                    </span>
                                )}
                                {" "}
                                {s.undone && (
                                    <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                      되돌림
                                    </span>
                                )}
                              </td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
            )}
            {" "}
            {/* ══════════ 상품 연결 ══════════ */}
            {" "}
            {vals.v.linking && (
                <section data-screen-label="상품 연결" style={{ padding: "14px", maxWidth: "1180px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10px", padding: "0 2px 12px" }}>
                    <span style={{ font: "var(--fw-medium) 12px/1.7 var(--font-sans)", color: "var(--fg-3)", textWrap: "pretty", maxWidth: "780px" }}>
                      마켓에서 들어온 리스팅 중 FlowBase SKU에 아직 붙지 않은 것만 모입니다. 한 번 이어주면 같은 리스팅이 다시 올 때 그 연결이 유지됩니다.
                    </span>
                  </div>
                  {" "}
                  <div className="tabbar" style={{ marginBottom: "12px" }}>
                    {vals.linkTabs.map((t: any, $index: number) => (
                        <span key={$index} className={`tab ${t.on}`} onClick={t.pick}>
                          {t.label}
                          <span className="count">
                            {t.count}
                          </span>
                        </span>
                    ))}
                  </div>
                  {" "}
                  {vals.linkTabTodo && !vals.linkEmpty && (
                      <div data-s21="link-bulk" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", background: "var(--bg-subtle)" }}>
                        <span className="v-btn" style={{ height: "26px", cursor: "pointer" }} onClick={vals.linkPickAll}>
                          {vals.linkPickAllLabel}
                        </span>
                        {" "}
                        <span style={{ flex: "1", minWidth: "0", font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                          여러 카드를 골라 한 번에 등록합니다. 고른 카드는 하나로 합쳐지지 않고 각각 SKU가 됩니다.
                        </span>
                        {" "}
                        {vals.linkPicked && (
                            <span className="v-btn v-btn--primary" style={{ height: "26px", cursor: "pointer", flex: "none" }} onClick={vals.linkBulkNewSku}>
                              {vals.linkPickedLabel}
                            </span>
                        )}
                      </div>
                  )}
                  {" "}
                  {vals.linkEmpty && (
                      <div style={{ border: "1px dashed var(--border)", borderRadius: "var(--r-md)", padding: "40px", textAlign: "center", font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-4)" }}>
                        {vals.linkEmptyMsg}
                      </div>
                  )}
                  {" "}
                  {vals.linkTabCost && (
                      <div data-s21="link-cost-pending" style={{ display: "grid", gap: "10px" }}>
                        {vals.linkCostNote !== "" && (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px", borderRadius: "var(--r-sm)", background: "var(--bg-subtle)", border: "1px solid var(--border)", font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-3)" }}>
                              <Lic name="check" size={13} color="var(--pnl-pos)" />
                              {" "}
                              <span>
                                {vals.linkCostNote}
                              </span>
                            </div>
                        )}
                        {vals.linkCostRows.map((r: any, $index: number) => (
                            <div key={$index} style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "12px 14px", display: "grid", gap: "8px" }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                                <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                                  {r.title}
                                </span>
                                {" "}
                                <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                  {r.meta}
                                </span>
                                {" "}
                                <span style={{ flex: "1" }}></span>
                                {" "}
                                <button className="v-btn" style={{ height: "24px", padding: "0 8px", fontSize: "11px" }} onClick={r.dismiss}>
                                  쓰지 않음
                                </button>
                              </div>
                              {r.hasCands && (
                                  <div style={{ display: "grid", gap: "5px" }}>
                                    {r.cands.map((c: any, $ci: number) => (
                                        <span key={$ci} style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: "0" }}>
                                          <button className={c.cls} style={{ height: "25px", padding: "0 9px", fontSize: "11px", flex: "none" }} onClick={c.pick}>
                                            연결
                                          </button>
                                          {" "}
                                          <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {c.label}
                                          </span>
                                          {" "}
                                          <span style={{ font: "var(--fw-regular) 11px var(--font-sans)", color: "var(--fg-4)", flex: "none" }}>
                                            {c.why}
                                          </span>
                                          {" "}
                                          <span style={{ font: "var(--fw-regular) 10px var(--font-sans)", color: "var(--fg-4)", flex: "none" }}>
                                            {c.dest}
                                          </span>
                                        </span>
                                    ))}
                                  </div>
                              )}
                              {r.noCandNote !== "" && (
                                  <span style={{ font: "var(--fw-regular) 11px/1.5 var(--font-sans)", color: "var(--fg-4)" }}>
                                    {r.noCandNote}
                                  </span>
                              )}
                            </div>
                        ))}
                        {vals.linkCostDismissed.length > 0 && (
                            <div style={{ border: "1px dashed var(--border)", borderRadius: "var(--r-md)", padding: "10px 12px", display: "grid", gap: "5px" }}>
                              <span style={{ font: "var(--fw-semi) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                쓰지 않기로 한 것
                              </span>
                              {vals.linkCostDismissed.map((d: any, $di: number) => (
                                  <span key={$di} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ font: "var(--fw-regular) 12px var(--font-sans)", color: "var(--fg-4)" }}>
                                      {d.label}
                                    </span>
                                    {" "}
                                    <button className="v-btn" style={{ height: "22px", padding: "0 7px", fontSize: "10px" }} onClick={d.undo}>
                                      되돌리기
                                    </button>
                                  </span>
                              ))}
                            </div>
                        )}
                      </div>
                  )}
                  {" "}
                  <div style={{ display: "grid", gap: "10px" }}>
                    {vals.linkRows.map((r: any, $index: number) => (
                        <div key={$index} style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "16px", alignItems: "start", padding: "12px 14px" }}>
                            <div style={{ display: "grid", gap: "5px", minWidth: "0" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                                <span style={{ width: "7px", height: "7px", borderRadius: "2px", background: r.chColor, flex: "none" }}></span>
                                {" "}
                                <span style={{ font: "var(--fw-semi) 11px var(--font-sans)", color: "var(--fg-3)" }}>
                                  {r.ch}
                                </span>
                                {" "}
                                <span className="v-chip" style={{ height: "20px", padding: "0 7px", fontSize: "10px" }}>
                                  {r.src}
                                </span>
                              </div>
                              {" "}
                              <div style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)", textWrap: "pretty" }}>
                                {r.listing}
                              </div>
                              {" "}
                              <div className="v-num" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-4)" }}>
                                {r.ext} · {r.price}
                              </div>
                              {" "}
                              {r.folded && (
                                  <div data-s21="link-cluster" style={{ display: "grid", gap: "4px", marginTop: "2px", paddingLeft: "9px", borderLeft: "1px solid var(--border)" }}>
                                    <span style={{ font: "var(--fw-semi) 11px var(--font-sans)", color: "var(--fg-3)" }}>
                                      {r.foldLabel}
                                    </span>
                                    {" "}
                                    {r.items.map((it: any, $index: number) => (
                                        <span key={$index} style={{ display: "flex", alignItems: "baseline", gap: "8px", minWidth: "0" }}>
                                          <span className="v-num" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {it.ident}
                                          </span>
                                          {" "}
                                          <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)", flex: "none" }}>
                                            {it.ch}
                                          </span>
                                        </span>
                                    ))}
                                  </div>
                              )}
                            </div>
                            {" "}
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: "none" }}>
                              {vals.linkTabTodo && (
                                  <span data-s21="link-newsku" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span className="v-chip" style={{ height: "26px", padding: "0 9px", cursor: "pointer" }} onClick={r.toggle}>
                                      {r.picked ? "선택됨" : "선택"}
                                    </span>
                                    {" "}
                                    <span className={r.newSkuClass} style={{ height: "26px", cursor: "pointer" }} onClick={r.newSku}>
                                      새 SKU로 등록
                                    </span>
                                  </span>
                              )}
                              {" "}
                              {vals.linkTabTodo && (
                                  <span className="v-btn" style={{ height: "26px", cursor: "pointer" }} onClick={r.ignore}>
                                    무시
                                  </span>
                              )}
                              {" "}
                              {vals.linkTabDone && (
                                  <span className="v-btn" style={{ height: "26px", cursor: "pointer" }} onClick={r.undo}>
                                    연결 해제
                                  </span>
                              )}
                              {" "}
                              {vals.linkTabSkip && (
                                  <span className="v-btn" style={{ height: "26px", cursor: "pointer" }} onClick={r.undo}>
                                    되돌리기
                                  </span>
                              )}
                            </div>
                          </div>
                          {" "}
                          {vals.linkTabTodo && r.hasCands && (
                              <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg-subtle)", padding: "10px 14px" }}>
                                <div style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)", marginBottom: "8px" }}>
                                  추천 SKU — 이름과 코드가 겹치는 정도
                                </div>
                                {" "}
                                <div style={{ display: "grid", gap: "6px" }}>
                                  {r.cands.map((c: any, $index: number) => (
                                      <div key={$index} style={{ display: "grid", gridTemplateColumns: "44px minmax(0, 1fr) minmax(0, 1fr) 96px 62px", alignItems: "center", gap: "12px" }}>
                                        <span className="v-num" style={{ font: "var(--fw-semi) 11px var(--font-mono)", color: c.confColor }}>
                                          {c.conf}
                                        </span>
                                        {" "}
                                        <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                          {c.label}
                                        </span>
                                        {" "}
                                        <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                          {c.shared}
                                        </span>
                                        {" "}
                                        <span className="v-num" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                          {c.sku}
                                        </span>
                                        {" "}
                                        <span className={c.pickClass} style={{ height: "24px", padding: "0 10px", fontSize: "11px", cursor: "pointer", justifySelf: "end" }} onClick={c.pick}>
                                          연결
                                        </span>
                                      </div>
                                  ))}
                                </div>
                              </div>
                          )}
                          {" "}
                          {vals.linkTabDone && (
                              <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg-subtle)", padding: "10px 14px", display: "grid", gap: "4px" }}>
                                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                                  <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                    연결됨
                                  </span>
                                  {" "}
                                  <span style={{ font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg)" }}>
                                    {r.linkedLabel}
                                  </span>
                                  {" "}
                                  <span className="v-num" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-4)" }}>
                                    {r.linkedSku}
                                  </span>
                                </div>
                                {" "}
                                <div className="v-num" style={{ font: "var(--fw-medium) 10px var(--font-mono)", color: "var(--fg-4)" }}>
                                  {r.key} — 같은 리스팅이 다시 오면 이 연결이 유지됩니다
                                </div>
                              </div>
                          )}
                        </div>
                    ))}
                  </div>
                </section>
            )}
            {" "}
            {/* ══════════ 필드 매핑 ══════════ */}
            {" "}
            {vals.v.fieldmap && (
                <section data-screen-label="필드 매핑" style={{ padding: "14px" }}>
                  {vals.fmUpdate && (
                      <div style={{ border: "1px solid var(--accent)", borderRadius: "var(--r-md)", overflow: "hidden", marginBottom: "14px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "9px", padding: "12px 14px" }}>
                          <Lic name="download" size={15} color="var(--accent)" />
                          {" "}
                          <span style={{ flex: "1", minWidth: "0", display: "grid", gap: "4px" }}>
                            <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                              {vals.fmUpdateTitle}
                            </span>
                            {" "}
                            <span style={{ font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-3)", textWrap: "pretty" }}>
                              {vals.fmUpdateBody}
                            </span>
                          </span>
                          {" "}
                          <span style={{ display: "flex", gap: "6px", flex: "none" }}>
                            <button className="v-btn" style={{ height: "28px" }} onClick={vals.toggleDiff}>
                              {vals.diffLabel}
                            </button>
                            {" "}
                            <button className="v-btn v-btn--primary" style={{ height: "28px" }} onClick={vals.applyUpdate}>
                              적용
                            </button>
                          </span>
                        </div>
                        {" "}
                        {vals.diffOpen && (
                            <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg-subtle)", padding: "12px 14px", display: "grid", gap: "7px" }}>
                              {vals.diffRows.map((d: any, $index: number) => (
                                  <span key={$index} style={{ display: "grid", gridTemplateColumns: "46px minmax(0, 1fr) 20px minmax(0, 1fr)", gap: "10px", alignItems: "center", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", background: "var(--bg-app)" }}>
                                    <span style={{ font: "var(--fw-semi) 10px var(--font-sans)", color: d.kindColor }}>
                                      {d.kind}
                                    </span>
                                    {" "}
                                    <span className="v-num" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {d.before}
                                    </span>
                                    {" "}
                                    <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)", textAlign: "center" }}>
                                      →
                                    </span>
                                    {" "}
                                    <span className="v-num" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: d.afterColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {d.after}
                                    </span>
                                  </span>
                              ))}
                              {" "}
                              <span style={{ font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                                직접 지정한 매핑은 덮어쓰지 않습니다. 위 변경 중 사용자가 손댄 항목이 있으면 그대로 두고 건너뜁니다.
                              </span>
                            </div>
                        )}
                      </div>
                  )}
                  {" "}
                  <div style={{ font: "var(--fw-medium) 12px/1.7 var(--font-sans)", color: "var(--fg-3)", textWrap: "pretty", maxWidth: "820px", padding: "0 2px 12px" }}>
                    매핑의 단위는 마켓이 아니라 마켓 × 문서 종류입니다. 같은 쿠팡이라도 주문 파일과 정산 파일은 열이 다르고 목적지 엔티티도 다릅니다. 한 번 확인한 양식은 다음 파일에 그대로 다시 쓰입니다.
                  </div>
                  {" "}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(620px, 1fr))", gap: "14px", alignItems: "start" }}>
                    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                          양식
                        </span>
                        {" "}
                        <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                          마켓 × 문서 종류
                        </span>
                      </div>
                      {" "}
                      {vals.fmList.map((f: any, $index: number) => (
                          <div key={$index} className="fb-row" style={{ display: "grid", gap: "4px", padding: "10px 12px 10px 9px", borderBottom: "1px solid var(--border)", borderLeft: `3px solid ${f.edge}`, background: f.bg, cursor: "pointer" }} onClick={f.pick}>
                            <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: "0" }}>
                              <span style={{ width: "7px", height: "7px", borderRadius: "2px", background: f.chColor, flex: "none" }}></span>
                              {" "}
                              <span style={{ font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {f.name}
                              </span>
                              {" "}
                              <span style={{ flex: "1" }}></span>
                              {" "}
                              <span style={{ font: "var(--fw-semi) 10px var(--font-sans)", color: f.stateColor, flex: "none" }}>
                                {f.state}
                              </span>
                            </div>
                            {" "}
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              <span className="v-chip" style={{ height: "20px", padding: "0 7px", fontSize: "10px" }}>
                                {f.doc}
                              </span>
                              {" "}
                              <span className="v-chip" style={{ height: "20px", padding: "0 7px", fontSize: "10px" }}>
                                {f.src}
                              </span>
                              {" "}
                              <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                → {f.dest}
                              </span>
                            </div>
                            {" "}
                            <div className="v-num" style={{ font: "var(--fw-medium) 10px var(--font-mono)", color: "var(--fg-4)" }}>
                              {f.meta}
                            </div>
                          </div>
                      ))}
                    </div>
                    {" "}
                    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                      <div style={{ padding: "11px 12px", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                            {vals.fmTitle}
                          </span>
                          {" "}
                          <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                            {vals.fmChannel} · {vals.fmDoc} · {vals.fmSrc}
                          </span>
                        </div>
                        {" "}
                        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "5px" }}>
                          <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                            목적지
                          </span>
                          {" "}
                          <span className="v-num" style={{ font: "var(--fw-semi) 11px var(--font-mono)", color: "var(--fg-2)" }}>
                            {vals.fmDest}
                          </span>
                          {" "}
                          <span style={{ flex: "1" }}></span>
                          {" "}
                          <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                            {vals.fmSummary}
                          </span>
                        </div>
                      </div>
                      {" "}
                      {vals.fmWarn && (
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 12px", background: "rgba(242,201,76,0.1)", font: "var(--fw-regular) 12px/1.5 var(--font-sans)", color: "var(--fg-2)", borderBottom: "1px solid var(--border)" }}>
                            <Lic name="triangle-alert" size={14} />
                            {" "}
                            <span style={{ flex: "1" }}>
                              {vals.fmWarnText}
                            </span>
                            {" "}
                            {vals.fmConfirmable && (
                                <span className="v-btn v-btn--primary" style={{ height: "26px", cursor: "pointer", flex: "none" }} onClick={vals.confirmFm}>
                                  양식 확인 완료
                                </span>
                            )}
                          </div>
                      )}
                      {" "}
                      <div className="db-table-wrap">
                        <table className="db-table">
                          <thead>
                            <tr>
                              <th>
                                <span className="db-th">
                                  파일 열
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th">
                                  샘플
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th">
                                  Canonical 필드
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th">
                                  근거
                                </span>
                              </th>
                              {" "}
                              <th>
                                <span className="db-th">
                                  신뢰도
                                </span>
                              </th>
                            </tr>
                          </thead>
                          {" "}
                          <tbody>
                            {vals.fmCols.map((c: any, $index: number) => (
                                <tr key={$index} className="fb-row">
                                  <td className="db-td" style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-2)", whiteSpace: "nowrap" }}>
                                    {c.header}
                                  </td>
                                  {" "}
                                  <td className="db-td" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-4)", whiteSpace: "nowrap" }}>
                                    {c.sample}
                                  </td>
                                  {" "}
                                  <td className="db-td">
                                    <select value={c.field} onChange={c.onPick} disabled={c.locked} style={{ maxWidth: "240px", height: "26px", padding: "0 6px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", background: "var(--bg-input)", color: c.fieldColor, font: "var(--fw-semi) 11px var(--font-mono)", outline: "none", cursor: "pointer" }}>
                                      {vals.fmFieldOptions.map((o: any, $index: number) => (
                                          <option key={$index} value={o}>
                                            {o}
                                          </option>
                                      ))}
                                    </select>
                                  </td>
                                  {" "}
                                  <td className="db-td db-td-title" style={{ font: "var(--fw-regular) 12px var(--font-sans)", color: "var(--fg-4)" }}>
                                    {c.why}
                                  </td>
                                  {" "}
                                  <td className="db-td" style={{ font: "var(--fw-semi) 11px var(--font-sans)", color: c.color, whiteSpace: "nowrap" }}>
                                    {c.conf}
                                  </td>
                                </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </section>
            )}
            {" "}
            {/* ══════════ 내 필드 ══════════ */}
            {" "}
            {vals.v.myfields && (
                <section data-screen-label="내 필드" style={{ padding: "14px", maxWidth: "1180px" }}>
                  <div style={{ font: "var(--fw-medium) 12px/1.7 var(--font-sans)", color: "var(--fg-3)", textWrap: "pretty", maxWidth: "820px", padding: "0 2px 12px" }}>
                    Canonical 스키마에 없는 값을 회사 전용으로 더합니다. 기본은 격리입니다 — Profit Engine은 이 필드들을 모르고, 손익 계산에 들어가지 않습니다. 비용으로 넣으려면 Canonical의 Cost 항목에 명시적으로 연결해야 합니다.
                  </div>
                  {" "}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 2px 12px" }}>
                    <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                      {vals.cfSummary}
                    </span>
                    {" "}
                    <span style={{ flex: "1" }}></span>
                    {" "}
                    <span className="v-btn v-btn--primary" style={{ height: "28px", cursor: "pointer" }} onClick={vals.addCf}>
                      필드 추가
                    </span>
                  </div>
                  {" "}
                  <div style={{ display: "grid", gap: "10px" }}>
                    {vals.cfRows.map((f: any, $index: number) => (
                        <div key={$index} style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "12px 14px", display: "grid", gap: "8px", background: f.bg }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", cursor: "pointer" }} onClick={f.toggle}>
                            <span style={{ display: "inline-flex", color: "var(--fg-4)", transform: `rotate(${f.rot})`, transition: "transform .12s ease" }}>
                              <Lic name="chevron-right" size={14} />
                            </span>
                            {" "}
                            <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                              {f.label}
                            </span>
                            {" "}
                            <span className="v-num" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-4)" }}>
                              {f.key}
                            </span>
                            {" "}
                            <span style={{ flex: "1" }}></span>
                            {" "}
                            <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                              {f.hint}
                            </span>
                            {" "}
                            <span style={{ font: "var(--fw-semi) 11px var(--font-sans)", color: f.effectColor }}>
                              {f.effect}
                            </span>
                          </div>
                          {" "}
                          {f.isOpen && (
                              <div style={{ display: "grid", gap: "12px", paddingTop: "4px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px 18px" }}>
                                  <label style={{ display: "grid", gap: "4px", minWidth: "0" }}>
                                    <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                      이름
                                    </span>
                                    {" "}
                                    <input value={f.label} onChange={f.onLabel} style={{ height: "28px", padding: "0 8px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", background: "var(--bg-input)", color: "var(--fg)", font: "var(--fw-medium) 12px var(--font-sans)", outline: "none" }} />
                                  </label>
                                  {" "}
                                  <label style={{ display: "grid", gap: "4px", minWidth: "0" }}>
                                    <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                      키 — 파일 매핑·API에서 쓰는 이름
                                    </span>
                                    {" "}
                                    <input value={f.key} onChange={f.onKey} style={{ height: "28px", padding: "0 8px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", background: "var(--bg-input)", color: "var(--fg)", font: "var(--fw-medium) 12px var(--font-mono)", outline: "none" }} />
                                  </label>
                                </div>
                                {" "}
                                <div style={{ display: "grid", gap: "5px" }}>
                                  <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                    붙는 곳
                                  </span>
                                  {" "}
                                  <div className="segmented" style={{ width: "fit-content" }}>
                                    {f.entities.map((o: any, $index: number) => (
                                        <div key={$index} className={`seg ${o.on}`} onClick={o.pick}>
                                          {o.label}
                                        </div>
                                    ))}
                                  </div>
                                </div>
                                {" "}
                                <div style={{ display: "grid", gap: "5px" }}>
                                  <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                    형식
                                  </span>
                                  {" "}
                                  <div className="segmented" style={{ width: "fit-content" }}>
                                    {f.types.map((o: any, $index: number) => (
                                        <div key={$index} className={`seg ${o.on}`} onClick={o.pick}>
                                          {o.label}
                                        </div>
                                    ))}
                                  </div>
                                </div>
                                {" "}
                                <label style={{ display: "grid", gap: "4px", minWidth: "0" }}>
                                  <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                    {f.optsLabel}
                                  </span>
                                  {" "}
                                  <input value={f.opts} onChange={f.onOpts} style={{ height: "28px", padding: "0 8px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", background: "var(--bg-input)", color: "var(--fg)", font: "var(--fw-medium) 12px var(--font-sans)", outline: "none" }} />
                                </label>
                                {" "}
                                <div style={{ display: "grid", gap: "5px" }}>
                                  <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                    채우는 방법
                                  </span>
                                  {" "}
                                  <div className="segmented" style={{ width: "fit-content" }}>
                                    {f.fills.map((o: any, $index: number) => (
                                        <div key={$index} className={`seg ${o.on}`} onClick={o.pick}>
                                          {o.label}
                                        </div>
                                    ))}
                                  </div>
                                </div>
                                {" "}
                                <div style={{ display: "grid", gap: "5px" }}>
                                  <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                    손익 반영 — 없음이면 Profit Engine이 이 필드를 모릅니다
                                  </span>
                                  {" "}
                                  <div className="segmented" style={{ width: "fit-content" }}>
                                    {f.effects.map((o: any, $index: number) => (
                                        <div key={$index} className={`seg ${o.on}`} onClick={o.pick}>
                                          {o.label}
                                        </div>
                                    ))}
                                  </div>
                                </div>
                                {" "}
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingTop: "4px", borderTop: "1px solid var(--border)" }}>
                                  <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)", paddingTop: "8px" }}>
                                    {f.filled} 채워짐 · {f.used}
                                  </span>
                                  {" "}
                                  <span style={{ flex: "1" }}></span>
                                  {" "}
                                  <span className="v-btn" style={{ height: "26px", cursor: "pointer", marginTop: "8px" }} onClick={f.remove}>
                                    필드 삭제
                                  </span>
                                </div>
                              </div>
                          )}
                          {" "}
                          {f.isClosed && (
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px 18px" }}>
                                <span style={{ display: "grid", gap: "2px", minWidth: "0" }}>
                                  <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                    붙는 곳
                                  </span>
                                  {" "}
                                  <span className="v-num" style={{ font: "var(--fw-semi) 11px var(--font-mono)", color: "var(--fg-2)" }}>
                                    {f.entity}
                                  </span>
                                </span>
                                {" "}
                                <span style={{ display: "grid", gap: "2px", minWidth: "0" }}>
                                  <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                    형식
                                  </span>
                                  {" "}
                                  <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-2)" }}>
                                    {f.type} · {f.opts}
                                  </span>
                                </span>
                                {" "}
                                <span style={{ display: "grid", gap: "2px", minWidth: "0" }}>
                                  <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                    채우는 방법
                                  </span>
                                  {" "}
                                  <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-2)", textWrap: "pretty" }}>
                                    {f.fill}
                                  </span>
                                </span>
                                {" "}
                                <span style={{ display: "grid", gap: "2px", minWidth: "0" }}>
                                  <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                    채워진 정도
                                  </span>
                                  {" "}
                                  <span className="v-num" style={{ font: "var(--fw-semi) 11px var(--font-mono)", color: "var(--fg-2)" }}>
                                    {f.filled}
                                  </span>
                                </span>
                                {" "}
                                <span style={{ display: "grid", gap: "2px", minWidth: "0" }}>
                                  <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                    쓰이는 곳
                                  </span>
                                  {" "}
                                  <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-2)" }}>
                                    {f.used}
                                  </span>
                                </span>
                              </div>
                          )}
                        </div>
                    ))}
                  </div>
                </section>
            )}
            {" "}
            {/* ══════════ 데이터 구조 ══════════ */}
            {" "}
            {vals.v.design && (
                <section data-screen-label="데이터 구조" style={{ padding: "14px", maxWidth: "1180px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--bg-subtle)", border: "1px solid var(--border)", marginBottom: "14px" }}>
                    <Lic name="lock" size={14} />
                    {" "}
                    <span style={{ flex: "1", font: "var(--fw-regular) 12px/1.6 var(--font-sans)", color: "var(--fg-2)", textWrap: "pretty" }}>
                      이 스키마는 편집하지 않습니다. Canonical이 고정되어야 마켓이 늘어나도 Profit Engine이 그대로 남습니다. 회사에 필요한 값을 더하려면
                      <span style={{ fontWeight: "var(--fw-semi)" }}>
                        내 필드
                      </span>
                      에서 만들고, 파일 열을 여기에 붙이려면
                      <span style={{ fontWeight: "var(--fw-semi)" }}>
                        필드 매핑
                      </span>
                      에서 지정합니다.
                    </span>
                    {" "}
                    <span className="v-btn" style={{ height: "26px", cursor: "pointer", flex: "none" }} onClick={vals.go.myfields}>
                      내 필드
                    </span>
                  </div>
                  {" "}
                  <div style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)", marginBottom: "10px" }}>
                    입력 → Canonical → Core
                  </div>
                  {" "}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px", alignItems: "stretch" }}>
                    {vals.pipeline.map((p: any, $index: number) => (
                        <div key={$index} style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                            <span style={{ width: "20px", height: "20px", borderRadius: "var(--r-xs)", background: "var(--bg-elevated-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", font: "var(--fw-semi) 10px var(--font-mono)", color: p.color }}>
                              {p.n}
                            </span>
                            {" "}
                            <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                              {p.title}
                            </span>
                          </div>
                          {" "}
                          <div style={{ font: "var(--fw-regular) 11px/1.55 var(--font-sans)", color: "var(--fg-4)" }}>
                            {p.desc}
                          </div>
                          {" "}
                          <div style={{ display: "grid", gap: "3px", marginTop: "auto" }}>
                            {p.items.map((it: any, $index: number) => (
                                <span key={$index} style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-3)" }}>
                                  {it}
                                </span>
                            ))}
                          </div>
                        </div>
                    ))}
                  </div>
                  {" "}
                  <div style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)", margin: "20px 0 10px" }}>
                    Canonical Commerce Schema
                  </div>
                  {" "}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "10px" }}>
                    {vals.entities.map((e: any, $index: number) => (
                        <div key={$index} style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "7px", padding: "9px 11px", borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)" }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "2px", background: e.color }}></span>
                            {" "}
                            <span style={{ font: "var(--fw-semi) 12px var(--font-mono)", color: "var(--fg)" }}>
                              {e.name}
                            </span>
                            {" "}
                            <span style={{ flex: "1" }}></span>
                            {" "}
                            <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                              {e.note}
                            </span>
                          </div>
                          {" "}
                          <div style={{ display: "grid", padding: "7px 11px 9px" }}>
                            {e.fields.map((f: any, $index: number) => (
                                <span key={$index} style={{ display: "flex", alignItems: "baseline", gap: "8px", padding: "2px 0" }}>
                                  <span style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: f.color }}>
                                    {f.name}
                                  </span>
                                  {" "}
                                  <span style={{ flex: "1" }}></span>
                                  {" "}
                                  <span style={{ font: "var(--fw-regular) 10px var(--font-mono)", color: "var(--fg-4)" }}>
                                    {f.type}
                                  </span>
                                </span>
                            ))}
                          </div>
                        </div>
                    ))}
                  </div>
                  {" "}
                  <div style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)", margin: "20px 0 10px" }}>
                    Profit Engine — 마켓을 모르는 단일 공식
                  </div>
                  {" "}
                  <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "14px", display: "grid", gap: "3px", maxWidth: "460px" }}>
                    {vals.formula.map((f: any, $index: number) => (
                        <span key={$index} style={{ display: "flex", alignItems: "baseline", gap: "10px", padding: "3px 0", borderTop: f.rule }}>
                          <span style={{ width: "12px", font: "var(--fw-semi) 12px var(--font-mono)", color: f.opColor }}>
                            {f.op}
                          </span>
                          {" "}
                          <span style={{ font: "var(--fw-medium) 12px var(--font-mono)", color: f.color }}>
                            {f.name}
                          </span>
                          {" "}
                          <span style={{ flex: "1" }}></span>
                          {" "}
                          <span className="v-num" style={{ font: "var(--fw-medium) 12px var(--font-mono)", color: f.color }}>
                            {f.value}
                          </span>
                        </span>
                    ))}
                  </div>
                </section>
            )}
            {" "}
            {/* ══════════ 설정 ══════════ */}
            {" "}
            {vals.v.settings && (
                <section data-screen-label="설정" style={{ padding: "14px", maxWidth: "1020px", display: "grid", gridTemplateColumns: "168px minmax(0, 1fr)", gap: "18px", alignItems: "start" }}>
                  <div style={{ display: "grid", gap: "1px", position: "sticky", top: "0" }}>
                    {vals.setSections.map((s: any, $index: number) => (
                        <span key={$index} className={`nav-item ${s.on}`} style={{ height: "30px" }} onClick={s.pick}>
                          <span>
                            {s.label}
                          </span>
                        </span>
                    ))}
                  </div>
                  {" "}
                  <div style={{ minWidth: "0" }}>
                    {vals.ssLic && (
                        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                            <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                              라이선스
                            </span>
                            {" "}
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", height: "20px", padding: "0 8px", borderRadius: "var(--r-pill)", background: vals.licBg, font: "var(--fw-semi) 11px var(--font-sans)", color: vals.licColor }}>
                              <span style={{ width: "5px", height: "5px", borderRadius: "999px", background: vals.licColor }}></span>
                              {" "}
                              <span>
                                {vals.licState}
                              </span>
                            </span>
                            {" "}
                            <span style={{ flex: "1" }}></span>
                            {" "}
                            <div className="segmented">
                              {vals.licTabs.map((t: any, $index: number) => (
                                  <div key={$index} className={`seg ${t.on}`} onClick={t.pick}>
                                    {t.label}
                                  </div>
                              ))}
                            </div>
                          </div>
                          {" "}
                          <div style={{ padding: "13px 12px", display: "grid", gap: "11px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <input className="v-input" style={{ flex: "1", minWidth: "260px", height: "30px", font: "var(--fw-medium) 12px var(--font-mono)" }} value={vals.licKey} onChange={vals.setLicKey} placeholder="FB-XXXX-XXXX-XXXX-XXXX" />
                              {" "}
                              <button className="v-btn v-btn--primary" style={{ height: "30px" }}>
                                {vals.licAction}
                              </button>
                            </div>
                            {" "}
                            {vals.licActive && (
                                <span style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1px", background: "var(--border)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>
                                  <span style={{ display: "grid", gap: "3px", padding: "10px 12px", background: "var(--bg-app)" }}>
                                    <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                      플랜
                                    </span>
                                    {" "}
                                    <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                                      {vals.licPlan}
                                    </span>
                                  </span>
                                  {" "}
                                  <span style={{ display: "grid", gap: "3px", padding: "10px 12px", background: "var(--bg-app)" }}>
                                    <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                      다음 갱신
                                    </span>
                                    {" "}
                                    <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                                      {vals.licRenew}
                                    </span>
                                  </span>
                                  {" "}
                                  <span style={{ display: "grid", gap: "3px", padding: "10px 12px", background: "var(--bg-app)" }}>
                                    <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                      채널
                                    </span>
                                    {" "}
                                    <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                                      {vals.licChannels}
                                    </span>
                                  </span>
                                </span>
                            )}
                            {" "}
                            <span style={{ display: "flex", alignItems: "center", gap: "10px", font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-4)", flexWrap: "wrap" }}>
                              <span>
                                {vals.licNote}
                              </span>
                              {" "}
                              <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: "3px", font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--accent)", textDecoration: "none" }}>
                                <span>
                                  {vals.licLink}
                                </span>
                                {" "}
                                <Lic name="arrow-up-right" size={11} />
                              </a>
                            </span>
                          </div>
                        </div>
                    )}
                    {" "}
                    {vals.ssGen && (
                        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                            일반
                          </div>
                          {" "}
                          {vals.genRows.map((g: any, $index: number) => (
                              <span key={$index} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "11px 12px", borderBottom: "1px solid var(--border)" }}>
                                <span style={{ display: "grid", gap: "2px", minWidth: "0", flex: "1" }}>
                                  <span style={{ font: "var(--fw-medium) 13px var(--font-sans)", color: "var(--fg-2)" }}>
                                    {g.label}
                                  </span>
                                  {" "}
                                  <span style={{ font: "var(--fw-regular) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                    {g.desc}
                                  </span>
                                </span>
                                {" "}
                                {g.isSeg && (
                                    <span className="segmented" style={{ flex: "none" }}>
                                      {g.opts.map((o: any, $index: number) => (
                                          <span key={$index} className={`seg ${o.on}`} onClick={o.pick}>
                                            {o.label}
                                          </span>
                                      ))}
                                    </span>
                                )}
                                {" "}
                                {g.isToggle && (
                                    <span style={{ width: "34px", height: "20px", borderRadius: "999px", background: g.tBg, border: `1px solid ${g.tBorder}`, position: "relative", cursor: "pointer", flex: "none", transition: "background .12s ease" }} onClick={g.toggle}>
                                      <span style={{ position: "absolute", top: "2px", left: g.tX, width: "14px", height: "14px", borderRadius: "999px", background: g.tKnob, transition: "left .12s ease" }}></span>
                                    </span>
                                )}
                              </span>
                          ))}
                          {" "}
                          <div style={{ padding: "10px 12px", font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-4)" }}>
                            설정은 이 컴퓨터에만 저장됩니다.
                          </div>
                        </div>
                    )}
                    {" "}
                    {vals.ssData && (
                      <>
                        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                            Credential
                          </div>
                          {" "}
                          <div style={{ display: "grid" }}>
                            {vals.creds.map((c: any, $index: number) => (
                                <span key={$index} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "11px 12px", borderBottom: "1px solid var(--border)" }}>
                                  <span style={{ font: "var(--fw-medium) 13px var(--font-sans)", color: "var(--fg-2)", minWidth: "150px" }}>
                                    {c.name}
                                  </span>
                                  {" "}
                                  <span style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-4)" }}>
                                    {c.ref}
                                  </span>
                                  {" "}
                                  <span style={{ flex: "1" }}></span>
                                  {" "}
                                  <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: c.color }}>
                                    {c.state}
                                  </span>
                                  {" "}
                                  <button className="v-btn" style={{ height: "26px" }}>
                                    교체
                                  </button>
                                </span>
                            ))}
                          </div>
                          {" "}
                          <div style={{ padding: "10px 12px", font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-4)" }}>
                            이 키는 이 컴퓨터에만 저장됩니다. FlowBase는 참조만 들고 있고, 실제 값은 로컬 암호화 저장소에 있습니다. 서버로 올라가지 않습니다.
                          </div>
                        </div>
                        {" "}
                        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden", marginTop: "12px" }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                            <span style={{ font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                              사용자 조정 (Adjustment Layer)
                            </span>
                            {" "}
                            <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                              원본은 그대로 두고 위에 얹습니다 — 다시 가져와도 유지됩니다
                            </span>
                          </div>
                          {" "}
                          <div className="db-table-wrap">
                            <table className="db-table">
                              <thead>
                                <tr>
                                  <th>
                                    <span className="db-th">
                                      대상
                                    </span>
                                  </th>
                                  {" "}
                                  <th>
                                    <span className="db-th">
                                      필드
                                    </span>
                                  </th>
                                  {" "}
                                  <th>
                                    <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                      원본
                                    </span>
                                  </th>
                                  {" "}
                                  <th>
                                    <span className="db-th" style={{ justifyContent: "flex-end" }}>
                                      조정 후
                                    </span>
                                  </th>
                                  {" "}
                                  <th>
                                    <span className="db-th">
                                      사유
                                    </span>
                                  </th>
                                  {" "}
                                  <th>
                                    <span className="db-th">
                                      작성
                                    </span>
                                  </th>
                                </tr>
                              </thead>
                              {" "}
                              <tbody>
                                {vals.adjRows.map((a: any, $index: number) => (
                                    <tr key={$index} className="fb-row">
                                      <td className="db-td" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-3)", whiteSpace: "nowrap" }}>
                                        {a.target}
                                      </td>
                                      {" "}
                                      <td className="db-td" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-4)" }}>
                                        {a.field}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell">
                                        {a.before}
                                      </td>
                                      {" "}
                                      <td className="db-td fb-cell" style={{ color: "var(--pnl-warn)", fontWeight: "var(--fw-semi)" }}>
                                        {a.after}
                                      </td>
                                      {" "}
                                      <td className="db-td" style={{ font: "var(--fw-regular) 12px var(--font-sans)", color: "var(--fg-3)" }}>
                                        {a.reason}
                                      </td>
                                      {" "}
                                      <td className="db-td" style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)", whiteSpace: "nowrap" }}>
                                        {a.by}
                                      </td>
                                    </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        {" "}
                        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden", marginTop: "12px" }}>
                          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--fg)" }}>
                            저장 위치
                          </div>
                          {" "}
                          <div style={{ padding: "12px", display: "grid", gap: "9px" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                              <span style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-3)" }}>
                                ~/Library/Application Support/FlowBase/flowbase.db
                              </span>
                              {" "}
                              <span style={{ flex: "1" }}></span>
                              {" "}
                              <button className="v-btn" style={{ height: "26px" }}>
                                폴더 열기
                              </button>
                              {" "}
                              <button className="v-btn" style={{ height: "26px" }}>
                                백업 내보내기
                              </button>
                            </span>
                            {" "}
                            <span style={{ font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-4)" }}>
                              모든 데이터는 이 파일 하나에 들어 있습니다. 앱을 지워도 이 파일을 옮기면 그대로 이어집니다.
                            </span>
                          </div>
                        </div>
                        {" "}
                        <div style={{ border: "1px solid var(--pnl-neg)", borderRadius: "var(--r-md)", overflow: "hidden", marginTop: "12px" }}>
                          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", font: "var(--fw-semi) 13px var(--font-sans)", color: "var(--pnl-neg)" }}>
                            전체 초기화
                          </div>
                          {" "}
                          <div style={{ padding: "12px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                            <span style={{ flex: "1", minWidth: "260px", font: "var(--fw-regular) 11px/1.6 var(--font-sans)", color: "var(--fg-3)", textWrap: "pretty" }}>
                              가져온 데이터, 직접 입력한 원가와 조정, 저장된 뷰, 연결 정보가 모두 사라집니다. 되돌릴 수 없습니다.
                            </span>
                            {" "}
                            <button className="v-btn" style={{ height: "28px", color: "var(--pnl-neg)", borderColor: "var(--pnl-neg)" }} onClick={vals.askReset}>
                              전체 초기화
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </section>
            )}
          </div>
          {" "}
          {vals.confirm && (
              <span className="fb-modal-scrim" style={{ position: "fixed", inset: "0", zIndex: "300", background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={vals.closeConfirm}>
                <span style={{ width: "460px", maxWidth: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-modal)", overflow: "hidden" }} onClick={vals.stopEvt}>
                  <span style={{ display: "block", padding: "16px 18px 0", font: "var(--fw-semi) 15px var(--font-sans)", color: "var(--fg)" }}>
                    {vals.confirm.title}
                  </span>
                  {" "}
                  <span style={{ display: "block", padding: "8px 18px 0", font: "var(--fw-regular) 12px/1.7 var(--font-sans)", color: "var(--fg-3)", textWrap: "pretty" }}>
                    {vals.confirm.body}
                  </span>
                  {" "}
                  {vals.confirm.hasRows && (
                      <span style={{ display: "grid", gap: "1px", margin: "14px 18px 0", background: "var(--border)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>
                        {vals.confirm.rows.map((r: any, $index: number) => (
                            <span key={$index} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", padding: "9px 12px", background: "var(--bg-app)" }}>
                              <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-3)" }}>
                                {r.k}
                              </span>
                              {" "}
                              <span className="v-num" style={{ font: "var(--fw-semi) 12px var(--font-mono)", color: "var(--fg)" }}>
                                {r.v}
                              </span>
                            </span>
                        ))}
                      </span>
                  )}
                  {" "}
                  {vals.confirm.hasChoice && (
                      <span style={{ display: "grid", gap: "7px", margin: "14px 18px 0" }}>
                        {vals.confirm.choices.map((c: any, $index: number) => (
                            <span key={$index} style={{ display: "flex", alignItems: "flex-start", gap: "9px", padding: "10px 12px", border: `1px solid ${c.border}`, borderRadius: "var(--r-sm)", background: c.bg, cursor: "pointer" }} onClick={c.pick}>
                              <span style={{ width: "14px", height: "14px", borderRadius: "999px", border: `1.5px solid ${c.dot}`, marginTop: "1px", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ width: "6px", height: "6px", borderRadius: "999px", background: c.fill }}></span>
                              </span>
                              {" "}
                              <span style={{ display: "grid", gap: "2px", minWidth: "0" }}>
                                <span style={{ font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg-2)" }}>
                                  {c.label}
                                </span>
                                {" "}
                                <span style={{ font: "var(--fw-regular) 11px/1.5 var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                                  {c.desc}
                                </span>
                              </span>
                            </span>
                        ))}
                      </span>
                  )}
                  {" "}
                  {vals.confirm.hasType && (
                      <span style={{ display: "grid", gap: "6px", margin: "14px 18px 0" }}>
                        <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-3)" }}>
                          계속하려면
                          <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg)" }}>
                            FlowBase
                          </span>
                          를 입력하세요
                        </span>
                        {" "}
                        <input className="v-input" style={{ height: "30px", fontFamily: "var(--font-mono)", fontSize: "12px" }} value={vals.confirmType} onChange={vals.setConfirmType} placeholder="FlowBase" />
                      </span>
                  )}
                  {" "}
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "7px", padding: "16px 18px 16px" }}>
                    <button className="v-btn" style={{ height: "30px" }} onClick={vals.closeConfirm}>
                      취소
                    </button>
                    {" "}
                    <button className="v-btn" style={{ height: "30px", color: vals.confirm.btnFg, borderColor: vals.confirm.btnBorder, opacity: vals.confirm.btnOp }} onClick={vals.confirm.run}>
                      {vals.confirm.confirmLabel}
                    </button>
                  </span>
                </span>
              </span>
          )}
          {" "}
          {/* ══════════ 상세 패널 ══════════ */}
          {" "}
          {vals.hasDetail && (
              <aside className="detail-side" style={{ width: "320px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <span style={{ minWidth: "0" }}>
                    <span style={{ display: "block", font: "var(--fw-semi) 14px var(--font-sans)", color: "var(--fg)" }}>
                      {vals.detail.title}
                    </span>
                    {" "}
                    <span style={{ display: "block", marginTop: "3px", font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                      {vals.detail.sub}
                    </span>
                  </span>
                  {" "}
                  <span style={{ flex: "1" }}></span>
                  {" "}
                  <span className="iconbtn" style={{ cursor: "pointer" }} onClick={vals.closeDetail}>
                    <Lic name="x" size={15} />
                  </span>
                </div>
                {" "}
                <div className="side-group" style={{ marginTop: "14px" }}>
                  <div style={{ font: "var(--fw-semi) 11px var(--font-sans)", color: "var(--fg-4)", marginBottom: "6px" }}>
                    손익 계산
                  </div>
                  {" "}
                  {vals.detail.lines.map((l: any, $index: number) => (
                      <span key={$index} style={{ display: "flex", alignItems: "baseline", gap: "8px", padding: "3px 0", borderTop: l.rule }}>
                        <span style={{ width: "10px", font: "var(--fw-semi) 11px var(--font-mono)", color: l.opColor }}>
                          {l.op}
                        </span>
                        {" "}
                        <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: l.labColor }}>
                          {l.label}
                        </span>
                        {" "}
                        <span style={{ flex: "1" }}></span>
                        {" "}
                        <span className="v-num" style={{ font: `${l.font} var(--font-mono)`, color: l.color }}>
                          {l.value}
                        </span>
                      </span>
                  ))}
                </div>
                {" "}
                <div className="side-group">
                  <div style={{ font: "var(--fw-semi) 11px var(--font-sans)", color: "var(--fg-4)", marginBottom: "6px" }}>
                    데이터 출처
                  </div>
                  {" "}
                  {vals.detail.prov.map((p: any, $index: number) => (
                      <span key={$index} className="prop-line" style={{ cursor: "default" }}>
                        <span className="pl-label">
                          {p.label}
                        </span>
                        {" "}
                        <span style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: p.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.value}
                        </span>
                      </span>
                  ))}
                </div>
                {" "}
                {vals.detail.hasMerge && (
                    <div className="side-group">
                      <div style={{ font: "var(--fw-semi) 11px var(--font-sans)", color: "var(--fg-4)", marginBottom: "6px" }}>
                        값 병합
                      </div>
                      {" "}
                      {vals.detail.merge.map((m: any, $index: number) => (
                          <span key={$index} style={{ display: "block", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "8px 10px", marginBottom: "6px" }}>
                            <span style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "6px" }}>
                              <span style={{ font: "var(--fw-semi) 12px var(--font-sans)", color: "var(--fg-2)" }}>
                                {m.label}
                              </span>
                              {" "}
                              <span style={{ font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)" }}>
                                {m.unit}
                              </span>
                            </span>
                            {" "}
                            <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px", padding: "2px 0" }}>
                              <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                                원본
                              </span>
                              {" "}
                              <span className="v-num" style={{ font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--fg-3)" }}>
                                {m.origin}
                              </span>
                            </span>
                            {" "}
                            {m.adjusted && (
                                <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px", padding: "2px 0" }}>
                                  <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--pnl-warn)" }}>
                                    조정
                                  </span>
                                  {" "}
                                  <span className="v-num" style={{ font: "var(--fw-semi) 11px var(--font-mono)", color: "var(--pnl-warn)" }}>
                                    {m.delta}
                                  </span>
                                </span>
                            )}
                            {" "}
                            <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px", padding: "4px 0 0", marginTop: "3px", borderTop: "1px solid var(--border)" }}>
                              <span style={{ font: "var(--fw-semi) 11px var(--font-sans)", color: "var(--fg-2)" }}>
                                표시값
                              </span>
                              {" "}
                              <span className="v-num" style={{ font: "var(--fw-semi) 12px var(--font-mono)", color: m.effColor }}>
                                {m.effective}
                              </span>
                            </span>
                            {" "}
                            {m.adjusted && (
                                <span style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "7px" }}>
                                  <span style={{ flex: "1", font: "var(--fw-medium) 10px var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                                    {m.reason}
                                  </span>
                                  {" "}
                                  <span className="v-btn" style={{ height: "24px", padding: "0 9px", fontSize: "11px", cursor: "pointer", flex: "none" }} onClick={m.remove}>
                                    조정 제거
                                  </span>
                                </span>
                            )}
                            {" "}
                            {m.notAdjusted && (
                                <span style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "7px" }}>
                                  <span style={{ flex: "1", font: "var(--fw-medium) 10px var(--font-mono)", color: "var(--fg-4)" }}>
                                    {m.src}
                                  </span>
                                  {" "}
                                  <span className="v-btn" style={{ height: "24px", padding: "0 9px", fontSize: "11px", cursor: "pointer", flex: "none" }} onClick={m.add}>
                                    조정 추가
                                  </span>
                                </span>
                            )}
                          </span>
                      ))}
                      {" "}
                      <span style={{ display: "block", font: "var(--fw-medium) 10px/1.6 var(--font-sans)", color: "var(--fg-4)", textWrap: "pretty" }}>
                        {vals.detail.mergeNote}
                      </span>
                    </div>
                )}
                {" "}
                {vals.detail.hasAdj && (
                    <div className="side-group">
                      <div style={{ font: "var(--fw-semi) 11px var(--font-sans)", color: "var(--fg-4)", marginBottom: "6px" }}>
                        사용자 조정
                      </div>
                      {" "}
                      {vals.detail.adj.map((a: any, $index: number) => (
                          <span key={$index} style={{ display: "block", padding: "8px 10px", borderRadius: "var(--r-sm)", background: "rgba(242,201,76,0.1)", marginBottom: "6px" }}>
                            <span style={{ display: "block", font: "var(--fw-medium) 11px var(--font-mono)", color: "var(--pnl-warn)" }}>
                              {a.head}
                            </span>
                            {" "}
                            <span style={{ display: "block", marginTop: "3px", font: "var(--fw-regular) 11px/1.5 var(--font-sans)", color: "var(--fg-3)" }}>
                              {a.body}
                            </span>
                          </span>
                      ))}
                    </div>
                )}
                {" "}
                {vals.detail.hasActions && (
                    <div style={{ display: "flex", gap: "6px" }}>
                      {vals.detail.actions.map((a: any, $index: number) => (
                          <button key={$index} className="v-btn" style={{ height: "28px" }} onClick={a.run}>
                            {a.label}
                          </button>
                      ))}
                    </div>
                )}
              </aside>
          )}
        </div>
      </main>
      {" "}
      {/* ══════════ ⌘K ══════════ */}
      {" "}
      {vals.cmdOpen && (
          <div className="cmd-scrim" onClick={vals.closeCmd}>
            <div className="cmd" onClick={vals.stop}>
              <div className="cmd-input-row">
                <Lic name="search" size={17} color="var(--fg-3)" />
                {" "}
                <input autoFocus={true} placeholder="이동 · 가져오기 · SKU 검색…" value={vals.cmdQuery} onChange={vals.onCmdInput} onKeyDown={vals.onCmdKey} />
                {" "}
                <span className="v-mono" style={{ color: "var(--fg-4)" }}>
                  esc
                </span>
              </div>
              {" "}
              <div className="cmd-list">
                {vals.cmdEmpty && (
                    <div className="search-empty">
                      결과 없음
                    </div>
                )}
                {" "}
                {vals.cmdItems.map((c: any, $index: number) => (
                    <div key={$index} className={`cmd-item ${c.on}`} onClick={c.run}>
                      <span className="ci-icon">
                        <Lic name={c.icon} size={16} />
                      </span>
                      {" "}
                      <span>
                        {c.label}
                      </span>
                      {" "}
                      <span className="ci-sub">
                        {c.sub}
                      </span>
                    </div>
                ))}
              </div>
            </div>
          </div>
      )}
      {" "}
      {/* ══════════ 연결 모달 ══════════ */}
      {" "}
      {vals.modalOpen && (
          <div style={{ position: "fixed", inset: "0", background: "var(--scrim)", zIndex: "80", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={vals.closeModal}>
            <div style={{ width: "min(440px, 100%)", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-modal)", padding: "20px" }} onClick={vals.stop}>
              <div style={{ font: "var(--fw-semi) 16px var(--font-sans)", color: "var(--fg)" }}>
                {vals.modal.title}
              </div>
              {" "}
              <div style={{ marginTop: "6px", font: "var(--fw-regular) 12px/1.55 var(--font-sans)", color: "var(--fg-3)" }}>
                {vals.modal.desc}
              </div>
              {" "}
              <div style={{ display: "grid", gap: "11px", marginTop: "16px" }}>
                {vals.modal.fields.map((f: any, $index: number) => (
                    <label key={$index} style={{ display: "grid", gap: "5px" }}>
                      <span style={{ font: "var(--fw-medium) 12px var(--font-sans)", color: "var(--fg-3)" }}>
                        {f.label}
                      </span>
                      {" "}
                      <input className="v-input" placeholder={f.ph} type={f.type} />
                    </label>
                ))}
              </div>
              {" "}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "16px" }}>
                <button className="v-btn" onClick={vals.closeModal}>
                  취소
                </button>
                {" "}
                <span style={{ flex: "1" }}></span>
                {" "}
                <button className="v-btn">
                  연결 테스트
                </button>
                {" "}
                <button className="v-btn v-btn--primary" onClick={vals.closeModal}>
                  연결
                </button>
              </div>
            </div>
          </div>
      )}
      {" "}
      {vals.quadFull && (
          <span className="fb-quad-full">
            <span style={{ display: "flex", alignItems: "center", gap: "10px", padding: "11px 14px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ font: "var(--fw-semi) 14px var(--font-sans)", color: "var(--fg)" }}>
                포지셔닝
              </span>
              {" "}
              <span style={{ font: "var(--fw-medium) 11px var(--font-sans)", color: "var(--fg-4)" }}>
                가로 매출 · 세로 이익률
              </span>
              {" "}
              <span style={{ flex: "1" }}></span>
              {" "}
              <span className="iconbtn" style={{ cursor: "pointer" }} onClick={vals.closeQuadFull}>
                <Lic name="x" size={16} />
              </span>
            </span>
            {" "}
            <span style={{ position: "relative", margin: "16px 16px 20px", borderLeft: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
              <span style={{ position: "absolute", left: "0", right: "0", top: vals.quadHy, borderTop: "1px dashed var(--border-strong)" }}></span>
              {" "}
              <span style={{ position: "absolute", top: "0", bottom: "0", left: vals.quadVx, borderLeft: "1px dashed var(--border-strong)" }}></span>
              {" "}
              {vals.quadLabels.map((q: any, $index: number) => (
                  <span key={$index} style={{ position: "absolute", left: q.x, top: q.y, font: "var(--fw-semi) 10px var(--font-sans)", color: q.color, opacity: "0.75" }}>
                    {q.label}
                  </span>
              ))}
              {" "}
              {vals.quadDots.map((d: any, $index: number) => (
                  <span key={$index} style={{ position: "absolute", left: d.x, top: d.y, width: d.size, height: d.size, marginLeft: d.off, marginTop: d.off, borderRadius: "999px", background: d.bg, border: `1.5px solid ${d.color}` }} onClick={d.pick}></span>
              ))}
            </span>
          </span>
      )}
      {" "}
      <span className="fb-tabbar">
        {vals.tabbar.map((t: any, $index: number) => (
            <span key={$index} className={t.on} onClick={t.pick}>
              <Lic name={t.icon} size={19} />
              {" "}
              <span>
                {t.label}
              </span>
            </span>
        ))}
      </span>
    </div>
  )
}
