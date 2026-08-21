/**
 * 배선 커버리지 — **마크업이 쓰는데 아무도 안 채우는 자리를 센다.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 이 도구가 생겼나 (2026-08-17) ★
 *
 * 사용자가 «목업 대비 허접하다»고 했고, 세어 보니 값을 채우는 코드가 **0곳**인
 * 블록이 다섯이었다 (`netTrend`·`pnlRows`·`chRows`·`moversUp`·`attnItems`).
 * 그런데 그때도 게이트는 **전부 초록**이었다:
 *
 * ```
 * convert-gate   마크업이 목업과 같은가          ← 초록
 * 이 도구        그 자리에 값이 들어오는가        ← 아무도 안 재고 있었다
 * ```
 *
 * 「이식했다」와 「작동한다」가 같은 단어를 쓰고 있었다. 그 차이를 사람 눈이
 * 발견하는 동안에는 매번 화면을 보고 놀라게 된다 — 실제로 그렇게 발견됐다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 무엇을 세는가 ★
 *
 * ```
 * 소비   src/app/generated/Template.tsx 의  vals.X        (마크업이 읽는 자리)
 * 배선   src/app/**.ts(x) 의                vals.X = …    (값을 넣는 자리)
 * 미배선 = 소비 − 배선
 * ```
 *
 * 화면 경계는 `data-screen-label`이 준다. 그래서 «어느 화면이 몇 % 살아 있나»가
 * 나오고, 그게 곧 다음 손이 갈 곳의 목록이다.
 *
 * ★ 미배선이 곧 결함은 아니다 ★
 * 컷 목록에 있는 화면(진단·비용·설정…)은 **안 만든 것이 사실**이다. 이 도구는
 * 판정하지 않고 **세기만 한다** — 판정은 사람이 목록을 보고 한다. 게이트
 * (`tests/wiring-coverage.test.ts`)가 지키는 것은 하나뿐이다: **늘어나지 않는다.**
 */

import { readFileSync, readdirSync } from "node:fs"

const TEMPLATE = "src/app/generated/Template.tsx"
const APP_DIR = "src/app"

/** 마크업이 `vals.X`로 읽는 자리. 뿌리 이름만 센다 (`vals.tot.qty` → `tot`). */
const CONSUMED = /vals\.([A-Za-z_$][\w$]*)/g
/** 값을 넣는 자리. `vals.X = …` 만 — 읽기와 구별된다. */
const ASSIGNED = /\bvals\.([A-Za-z_$][\w$]*)\s*=[^=]/g

/**
 * ★ 선언된 «안 채움» — 미배선이 전부 결함은 아니다 ★
 *
 * 274개를 그냥 세면 「배선률 30%」가 나오는데, 그 숫자는 **오해를 부른다** —
 * 대부분이 사용자가 MVP 동결에서 **직접 자른 것**이거나 헌장이 **금지한 것**이다.
 * 그래서 `DEVIATIONS`(보존 게이트)와 같은 방식으로 **선언**한다:
 *
 *   선언된 것    이유가 붙어 있다. 세되 «남은 일»로 세지 않는다
 *   미분류       **이것이 진짜 목록이다.** 게이트가 지키는 수도 이쪽이다
 *
 * 선언이 낡으면(그 필드가 마크업에서 사라지면) 게이트가 잡는다 — 목록이 썩지 않는다.
 */
