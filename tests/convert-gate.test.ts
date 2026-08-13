/**
 * 보존 게이트가 **진짜 잡는지** 확인한다.
 *
 * 게이트가 녹색인 것만으로는 아무것도 증명되지 않는다 — 가드가 무를 수도,
 * 그 경로가 애초에 안 쓰일 수도 있다. 둘은 전혀 다른 결론이다 (ADR-007).
 * 그래서 출력에 **일부러 흠집을 내고** 게이트가 그걸 잡는지 본다.
 *
 * 흠집은 실제로 이식에서 일어날 법한 것들이다: 카피를 살짝 고치기, DS 클래스를
 * 빠뜨리기, 토큰을 다른 토큰으로 바꾸기, 표현식을 통째로 잃기, SVG 경로가
 * 뭉개지기. 마지막 것이 `attrs` 항목을 넓힌 이유다.
 */

import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { readTemplate } from "../tools/convert/source.js"
import { parseTemplate } from "../tools/convert/parse.js"
import { compareIr, irDiffCount, irFromTree, type IrField } from "../tools/convert/ir.js"
import { irFromTsx } from "../tools/convert/jsx-ir.js"
import { UNBUILT } from "../src/app/shell.js"

const MOCKUP = "mockup/FlowBase.dc.html"
const GENERATED = "src/app/generated/Template.tsx"

const src = readTemplate(MOCKUP)
const generated = readFileSync(GENERATED, "utf8")

/**
 * ★ 선언된 이탈 — 목업과 **일부러** 다른 자리 ★
 *
 * 게이트의 원래 규칙은 "diff 0"이었다. 그런데 목업을 그대로 따르면 오히려 헌장을
 * 어기는 자리가 실제로 있다. 그때 선택지는 둘뿐이다 — 게이트를 빨간 채로 두거나,
 * 이탈을 **선언**하거나. 빨간 게이트는 곧 꺼지므로(이 저장소가 이미 아는 교훈)
 * 선언하는 쪽을 만든다.
 *
 * 선언은 게이트를 무르게 하지 않는다. **오히려 강해진다** —
 *   · 선언한 것 말고 다른 차이가 있으면 여전히 실패한다
 *   · 선언이 **낡으면**(목업에 그 문구가 더는 없으면) 실패한다. 목록이 썩지 않는다
 *
 * 그래서 이 배열이 곧 *"목업과 다르게 만든 자리의 전체 목록"*의 기계 검사판이다.
 * 사람이 읽는 판은 `docs/목업-결함-발견분.md`에 있다.
 */
