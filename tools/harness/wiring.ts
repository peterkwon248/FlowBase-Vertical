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
    fields: /^(comparisons|hasCompare|heroCompare|heroDelta|kpiTip|bridge[A-Z]|cal[A-Z]|calendar|monthCells|yearCells|dowHead|dayTip|showCal|toggleCalView)/,
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
    name: "미구현 화면 — 비용",
    fields: /^(ad(Alloc|Count|Roas|Rows|Total|Unalloc)|cd[A-Z]|cost(Changes|Miss|Rows|Tabs|Total)|ct[A-Z]|fix(Rows|Total)|layer[A-Z]|ops(Rows|Total)|set(CdCost|CdFrom|CdMemo))/,
    why: "컷 목록 — 고정비·운영비 입력 화면. 지금은 손익이 0원으로 정직하게 말한다",
  },
  {
    name: "미구현 화면 — 설정·라이선스·커맨드팔레트",
    fields: /^(lic[A-Z]|setLicKey|ss[A-Z]|creds|genRows|adjRows|askReset|setSections|confirmType|setConfirmType|cmd[A-Z]|openCmd|closeCmd|onCmd[A-Z]|modal|modalOpen|closeModal|detail|hasDetail|closeDetail|closeQuadFull)/,
    why: "컷 목록 — 설정 화면과 커맨드 팔레트. 배포 단계 일이다",
  },
  {
    name: "미구현 화면 — 필드 매핑·내 필드·데이터 구조",
    fields: /^(fm[A-Z]|diff[A-Z]|toggleDiff|applyUpdate|confirmFm|cf[A-Z]|addCf|entities|formula|pipeline)/,
    why: "컷 목록 — «수동 매핑 편집·양식 구독»은 배포 단계 일. 데이터 구조는 읽기 전용 설명 화면",
  },
  {
    name: "헤더 부가 — 배지·팝오버·표시 메뉴",
    fields: /^(attn[A-Z]|toggleAttn|headMore[A-Z]|toggleHeadMore|disp[A-Z]|toggleDisp|closeDisp|[a-z]+Badge|pendingCount|unmappedCount|catItems|syncAll)/,
    why: "MVP 세 동작에 없다. 배지는 «지금 몇 건»을 세는 조회가 화면마다 더 필요해 값보다 비용이 크다",
  },
  {
    name: "★ 금지된 것 — 「동기화」 카피",
    fields: /^(syncColor|syncLine)/,
    why: "LOCK 10 — 양방향·자동이 실존하기 전까지 «동기화» 카피 금지. **배선하면 안 되는 자리**다",
  },
  {
    name: "표 필터·검색·열 숨김",
    fields: /^(filter[A-Z]|toggleFilter|hasFilters|clear[A-Z][a-z]*Filter|hasOrderFilter|orderFilterLabel|exp[A-Z]|toggleExpHidden|hasQuery|clearQuery|pnlQuery|onPnlQuery|showAllProducts|hasRest|rest|setTabs|stateTabs)/,
    why: "표가 60행 규모라 스크롤로 충분하다. 수백 행이 되는 날 다시 본다 (등재)",
  },
  {
    name: "§21-4 — 비용 구성 호버 툴팁",
    fields: /^(mixTip)$/,
    why:
      "도넛·막대 **범례에 금액을 인라인으로** 준다(§9 — 호버 의존 금지). 그러면 툴팁이 " +
      "답할 질문이 남지 않는다. 보존 게이트의 `cost-bars` 구간 선언에 같은 이유가 적혀 있다",
  },
  {
    name: "가져오기 — URL·직접 입력 경로",
    fields: /^(fetchUrl|url[A-Z]|setUrl|man[A-Z]|clearImpChannel)/,
    why: "ADR-013 — 파일은 웹 표준 `<input type=file>`로 받는다. URL·수동 입력은 IPC 표면을 늘리므로 MVP 후",
  },
  {
    name: "이벤트 유틸 · 첫 실행 토글",
    fields: /^(stopEvt|closeMenus|stop|js|firstRunLabel|toggleFirstRun|goFieldmap|hero(Bg|Color|Icon)|heroBasisGo|pnlCaption)/,
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
  /** 선언 이름 → 그 선언이 덮은 필드 수. 낡은 선언(0건)은 게이트가 잡는다. */
  readonly cutHits: Readonly<Record<string, number>>
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
  for (const c of CUTS) cutHits[c.name] = 0
  for (const f of allUnwired) {
    const c = cutOf(f)
    if (c !== null) cutHits[c] = (cutHits[c] ?? 0) + 1
  }
  return {
    screens,
    allConsumed,
    allWired: allConsumed.filter((f) => wired.has(f)),
    allUnwired,
    allTodo: allUnwired.filter((f) => cutOf(f) === null),
    cutHits,
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
  return out.join("\n")
}

if ((process.argv[1] ?? "").endsWith("wiring.ts")) {
  console.log(formatReport(wiringReport()))
}