const CUTS: { name: string; fields: RegExp; why: string }[] = [
  {
    name: "대시보드 3단 — 비교·워터폴·캘린더",
    fields: /^(comparisons|heroCompare|heroDelta|kpiTip|bridge[A-Z]|cal[A-Z]|calendar|monthCells|yearCells|dowHead|dayTip|showCal|toggleCalView)/,
    why: "컷 목록 — «8월 실데이터 도착 후». 비교 대상이 DB에 없으면 지어도 렌더되지 않는다 (§21-4 워터폴 이행 시점)",
  },
  {
    name: "리포트 레이아웃 · 아카이브",
    fields: /^(isReport|report[A-Z]|print[A-Z]|exitReport|archive[A-Z]|toggleArchive|showToolbar|rp[A-Z])/,
    why: "컷 목록 — PDF 리포트는 Pro 기능이고 배포 단계 일이다 (§16-4)",
  },
  {
    name: "저장된 뷰 · 기간 범위 선택기",
    fields: /^(saveView|savedViews|viewName|viewDirty|viewsOpen|newViewName|setNewViewName|viewSaveNote|toggleViews|range[A-Z]|toggleRange|resetRange|prevMonth|nextMonth|prevDis|nextDis|presetItems)/,
    why: "월 선택기(MVP 1)가 그 자리를 최소형으로 대신한다. 임의 기간·저장된 뷰는 MVP 후",
  },
  {
    name: "현금흐름 · 무버스 · 플래그",
    fields: /^(cash[A-Z]|movers[A-Z]|flags|flagCount|marketDown|downTitle|downBody)/,
    why: "컷 목록 — 대시보드 3단 계열. 재료(전월 비교·정산 예정일)가 아직 없다",
  },
  {
    name: "미구현 화면 — 진단",
    fields: /^(diagTabs|diagToTable|dt[A-Z]|quad[A-Z]|cac[A-Z]|growth[A-Z]|newProds|last[A-Z]|actions|openQuadFull)/,
    why: "컷 목록 — «없어도 손익이 보인다». 화면이 §21-7로 「준비 중」을 말하고 있다",
  },
  {
    /**
     * ★ 광고비 탭은 **더 이상 컷이 아니다** (2026-08-21 · 조사 2.6) ★
     *
     * `ad(Alloc|Count|Roas|Rows|Total|Unalloc)`와 `ctAd`가 여기서 빠졌다 — 전부
     * 배선됐다. 이 선언이 낡은 채로 남아 있으면 **배선된 화면을 「미구현」이라고
     * 세면서 안 보게 된다**. 이 저장소가 반복해 겪은 병이라(팔레트·광고비 배분에
     * 이어 셋째) 같은 커밋에서 닫는다.
     *
     * 미룬 사유 자체도 틀려 있었다: 「만들어도 빈 화면 — `fact_ad_spend`가 실 DB·
     * 데모 둘 다 0행」이라 적혀 있었는데, 2026-08-21 실측에서 실 DB는
     * **80,137행 · 15,700,534원**이었다. 커밋된 픽스처만으로 `pnl.ts --clean`이
     * 채운다 — 「사용자가 광고 파일을 넣어야 한다」도 참이 아니었다.
     *
     * 2026-08-19에도 절반이 이렇게 빠졌다(고정비 표·3층 표·`costTabs`).
     */
    name: "미구현 화면 — 비용 (원가 탭)",
    fields: /^(cd[A-Z]|cost(Changes|Miss|Rows|Total)|set(CdCost|CdFrom|CdMemo))/,
    why:
      "컷 목록 — 비용 화면의 **원가 탭**. 원가는 상품 화면에 이미 있으므로 여기에 " +
      "두 번 그리지 않는다(U-3: 같은 일을 하는 자리를 둘 만들면 어느 쪽이 참인지 " +
      "모른다). 광고비 탭은 2026-08-21에 배선돼 이 컷에서 빠졌다",
  },
  {
    /**
     * ★ 커맨드 팔레트는 더 이상 컷이 아니다 (2026-08-20 · 감사 A-2-3) ★
     * `cmd*`·`closeCmd`·`onCmd*`가 배선됐다. 이름과 사유에서 뺐다 — 낡은 선언이
     * 남아 있으면 다음 사람이 «팔레트는 안 만들기로 했구나»로 읽는다.
     *
     * ⚠ **그때 「정규식에는 남겨 둔다 — `openCmd`는 목업에만 있고 우리가 안 쓰는
     * 이름이다」고 적었는데 그것이 거짓이었다** (2026-08-21에 새 게이트가 잡았다).
     * `palette.ts:91`이 `vals.openCmd = actions.open`으로 채우고 있고 사이드바의
     * ⌘K 상자(`Template.tsx:88`)가 그걸 쓴다. **팔레트는 통째로 배선됐다.**
     * 선언을 절반만 걷으면 나머지 절반이 그대로 썩는다 — 그 자리를 이제 기계가 문다.
     */
    name: "미구현 화면 — 설정·라이선스",
    fields: /^(lic[A-Z]|setLicKey|ss[A-Z]|creds|genRows|adjRows|askReset|setSections|confirmType|setConfirmType|modal|modalOpen|closeModal|detail|hasDetail|closeDetail|closeQuadFull)/,
    why: "컷 목록 — 설정 화면. 배포 단계 일이다 (커맨드 팔레트는 2026-08-20에 배선됐다)",
  },
  {
    // ★ 2026-08-19 B1에서 필드매핑 읽기 배선이, B2에서 확인 완료(confirmFm·
    // fmConfirmable)가 끝났다 ★ 남는 것은 §20 트리거 게이트 안의 것뿐이다:
    // 드리프트(diff*·toggleDiff·applyUpdate·fmUpdate*)와 질문 카드(cf*)는
    // «8월 실전 실물 1회» 게이트다 — 컷에 남아 있는 것이 게이트 준수의 기계적
    // 증거다. 확인 완료가 빠진 근거는 §20 규칙 1 개정(2026-08-18 사용자 확정) —
    // «펼치면 전체 편집 표»는 게이트 밖이고, 그 표의 저장 버튼이 confirmFm이다.
    name: "§20 게이트 — 드리프트·질문 카드 + 미구현(내 필드·데이터 구조)",
    fields: /^(diff[A-Z]|toggleDiff|applyUpdate|fmUpdate|cf[A-Z]|addCf|entities|formula|pipeline)/,
    why:
      "드리프트·질문 카드는 §20 구현 트리거(8월 실전 실물 1회) 게이트 안이다. " +
      "내 필드·데이터 구조 화면은 배포 단계 일",
  },
  {
    /**
     * ★ `headMore*`와 `syncAll`을 여기서 뺐다 (2026-08-20 감사) ★
     *
     * 둘 다 배선됐다. 그리고 애초에 **여기 있으면 안 되는 것들**이었다 —
     * 사유가 «MVP 세 동작에 없다»인데, `toggleHeadMore`는 768px 미만에서 CSS가
     * 지운 기간 선택기를 **되찾는 유일한 통로**였고 `syncAll`은 전 화면 상단의
     * 주 버튼이었다. 배지와 같은 취급을 받아 게이트가 초록인 채로 남았다.
     * `exp[A-Z]`가 「표 필터」 컷에 접혀 있던 것과 같은 병이다.
     */
    name: "헤더 부가 — 배지·표시 메뉴",
    fields: /^(attn[A-Z]|toggleAttn|disp[A-Z]|toggleDisp|closeDisp|(?!fm)[a-z]+Badge|pendingCount|unmappedCount|catItems)/,
    why: "MVP 세 동작에 없다. 배지는 «지금 몇 건»을 세는 조회가 화면마다 더 필요해 값보다 비용이 크다",
  },
  {
    name: "★ 금지된 것 — 「동기화」 카피",
    fields: /^(syncColor|syncLine)/,
    why: "LOCK 10 — 양방향·자동이 실존하기 전까지 «동기화» 카피 금지. **배선하면 안 되는 자리**다",
  },
  {
    name: "표 필터·검색·열 숨김",
    fields: /^(filter[A-Z]|toggleFilter|hasFilters|clear[A-Z][a-z]*Filter|hasOrderFilter|orderFilterLabel|toggleExpHidden|expHiddenBg|hasQuery|clearQuery|pnlQuery|onPnlQuery|showAllProducts|hasRest|rest|setTabs|stateTabs)/,
    why:
      "표가 60행 규모라 스크롤로 충분하다. 수백 행이 되는 날 다시 본다 (등재). " +
      "★ `toggleExpHidden`·`expHiddenBg`(「숨긴 컬럼도 포함」 체크박스)가 여기 있는 이유: " +
      "**열 숨김 기능 자체가 없어서** 포함할 숨긴 열이 없다. 내보내기는 2026-08-20에 " +
      "만들었지만 이 체크박스는 열 숨김이 생기는 날 함께 산다 — 그때까지는 «켜도 " +
      "아무 차이가 없는 컨트롤»이라 배선하는 것이 오히려 거짓말이다",
  },
  {
    /**
     * ★ 내보내기 부채는 **닫혔다** (2026-08-20) ★
     *
     * 여기 「내보내기 — ⚠ LOCK 8 부채(컷이 아니라 기한)」 컷이 있었다. 그 전에는
     * `exp[A-Z]` 다섯 자리가 위 「표 필터·검색」 컷에 «표가 60행이라 스크롤로
     * 충분하다»는 **남의 사유**로 묶여 있었고, 그래서 배선 게이트가 초록인 채
     * 헌장 B-10(내보내기 무료 전면 개방)의 전면 부재를 덮고 있었다.
     *
     * 감사가 그것을 부채로 갈라냈고, 이 커밋이 만들어서 컷 자체를 없앴다.
     * 남은 것은 `toggleExpHidden` 하나뿐인데 그건 **열 숨김이 없어서** 못 켠다 —
     * 위 「표 필터·검색」 컷에 남는 것이 맞다 (거기가 제 자리다).
     *
     * 이 주석은 지우지 않는다. 컷이 사라진 자리에 «왜 있었나»가 없으면
     * 다음 사람이 같은 것을 다시 컷으로 선언한다.
     */
    name: "§21-4 — 비용 구성 호버 툴팁",
    fields: /^(mixTip)$/,
    why:
      "도넛·막대 **범례에 금액을 인라인으로** 준다(§9 — 호버 의존 금지). 그러면 툴팁이 " +
      "답할 질문이 남지 않는다. 보존 게이트의 `cost-bars` 구간 선언에 같은 이유가 적혀 있다",
  },
  {
    name: "가져오기 — URL·직접 입력 경로",
    fields: /^(fetchUrl|url(?!Imported)[A-Z]|setUrl|man[A-Z]|clearImpChannel)/,
    why: "ADR-013 — 파일은 웹 표준 `<input type=file>`로 받는다. URL·수동 입력은 IPC 표면을 늘리므로 MVP 후",
  },
  {
    name: "이벤트 유틸 · 첫 실행 토글",
    fields: /^(closeMenus|js|firstRunLabel|toggleFirstRun|hero(Bg|Color|Icon)|heroBasisGo|pnlCaption)/,
    why: "표시용 상수이거나 목업의 데모 토글이다. 값을 넣어도 화면이 달라지지 않는다",
  },
]