const DEVIATIONS: { field: IrField; from: string[]; to: string[]; why: string }[] = [
  {
    field: "texts",
    from: ["데이터 신선도"],
    to: ["이 숫자가 담지 못한 것"],
    why:
      "이 카드에 연결별 신선도 대신 손익의 결손(`pnlGaps`)을 올렸다. CLI가 손익 밑에 " +
      "늘 출력하던 단서를 화면이 두고 오면 사용자는 순이익을 완성된 숫자로 읽는다 (A-5). " +
      "실제 연결 신선도는 연결 배선이 생길 때 자기 카드를 받는다",
  },
  {
    field: "texts",
    from: ["마켓 API 장애와 무관하게 마지막 성공 동기화 데이터로 계속 조회됩니다."],
    to: ["여기 있는 항목은 위 숫자에 반영되지 않았습니다. 기준 데이터를 넣거나 빠진 파일을 가져오면 목록에서 사라집니다."],
    why:
      'LOCK 10 — "동기화" 카피는 양방향·자동이 실존하기 전까지 금지다. 게다가 우리는 ' +
      "마켓 API를 부르지 않으므로(파일 가져오기뿐) 원문은 사실도 아니다. 문서 우선순위상 " +
      "헌장이 목업을 이긴다",
  },

  // ── §21-4 «KPI 카드 — 스파크라인 제거» ────────────────────────────────
  // "값 · 변화 · 분모만 남긴다. 추세는 아래의 큰 차트가 말한다."
  {
    field: "styles",
    from: [
      "display:grid", "gridAutoFlow:column", "gridAutoColumns:1fr", "alignItems:end",
      "gap:2px", "height:18px",
      "display:block", "width:100%", "height:{s.h}", "background:{s.c}",
      "borderRadius:1px", "opacity:{s.op}", "cursor:default",
    ],
    to: [],
    why: "§21-4 스파크라인 제거 — 막대 컨테이너(6)와 막대 자체(7)의 스타일이 통째로 빠진다",
  },
  {
    field: "attrs",
    from: ["onMouseEnter={s.enter}", "onMouseLeave={s.leave}"],
    to: [],
    why: "§21-4 스파크라인 제거 — 막대의 호버 핸들러도 함께 사라진다",
  },
  {
    field: "holes",
    from: ["k.spark", "s.h", "s.c", "s.op", "s.enter", "s.leave"],
    to: [],
    why: "§21-4 스파크라인 제거 — 막대를 그리던 동적 자리 6개가 전부 없어진다",
  },
  {
    field: "styles",
    from: ["gridTemplateRows:15px 26px 15px 18px 14px"],
    to: ["gridTemplateRows:{kpiRows}"],
    why:
      "스파크라인 줄(18px)이 빠지고, 비교가 없으면 «변화» 줄(15px)도 빠진다. 행 정의를 " +
      "상수로 두면 사라진 요소 자리에 빈 칸이 남으므로 데이터를 따르게 한다",
  },
  {
    field: "holes",
    from: ["kpis", "k.label"],
    to: ["kpis", "kpiRows", "k.label"],
    why: "위 `gridTemplateRows:{kpiRows}`가 만든 새 동적 자리",
  },

  // ── 비교 문장을 데이터에 묶는다 (결함 47의 잔여분) ────────────────────
  // 값은 이미 비어 있었지만 **문장**이 살아 있어 화면이 없는 비교를 있는 것처럼
  // 말했다. 고치는 방향은 문장을 바꾸는 것이 아니라 **존재 조건을 데이터에 묶는 것**이다 —
  // 그래야 8월 파일이 들어오는 날 스스로 살아나고, 그때 다시 켜는 작업이 생기지 않는다.
  {
    field: "holes",
    from: ["heroNet", "heroBg"],
    to: ["heroNet", "hasCompare", "heroBg"],
    why: '히어로의 «vs 지난달» 줄 전체를 `hasCompare`로 감쌌다. 비교 대상이 DB에 없는데 "vs 7월 같은 기간"이 떠 있었다',
  },
  {
    field: "holes",
    from: ["r.val", "kpiTip"],
    to: ["r.val", "hasCompare", "kpiTip"],
    why:
      '지표 스트립의 설명문("숫자 = 8월 누계 · 옆의 %는 전월 같은 기간 대비 · 막대는 8/1 → 8/8")을 ' +
      "감쌌다. 한 문장에 거짓이 셋이었다 — 8월도, 전월 비교도, 일별 막대(스파크라인)도 없다",
  },
  {
    field: "holes",
    from: ["k.value", "k.deltaColor"],
    to: ["k.value", "k.hasDelta", "k.deltaColor"],
    why: 'KPI 카드의 «전월 대비» 라벨 줄을 `k.hasDelta`로 감쌌다. 값은 비어 있는데 라벨만 남아 "계산 중"처럼 읽혔다',
  },

  // ── §21-7 «미구현 화면» 게이트 재지정 ─────────────────────────────────
  // 안내 블록 자체는 `S21_REGIONS`가 빼지만 **기존 게이트를 갈아끼운 자국**은 남는다.
  // 미구현 화면에서는 온보딩도 본문도 그리지 않으므로 두 조건이 함께 바뀐다.
  {
    field: "holes",
    from: ["firstRun", "goImport", "notFirstRun", "diagTabs"],
    to: ["diagUnbuilt", "diagOnboard", "goImport", "diagReady", "diagTabs"],
    why:
      "§21-7 — 진단 화면의 온보딩·본문 게이트를 **화면별 상태**로 갈아끼웠다. `firstRun`은 " +
      "«앱에 데이터가 하나도 없다»인데 배선 안 된 화면의 «만들지 않았다»까지 그 하나로 " +
      "판정되고 있었다. 앞의 `diagUnbuilt`는 신설 안내 블록을 감싼 조건이다. " +
      "**배선 시 제거** — 진단이 배선되면 세 홀 모두 사라지고 `firstRun`/`notFirstRun`로 돌아간다",
  },

  // ── LOCK 10 «동기화» 전수 (결함 50) ───────────────────────────────────
  {
    field: "texts",
    from: ["원가는 마켓이 주지 않습니다. 회사만 아는 값이라 여기서 직접 입력하고, 동기화가 덮어쓰지 않습니다. 단가는"],
    to: ["원가는 마켓이 주지 않습니다. 회사만 아는 값이라 여기서 직접 입력하고, 가져오기가 덮어쓰지 않습니다. 단가는"],
    why:
      'LOCK 10 — 결함 46·48에 이은 세 번째 «동기화». 이 자리는 **조건 뒤에 숨어 있어**(`ctCogs`가 ' +
      "`emptyVals`에서 false다) 렌더 기반 검사로는 영영 안 보였다. 문장 자체는 참이지만 " +
      "우리 어휘로는 «가져오기»가 덮어쓰지 않는 것이다 — 사실도 그렇다. 원가는 기준 데이터고 " +
      "가져오기는 사실만 넣는다",
  },

  // ── §21-6 «상품 연결» ─────────────────────────────────────────────────
  // 신설 요소 셋은 `S21_REGIONS`가 통째로 빼고, 여기 남는 것은 **기존 마크업에
  // 남은 자국**이다 — 신설 요소를 감싼 조건, 넓어진 그리드, 그리고 카피 2건.
  {
    field: "texts",
    from: [
      "마켓에서 들어온 리스팅 중 FlowBase SKU에 아직 붙지 않은 것만 모입니다. 한 번 이어주면 그 마켓 ID는 기록으로 남아 다음 동기화부터 자동으로 붙습니다.",
    ],
    to: [
      "마켓에서 들어온 리스팅 중 FlowBase SKU에 아직 붙지 않은 것만 모입니다. 한 번 이어주면 같은 리스팅이 다시 올 때 그 연결이 유지됩니다.",
    ],
    why:
      "결함 48 — 한 문장에 위반이 둘이었다. «동기화»는 LOCK 10이 금지하고(우리는 파일 " +
      "가져오기뿐이다), «자동으로 붙습니다»는 ADR-012가 보증하지 않는다. 보증되는 것은 " +
      "같은 `listing_key`가 다시 왔을 때의 **보존**이지 새 리스팅의 자동 연결이 아니다",
  },
  {
    field: "texts",
    from: ["— 다음 가져오기부터 자동으로 붙습니다"],
    to: ["— 같은 리스팅이 다시 오면 이 연결이 유지됩니다"],
    why:
      "결함 48 — done 탭의 같은 약속. 새 옵션(색상:그린)은 `unlinked`로 태어난다. " +
      "자동 연결을 만들지 않는 이유는 작업 리듬 12다 — 같은 SKU인지는 사실이 아니라 " +
      "판단이고(옵션마다 원가가 다를 수 있다), 검토 전에 접으면 사람은 접힌 것만 본다",
  },
  {
    field: "holes",
    from: ["t.count", "linkEmpty"],
    to: ["t.count", "linkTabTodo&&!vals.linkEmpty", "linkEmpty"],
    why:
      "§21-6 ② 일괄 바(`data-s21=\"link-bulk\"`)를 감싼 조건. 구간 자체는 빠지지만 " +
      "**조건은 부모에 남는다** — 신설 요소가 기존 마크업에 남기는 자국이고, 그 자국까지 " +
      "선언해야 «선언 밖은 그대로»가 참이 된다",
  },
  {
    field: "holes",
    from: ["r.price", "linkTabTodo", "r.ignore"],
    to: ["r.price", "r.folded", "linkTabTodo", "linkTabTodo", "r.ignore"],
    why:
      "§21-6 ①②가 남긴 조건 둘 — `r.folded`(군집 블록) · `linkTabTodo` 하나 더" +
      "([새 SKU로 등록] 묶음). 뒤의 `linkTabTodo`·`r.ignore`는 목업의 «무시» 버튼 그대로다",
  },
  {
    field: "holes",
    from: ["linkTabTodo", "r.cands"],
    to: ["linkTabTodo&&r.hasCands", "r.cands"],
    why:
      "«추천 SKU — 이름과 코드가 겹치는 정도» 머리글의 **존재 조건을 데이터에 묶었다.** " +
      "목업은 SKU가 이미 있는 세계를 전제해 후보가 빌 일이 없었지만, 콜드스타트(SKU 0)에서는 " +
      "카드 61장 전부가 아무것도 없는 머리글을 이고 서서 «계산 중»처럼 읽힌다. " +
      "결함 47(비교 문장)과 **같은 처방**이고 — 문구가 아니라 조건을 고친다 — 첫 SKU가 " +
      "생기는 순간 스스로 살아난다. 그 자리를 지금 채우는 것이 §21-6 ②다",
  },
  {
    field: "holes",
    from: ["c.label", "c.sku"],
    to: ["c.label", "c.shared", "c.sku"],
    why:
      "§21-6 ③ «후보별 근거 한 줄» — 겹친 토큰을 후보 행에 **인라인으로** 넣는다. " +
      "구간 선언이 아니라 값 치환으로 둔 이유는, 이 자리는 통째로 갈아엎는 곳이 아니라 " +
      "기존 행에 칸 하나가 늘어난 곳이라서다 — 나머지 네 칸은 여전히 1:1로 대조된다",
  },
  {
    field: "styles",
    from: [
      "gridTemplateColumns:44px minmax(0, 1fr) 148px 62px",
      "alignItems:center", "gap:12px",
      "font:var(--fw-semi) 11px var(--font-mono)", "color:{c.confColor}",
      "font:var(--fw-medium) 12px var(--font-sans)", "color:var(--fg-2)",
      "whiteSpace:nowrap", "overflow:hidden", "textOverflow:ellipsis",
      "font:var(--fw-medium) 11px var(--font-mono)", "color:var(--fg-4)",
      "whiteSpace:nowrap", "overflow:hidden", "textOverflow:ellipsis",
    ],
    to: [
      // 148px → 96px. §21-6이 못박은 우선순위다 — «공간이 부족하면 SKU 코드 열을
      // 줄이지 근거를 접지 않는다». 근거가 툴팁으로 밀리는 순간 제안은 근거 없는
      // 지시가 되고, §21-1이 derived에 건 근거 진입로 의무가 깨진다.
      "gridTemplateColumns:44px minmax(0, 1fr) minmax(0, 1fr) 96px 62px",
      "alignItems:center", "gap:12px",
      "font:var(--fw-semi) 11px var(--font-mono)", "color:{c.confColor}",
      "font:var(--fw-medium) 12px var(--font-sans)", "color:var(--fg-2)",
      "whiteSpace:nowrap", "overflow:hidden", "textOverflow:ellipsis",
      // 신설 — 근거 칸. 식별자가 아니라 낱말이라 mono가 아닌 sans이고,
      // SKU 코드(--fg-4)보다 한 단계 밝게(--fg-3) 둬서 «읽는 것»임을 표시한다.
      "font:var(--fw-medium) 11px var(--font-sans)", "color:var(--fg-3)",
      "whiteSpace:nowrap", "overflow:hidden", "textOverflow:ellipsis",
      "font:var(--fw-medium) 11px var(--font-mono)", "color:var(--fg-4)",
      "whiteSpace:nowrap", "overflow:hidden", "textOverflow:ellipsis",
    ],
    why: "§21-6 ③ — 후보 행이 4칸에서 5칸이 된다. SKU 코드 열을 줄여 근거 칸을 만들었다",
  },
  {
    field: "tokens",
    // 앞의 `--font-mono`(일치도 칸)까지 붙여야 유일해진다 — 뒤 6개만으로는 4곳에서
    // 잡히고, `indexOfRun`이 그걸 세우고 알려줬다. 가드의 가드가 실제로 일한 자리다.
    from: [
      "--font-mono",
      "--fw-medium", "--font-sans", "--fg-2",
      "--fw-medium", "--font-mono", "--fg-4",
    ],
    to: [
      "--font-mono",
      "--fw-medium", "--font-sans", "--fg-2",
      "--fw-medium", "--font-sans", "--fg-3",
      "--fw-medium", "--font-mono", "--fg-4",
    ],
    why: "§21-6 ③ 근거 칸이 참조하는 토큰 3개. 위 `styles` 선언의 짝이다",
  },
]

