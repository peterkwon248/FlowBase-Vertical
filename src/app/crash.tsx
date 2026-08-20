/**
 * 앱이 죽었을 때 **빈 흰 창을 남기지 않는다** (2026-08-20 · 조사 3.9 · LOCK 6).
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 무엇이 아팠나 ★
 *
 * `main.tsx`가 `createRoot(root).render(<App />)` 하나였고 저장소 전체에
 * `ErrorBoundary`·`componentDidCatch`·`window.onerror`·`unhandledrejection`이
 * **0건**이었다.
 *
 * React 19는 렌더 예외를 잡아 줄 경계가 없으면 **트리를 통째로 언마운트한다.**
 * 브라우저라면 콘솔에 스택이라도 남지만 **릴리즈 웹뷰에는 콘솔이 없다** —
 * 사용자가 보는 것은 **아무 글자도 없는 흰 창** 하나다. 무엇이 잘못됐는지,
 * 데이터가 남아 있는지, 무엇을 하면 되는지 알 방법이 0이다.
 *
 * 「조용한 실패 금지」(LOCK 6)가 금지하는 것의 가장 큰 판이다.
 *
 * ★ 그래서 여기서 지키는 것 셋 ★
 *
 *   ① **무슨 일이 났는지 말한다** — 사고가 났다는 사실과 오류 원문
 *   ② **데이터가 안전하다고 말한다** — 이건 참이다. 화면이 죽은 것이지 DB는
 *      멀쩡하다(쓰기는 트랜잭션이고, 이 경계는 렌더 단계에서만 잡는다).
 *      이 한 줄이 없으면 사용자는 «내 데이터도 날아갔나»부터 걱정한다
 *   ③ **다음 동작을 준다** — 다시 시도(리로드). 되돌릴 길이 있다고 말한다
 *
 * ★ 왜 React 컴포넌트가 아니라 DOM인가 ★
 * 경계 자체는 클래스 컴포넌트지만, **그리는 화면은 순수 DOM**이다. 방금 React가
 * 죽은 자리에서 React로 오류를 그리면 그 렌더가 또 죽을 수 있다. 오류 화면은
 * 앱의 어떤 코드에도 기대지 않는다 — `vals`도 `Template`도 쓰지 않는다.
 *
 * ★ 목업 밖이다 ★ 동결 목업에 이 표면이 없다. `webDemoBanner`와 같은 판단으로
 * **문서 수준**에 그린다(§21 개정 없이 가려면 목업 밖이어야 한다). 그리고 이
 * 화면은 어느 화면에 있든 참이라 한 화면에 매달 이유가 없다.
 * ─────────────────────────────────────────────────────────────
 */

import { Component, type ErrorInfo, type ReactNode } from "react"

/** 사용자에게 보일 오류 한 줄. 스택은 넣지 않는다 — 읽을 수 없는 것은 도움이 아니다. */
function describe(err: unknown): string {
  if (err instanceof Error) return err.message || err.name
  return String(err)
}

/**
 * 오류 화면을 **DOM으로** 그린다. React에 기대지 않는다 (위 주석 참조).
 *
 * `detail`은 접어 둔다 — 첫 화면에 스택 비슷한 것이 보이면 사용자는 자기가 뭘
 * 잘못한 줄 안다. 필요할 때 펴서 그대로 복사해 보낼 수 있으면 충분하다.
 */
export function paintCrash(host: HTMLElement, err: unknown): void {
  const msg = describe(err)
  host.textContent = ""
  host.setAttribute(
    "style",
    [
      "position:fixed", "inset:0", "z-index:99999",
      "display:flex", "align-items:center", "justify-content:center",
      "padding:24px", "background:var(--bg-app, #fff)",
      "font:var(--fw-regular, 400) 13px var(--font-sans, system-ui)",
      "color:var(--fg, #111)",
    ].join(";"),
  )

  const card = document.createElement("div")
  card.setAttribute(
    "style",
    [
      "max-width:520px", "width:100%", "display:grid", "gap:12px",
      "padding:20px", "border-radius:12px",
      "background:var(--bg-elevated, #fafafa)",
      "border:1px solid var(--border-strong, #ddd)",
    ].join(";"),
  )

  const h = document.createElement("div")
  h.textContent = "화면을 그리다 멈췄습니다"
  h.setAttribute("style", "font:var(--fw-semi, 600) 15px var(--font-sans, system-ui)")

  // ★ 이 줄이 이 화면의 값이다 ★ 사용자가 가장 먼저 걱정하는 것은 데이터다.
  const safe = document.createElement("div")
  safe.textContent =
    "넣어 두신 데이터는 그대로 있습니다 — 화면만 멈춘 것이고, 저장된 것은 건드리지 않았습니다."
  safe.setAttribute("style", "color:var(--fg-2, #444); line-height:1.6")

  const detail = document.createElement("details")
  const sum = document.createElement("summary")
  sum.textContent = "무엇이 났는지 보기"
  sum.setAttribute("style", "cursor:pointer; color:var(--fg-4, #888)")
  const pre = document.createElement("pre")
  pre.textContent = msg
  pre.setAttribute(
    "style",
    [
      "margin:8px 0 0", "padding:10px", "border-radius:8px", "overflow:auto",
      "max-height:180px", "white-space:pre-wrap", "word-break:break-word",
      "background:var(--bg-subtle, #f0f0f0)", "color:var(--fg-2, #444)",
      "font:11px var(--font-mono, ui-monospace, monospace)",
    ].join(";"),
  )
  detail.append(sum, pre)

  const btn = document.createElement("button")
  btn.textContent = "다시 열기"
  btn.setAttribute(
    "style",
    [
      "justify-self:start", "cursor:pointer",
      "padding:7px 14px", "border-radius:8px", "border:1px solid var(--border-strong, #ddd)",
      "background:var(--bg-app, #fff)", "color:var(--fg, #111)",
      "font:var(--fw-medium, 500) 12px var(--font-sans, system-ui)",
    ].join(";"),
  )
  btn.addEventListener("click", () => location.reload())

  card.append(h, safe, detail, btn)
  host.append(card)
}