/** 선언된 컷인가. 아니면 **미분류** — 그것이 남은 일의 목록이다. */
function cutOf(field: string): string | null {
  for (const c of CUTS) if (c.fields.test(field)) return c.name
  return null
}

export interface ScreenCoverage {
  readonly screen: string
  readonly consumed: readonly string[]
  readonly wired: readonly string[]
  /** 소비되는데 안 채워진 것 전부 (선언된 컷 포함). */
  readonly unwired: readonly string[]
  /** ★ 그중 **선언되지 않은 것** — 이것이 남은 일이다. */
  readonly todo: readonly string[]
}

export interface WiringReport {
  readonly screens: readonly ScreenCoverage[]
  /** 화면 전체를 통틀어 한 번이라도 소비되는 필드. */
  readonly allConsumed: readonly string[]
  readonly allWired: readonly string[]
  readonly allUnwired: readonly string[]
  /** ★ 게이트가 지키는 수 — 선언되지 않은 미배선. */
  readonly allTodo: readonly string[]
  /** 선언 이름 → 그 선언이 덮은 **미배선** 필드 수. 통째로 낡은 선언(0건)을 잡는다. */
  readonly cutHits: Readonly<Record<string, number>>
  /**
   * ★ 선언 이름 → 그 선언이 덮는 **이미 배선된** 필드들 (2026-08-21) ★
   *
   * 컷은 「안 만들기로 한 것」이다. 그러니 **배선된 필드를 덮는 컷 선언은 그 자체로
   * 거짓**이다 — 만들어 놓고 「안 만든다」고 적어 둔 상태다.
   *
   * ★ 왜 `cutHits === 0`으로는 부족했나 ★ 그건 **그룹이 통째로** 낡아야 잡는다.
   * 오늘(2026-08-21) 「미구현 화면 — 비용 (광고비 탭·원가 탭)」은 원가 탭 필드
   * 11개를 여전히 덮고 있어 `cutHits = 11`이었고, 그 사이 **광고비 탭은 배선됐는데도**
   * 게이트가 조용했다. 한 그룹 안에서 **일부만 낡는 것**이 이 저장소가 반복해 겪은
   * 모양이다 — 오늘로 **세 번째**다:
   *
   *   `exp[A-Z]`        → 「표 필터」 컷에 접혀 있었다 (2026-08-20 발견)
   *   `toggleHeadMore`  → 「배지」 컷에 접혀 있었다     (같은 날)
   *   `ad*` · `ctAd`    → 「미구현 화면 — 비용」 컷에   (2026-08-21)
   *
   * 세 번이면 우연이 아니라 구조다. 산문으로 「컷 선언이 낡는 것이 이 저장소가
   * 반복해 겪은 병이다」라고 세 번 적는 대신 기계가 한 번 물게 한다.
   */
  readonly cutStale: Readonly<Record<string, readonly string[]>>
}

