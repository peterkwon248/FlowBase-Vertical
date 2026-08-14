/**
 * 채널 화면 배선 — **커버리지의 주 서식지** (§22-4).
 *
 * ★ 새 마크업이 없다 ★
 * 목업이 이미 그려 뒀다. `vals.showCoverage` + `c.coverage[]`(점·이름·출처)가
 * 커버리지 스트립이고, `c.hasNote`/`c.note`가 3절 문장의 자리다. 목업의 11번가
 * 시드 노트가 그 의도를 못박는다:
 *
 * > *"정산 파일을 아직 넣지 않았습니다. 주문은 들어왔지만 이 기간 손익에서
 * >  11번가 정산이 빠져 있습니다."*
 *
 * 우리 실데이터는 그 **거울상**이다 — 11번가는 정산이 있고 주문이 없다. 목업이
 * 손으로 쓴 문장을 데이터에서 파생시키는 것이 이 파일이 하는 일 전부다.
 *
 * ★ 문장을 여기서 만드는 이유 ★
 * `core/coverage`는 구조만 낸다. *"**11번가 주문 파일**을 넣으면"*에는 마켓 통칭이
 * 들어가고 core는 그것을 알 수 없기 때문이다 (LOCK 4). 재료는 팩 사전에서 온다.
 */

import type { ConnectionCoverage } from "@core/coverage/load.js"
import type { CoverageEntry, DocType, MetricId } from "@core/coverage/index.js"
import type { MarketDict } from "@packs/kr-marketplace/markets/index.js"
import type { TemplateVals } from "./generated/vals.js"
import { won } from "./format.js"

/**
 * 마켓 사전 조회 — **주입받는다.**
 *
 * 팩의 `markets/index.ts`는 `import.meta.glob`을 쓰므로 번들러 안에서만 돈다.
 * SSR 하네스는 `tsx`로 돌아 그것을 모른다(프로파일 레지스트리가 이미 겪은 제약).
 * 그래서 여기서는 **타입만** 가져오고 함수는 호출자가 준다 — `loadCoverage`가
 * `resolveDocType`을 받는 것과 같은 규율이다.
 */
export type DictLookup = (marketplaceKey: string) => MarketDict | null

const DIM = "var(--fg-4)"
const GREEN = "var(--pnl-pos, #4CB782)"
const YELLOW = "var(--label-yellow, #F2C94C)"

/** 스트립에 그리는 순서 — 손익이 쌓이는 순서와 같다. */
const STRIP: readonly DocType[] = ["order", "settlement", "ad", "cost"]

/**
 * 문장이 언급하는 지표. **광고는 여기 없다** — 광고를 하지 않는 셀러에게
 * *"광고 파일이 없습니다"*는 잔소리다. 잠긴 지표는 스트립에서 조용히 흐리게
 * 표시되고, 문장은 손익 3층의 뼈대만 말한다 (§22 «숙제 검사 톤 금지»).
 */
const NOTABLE: readonly MetricId[] = ["revenue", "fee", "contribution"]

/** 목업 `STATES` 그대로. 새 상태를 발명하지 않는다 (헌장 C-7). */
const STATES: Record<string, { label: string; color: string; bg: string }> = {
  CONNECTED: { label: "연결됨", color: GREEN, bg: "rgba(76,183,130,0.12)" },
  SYNCING: { label: "가져오는 중", color: "var(--accent)", bg: "var(--accent-soft)" },
  ERROR: { label: "연결 오류", color: "var(--pnl-neg, #EB5757)", bg: "rgba(235,87,87,0.12)" },
  EXPIRED: { label: "인증 만료", color: "var(--label-orange, #F2994A)", bg: "rgba(242,153,74,0.12)" },
  REAUTH_REQUIRED: { label: "다시 연결 필요", color: YELLOW, bg: "rgba(242,201,76,0.12)" },
  DISCONNECTED: { label: "연결되지 않음", color: DIM, bg: "var(--bg-elevated-2)" },
  FORMAT_CHANGED: { label: "양식 변경 감지", color: YELLOW, bg: "rgba(242,201,76,0.12)" },
}