/**
 * `hay`에서 `needle` **연속 구간**의 시작 위치. 없으면 -1.
 *
 * ★ 여러 번 나오면 오류다 ★ 첫 자리를 고르면 **엉뚱한 구간을 갈아끼우고도
 * 게이트는 녹색**이 된다. `"v-num"` 하나처럼 흔한 값은 특히 그렇다. 그래서
 * 모호하면 세우고, 선언하는 쪽이 문맥을 붙여 유일하게 만들도록 요구한다.
 */
function indexOfRun(hay: readonly string[], needle: readonly string[]): number {
  if (needle.length === 0) return -1
  const hits: number[] = []
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer
    hits.push(i)
  }
  if (hits.length > 1) {
    throw new Error(
      `선언이 모호하다: ${JSON.stringify(needle).slice(0, 90)} 구간이 ${hits.length}곳에서 잡힌다. ` +
        `앞뒤 항목을 붙여 유일하게 만들어야 한다 — 아니면 엉뚱한 자리가 바뀌어도 게이트가 녹색이다`,
    )
  }
  return hits[0] ?? -1
}

/**
 * 선언된 이탈을 기대값에 반영한다. **연속 구간을 통째로 갈아끼운다** —
 * `from`을 찾아 `to`로 splice한다. 길이가 달라도 되므로 카피 한 줄 교체부터
 * 요소 삭제(`to: []`)·신설(`from`은 인접 항목, `to`는 그것 + 새 항목)까지 한 어휘로 적는다.
 *
 * ★ 왜 인덱스가 아니라 **내용**으로 찾는가 ★
 * §21 패치는 요소를 지우고 새로 그리므로 뒤따르는 모든 인덱스가 밀린다. 인덱스로
 * 선언하면 이탈 하나를 추가할 때마다 나머지 선언이 전부 어긋난다 — 그런 목록은
 * 유지되지 않는다. 내용으로 찾으면 **선언끼리 독립**이고, 목업에서 그 문구가
 * 사라지는 순간 자동으로 낡은 것으로 잡힌다.
 *
 * ★ 이 장치의 한계를 정직하게 ★
 * 도넛을 막대로 바꾼 자리에는 **대조할 원본이 없다**. 게이트가 그 구간에서
 * 증명하는 것은 "같다"가 아니라 **"여기가 바뀐다고 선언돼 있다"**뿐이다.
 * 게이트의 진짜 값은 **선언 밖이 그대로임**을 보증하는 데 있다.
 */