/** 배선 파일 전부에서 «채워지는 필드»를 모은다. */
function wiredFields(): Set<string> {
  const out = new Set<string>()
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${e.name}`
      if (e.isDirectory()) {
        // 생성물은 값을 채우지 않는다 — 읽기만 한다. 세면 자기 자신을 배선으로 센다.
        if (e.name !== "generated") walk(path)
        continue
      }
      if (!/\.tsx?$/.test(e.name)) continue
      const src = readFileSync(path, "utf8")
      for (const m of src.matchAll(ASSIGNED)) out.add(m[1]!)
    }
  }
  walk(APP_DIR)
  return out
}

/**
 * 화면별로 가른다. `data-screen-label`이 나오는 줄부터 다음 라벨 전까지가 한 화면이고,
 * 첫 라벨보다 앞은 **셸**(사이드바·헤더·모달)이다 — 화면이 아니라 늘 떠 있는 것들이라
 * 따로 센다.
 */
export function wiringReport(): WiringReport {
  const lines = readFileSync(TEMPLATE, "utf8").split("\n")
  const marks: { screen: string; at: number }[] = []
  lines.forEach((l, i) => {
    const m = /data-screen-label="([^"]+)"/.exec(l)
    if (m) marks.push({ screen: m[1]!, at: i })
  })

  const wired = wiredFields()
  const screens: ScreenCoverage[] = []
  const seenAll = new Set<string>()

  const collect = (from: number, to: number): string[] => {
    const set = new Set<string>()
    for (const line of lines.slice(from, to)) {
      for (const m of line.matchAll(CONSUMED)) set.add(m[1]!)
    }
    return [...set].sort()
  }

  const push = (screen: string, from: number, to: number): void => {
    const consumed = collect(from, to)
    consumed.forEach((f) => seenAll.add(f))
    const unwired = consumed.filter((f) => !wired.has(f))
    screens.push({
      screen,
      consumed,
      wired: consumed.filter((f) => wired.has(f)),
      unwired,
      todo: unwired.filter((f) => cutOf(f) === null),
    })
  }

  if (marks.length > 0) push("셸 (사이드바·헤더·모달)", 0, marks[0]!.at)
  marks.forEach((m, i) => push(m.screen, m.at, marks[i + 1]?.at ?? lines.length))

  const allConsumed = [...seenAll].sort()
  const allUnwired = allConsumed.filter((f) => !wired.has(f))
  const cutHits: Record<string, number> = {}
  const cutStale: Record<string, string[]> = {}
  for (const c of CUTS) {
    cutHits[c.name] = 0
    cutStale[c.name] = []
  }
  for (const f of allUnwired) {
    const c = cutOf(f)
    if (c !== null) cutHits[c] = (cutHits[c] ?? 0) + 1
  }
  const allWired = allConsumed.filter((f) => wired.has(f))
  // 배선된 것을 덮는 컷 = 만들어 놓고 「안 만든다」고 적어 둔 선언. 위 주석 참조.
  for (const f of allWired) {
    const c = cutOf(f)
    if (c !== null) cutStale[c]!.push(f)
  }
  return {
    screens,
    allConsumed,
    allWired,
    allUnwired,
    allTodo: allUnwired.filter((f) => cutOf(f) === null),
    cutHits,
    cutStale,
  }
}

/** 사람이 읽는 보고. `npm run wiring`이 이걸 찍는다. */
export function formatReport(r: WiringReport): string {
  const out: string[] = []
  const pctOf = (a: number, b: number): string => (b === 0 ? "—" : `${Math.round((a / b) * 100)}%`)

  out.push("화면별 배선 — 마크업이 쓰는 자리 중 값이 들어오는 비율")
  out.push("")
  out.push(
    `${"화면".padEnd(26)}${"소비".padStart(5)}${"배선".padStart(6)}${"컷".padStart(5)}${"남은일".padStart(7)}${"배선률".padStart(8)}`,
  )
  out.push("─".repeat(54))
  for (const s of r.screens) {
    const live = s.consumed.length - (s.unwired.length - s.todo.length)
    out.push(
      s.screen.padEnd(26) +
        String(s.consumed.length).padStart(5) +
        String(s.wired.length).padStart(6) +
        String(s.unwired.length - s.todo.length).padStart(5) +
        String(s.todo.length).padStart(7) +
        pctOf(s.wired.length, live).padStart(8),
    )
  }
  out.push("─".repeat(54))
  out.push(
    "합계(중복 제거)".padEnd(26) +
      String(r.allConsumed.length).padStart(5) +
      String(r.allWired.length).padStart(6) +
      String(r.allUnwired.length - r.allTodo.length).padStart(5) +
      String(r.allTodo.length).padStart(7) +
      pctOf(r.allWired.length, r.allConsumed.length - (r.allUnwired.length - r.allTodo.length)).padStart(8),
  )
  out.push("")
  out.push("★ 배선률의 분모는 «컷을 뺀 것»이다 — 컷은 안 만들기로 한 것이지 못 만든 것이 아니다")
  out.push("")
  out.push("남은 일 — 선언되지 않은 미배선")
  if (r.allTodo.length === 0) out.push("  없다. 소비되는 자리는 전부 채워졌거나 선언됐다")
  for (const s of r.screens) {
    if (s.todo.length === 0) continue
    out.push(`  ${s.screen} (${s.todo.length})`)
    out.push(`     ${s.todo.join(" · ")}`)
  }
  out.push("")
  out.push("선언된 컷 — 세되 «남은 일»로 세지 않는다")
  for (const c of CUTS) out.push(`  ${String(r.cutHits[c.name] ?? 0).padStart(3)}  ${c.name}`)

  const stale = Object.entries(r.cutStale).filter(([, fs]) => fs.length > 0)
  if (stale.length > 0) {
    out.push("")
    out.push("✖ 낡은 컷 선언 — **배선된 것을 「안 만든다」고 적어 두었다**")
    for (const [name, fs] of stale) {
      out.push(`  ${name}`)
      out.push(`     ${fs.join(" · ")}`)
    }
    out.push("  → 그 필드를 정규식에서 빼고, 선언문이 아직 참인지 다시 읽어라")
  }
  return out.join("\n")
}

/**
 * ★ CLI는 판정할 수 있어야 한다 — 아니면 리포트라고 불러야 한다 ★
 *
 * 2026-08-20 감사 B-5: 이 CLI가 `process.exitCode`를 **한 번도 안 세웠다.**
 * 남은 일이 100건이어도 exit 0이었고, 그런 명령을 CI에 걸면 **늘 초록인 게이트**가
 * 하나 더 생긴다 — 사람을 훈련시켜 게이트를 무시하게 만드는 바로 그 장치다
 * (`convert:gate`가 늘 빨개서 생긴 문제의 거울상).
 *
 * ★ 진짜 판정자는 여전히 `tests/wiring-coverage.test.ts`다 ★ 거기 `TODO_MAX = 0`이
 * 래칫으로 박혀 있고 그 시험은 CI의 `npm test`가 돌린다. `--check`는 **사람이 손으로
 * 부를 때** 같은 답을 내게 하려는 것이지, CI에 한 줄을 더 걸려는 게 아니다.
 */
if ((process.argv[1] ?? "").endsWith("wiring.ts")) {
  const report = wiringReport()
  console.log(formatReport(report))
  if (process.argv.includes("--check") && report.allTodo.length > 0) {
    console.error(`\n✖ 선언되지 않은 미배선 ${report.allTodo.length}건 — 배선하거나 컷으로 선언해라`)
    process.exitCode = 1
  }
}
