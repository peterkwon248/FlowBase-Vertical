/**
 * 앱 셸 — 3a-b 이식.
 *
 * 목업 화면은 이제 **변환기 출력**(`generated/Template.tsx`)이 통째로 그린다.
 * 손으로 옮긴 온보딩은 여기 없다 — 첫 시험에서 손 이식이 목업과 어긋난 것이
 * 드러났고(카피 3개 누락·색 결정이 뷰로 이동·onClick 소실), 기계 변환본이
 * 그 자리를 받았다. 그 기록은 커밋 `7f2a805`에 있다.
 *
 * 이 파일이 하는 일은 **상태를 들고 있는 것**뿐이다:
 *
 * ```
 * 화면 전환 · 사이드바 접힘 · 테마   →  여기 (React 상태)
 * 값의 모양                          →  shell.ts (목업 renderVals의 표시 부분)
 * 마크업                             →  generated/Template.tsx (기계 변환)
 * 데이터                             →  아직 없다
 * ```
 *
 * ★ 데이터가 없다 ★
 * 웹뷰용 드라이버가 아직 없어(ADR-008의 Tauri 커맨드 미구현) 리포지토리에
 * 붙지 않았다. 배지·목록·손익은 `emptyVals()`가 준 빈 값 그대로다 —
 * **시드를 넣어 채워 보이지 않는다.** 화면이 비어 보이는 것이 지금의 사실이다.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Template } from "./generated/Template.js"
import { dashboardVals } from "./dashboard.js"
import { settlementVals } from "./settlement.js"
import { orderVals } from "./order.js"
import { linkingVals, type LinkTab, type LinkingActions } from "./linking.js"
import { channelVals } from "./channel.js"
import { historyVals, undoConfirm, type ConfirmDialog } from "./history.js"
import {
  emptyDraft,
  productVals,
  replaceConfirmRows,
  type CostDraftState,
  type ProdTab,
  type ProductActions,
} from "./product.js"
import { parseCostDraft } from "@core/cost/index.js"
import type { ProductSkuRow, ProductView } from "@core/product/rows.js"
import { marketDict } from "@packs/kr-marketplace/markets/index.js"
import { importVals, BIG_FILE_BYTES, EMPTY_WIZARD, type ImportActions, type ImportWizardState } from "./import.js"
import { analyzeImport } from "@core/import/analyze.js"
import { runImport } from "@core/import/run.js"
import { loadProfiles } from "@packs/kr-marketplace/profiles/index.js"
import { DEV_LIBRARY, findPriorImports, loadDevSnapshot, nowStamp, readDigest, recordSighting, today, writeThenReload, type LoadResult } from "./data.js"
import type { PnlSnapshot } from "@core/profit/snapshot.js"
import { monthPeriod, type Month, type MonthRow } from "@core/profit/months.js"
import type { ChannelRow, DailySeries, ProfitRow } from "@core/profit/rows.js"
import { periodVals } from "./period.js"
import type { Period } from "@core/profit/index.js"
import type { SettlementRow } from "@core/settlement/rows.js"
import type { OrderRow } from "@core/order/rows.js"
import type { LinkingCard, LinkingView } from "@core/linking/view.js"
import type { ConnectionCoverage } from "@core/coverage/load.js"
import { openedBy } from "@core/coverage/index.js"
import type { HistoryRow } from "@core/history/rows.js"
import { shellStateFor, shellVals, type NavKey, type ShellState } from "./shell.js"

/** 목업 L3908과 같은 기준. 사이드바가 서랍이 되는 폭이다. */
const NARROW = "(max-width: 1023px)"

/**
 * 잠금을 못 잡았을 때의 문구. **«아무 일도 안 일어남»의 자리를 메운다.**
 *
 * 이 말이 뜨면 그 자체가 진단이다 — 다른 동작이 진짜로 도는 중이거나, 끝났는데
 * 잠금이 안 풀린 것이다. 후자면 앱을 다시 켜는 것이 확실한 복구이므로 그렇게 적는다.
 */
const BUSY_WHY =
  "다른 동작이 DB를 쓰고 있어 시작하지 못했습니다. 진행 중인 것이 없다면 " +
  "앱을 껐다 켜고 다시 눌러 주세요."

/** 말만 하는 모달 하나. 되돌리기 실패가 쓰던 모양 그대로다 — 새 마크업 0줄. */
const sayConfirm = (title: string, body: string, close: () => void): ConfirmDialog => ({
  title,
  body,
  hasRows: false,
  rows: [],
  hasChoice: false,
  choices: [],
  hasType: false,
  confirmLabel: "닫기",
  btnFg: "var(--fg)",
  btnBorder: "var(--border-strong)",
  btnOp: "1",
  run: close,
})