function applyDeviations(ir: ReturnType<typeof irFromTree>): ReturnType<typeof irFromTree> {
  const out = { ...ir }
  for (const d of DEVIATIONS) {
    const list = [...out[d.field]]
    const at = indexOfRun(list, d.from)
    if (at === -1) {
      throw new Error(
        `선언된 이탈이 낡았다: 목업의 ${d.field}에 ${JSON.stringify(d.from)} 구간이 없다. ` +
          `목업이 바뀌었거나 이탈이 필요 없어진 것이다 — DEVIATIONS에서 지워야 한다`,
      )
    }
    list.splice(at, d.from.length, ...d.to)
    out[d.field] = list
  }
  return out
}

/**
 * ★ §21이 **통째로 갈아엎은 구간** ★
 *
 * 카피 한 줄 교체(`DEVIATIONS`)와 달리, 여기는 요소가 사라지고 다른 것이 들어온다.
 * 값 단위로 선언하려면 스타일·토큰만 백 개가 넘고 **그 목록은 유지되지 않는다.**
 * 그래서 구간째 뺀다 — 목업 쪽은 그 요소의 `style` 원문으로, 출력 쪽은
 * `data-s21` 표식으로 짚는다.
 *
 * ★ 정직하게: 이 구간에서 게이트가 증명하는 것은 "같다"가 아니다 ★
 * 대조할 원본이 없으므로 증명되는 것은 **"여기가 바뀐다고 선언돼 있다"**뿐이다.
 * 게이트의 값은 **선언 밖 전 항목이 그대로임**을 보증하는 데 있고, 아래 두
 * 테스트가 선언 자체의 유효성(목업에 실재 · 출력에 표식 실재)을 지킨다.
 *
 * ★ 두 종류를 구분한다 — `mockupStyle`이 있으면 «교체», `null`이면 «순수 신설» ★
 *
 * 도넛→막대는 목업의 요소를 **치우고 그 자리에** 다른 것을 놓았다. §21-6의 셋은
 * 다르다 — 목업에 대응물이 아예 없다. 목업이 «SKU가 이미 있는 세계»를 전제하고
 * 그려서 콜드스타트(SKU 0)를 보지 못했기 때문이고, 그건 결함이 아니라 전제의
 * 시차다 (§21-6).
 *
 * 둘을 한 어휘로 뭉뚱그리면 «없앤 것»과 «더한 것»이 구분되지 않는다. 신설 구간은
 * 목업 쪽에서 **아무것도 빼지 않으므로**, 그 사실이 선언에 보여야 한다 —
 * 보증 범위를 부풀리지 않는 것이 이 게이트의 규율이다.
 */