/** 종성이 있으면 «이/을», 없으면 «가/를». 지표 이름이 늘어나도 문장이 안 어색해진다. */
const hasJong = (s: string): boolean => {
  const c = s.charCodeAt(s.length - 1)
  return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : false
}
const iga = (s: string): string => `${s}${hasJong(s) ? "이" : "가"}`

/** 원가는 파일이 아니므로 마켓 사전에 없다. 마켓 중립이라 여기 둔다. */
const docLabel = (dt: DocType, dict: MarketDict | null): string =>
  dt === "cost" ? "원가" : (dict?.docTypes[dt]?.label ?? dt)

/**
 * 커버리지 스트립 — 목업 `cvg(label, lv, via)`와 같은 모양.
 *
 * 목업은 6칸(상품·주문·반품·정산·광고·원가)이었지만 우리 `DocType` 어휘는 4종이다.
 * **없는 칸을 «미수집»으로 그리지 않는다** — 영원히 안 채워질 칸을 만들어 두면
 * 그것이 곧 결핍처럼 읽힌다. 칸 수는 마크업이 아니라 데이터라 목업 대조 게이트와
 * 무관하다(`c.coverage.map`).
 */
export function coverageStrip(
  cc: ConnectionCoverage,
  dict: MarketDict | null,
): { label: string; via: string; color: string }[] {
  const held = new Set(cc.coverage.held)
  return STRIP.map((dt) => {
    const label = docLabel(dt, dict)
    if (dt === "cost") {
      if (held.has("cost")) return { label, via: "수동", color: GREEN }
      // 반쯤 채워진 원가는 «없음»과 다르다. 노란 점이 그 사실을 그대로 말한다.
      if (cc.counts.cost > 0) return { label, via: `${won(cc.counts.cost)}/${won(cc.skuCount)}`, color: YELLOW }
      return { label, via: "미입력", color: DIM }
    }
    if (held.has(dt)) return { label, via: "파일", color: GREEN }
    // ★ «아직 안 넣었다»와 «넣어도 못 읽는다»는 다르다 ★
    // 후자를 «미수집»이라 쓰면 사용자가 파일을 찾아 넣으러 갔다가 거절당한다.
    return (dict?.readable ?? []).includes(dt)
      ? { label, via: "미수집", color: DIM }
      : { label, via: "양식 미지원", color: DIM }
  })
}

/**
 * 3절 문장 (§22-3). 잠긴 것이 없으면 **빈 문자열** — 할 말이 없으면 안 한다.
 *
 * ① 있다 · ② 잠겼다 + 값 · ③ 하면 된다.
 */