interface State {
  readonly err: unknown | null
}

/**
 * 렌더 예외를 잡는 경계. **앱 전체를 감싼다** — 부분만 감싸면 감싸지 않은 자리에서
 * 같은 흰 창이 난다.
 */
export class Crash extends Component<{ children: ReactNode }, State> {
  override state: State = { err: null }

  static getDerivedStateFromError(err: unknown): State {
    return { err }
  }

  override componentDidCatch(err: unknown, info: ErrorInfo): void {
    // 콘솔에도 남긴다 — 개발 중에는 이쪽이 훨씬 빠르다. 릴리즈에서는 아무도
    // 못 보므로 **화면이 본체**다.
    console.error("[crash]", err, info.componentStack)
  }

  override render(): ReactNode {
    if (this.state.err === null) return this.props.children
    /**
     * ★ React로 오류 화면을 그리지 않는다 ★ 방금 React가 죽은 자리다.
     * `ref` 콜백에서 순수 DOM으로 칠하고, React 쪽은 빈 컨테이너만 남긴다.
     */
    return (
      <div
        ref={(el) => {
          if (el !== null) paintCrash(el, this.state.err)
        }}
      />
    )
  }
}

/**
 * 렌더 **밖**에서 나는 사고도 잡는다 — 경계는 렌더 단계만 본다.
 *
 * 잡히지 않은 프라미스 거절(`unhandledrejection`)이 특히 그렇다. 이 앱의 쓰기는
 * 전부 비동기라 거기서 터진 것은 경계에 안 걸리고, 지금까지 **아무 데도 안 남았다.**
 *
 * ★ 화면을 덮지 않는다 ★ 렌더는 멀쩡한데 비동기 하나가 터진 것뿐일 수 있다.
 * 그럴 때 전면 오류 화면을 띄우면 멀쩡한 앱을 우리가 죽이는 셈이다 — 그래서
 * 여기서는 **구석의 알약**으로만 말한다(`webDemoBanner`와 같은 자리·같은 판단).
 */
export function watchUnhandled(): () => void {
  let shown: HTMLElement | null = null
  const say = (msg: string): void => {
    if (shown !== null) return // 한 번만 — 연달아 터지면 화면이 알약으로 덮인다
    const pill = document.createElement("div")
    pill.textContent = `처리하지 못한 오류가 있었습니다 — ${msg}`
    pill.setAttribute(
      "style",
      [
        "position:fixed", "left:10px", "bottom:10px", "z-index:9999",
        "max-width:min(520px, calc(100vw - 20px))",
        "padding:6px 12px", "border-radius:999px",
        "font:var(--fw-medium, 500) 11px var(--font-sans, system-ui)",
        "color:var(--pnl-neg, #E5484D)", "background:var(--bg-elevated, #fff)",
        "border:1px solid var(--border-strong, #ddd)",
        "overflow:hidden", "text-overflow:ellipsis", "white-space:nowrap",
        "cursor:pointer",
      ].join(";"),
    )
    // 눌러서 치울 수 있다 — 못 치우는 고지는 화면을 영구히 좁힌다.
    pill.addEventListener("click", () => {
      pill.remove()
      shown = null
    })
    document.body.appendChild(pill)
    shown = pill
  }

  const onRejection = (e: PromiseRejectionEvent): void => say(describe(e.reason))
  const onError = (e: ErrorEvent): void => say(describe(e.error ?? e.message))
  window.addEventListener("unhandledrejection", onRejection)
  window.addEventListener("error", onError)
  return () => {
    window.removeEventListener("unhandledrejection", onRejection)
    window.removeEventListener("error", onError)
  }
}