const S21_REGIONS = [
  {
    id: "cost-bars",
    removeWhenWired: null,
    mockupStyle: "display: flex; align-items: center; gap: 14px; position: relative",
    why:
      "§21-4 «매출 구성 도넛 → 가로 막대». 도넛(112px 원 + clip 조각) · 범례 · 호버 " +
      "툴팁이 통째로 빠지고 항목별 가로 막대(라벨 · 금액 · 매출 대비 · 막대)가 들어온다. " +
      "금액이 인라인으로 나오면서 §9의 «S/M hover 의존 금지»도 함께 해소된다",
  },
  {
    id: "link-cluster",
    removeWhenWired: null,
    mockupStyle: null,
    why:
      "§21-6 ① «군집 카드» — 신설. 목업 `linking`은 리스팅-평면이라 11번가 옵션 44개가 " +
      "44줄이 된다. 같은 상품부의 옵션을 한 카드로 접고 접힌 목록을 펴는 블록이 " +
      "들어온다. 접기 기준은 유사도가 아니라 **상품부 완전 일치**다 (작업 리듬 12)",
  },
  {
    id: "link-newsku",
    removeWhenWired: null,
    mockupStyle: null,
    why:
      "§21-6 ② «[새 SKU로 등록]» — 신설. 후보가 없을 때의 기본 액션이고, 이것이 없으면 " +
      "SKU 0개 상태에서 화면이 작동 자체를 못 한다. 일괄형의 선택 칩도 같은 자리에 붙는다",
  },
  {
    id: "unbuilt-diag",
    mockupStyle: null,
    removeWhenWired: "diag",
    why:
      "§21-7 «아직 만들지 않은 화면은 그렇게 말한다» — 신설. 목업에는 화면 상태가 " +
      "firstRun/notFirstRun 둘뿐이었다(시드가 전 화면을 채웠으니 그걸로 족했다). 실제로는 " +
      "«데이터는 있는데 이 화면을 아직 만들지 않았다»라는 세 번째 상태가 있고, 그때 화면이 " +
      "침묵하면 사용자는 «없다»가 아니라 «깨졌다»로 읽는다. 2d에서 실제로 그렇게 읽혔다",
  },
  {
    id: "link-bulk",
    removeWhenWired: null,
    mockupStyle: null,
    why:
      "§21-6 ② 일괄형 «선택 N개를 각각 새 SKU로 등록» — 신설. 콜드스타트의 none 19건이 " +
      "여기로 들어온다. **각각**이라는 말이 요점이다 — 고른 카드를 하나로 합치지 않는다",
  },
] as const