export function coverageNote(cc: ConnectionCoverage, dict: MarketDict | null): string {
  const locked = cc.coverage.entries.filter((e) => !e.open && NOTABLE.includes(e.metric))
  if (locked.length === 0) return ""

  // ① 있다
  const heldParts = cc.coverage.held.map((dt) =>
    dt === "cost"
      ? `원가 ${won(cc.counts.cost)}개`
      : `${docLabel(dt, dict)} ${won(cc.counts[dt])}건`,
  )
  const s1 =
    heldParts.length > 0
      ? `${heldParts.join(" · ")}이 들어와 있습니다.`
      : "아직 들어온 파일이 없습니다."

  // ② 잠겼다 + 값 — 빠진 입력마다 한 문장.
  const missing: DocType[] = []
  for (const e of locked) for (const d of e.missing) if (!missing.includes(d)) missing.push(d)

  const s2 = missing
    .map((dt) => {
      const blocked = locked.filter((e) => e.missing.includes(dt))
      // 기여이익은 합성 지표라 «무엇이 막혔나»의 대표로는 약하다 — 먼저 단일 지표를 고른다.
      const lead: CoverageEntry =
        blocked.find((e) => e.metric !== "contribution") ?? blocked[0]!
      if (dt === "cost") {
        return `원가가 아직 입력되지 않아 ${iga(lead.label)} 잠겨 있습니다.`
      }
      const file = `${docLabel(dt, dict)} 파일`
      return lead.lockedValue !== null
        ? `${file}이 없어 ${lead.label} ${won(lead.lockedValue)}원이 손익에 반영되지 않습니다.`
        : `${file}이 없어 ${iga(lead.label)} 손익에 잡히지 않습니다.`
    })
    .join(" ")

  // ③ 하면 된다 — 파일은 바로 옆 [파일 가져오기] 버튼이 동선이다.
  //    원가는 아직 입력 화면이 없으므로 **동선을 약속하지 않는다** (§21-1).
  //
  // ★ 못 지킬 약속을 하지 않는다 (2026-08-14 실기기에서 드러남) ★
  // 이 자리는 *"주문·정산 파일을 넣으면 열립니다"*라고 말했는데, 사용자가 쿠팡
  // 매출 파일을 넣자 *"맞는 매핑 프로파일이 없습니다"*가 떴다. 오늘 마켓×성격
  // 9칸 중 읽을 수 있는 것은 **3칸뿐**이라, 시키기 전에 **읽을 수 있는지**부터 본다.
  const files = missing.filter((d) => d !== "cost")
  const readable = dict?.readable ?? []
  const canRead = files.filter((d) => readable.includes(d))
  const cannot = files.filter((d) => !readable.includes(d))

  const parts: string[] = []
  if (canRead.length > 0) {
    parts.push(`${canRead.map((d) => docLabel(d, dict)).join("·")} 파일을 넣으면 열립니다.`)
  }
  if (cannot.length > 0) {
    parts.push(
      `${cannot.map((d) => docLabel(d, dict)).join("·")} 파일은 아직 읽을 수 없습니다 — ` +
        `이 양식의 매핑 프로파일이 없습니다.`,
    )
  }
  if (parts.length === 0) {
    parts.push("원가는 마켓이 주지 않는 값이라 직접 입력해야 합니다.")
  }

  return `${s1} ${s2} ${parts.join(" ")}`
}

export interface ChannelActions {
  readonly goImport: () => void
}

export function channelVals(
  vals: TemplateVals,
  list: readonly ConnectionCoverage[],
  actions: ChannelActions,
  dictOf: DictLookup,
): void {
  vals.showCoverage = true

  vals.conns = list.map((cc) => {
    const dict = dictOf(cc.marketplaceKey)
    const st = STATES[cc.state] ?? STATES["CONNECTED"]!
    const note = coverageNote(cc, dict)

    return {
      // 이름은 `connection.display_name` — 내부 키를 내보내지 않는다 (헌장 C-4)
      name: cc.channel,
      abbr: dict?.abbr ?? "—",
      color: dict?.color ?? "var(--fg-3)",
      stateLabel: st.label,
      sc: st.color,
      bg: st.bg,
      // ── 세 조각은 전부 사실이어야 한다 ──────────────────────────
      // v1에 계정 연결은 없다. «동기화» 어휘도 쓰지 않는다 (LOCK 10)
      account: "파일로 가져오기",
      mode: "계정 연결 없음",
      lastLine:
        cc.lastImportAt === null
          ? "가져온 파일 없음"
          : `마지막 가져오기 ${cc.lastImportAt.slice(0, 10)}`,

      hasNote: note !== "",
      note,
      coverage: coverageStrip(cc, dict),

      // ★ G마켓/옥션을 못 나눈다 ★ 그것을 가르는 컬럼은 «판매아이디» 하나뿐인데
      // ESM 프로파일이 받지 않는다. 데이터가 없으므로 채널 분리를 그리지 않는다.
      hasChannels: false,
      channels: [],

      // ── 아직 없는 것들 ─────────────────────────────────────────
      // 못 누르는 버튼을 그려놓고 막지 않는다 (§21-1). 조건부 마크업은 끄고,
      // 무조건 그려지는 «연결 관리»만 무동작으로 남는다.
      showLock: false,
      canDisconnect: false,
      upgrade: () => {},
      disconnect: () => {},
      manage: () => {},

      primaryLabel: "파일 가져오기",
      primary: actions.goImport,
    }
  })
}