export function App(): React.JSX.Element {
  // 첫 렌더부터 폭에 맞는 상태여야 한다. 좁은 화면에서 서랍이 열린 채로
  // 한 프레임이라도 뜨면 본문을 덮는다 (목업 L3690과 같은 판단).
  const [state, setState] = useState<ShellState>(() =>
    shellStateFor(typeof window !== "undefined" && window.matchMedia(NARROW).matches),
  )

  // 목업은 렌더 시점에 matchMedia를 한 번 읽고 끝이라 창을 줄여도 반응하지
  // 않는다. React에서는 상태로 들고 구독해야 같은 화면이 나오므로 그렇게 한다 —
  // 목업의 결함을 옮기지 않는 쪽이고, §21 "좁은 화면" 항목과도 어긋나지 않는다.
  useEffect(() => {
    const mq = window.matchMedia(NARROW)
    const sync = (): void =>
      setState((s) => {
        if (mq.matches === s.isNarrow) return s
        // 경계를 **넘을 때만** 접힘을 다시 정한다. 같은 모드 안에서는 사용자가
        // 직접 연 서랍을 리사이즈가 마음대로 닫지 않는다.
        return { ...s, isNarrow: mq.matches, navCollapsed: mq.matches }
      })
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", state.theme)
  }, [state.theme])

  // 3b-0 CLI가 만든 DB를 읽는다. 실제 배포 경로(사용자 데이터 디렉터리 +
  // 가져오기 화면)는 아직 없다 — 지금은 **화면 숫자 = CLI 숫자**를 증명하는
  // 것이 목적이고, 같은 DB를 같은 스냅샷 함수로 읽으므로 구조가 그걸 보장한다.
  const [snap, setSnap] = useState<PnlSnapshot | null>(null)
  const [setRows, setSetRows] = useState<readonly SettlementRow[]>([])
  const [ordRows, setOrdRows] = useState<readonly OrderRow[]>([])
  const [linking, setLinking] = useState<LinkingView | null>(null)
  const [coverage, setCoverage] = useState<readonly ConnectionCoverage[]>([])
  const [history, setHistory] = useState<readonly HistoryRow[]>([])
  const [products, setProducts] = useState<ProductView | null>(null)
  /** 대시보드의 두 표 — 상품별·채널별 손익. 조회가 준 것을 그대로 든다. */
  const [profitRows, setProfitRows] = useState<readonly ProfitRow[]>([])
  const [channelRows, setChannelRows] = useState<readonly ChannelRow[]>([])
  const [daily, setDaily] = useState<DailySeries>({ points: [], periodOnly: 0 })
  /** 일별 차트에서 호버 중인 칸. -1이면 안 떠 있다 — 화면 상태라 DB에 가지 않는다. */
  const [trendIdx, setTrendIdx] = useState(-1)
  /**
   * ★ 보고 있는 달 (MVP 1, 2026-08-16) ★
   *
   * 전에는 `DEV_PERIOD` 상수였다 — 8월 파일을 넣어도 화면이 7월을 그렸다.
   * 이제 **조회가 결정하고 화면은 결과를 받는다**: 요청한 달에 데이터가 없으면
   * 조회가 최신 달로 물러나므로, 상태를 «요청»이 아니라 **«실제로 본 것»**으로
   * 들고 있어야 라벨과 숫자가 갈리지 않는다.
   */
  const [per, setPer] = useState<Period>(() => monthPeriod(new Date().toISOString().slice(0, 7)))
  const [month, setMonth] = useState<Month>(() => new Date().toISOString().slice(0, 7))
  const [months, setMonths] = useState<readonly MonthRow[]>([])
  /** 달 목록이 펼쳐져 있나. 화면 상태라 DB에 가지 않는다. */
  const [monthOpen, setMonthOpen] = useState(false)
  /** 쓰기 뒤 재조회가 **보던 달**로 돌아오게 하는 참조 (`take`가 갱신한다). */
  const monthRef = useRef<Month>(new Date().toISOString().slice(0, 7))
  /** 되돌리기·원가 정정 확인 다이얼로그. `null`이면 안 떠 있다. */
  const [confirm, setConfirm] = useState<ConfirmDialog | null>(null)

  /**
   * ★ **DB에 닿는 동작은 한 번에 하나** — 이 앱의 잠금은 이것 하나다 ★
   *
   * 2d에서 사용자가 [새 SKU로 등록]을 두 번 눌러 고아 SKU가 남았다. 근본 방어는
   * **리포지토리의 멱등성**이고(같은 리스팅이 두 번 와도 SKU가 둘이 되지 않는다),
   * 이건 그 위에 얹는 UX층이다 — 두 번째 클릭이 아무 일도 안 하고 조용히 지나가면
   * 사용자는 «눌렸나?»를 알 수 없으므로, 애초에 받지 않는 편이 낫다.
   *
   * ─────────────────────────────────────────────────────────────
   * ★ 잠금이 **둘이었다** (~2026-08-16) ★
   * 이것과 위저드의 `wiz.busy`가 서로를 몰랐다. 그래서 적재가 도는 중에 원가
   * 저장·되돌리기·달 바꾸기가 들어올 수 있었고, 그 경로가 전부 `openTauriDriver`라
   * **전역 연결 하나**를 두고 부딪혔다 (`tests/tauri-conn-race.test.ts`가 재현).
   *
   * 이제 셋이 겹친다:
   * ```
   * 저장 계층   임차 번호 — 이미 쓰는 중이면 열기를 **거절**한다   ← 정확성
   * 이 잠금     DB에 닿는 모든 동작이 여기를 지난다                ← 그 거절을 안 만나게
   * wiz.busy    위저드 버튼의 «적재 중» 표시                       ← 표시 전용
   * ```
   * 마지막 것은 이제 **잠금이 아니다.** 화면 상태로만 남는다.
   * ─────────────────────────────────────────────────────────────
   *
   * `useRef`인 이유는 상태 갱신을 기다리지 않기 때문이다. `useState`로 하면
   * 리렌더 전에 도착한 두 번째 클릭이 옛 값을 본다 — 막으려는 그 경우를 못 막는다.
   */
  const busy = useRef(false)

  /**
   * 잠금을 잡는다. 못 잡으면 거짓이고, 부르는 쪽은 **아무 일도 하지 않는다.**
   *
   * 함수로 묶는 이유는 규칙이 한 곳에만 있어야 하기 때문이다 — 자리마다 손으로
   * `if (busy.current)`를 적으면 새 버튼이 하나 생기는 날 그 자리만 빠진다.
   * 실제로 위저드가 정확히 그렇게 빠져 있었다.
   */
  const acquire = useCallback((): boolean => {
    if (busy.current) return false
    busy.current = true
    return true
  }, [])

  const release = useCallback((): void => {
    busy.current = false
  }, [])

  /**
   * ★ 읽지 못한 것을 «없다»로 그리지 않는다 (헌장 6 · §22) ★
   *
   * ─────────────────────────────────────────────────────────────
   * 2026-08-16, 사용자가 상품을 연결한 직후 **모든 화면이 비었다.** 데이터는
   * 멀쩡했다 — 쓰기는 성공했고 이어진 재조회가 실패했는데, 여기가 그 실패를
   * `console.warn` 하나로 넘기고 **빈 값을 그대로 상태에 넣었다.** 화면은
   * "연결한 것이 다 사라졌다"고 말했다.
   *
   * 옛 주석은 «빈 화면이 지금의 사실이다»였다. 그것은 **데이터가 없을 때만** 참이다.
   * 읽지 못한 것과 없는 것은 다르고, 그 둘을 가르는 것이 이 프로젝트의 §22다.
   * ─────────────────────────────────────────────────────────────
   *
   * 실패하면 **화면을 건드리지 않는다.** 직전까지 보던 것이 남는 편이 통째로
   * 비는 것보다 참에 가깝고(그 데이터는 실제로 DB에 있다), 모달이 이유를 말한다.
   * 새 마크업은 만들지 않는다 — 되돌리기 실패가 이미 쓰는 그 모달이다.
   */
  const take = useCallback((r: LoadResult) => {
    if (r.error !== null) {
      console.warn("[data] 읽지 못했다:", r.error)
      /**
       * ★ 문구 정정 (2026-08-16) ★
       * 처음엔 「읽기가 실패했습니다」라고 못박았는데, `writeThenReload`는 **쓰기
       * 실패도 같은 자리로 돌려준다.** 실제로 SKU 등록이 터졌을 때 화면이
       * 「읽지 못했습니다」라고 말했다 — 사용자가 원인을 엉뚱한 데서 찾게 된다.
       *
       * 어느 쪽인지 모르면 **모른다고 말하지 않는다** — 아는 것만 말한다:
       * 「사라진 게 아니다 · 화면은 그대로 뒀다 · 원문은 이것이다」.
       */
      setConfirm({
        title: "이 동작을 마치지 못했습니다",
        body:
          `저장된 것이 사라진 것은 아닙니다. 화면은 마지막으로 읽은 것을 ` +
          `그대로 두었습니다.\n\n${r.error}`,
        hasRows: false,
        rows: [],
        hasChoice: false,
        choices: [],
        hasType: false,
        confirmLabel: "닫기",
        btnFg: "var(--fg)",
        btnBorder: "var(--border-strong)",
        btnOp: "1",
        run: () => setConfirm(null),
      })
      return
    }
    if (r.snapshot) setSnap(r.snapshot)
    setSetRows(r.settlement)
    setOrdRows(r.orders)
    setLinking(r.linking)
    setCoverage(r.coverage)
    setHistory(r.history)
    setProducts(r.products)
    setProfitRows(r.profitRows)
    setChannelRows(r.channelRows)
    setDaily(r.daily)
    // 기간은 **조회가 정한 것**을 받는다. 요청한 달이 사라졌으면 물러난 달이 온다.
    setPer(r.period)
    setMonth(r.month)
    setMonths(r.months)
    setMonthOpen(false)
    // 쓰기 콜백들이 읽는 자리. 상태로 읽으면 그때 만들어진 클로저가 옛 달을 본다 —
    // 원가를 넣고 화면이 다른 달로 튀는 모양이 정확히 그것이다.
    monthRef.current = r.month
  }, [])

  useEffect(() => {
    void loadDevSnapshot().then(take)
  }, [take])

  /**
   * 달을 바꾼다. **다시 조회한다** — 화면 상태만 바꾸고 숫자를 그대로 두면
   * 라벨과 값이 갈린다. 같은 달을 다시 고르면 아무 일도 하지 않는다.
   */
  const pickMonth = useCallback(
    (ym: Month) => {
      if (ym === month) {
        setMonthOpen(false)
        return
      }
      // 읽기도 연결을 연다 — 적재가 도는 중이면 저장 계층이 거절한다.
      // 달 바꾸기가 그 거절을 모달로 띄우는 것보다, 잠시 안 받는 편이 낫다.
      if (!acquire()) return
      void loadDevSnapshot(ym)
        .then(take)
        .finally(release)
    },
    [acquire, month, release, take],
  )

  // ── 상품 연결 (§21-6) ────────────────────────────────────────────
  // 탭과 선택은 **화면 상태**라 여기 산다. 연결 자체는 DB에 있고, 쓰기가 끝나면
  // 다시 조회해서 받는다 (`writeThenReload`) — 손으로 목록을 고치지 않는다.
  const [linkTab, setLinkTab] = useState<LinkTab>("todo")
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set())


  /**
   * 일괄 등록에서 **개별로 실패한 것들.**
   *
   * 쓰기 콜백은 값을 돌려줄 자리가 없다(`writeThenReload`가 주는 것은 `LoadResult`다).
   * 그래서 여기로 받아, **다시 읽기가 끝난 뒤에** 말한다 — 그래야 「되긴 됐다」와
   * 「이건 안 됐다」를 사용자가 같은 화면에서 본다.
   */
  const bulkFailures = useRef<{
    total: number
    failed: { title: string; why: string }[]
  } | null>(null)

  const write = useCallback(
    (fn: Parameters<typeof writeThenReload>[0]) => {
      if (!acquire()) return
      // ★ 잠금은 **`finally`로만 푼다** (2026-08-16) ★
      // `.then` 안에서 풀면 그 뒤가 던졌을 때 잠금이 영영 남고, 그때부터 이 앱의
      // 모든 버튼이 «눌러도 아무 일 없음»이 된다 — 사용자가 신고한 바로 그 모양이다.
      void writeThenReload(fn, monthRef.current)
        .then((r) => {
          // 쓰기가 끝난 카드는 선택에 남아 있을 이유가 없다 — 다음 탭으로 갔다
          setPicked(new Set())
          take(r)

          /**
           * ★ 부분 성공을 **부분 성공이라고 말한다** ★
           * 「N개 중 M개 등록」에서 멈추고 아무 말도 안 하면 사용자는 전부 됐다고
           * 믿고 다음으로 간다. `take`가 화면을 갱신한 뒤에 말해야, 남은 카드가
           * 이미 보이는 상태에서 이유를 읽는다.
           */
          const b = bulkFailures.current
          bulkFailures.current = null
          if (b && r.error === null) {
            setConfirm({
              title: `${b.total - b.failed.length}개 등록 · ${b.failed.length}개 실패`,
              body: [
                "실패한 카드는 목록에 그대로 남아 있습니다 — 다시 시도할 수 있습니다.",
                "",
                ...b.failed.slice(0, 5).map((f) => `· ${f.title.slice(0, 40)} — ${f.why}`),
                ...(b.failed.length > 5 ? [`… 외 ${b.failed.length - 5}개`] : []),
              ].join("\n"),
              hasRows: false,
              rows: [],
              hasChoice: false,
              choices: [],
              hasType: false,
              confirmLabel: "닫기",
              btnFg: "var(--fg)",
              btnBorder: "var(--border-strong)",
              btnOp: "1",
              run: () => setConfirm(null),
            })
          }
        })
        .finally(release)
    },
    [acquire, release, take],
  )

  const ids = (c: LinkingCard): string[] => c.listings.map((l) => l.id)

  const linkActions: LinkingActions = {
    pickTab: (t) => {
      setLinkTab(t)
      // 탭이 바뀌면 선택도 뜻을 잃는다. 남겨두면 «선택 3개»가 보이지 않는 카드를
      // 가리키게 되고, 일괄 등록이 사용자가 못 본 것에 손을 댄다
      setPicked(new Set())
    },
    newSku: (c) => write((repo) => repo.createSkuForListings(DEV_LIBRARY, ids(c), c.title, nowStamp()).then(() => {})),
    link: (c, skuId) => write((repo) => repo.linkListings(ids(c), skuId, nowStamp()).then(() => {})),
    ignore: (c) => write((repo) => repo.ignoreListings(ids(c), nowStamp()).then(() => {})),
    undo: (c) => write((repo) => repo.unlinkListings(ids(c), nowStamp()).then(() => {})),
    toggle: (key) =>
      setPicked((s) => {
        const next = new Set(s)
        if (!next.delete(key)) next.add(key)
        return next
      }),
    toggleAll: () =>
      setPicked((s) => {
        const cards = linking ? (linkTab === "todo" ? linking.todo : linkTab === "done" ? linking.done : linking.ignored) : []
        return s.size === cards.length ? new Set() : new Set(cards.map((c) => c.key))
      }),
    bulkNewSku: () => {
      const cards = (linking?.todo ?? []).filter((c) => picked.has(c.key))
      if (cards.length === 0) return
      // ★ **각각** 새 SKU다 — 하나로 합치지 않는다 (§21-6 ②) ★
      // 합치는 것은 서로 다른 상품을 한 SKU로 만드는 되돌리기 어려운 행위이고,
      // 그건 카드마다 사람이 봐야 한다 (작업 리듬 12).
      //
      /**
       * ★ 하나가 터졌다고 나머지를 멈추지 않는다 (2026-08-16) ★
       *
       * 전에는 `for … await`가 첫 실패에서 예외로 빠져나갔다. 사용자가 「모두
       * 선택 → 새 SKU로 등록」을 눌렀을 때 **114개 중 37개만 처리되고 멈췄고**,
       * 화면은 왜 멈췄는지 말하지 않았다.
       *
       * 카드는 서로 독립이다 — A가 실패할 이유가 B를 막지 않는다. 그래서 카드마다
       * 잡고 계속 간 뒤, **끝에 한 번 사람 말로 보고한다.** 조용히 넘기면 사용자는
       * 「전부 됐다」고 믿고 다음으로 간다 (LOCK 6).
       */
      write(async (repo) => {
        const failed: { title: string; why: string }[] = []
        for (const c of cards) {
          try {
            await repo.createSkuForListings(DEV_LIBRARY, ids(c), c.title, nowStamp())
          } catch (e) {
            failed.push({ title: c.title, why: e instanceof Error ? e.message : String(e) })
          }
        }
        if (failed.length > 0) bulkFailures.current = { total: cards.length, failed }
      })
    },
  }

  // ── 상품 · 원가 입력 (③) ─────────────────────────────────────────
  //
  // ★ 초안은 **SKU마다** 있다 ★ 목업은 `costDraft` 하나를 61행이 공유해서 한 칸에
  // 치면 61칸에 같은 글자가 떴다. 여기서는 Map이고, 저장에 성공한 행만 지운다 —
  // 실패한 행의 초안을 지우면 사용자가 친 값이 사유와 함께 사라진다.
  const [prodTab, setProdTab] = useState<ProdTab>("list")
  const [drafts, setDrafts] = useState<ReadonlyMap<string, CostDraftState>>(() => new Map())

  const putDraft = useCallback(
    (skuId: string, patch: Partial<CostDraftState>) =>
      setDrafts((m) => {
        const next = new Map(m)
        next.set(skuId, { ...(m.get(skuId) ?? emptyDraft(today())), ...patch })
        return next
      }),
    [],
  )

  const dropDraft = useCallback(
    (skuId: string) =>
      setDrafts((m) => {
        const next = new Map(m)
        next.delete(skuId)
        return next
      }),
    [],
  )

  /**
   * 원가 저장 — **한 번에 끝나지 않을 수 있다.**
   *
   * 같은 적용일이 이미 있으면 리포지토리가 넣지 않고 «있다 + 그 값»을 돌려준다.
   * 그때 화면이 사람에게 묻고, 답을 받아 `replace`로 다시 부른다 (§21-1). 조용히
   * 덮으면 오타 한 번이 이력 한 칸을 소리 없이 지운다 — 그 값은 Fact가 아니라
   * `row_shadow`가 없어 되찾을 수 없다.
   */
  const saveCost = useCallback(
    (row: ProductSkuRow, draft: CostDraftState, replace: boolean) => {
      const parsed = parseCostDraft(draft)
      if (!parsed.ok || !acquire()) return

      // `writeThenReload`는 쓰기 결과를 돌려주지 않으므로 클로저로 받는다 —
      // 「넣었나 / 이미 있나」를 알아야 물을지 말지를 정할 수 있다.
      let outcome: { inserted: boolean; replaced: boolean; previous: number | null } | null = null

      void writeThenReload(async (repo) => {
        outcome = await repo.addCost({
          libraryId: DEV_LIBRARY,
          skuId: row.skuId,
          kind: "COGS",
          amount: parsed.amount,
          effectiveFrom: parsed.effectiveFrom,
          now: nowStamp(),
          replace,
        })
      }, monthRef.current)
        .then((r) => {
          if (r.error) {
            console.warn("[cost] 원가 저장에 실패했다:", r.error)
            return
          }
          take(r)

          const got = outcome as { inserted: boolean; replaced: boolean; previous: number | null } | null
          if (got && !got.inserted && !got.replaced && got.previous !== null) {
            // 같은 날짜가 이미 있다 → 묻는다. 초안은 **남겨 둔다** — 사용자가 아니오를
            // 눌렀을 때 방금 친 값이 사라지면 다시 쳐야 한다.
            setConfirm({
              title: "이 날짜의 원가를 고칠까요",
              body:
                `${parsed.effectiveFrom}부터 적용되는 원가가 이미 있습니다. ` +
                `새 줄로 쌓이지 않고 그 값을 **덮어씁니다** — 되돌릴 수 없습니다. ` +
                `«이날부터 값이 바뀐다»를 남기려면 적용 시작일을 다른 날로 바꿔 저장하세요.`,
              hasRows: true,
              rows: replaceConfirmRows(row, got.previous, parsed.amount, parsed.effectiveFrom),
              hasChoice: false,
              choices: [],
              hasType: false,
              confirmLabel: "덮어쓰기",
              btnFg: "var(--pnl-neg, #EB5757)",
              btnBorder: "var(--pnl-neg, #EB5757)",
              btnOp: "1",
              run: () => {
                setConfirm(null)
                saveCost(row, draft, true)
              },
            })
            return
          }
          // 저장됐다 — 초안을 비운다. 값은 이제 DB가 갖고 있고 목록이 그걸 다시 읽었다.
          dropDraft(row.skuId)
        })
        .finally(release)
    },
    [acquire, dropDraft, release, take],
  )

  const productActions: ProductActions = {
    pickTab: setProdTab,
    setDraft: putDraft,
    save: (row) => saveCost(row, drafts.get(row.skuId) ?? emptyDraft(today()), false),
  }

  // ── 가져오기 위저드 ──────────────────────────────────────────────
  // 파일은 **웹 표준 `<input type="file">`**로 받는다 (ADR-013 — IPC 표면 0).
  const [wiz, setWiz] = useState<ImportWizardState>(EMPTY_WIZARD)
  const wizBytes = useRef<Uint8Array | null>(null)

  /** 분석은 DB를 건드리지 않는다. 몇 번을 불러도 같은 답이라 시트 바꾸기가 싸다. */
  const analyze = useCallback(async (bytes: Uint8Array, name: string, sheetIndex: number) => {
    try {
      const analysis = await analyzeImport(bytes, name, loadProfiles(), { sheetIndex })
      // 같은 바이트가 이미 들어왔는지 — **파일명이 달라도** 잡힌다 (마이그레이션 006).
      // 실패해도 가져오기를 막지 않는다. 고지를 못 하는 것이 못 넣는 것보다 낫다.
      const priorSame = await findPriorImports(analysis.contentHash)
      /**
       * ★ 본 것을 남긴다 — **넣기 전에, 넣지 않아도** (마이그레이션 009) ★
       *
       * 프로파일이 없으면 여기서 끝나던 파일이 지금까지 통째로 증발했다. 열 이름과
       * 표본은 이미 손에 있었는데 아무데도 안 남겼다. `profiles[0]`이 없으면
       * `null`로 남는다 — 「맞는 양식이 없었다」도 기록할 값이다.
       */
      void recordSighting(analysis)
      setWiz((w) => ({ ...w, analysis, priorSame, profileIndex: 0, error: null, busy: false }))
    } catch (e) {
      setWiz((w) => ({
        ...w,
        analysis: null,
        busy: false,
        error: e instanceof Error ? e.message : String(e),
      }))
    }
  }, [])

  const importActions: ImportActions = {
    pickFile: (ev: unknown) => {
      const input = (ev as { target?: { files?: FileList | null } } | null)?.target
      const file = input?.files?.[0]
      if (!file) return
      // ★ 열기 **전에** 판정한다 ★ 큰 파일이면 화면이 멈출 수 있다고 미리 말한다.
      // 메인 스레드에서 도는 동안은 이 고지가 유일한 방어다 (ADR-001 조건 2 부채).
      setWiz({ ...EMPTY_WIZARD, busy: true, bigFile: file.size >= BIG_FILE_BYTES })
      void file.arrayBuffer().then((buf) => {
        const bytes = new Uint8Array(buf)
        wizBytes.current = bytes
        void analyze(bytes, file.name, 0)
      })
    },
    pickProfile: (i) => setWiz((w) => ({ ...w, profileIndex: i })),
    pickSheet: (i) => {
      const bytes = wizBytes.current
      const name = wiz.analysis?.fileName
      if (!bytes || name === undefined) return
      void analyze(bytes, name, i)
    },
    confirm: () => {
      const bytes = wizBytes.current
      const a = wiz.analysis
      const match = a?.profiles[wiz.profileIndex]
      /**
       * ★ 안 되면 **왜 안 되는지 말한다** (2026-08-16, 사용자 신고) ★
       *
       * 사용자가 [확인하고 가져오기]를 눌렀는데 **아무 일도 일어나지 않았다.**
       * 실측: 그 시각에 `batch` 행이 하나도 안 생겼다 → 적재는 시작조차 안 했고,
       * 이 가드가 조용히 `return`한 것이다. 조건이 다섯인데 **다섯이 한 줄에서
       * 똑같이 침묵**했으니 사용자도 우리도 무엇이 막았는지 알 수 없었다 (LOCK 6).
       *
       * 문구를 모달로 띄운다 — 위저드의 오류 칸은 긴 매핑표 **위**에 있어서,
       * 표 끝의 버튼을 누른 사람의 화면에는 보이지 않는다. 새 마크업은 만들지
       * 않는다: 되돌리기 실패가 이미 쓰는 그 모달이다.
       */
      const stop = (why: string): void => {
        setWiz((w) => ({ ...w, error: why }))
        setConfirm(sayConfirm("가져오기를 시작하지 못했습니다", why, () => setConfirm(null)))
      }
      if (!bytes || !a || !match || wiz.busy) {
        stop(
          !bytes
            ? "고른 파일의 내용이 남아 있지 않습니다 — 파일을 다시 골라 주세요."
            : !a || !match
              ? "이 파일에 맞는 양식을 찾지 못했습니다 — 파일을 다시 골라 주세요."
              : "이미 가져오는 중입니다.",
        )
        return
      }
      if (!acquire()) {
        stop(BUSY_WHY)
        return
      }

      setWiz((w) => ({ ...w, busy: true, error: null }))
      const stamp = nowStamp()
      // batch id는 시각으로 만든다. 같은 파일을 다시 넣으면 **새 batch**이고,
      // 행은 `source_key`로 UPSERT된다 — 덮어쓰기가 아니라 쌓기다 (LOCK 2).
      const batchId = `batch-${stamp.replace(/[^0-9]/g, "")}`
      const connId = `conn-${match.profile.marketplaceKey}`

      /**
       * ★ «가져오는 중»을 **그리고 나서** 시작한다 (2026-08-16, 사용자 신고) ★
       *
       * 파싱은 메인 스레드에서 돈다(Worker 이관은 MVP 후로 잘렸다). 8만 행짜리
       * 광고 리포트는 그 동안 창을 통째로 잠그는데, `setWiz(busy)` 직후에 바로
       * 시작하면 **그 상태가 한 번도 그려지지 않는다** — 버튼은 「확인하고
       * 가져오기」인 채 얼고, 사용자에게는 «눌러도 아무 일 없음»과 똑같이 보인다.
       *
       * 한 프레임 양보하면 브라우저가 「가져오는 중…」을 먼저 칠하고, 그다음
       * 잠긴다. 잠기는 것은 그대로지만 **잠겼다는 사실이 화면에 남는다.**
       * 시간을 재는 게 아니라 «한 번 그릴 틈»을 주는 것이라 기기 속도와 무관하다.
       */
      const start = (): void => {
        void writeThenReload(async (repo) => {
          await repo.ensureLibrary(DEV_LIBRARY, "기본", stamp)
          await repo.ensureConnection(
            {
              id: connId,
              libraryId: DEV_LIBRARY,
              packId: match.profile.packId,
              marketplaceKey: match.profile.marketplaceKey,
              displayName: match.profile.displayName,
            },
            stamp,
          )
          await runImport(repo, {
            bytes,
            fileName: a.fileName,
            profile: match.profile,
            sheetIndex: a.sheetIndex,
            libraryId: DEV_LIBRARY,
            connectionId: connId,
            batchId,
            now: stamp,
          })
        }, monthRef.current).then((r) => {
          if (r.error) {
            setWiz((w) => ({ ...w, busy: false, error: r.error }))
            // 인라인 오류 칸은 **매핑표 위**에 있다. 표 끝의 버튼을 누른 사람은
            // 그것을 못 보고 «아무 일도 없었다»로 읽는다 — 같은 말을 모달로도 한다.
            setConfirm(sayConfirm("가져오지 못했습니다", r.error, () => setConfirm(null)))
            return
          }
          take(r)
          // 다이제스트는 **적재 뒤에 다시 읽는다.** 넣으면서 센 것을 그대로 쓰지 않는
          // 이유는 화면이 말하는 수가 DB가 아는 수여야 하기 때문이다. 잠금은 그
          // 조회까지 **한 사슬**로 묶여 있어 아래 `finally` 하나가 전부 책임진다.
          return readDigest(batchId).then((digest) =>
            setWiz((w) => ({ ...w, busy: false, digest, error: null })),
          )
        })
          .finally(release)
      }
      requestAnimationFrame(() => setTimeout(start, 0))
    },
    reset: () => {
      wizBytes.current = null
      setWiz(EMPTY_WIZARD)
    },
  }

  const go = useCallback((view: NavKey) => setState((s) => ({ ...s, view })), [])
  const toggleNav = useCallback(
    () => setState((s) => ({ ...s, navCollapsed: !s.navCollapsed })),
    [],
  )
  const closeNav = useCallback(() => setState((s) => ({ ...s, navCollapsed: true })), [])
  const openNav = useCallback(() => setState((s) => ({ ...s, navCollapsed: false })), [])
  // 목업 L5692. 첫 실행 안내를 벗어나면서 가져오기 화면으로 간다.
  const goImport = useCallback(
    () => setState((s) => ({ ...s, view: "import", firstRun: false })),
    [],
  )
  const toggleTheme = useCallback(
    () => setState((s) => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" })),
    [],
  )

  /**
   * 되돌리기 — **묻고, 실행하고, 다시 읽는다.**
   *
   * 되돌린 뒤 화면 상태를 손으로 고치지 않고 `writeThenReload`로 전부 다시 조회한다.
   * 되돌리기는 대시보드 숫자까지 바꾸는 행위라, 목록만 갱신하면 그 순간 화면
   * 절반이 옛 숫자를 믿는다 (연결 화면에서 세운 규율과 같다).
   */
  const askUndo = useCallback(
    (row: HistoryRow) => {
      setConfirm(
        undoConfirm(row, () => {
          setConfirm(null)
          // 되돌리기도 DB에 닿는 동작이다 — 적재가 도는 중에 들어오면 저장 계층이
          // 거절한다. 잠금을 지나게 해서 그 거절을 애초에 안 만나게 한다.
          if (!acquire()) return
          void writeThenReload(async (repo) => {
            await repo.undoBatch(row.id, nowStamp())
          }, monthRef.current)
            .then((r) => {
              take(r)
              // 실패를 삼키지 않는다 (헌장 6). 새 UI를 만들지 않고 같은 모달로 말한다.
              if (r.error) {
                setConfirm(sayConfirm("되돌리지 못했습니다", r.error, () => setConfirm(null)))
              }
            })
            .finally(release)
        }),
      )
    },
    [acquire, release, take],
  )

  const vals = shellVals(state, { go, toggleNav, closeNav, openNav, goImport, toggleTheme })
  // 월 선택기. 기간이 걸리는 화면에서만 붙고, 고를 달이 없으면 아예 안 붙는다.
  periodVals(vals, state.view, month, months, monthOpen, {
    toggle: () => setMonthOpen((o) => !o),
    pick: pickMonth,
  })
  // 데이터가 있으면 대시보드 값을 덮어쓴다. 없으면 빈 값 그대로 —
  // 시드를 넣어 채워 보이지 않는다 (헌장 C).
  if (snap) {
    dashboardVals(vals, snap, per, coverage, {
      products: profitRows,
      channels: channelRows,
      daily,
      trendIdx,
      onTrend: setTrendIdx,
    })
    // 데이터가 들어왔으니 첫 실행 안내는 지나간다.
    vals.firstRun = false
    vals.notFirstRun = true
  }
  // 정산은 손익과 **다른 조회**라 따로 배선한다. 둘 다 같은 순간의 같은 DB를
  // 읽으므로(loadDevSnapshot이 연결을 한 번만 연다) 화면끼리 어긋나지 않는다.
  if (setRows.length > 0) settlementVals(vals, setRows, per)
  if (ordRows.length > 0) orderVals(vals, ordRows, per)
  // 연결은 **0장도 사실**이다. 다른 화면과 달리 길이로 거르지 않는 이유는, 리스팅이
  // 하나도 없으면 "연결할 것이 없습니다"가 떠야 하기 때문이다 — 목업의 빈 상태가
  // 그 자리에 이미 있다.
  if (linking) linkingVals(vals, linking, linkTab, picked, linkActions)
  // §22-4 다이제스트 한 줄 — 방금 넣은 파일이 이 채널에서 무엇을 열었나.
  // 커버리지는 `take(r)`가 적재 뒤 다시 읽어 둔 것이라 DB가 아는 값이다.
  const doneProfile = wiz.digest ? wiz.analysis?.profiles[wiz.profileIndex]?.profile : undefined
  const doneDocType =
    doneProfile?.docType === "order" || doneProfile?.docType === "settlement" || doneProfile?.docType === "ad"
      ? doneProfile.docType
      : null
  const doneCov = doneProfile
    ? coverage.find((c) => c.marketplaceKey === doneProfile.marketplaceKey)
    : undefined
  importVals(
    vals,
    wiz,
    importActions,
    doneCov && doneDocType ? openedBy(doneCov.coverage, doneDocType) : [],
  )
  // 커버리지도 **0개가 사실**이다 — 연결이 없으면 카드가 없는 것이 맞다.
  // 잠긴 것을 말하는 화면이라 데이터가 적을수록 오히려 할 말이 많다 (§22).
  channelVals(vals, coverage, { goImport }, marketDict)
  historyVals(vals, history, { askUndo })
  // 상품도 **0장이 사실**이다 — SKU가 없으면 «연결된 SKU가 아직 없습니다»가 게이지에
  // 뜬다. 연결 화면과 같은 판단이고, 원가를 넣을 대상이 없다는 것 자체가 할 말이다.
  if (products) productVals(vals, products, prodTab, drafts, today(), productActions, per)
  // 확인 다이얼로그는 화면이 아니라 앱 상태다 — 어느 화면에서 띄웠든 같은 모달이다.
  vals.confirm = confirm
  vals.closeConfirm = () => setConfirm(null)

  return <Template vals={vals} />
}