const want = applyDeviations(
  irFromTree(parseTemplate(src.html, src.startLine).nodes, {
    // 신설 구간(`mockupStyle: null`)은 목업에서 뺄 것이 없다 — 애초에 없던 요소다.
    styleContains: S21_REGIONS.map((r) => r.mockupStyle).filter((s) => s !== null),
  }),
)

/** 흠집 하나를 낸 출력으로 IR을 만들고 게이트를 돌린다. */
function gateAfter(mutate: (s: string) => string) {
  const mutated = mutate(generated)
  expect(mutated, "치환이 실제로 일어나야 시험이 성립한다").not.toBe(generated)
  return compareIr(want, irFromTsx(GENERATED, mutated))
}

/** 첫 번째 자리만 바꾼다. 전역 치환은 "많이 틀렸다"를 만들어 시험이 무뎌진다. */
function once(s: string, find: string, replace: string): string {
  const at = s.indexOf(find)
  if (at === -1) throw new Error(`시험용 문자열을 못 찾았다: ${find}`)
  return s.slice(0, at) + replace + s.slice(at + find.length)
}

describe("보존 게이트 — 변환 출력이 목업과 같은가", () => {
  it("손대지 않은 출력은 전 항목이 일치한다", () => {
    const diff = compareIr(want, irFromTsx(GENERATED, generated))
    const report = Object.entries(diff)
      .filter(([, v]) => v.length > 0)
      .map(([k, v]) => `${k}: ${v.slice(0, 3).join(" / ")}`)
      .join("\n")
    expect(irDiffCount(diff), report).toBe(0)
  })

  it("선언된 이탈에는 이유가 붙어 있다 — 이유 없는 이탈은 사고와 구분되지 않는다", () => {
    // 목업에 실재하는 문구를 가리키는지는 `applyDeviations`가 모듈 로드 시점에
    // 이미 검증했다 (낡으면 이 파일 전체가 선다).
    expect(DEVIATIONS.length, "이탈이 하나도 없으면 이 장치는 필요 없다").toBeGreaterThan(0)
    for (const d of DEVIATIONS) {
      expect(d.from.length, "찾을 구간이 비면 아무것도 못 찾는다").toBeGreaterThan(0)
      expect(d.why.length, `${d.from[0]}의 이탈에 이유가 없다`).toBeGreaterThan(20)
    }
  })

  /**
   * 구간 선언은 **양쪽에서 정확히 한 번씩** 짚혀야 한다.
   *
   * 오타 하나로 짚기가 빗나가면 큰 구간이 조용히 **대조에서 빠지거나**(출력 표식
   * 오타) **통째로 diff로 쏟아진다**(목업 짚기 오타). 앞의 경우가 특히 위험하다 —
   * 게이트는 녹색인데 아무것도 안 보고 있는 상태가 된다.
   */
  it("§21 구간 선언이 양쪽에서 정확히 하나씩 짚힌다", () => {
    const mockupSrc = readFileSync(MOCKUP, "utf8")
    for (const r of S21_REGIONS) {
      // 신설 구간은 목업 쪽 짝이 **없는 것이 정상**이다. 그래도 검사는 한다 —
      // 목업에 실재하는 요소를 실수로 «신설»이라 선언하면 그 구간이 양쪽에서
      // 조용히 빠져 아무도 안 보는 자리가 된다.
      if (r.mockupStyle !== null) {
        expect(
          mockupSrc.split(r.mockupStyle).length - 1,
          `목업에서 "${r.mockupStyle}"가 하나만 잡혀야 한다 — 0이면 낡았고, 2 이상이면 엉뚱한 구간까지 뺀다`,
        ).toBe(1)
      }
      expect(
        generated.split(`data-s21="${r.id}"`).length - 1,
        `출력에 data-s21="${r.id}" 표식이 하나여야 한다`,
      ).toBe(1)
      expect(r.why.length, `${r.id} 구간에 이유가 없다`).toBeGreaterThan(20)
    }
    // 표식이 선언보다 많으면, 선언되지 않은 구간이 조용히 대조에서 빠지고 있다
    expect(
      generated.split("data-s21=").length - 1,
      "선언되지 않은 data-s21 표식이 있다 — 그 구간은 아무도 안 보고 있다",
    ).toBe(S21_REGIONS.length)
  })

  /**
   * ★ «배선 시 제거» 표기는 장식이 아니다 ★
   *
   * §21-7 안내 문구는 **임시물**이다. 화면이 배선되는 날 지워야 하는데, 지우라고
   * 적어두기만 하면 아무도 안 지운다 — 배선하는 사람은 자기 화면만 보지 이 배열을
   * 보지 않는다. 그래서 `shell.ts`의 `UNBUILT`에서 그 화면이 빠지는 순간 **이 테스트가
   * 먼저 깨지게** 한다. 그때가 안내 마크업을 지울 시점이다.
   *
   * 부재를 단언한 것(작업 리듬 9)의 사촌이다 — 이쪽은 **임시물의 수명**을 단언한다.
   */
  it("«배선 시 제거» 표기가 낡지 않았다 — 배선되면 안내를 지워야 한다", () => {
    for (const r of S21_REGIONS) {
      const wired = r.removeWhenWired
      if (!wired) continue
      expect(
        UNBUILT.includes(wired),
        `${r.id}는 «${wired} 배선 시 제거» 구간인데 shell.ts의 UNBUILT에 «${wired}»가 없다. ` +
          `그 화면은 이제 배선됐다는 뜻이므로 Template.tsx의 data-s21="${r.id}" 안내 블록과 ` +
          `이 선언, 그리고 관련 DEVIATIONS를 함께 지워야 한다`,
      ).toBe(true)
    }
  })

  it("문법이 깨진 출력은 IR을 만들기 전에 세운다", () => {
    expect(() => irFromTsx("x.tsx", "export const a = <div>{</div>")).toThrow(/문법/)
  })
})

describe("가드를 부러뜨려 본다 — 이 흠집들은 반드시 잡혀야 한다", () => {
  const cases: { name: string; field: IrField; mutate: (s: string) => string }[] = [
    {
      name: "카피를 한 글자 고치면",
      field: "texts",
      mutate: (s) => once(s, "정산 파일을 여기에 놓으세요", "정산 파일을 여기에 놓으세요."),
    },
    {
      name: "Vector DS 클래스를 빠뜨리면",
      field: "classes",
      mutate: (s) => once(s, `className="v-btn v-btn--primary"`, `className="v-btn"`),
    },
    {
      name: "인라인 style 값이 드리프트하면",
      field: "styles",
      mutate: (s) => once(s, `padding: "34px 24px"`, `padding: "32px 24px"`),
    },
    {
      name: "토큰을 다른 토큰으로 바꾸면",
      field: "tokens",
      mutate: (s) => once(s, `background: "var(--bg-subtle)"`, `background: "var(--bg-app)"`),
    },
    {
      name: "동적 자리를 통째로 잃으면",
      field: "holes",
      mutate: (s) => once(s, `onClick={vals.goImport}`, ``),
    },
    {
      name: "SVG 경로가 뭉개지면",
      field: "attrs",
      mutate: (s) => once(s, ' d="', ' d="M0 0 '),
    },
    {
      name: "아이콘 이름이 바뀌면",
      field: "attrs",
      mutate: (s) => once(s, `<Lic name="file-spreadsheet"`, `<Lic name="file-text"`),
    },
  ]

  for (const c of cases) {
    it(`${c.name} ${c.field}에서 잡힌다`, () => {
      const diff = gateAfter(c.mutate)
      expect(diff[c.field].length, `${c.field}가 흠집을 못 봤다`).toBeGreaterThan(0)
    })
  }
})
