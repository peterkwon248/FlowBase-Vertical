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
  /**
   * ★ 같은 열 자리의 `holes` 쪽 그림자 ★
   * `onClick={vals.expSet.xlsx}`는 속성이면서 **홀**이기도 하다. 위 `attrs` 선언과
   * 짝을 이룬다 — 둘 중 하나만 적으면 게이트가 다른 쪽에서 붉어진다.
   *
   * 「가져오기 기록」만 앞 문맥이 짧다: 그 팝오버에는 **「숨긴 컬럼도 포함」 줄이
   * 없다**(목업이 그렇다 — 기록에는 숨길 컬럼이 없으니 맞는 설계다). 그래서
   * `toggleExpHidden`·`expHiddenBg`가 빠지고 `expScope` 바로 뒤가 버튼이다.
   */
  {
    field: "holes",
    from: ["expSet.on", "stopEvt", "expScope", "toggleExpHidden", "expHiddenBg", "expNote"],
    to: ["expSet.on", "stopEvt", "expScope", "toggleExpHidden", "expHiddenBg", "expSet.xlsx", "expSet.csv", "expNote"],
    why: "정산 화면 내보내기 — `onClick` 두 자리가 홀로도 세어진다 (LOCK 8)",
  },
  {
    field: "holes",
    from: ["expPrd.on", "stopEvt", "expScope", "toggleExpHidden", "expHiddenBg", "expNote"],
    to: ["expPrd.on", "stopEvt", "expScope", "toggleExpHidden", "expHiddenBg", "expPrd.xlsx", "expPrd.csv", "expNote"],
    why: "상품별 손익 화면 내보내기 — `onClick` 두 자리가 홀로도 세어진다 (LOCK 8)",
  },
  {
    field: "holes",
    from: ["expCst.on", "stopEvt", "expScope", "toggleExpHidden", "expHiddenBg", "expNote"],
    to: ["expCst.on", "stopEvt", "expScope", "toggleExpHidden", "expHiddenBg", "expCst.xlsx", "expCst.csv", "expNote"],
    why: "비용 화면 내보내기 — `onClick` 두 자리가 홀로도 세어진다 (LOCK 8)",
  },
  {
    field: "holes",
    from: ["expOrd.on", "stopEvt", "expScope", "toggleExpHidden", "expHiddenBg", "expNote"],
    to: ["expOrd.on", "stopEvt", "expScope", "toggleExpHidden", "expHiddenBg", "expOrd.xlsx", "expOrd.csv", "expNote"],
    why: "주문 화면 내보내기 — `onClick` 두 자리가 홀로도 세어진다 (LOCK 8)",
  },
  {
    field: "holes",
    from: ["expSyn.on", "stopEvt", "expScope"],
    to: ["expSyn.on", "stopEvt", "expScope", "expSyn.xlsx", "expSyn.csv"],
    why: "가져오기 기록 화면 내보내기 — `onClick` 두 자리가 홀로도 세어진다 (LOCK 8)",
  },
  /**
   * ★ 내보내기 버튼 열 자리 — 목업에는 **`onClick`이 아예 없었다** (2026-08-20 · LOCK 8) ★
   *
   * 헌장 B-10은 「내보내기는 무료 전면 개방 · 데이터 인질 금지」인데 오늘까지
   * **전면 부재**였다. 버튼 다섯 쌍이 그려져 있고 전부 무동작이라 U-3(못 누르는
   * 것은 안 그린다)도 함께 어기고 있었다 (감사 A-2-2).
   *
   * ★ 왜 `data-s21` 신설 구간이 아닌가 ★ 처음엔 버튼 줄을 구간으로 감쌌다.
   * 그런데 그건 **틀린 선언**이다 — 우리는 목업을 교체한 게 아니라 **핸들러만
   * 얹었다.** 구간으로 감싸면 버튼의 글자·클래스·style까지 대조에서 빠져
   * 「XLSX」가 「엑셀」로 바뀌어도 게이트가 조용하다. 게다가 다섯 자리의 style이
   * 똑같아 `mockupStyle`이 «하나만 잡혀야 한다»에서 5를 세고 거부했다.
   *
   * `attrs`에 **한 자리씩 늘어나는 것**이 사실 그대로이고, 나머지 IR 필드는
   * 전부 대조를 유지한다.
   *
   * ⚠ 낡는 조건: 목업이 팝오버 구조를 바꾸면 `from`이 안 맞아 게이트가 스스로
   * 「선언된 이탈이 낡았다」로 신고한다.
   */
  {
    field: "attrs",
    from: ["onClick={expSet.open}", "name=more-horizontal", "size=15", "onClick={stopEvt}", "onClick={toggleExpHidden}", "class=v-btn", "class=v-btn"],
    to: ["onClick={expSet.open}", "name=more-horizontal", "size=15", "onClick={stopEvt}", "onClick={toggleExpHidden}", "class=v-btn", "onClick={expSet.xlsx}", "class=v-btn", "onClick={expSet.csv}"],
    why: "정산 화면 내보내기 — 목업 버튼에 핸들러가 없어 `onClick` 두 자리를 얹었다 (LOCK 8)",
  },
  {
    field: "attrs",
    from: ["onClick={expPrd.open}", "name=more-horizontal", "size=15", "onClick={stopEvt}", "onClick={toggleExpHidden}", "class=v-btn", "class=v-btn"],
    to: ["onClick={expPrd.open}", "name=more-horizontal", "size=15", "onClick={stopEvt}", "onClick={toggleExpHidden}", "class=v-btn", "onClick={expPrd.xlsx}", "class=v-btn", "onClick={expPrd.csv}"],
    why: "상품별 손익 화면 내보내기 — 목업 버튼에 핸들러가 없어 `onClick` 두 자리를 얹었다 (LOCK 8)",
  },
  {
    field: "attrs",
    from: ["onClick={expCst.open}", "name=more-horizontal", "size=15", "onClick={stopEvt}", "onClick={toggleExpHidden}", "class=v-btn", "class=v-btn"],
    to: ["onClick={expCst.open}", "name=more-horizontal", "size=15", "onClick={stopEvt}", "onClick={toggleExpHidden}", "class=v-btn", "onClick={expCst.xlsx}", "class=v-btn", "onClick={expCst.csv}"],
    why: "비용 화면 내보내기 — 목업 버튼에 핸들러가 없어 `onClick` 두 자리를 얹었다 (LOCK 8)",
  },
  {
    field: "attrs",
    from: ["onClick={expOrd.open}", "name=more-horizontal", "size=15", "onClick={stopEvt}", "onClick={toggleExpHidden}", "class=v-btn", "class=v-btn"],
    to: ["onClick={expOrd.open}", "name=more-horizontal", "size=15", "onClick={stopEvt}", "onClick={toggleExpHidden}", "class=v-btn", "onClick={expOrd.xlsx}", "class=v-btn", "onClick={expOrd.csv}"],
    why: "주문 화면 내보내기 — 목업 버튼에 핸들러가 없어 `onClick` 두 자리를 얹었다 (LOCK 8)",
  },
  {
    field: "attrs",
    from: ["onClick={stopEvt}", "class=v-btn", "class=v-btn"],
    to: ["onClick={stopEvt}", "class=v-btn", "onClick={expSyn.xlsx}", "class=v-btn", "onClick={expSyn.csv}"],
    why: "가져오기 기록 화면 내보내기 — 목업 버튼에 핸들러가 없어 `onClick` 두 자리를 얹었다 (LOCK 8)",
  },
  {
    field: "texts",
    from: ["일부 제외", "vs 7월 같은 기간"],
    to: ["vs 7월 같은 기간"],
    why:
      "「일부 제외」가 **박힌 문자열에서 홀로 바뀌었다** (2026-08-21 · 012). 배너를 " +
      "접고 나면 칩이 «일부 제외 · 확인함»이라고 말해야 한다 — 접힌 것과 아직 안 본 " +
      "것은 다르고, 같은 글자로 두면 사용자가 «확인 버튼을 눌렀는데 아무 일도 " +
      "안 일어났다»로 읽는다. 문자열 자체는 사라진 것이 아니라 `partialChipLabel`의 " +
      "기본값으로 살아 있다",
  },
  {
    field: "holes",
    from: ["partial", "heroNet"],
    to: ["partialChip", "partialChipLabel", "heroNet"],
    why:
      "히어로의 「일부 제외」 칩 — **배너와 조건이 갈렸다** (2026-08-21 · 012). 목업은 " +
      "배너와 칩을 같은 `partial` 하나로 켰다. 그런데 사용자가 배너를 접을 수 있게 " +
      "되면서(«계속 떠서 불편함») 둘의 뜻이 달라졌다: 배너는 «아직 확인 안 한 새 " +
      "사실», 칩은 «제외가 있다»는 사실 자체다. 접었다고 칩까지 사라지면 그게 조용한 " +
      "실패다(LOCK 6) — 접힌 것은 **세고 있는 부재**여야 한다(ADR-016의 `dismissed` " +
      "계보). 라벨도 홀이 된 것은 접힌 뒤 «일부 제외 · 확인함»으로 바뀌기 때문이다",
  },
  {
    field: "styles",
    from: ["maxWidth:1000px"],
    to: ["maxWidth:1180px"],
    why:
      "가져오기 화면의 본문 폭 (2026-08-21 · 사용자 지적 «오른쪽 공간이 자꾸 빈다»). " +
      "목업은 위저드를 1000px로 좁게 잡았고 그때는 맞았다 — 단계 안내와 확인 표뿐이라 " +
      "읽기 폭이 좁을수록 좋았다. 그 사이에 **넓은 것들이 들어왔다**: 시트 목록(19시트 " +
      "워크북의 판정 문구가 한 줄에 붙는다) · 원본 표 미리보기 격자(`import-grid` — " +
      "101열 파일이 실재한다) · 확인 표. 나머지 본문 화면이 전부 1180이라 **가져오기만 " +
      "혼자 좁았고**, 데스크톱 폭에서 오른쪽 700px가 비었다. 새 값을 발명하지 않고 " +
      "이미 쓰는 1180에 맞춘다",
  },
  {
    field: "holes",
    from: ["v.linking", "linkTabs"],
    to: ["rowsOpen", "v.linking", "linkTabs"],
    why:
      "적재된 행 패널(`S21_REGIONS`의 `history-rows`)을 **감싼 조건**이다. 구간 자체는 " +
      "신설이라 대조에서 빠지지만 `{vals.rowsOpen && …}`는 부모(가져오기 기록 섹션의 " +
      "끝)에 남아 다음 화면의 첫 홀 앞에 한 자리를 만든다",
  },
  {
    field: "holes",
    from: ["firstRun", "goImport", "onboard"],
    to: ["appLoading", "firstRun", "goImport", "onboard"],
    why:
      "「불러오는 중」(`S21_REGIONS`의 `shell-loading`)을 **감싼 조건**이다. 구간 자체는 " +
      "신설이라 대조에서 빠지지만 그것을 감싼 `{vals.appLoading && …}`는 부모에 남고, " +
      "대시보드 섹션의 **첫 홀**이 되므로 목업의 `firstRun` 앞에 한 자리가 생긴다",
  },
  {
    field: "holes",
    from: ["ic.value", "colRows"],
    to: ["ic.value", "impGrid", "colRows"],
    why:
      "원본 표 미리보기(`S21_REGIONS`의 `import-grid`)를 **감싼 조건**이다. 구간 자체는 " +
      "신설이라 대조에서 빠지지만 그것을 감싼 `{vals.impGrid && …}`는 부모에 남는다. " +
      "표본이 0행이면 그리지 않는다 — 빈 격자를 그려 놓으면 «파일이 비었다»와 «미리보기 " +
      "범위에 데이터 행이 없다»가 구별되지 않는다 (§18-C가 0행을 숨기지 말라고 한 것은 " +
      "**시트 목록**에서이고, 여기서 답은 격자를 접고 이유를 말하는 쪽이다)",
  },
  {
    field: "holes",
    from: ["s.costFilled", "s.cost"],
    to: [],
    why:
      "★ 매입원가 칸 — 목업의 **읽기 전용 원가 텍스트가 교체 구간 안으로 들어갔다** " +
      "(2026-08-16). 목업은 값이 있으면 입력칸 대신 텍스트를 그렸고(그래서 «채운 뒤엔 " +
      "못 고친다»가 결함 ③이었다), 우리 교체는 **입력칸과 현재값을 함께** 보인다 — " +
      "고칠 수 있어야 하기 때문이다. 두 조각이 한 구간(`data-s21=\"cost-input\"`) 안에 " +
      "있어야 정렬이 하나가 된다: 밖에 두었더니 입력 묶음은 오른쪽, 현재값은 왼쪽으로 " +
      "갈려 사용자가 «간격이 이상하다»고 지적했다. 그 자리에서 금액(12px·fg)과 " +
      "적용일(10px·fg-4)의 위계도 함께 준다 — 한 문자열이면 둘이 같은 무게가 된다",
  },
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

  {
    field: "holes",
    from: ["subtitle", "syncColor"],
    to: ["subtitle", "periodPick", "syncColor"],
    why:
      "월 선택기(`S21_REGIONS`의 `period-picker`)를 **감싼 조건**이다. 구간 자체는 " +
      "신설이라 대조에서 빠지지만 그것을 감싼 `{vals.periodPick && …}`는 부모에 남는다. " +
      "`null`이면 그리지 않는다 — 기간이 안 걸리는 화면에서 선택기를 그리면 " +
      "«여기서 달을 고를 수 있다»가 거짓이 된다",
  },

  {
    field: "classes",
    // `db-table-wrap`은 여덟 곳에 있다 — 앞 항목을 붙여 대시보드의 그 표로 좁힌다.
    from: ["rp-keep", "db-table-wrap"],
    to: ["rp-keep", "db-table-wrap fb-pnl-scroll"],
    why:
      "상품별 손익 표에 **세로 스크롤**을 준다 (2026-08-17). 실측 60행이 카드 밖으로 " +
      "흘러 채널별 손익을 화면 아래로 밀어냈다. 목업에는 세로 스크롤이 없는데(전체에서 " +
      "`max-height`는 드롭다운 하나뿐) **시드에 상품이 몇 개 없어 드러나지 않았을 뿐**이다. " +
      "규칙은 CSS에 두고 여기서는 클래스만 더한다. 헤더는 `th`가 이미 `sticky; top: 0`이라 " +
      "스크롤 상자만 주면 붙고, 합계는 CSS가 `tbody tr:last-child`로 **구조로** 짚어 " +
      "바닥에 고정한다 — 마크업을 더 건드리지 않으려는 선택이다",
  },

  {
    field: "attrs",
    // `attrs`는 속성 원문도 따로 세므로 위 `classes` 선언과 **짝으로** 간다.
    from: ["size=12", "class=db-table-wrap"],
    to: ["size=12", "class=db-table-wrap fb-pnl-scroll"],
    why: "위 «상품별 손익 표 세로 스크롤»의 속성 쪽 짝",
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

  /**
   * ★ 결함 47 계열 — 컬럼 머리글이 시드의 달을 사실인 척한다 (결함 61) ★
   *
   * 상품 표의 마지막 두 칸이 «8월 판매»·«8월 기여이익»이다. 목업 시드가 8월이라
   * 참이었지만 우리 데이터는 7월이고, **품목 적재로 그 칸에 진짜 숫자가 들어온
   * 순간** 「8월 판매 520」이라는 거짓말이 됐다 — 520은 7월 수량이다.
   *
   * 헤더를 기간에 맞춰 동적으로 만들려면 홀을 새로 여는 마크업 변경이 필요하다.
   * 달 이름을 **빼는 것**이 더 작고 더 정직하다: 기간은 `prodHint`가 말한다.
   */
  {
    field: "texts",
    from: ["8월 판매", "8월 기여이익"],
    to: ["판매 수량", "기여이익"],
    why:
      "상품 표 머리글에서 «8월»을 뺐다. 목업 시드는 8월이지만 데이터는 7월이라 " +
      "**품목 적재로 그 칸에 숫자가 들어오자 곧바로 거짓이 됐다**(7월 수량 520이 " +
      "«8월 판매»로 표시됐다). 결함 47(헤더 부제의 «2026년 8월»)과 같은 계열이고, " +
      "기간은 `prodHint`가 데이터에서 파생시켜 말한다",
  },

  // ── §21-7 «미구현 화면» 게이트 재지정 ─────────────────────────────────
  // 안내 블록 자체는 `S21_REGIONS`가 빼지만 **기존 게이트를 갈아끼운 자국**은 남는다.
  // 미구현 화면에서는 온보딩도 본문도 그리지 않으므로 두 조건이 함께 바뀐다.
  {
    field: "holes",
    from: ["prodTabs"],
    to: ["prodReady", "prodTabs"],
    why:
      "§21-7 — 상품 화면의 본문 게이트. **`prodUnbuilt`가 여기서 빠졌다 (③ 배선, 2026-08-14)** — " +
      "안내 블록이 지워지면서 그 조건도 함께 사라졌다. `prodReady`는 남는다: 이 화면은 진단과 " +
      "달리 목업에 온보딩 빈 상태조차 없어서(`firstRun` 분기가 없다) **아무 조건도 없이 빈 " +
      "껍데기를 그리고 있었고**, 그건 배선과 무관하게 여전히 참이다",
  },
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

  // ── 위저드의 시드 숫자 두 개 (결함 52) ────────────────────────────────
  // 목업이 «오류 3건»과 «중복 7건»을 **숫자째 박아** 뒀다. 시드의 수를 사실인 척한
  // 것이라 결함 47(헤더 부제의 «2026년 8월»)과 같은 계열이다. 데이터에서 뽑는다.
  {
    field: "texts",
    from: ["오류 3건 — 가져오기에서 제외"],
    to: [],
    why:
      "결함 52 — 시드의 «3»이 박혀 있었다. `{impExcludedLabel}`로 데이터에서 뽑는다. " +
      "0건이면 «제외된 행이 없습니다»라고 말하고, 있으면 **«미리보기 범위에서»**라는 " +
      "단서를 붙인다 — 전체 수인 척하면 사용자가 그 수를 믿는다",
  },
  {
    field: "texts",
    from: ["source_key 기준 중복 7건은 UPSERT 처리됩니다."],
    to: [],
    why:
      "결함 52 — 시드의 «7»이 박혀 있었다. 게다가 **UPSERT 건수는 넣어봐야 안다** — " +
      "넣기 전에 셀 수 없는 수다. 그래서 숫자를 빼고 동작만 설명하는 문장으로 바꿨다 " +
      "(`{impDupNote}`). 모르는 것을 숫자로 말하지 않는다",
  },
  {
    field: "holes",
    from: ["errRows", "e.row"],
    to: ["impExcludedLabel", "errRows", "e.row"],
    why: "위 «오류 N건» 카피가 정적 텍스트에서 동적 자리로 바뀐 자국",
  },
  {
    field: "holes",
    from: ["urlImported"],
    to: ["impDupNote", "urlImported"],
    why: "위 «중복 N건» 카피가 동적 자리로 바뀐 자국",
  },
  {
    field: "holes",
    from: ["srcWizard", "srcName"],
    to: ["!vals.srcWizard", "impHasError", "srcWizard", "srcName"],
    why:
      "위저드 앞에 **파일을 고르는 자리와 실패를 말하는 자리**가 붙었다. 목업은 " +
      "`srcWizard`가 참인 상태부터 그려서 파일이 없을 때 아무것도 렌더되지 않았다 — " +
      "구간 자체는 `S21_REGIONS`가 빼지만 그것을 감싼 조건은 부모에 남는다",
  },
  {
    field: "holes",
    from: ["srcSwap", "profileTabs"],
    to: ["impReset", "srcSwap", "impBig", "impManySheets", "profileTabs"],
    why:
      "«다른 파일» 버튼이 목업에서는 **핸들러가 없었다** — 실제로 되돌아갈 수 있게 붙였다. " +
      "그 뒤의 `impBig`·`impManySheets`는 큰 파일 고지와 §18 시트 선택 구간을 감싼 조건이다",
  },
  {
    field: "holes",
    from: ["go.settlement", "v.sync"],
    to: ["impCanRun", "impRun", "impRunLabel", "impDone", "v.sync"],
    why:
      "실행 버튼이 조건 뒤로 들어가고(맞는 프로파일이 없으면 그리지 않는다) 라벨이 " +
      "상태를 말한다. 뒤의 `impDone`은 다이제스트 구간을 감싼 조건이다 — 적재가 끝나야 뜬다",
  },
  {
    field: "attrs",
    from: ["name=triangle-alert", "size=14", "class=segmented"],
    to: ["onClick={impReset}", "name=triangle-alert", "size=14", "class=segmented"],
    why: "위 «다른 파일» 핸들러의 짝 — attrs는 속성 원문도 따로 세므로 함께 선언한다",
  },
  {
    field: "attrs",
    from: ["class=v-btn v-btn--primary", "onClick={go.settlement}"],
    to: ["class=v-btn v-btn--primary", "onClick={impRun}"],
    why: "실행 버튼이 **화면 이동이 아니라 적재**를 한다. 목업은 정산 화면으로 보내기만 했다",
  },
  {
    field: "texts",
    from: ["확인하고 가져오기"],
    to: [],
    why:
      "실행 버튼의 라벨이 상태를 말한다 — 도는 동안 «가져오는 중…». 메인 스레드라 " +
      "화면이 멈추므로(ADR-001 조건 2 부채) 버튼이 마지막으로 남긴 말이 «지금 뭘 하는 " +
      "중인지»여야 한다. 그리고 맞는 프로파일이 없으면 **버튼 자체가 없다** — 누를 수 " +
      "없는 것을 그려놓고 막지 않는다 (§21-1 계열)",
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
  // ── §20 루프의 첫 수확 — 버튼 위계를 등급에 묶는다 ──────────────────────
  // 사용자가 2d에서 61번 전부 [새 SKU로 등록]을 눌렀다. 제안은 보였는데도 그랬다 —
  // 파란 primary가 카드 머리에 늘 떠 있고 옳은 행동인 [연결]은 아래 작은 보조 버튼이라
  // 눈이 먼저 가는 쪽을 누른 것이다. §21-6은 이미 다르게 적어 뒀다:
  //   "[새 SKU로 등록] — **후보가 없을 때의 기본값**"
  //   "`clear`는 후보 1개를 *미리 선택된 상태로* 제시"
  // 「기본 액션」을 「항상 primary」로 읽은 것이 오독이었다.
  {
    field: "classes",
    // 앞의 «무시/해제 버튼 + 일치도·SKU 코드»까지 붙여야 유일해진다 —
    // `v-btn v-btn--primary`만으로는 18곳에서 잡히고, `indexOfRun`이 그걸 세웠다
    from: ["v-btn", "v-num", "v-num", "v-btn v-btn--primary"],
    to: ["v-btn", "v-num", "v-num", "{c.pickClass}"],
    why:
      "§21-6 — [연결]의 강조가 **등급을 따른다.** `clear`면 primary(후보 하나가 «미리 " +
      "선택된» 것의 시각적 표현), `contested`면 보조 — 여럿 중 어느 것도 미리 고르지 " +
      "않는다. 애매한 것을 골라주면 사람의 확정이 검토가 아니라 통과의례가 된다 (§20 신뢰 전제)",
  },
  {
    field: "attrs",
    from: ["class=v-btn v-btn--primary", "onClick={c.pick}"],
    to: ["class={c.pickClass}", "onClick={c.pick}"],
    why: "위 `classes` 선언의 짝 — `attrs`는 속성 원문도 따로 센다",
  },
  {
    field: "holes",
    from: ["c.sku", "c.pick"],
    to: ["c.sku", "c.pickClass", "c.pick"],
    why: "위 `classes` 선언이 만든 새 동적 자리",
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
  // ── 가져오기 위저드 ④ — 기준 데이터 적용일 (2026-08-19) ──────────────
  {
    field: "holes",
    // `impDupNote`는 위저드 아래 «UPSERT 안내» 줄이다 — 목업에 하나뿐이라 이걸로 짚는다.
    from: ["impDupNote"],
    to: ["impRefer", "impDupNote"],
    why:
      "기준 데이터 적용일 블록(`data-s21=\"import-reference\"`)을 **감싼 조건**이다. " +
      "구간 자체는 `S21_REGIONS`가 빼지만 그것을 감싼 `{vals.impRefer && …}`는 부모에 " +
      "남는다. 사실 파일에는 그리지 않는다 — 주문 파일 앞에서 «언제부터 적용되나요»를 " +
      "물으면 그건 **행마다 날짜를 들고 온 파일**에 대고 없는 질문을 하는 것이다",
  },
  // ── 비용 화면 — 고정비 (2026-08-19) ──────────────────────────────
  {
    field: "texts",
    from: ["8일 / 31일"],
    to: [],
    why:
      "「이 기간 몫」의 분수가 **박힌 문자열**이었다 — 시드 기간(8일/31일)의 값이다. " +
      "7월 전체를 보면 31/31인데 화면은 영영 「8일 / 31일」이라고 말한다. 헤더 부제의 " +
      "「2026년 8월」과 같은 계보(결함 61·47)라 같은 처방을 쓴다: **동적 자리로 바꾼다.** " +
      "`vals.fixDays`이고, 달을 걸치는 기간은 하나의 분수로 말할 수 없으므로(7/20~8/10 = " +
      "12/31 + 10/31) 그때는 **빈 문자열**이다 — 분수를 지어내지 않는다",
  },
  {
    field: "holes",
    // 「이 기간 몫」 줄의 합계 자리. 목업에 하나뿐이라 이걸로 짚는다.
    from: ["fixTotal"],
    to: ["fixDays", "fixTotal"],
    why: "위 «8일 / 31일 → 동적 자리»의 짝 — 텍스트가 빠진 만큼 홀이 하나 생긴다",
  },
  // ── 연결 화면 — 원가 대기 (2026-08-19 D2) ────────────────────────
  {
    field: "holes",
    // `linkRows`는 연결 화면의 카드 그리드다 — 목업에 하나뿐이라 이걸로 짚는다.
    from: ["linkRows"],
    to: ["linkTabCost", "linkRows"],
    why:
      "원가 대기 블록(`data-s21=\"link-cost-pending\"`)을 **감싼 조건**이다. 구간 자체는 " +
      "`S21_REGIONS`가 빼지만 그것을 감싼 `{vals.linkTabCost && …}`는 부모에 남는다. " +
      "다른 탭에서는 그리지 않는다 — 리스팅 카드와 원가 대기 행은 확정이 하는 일이 " +
      "달라서(연결 vs 원가 넣기) 한 그리드에 섞으면 버튼의 뜻이 갈린다",
  },
  {
    field: "attrs",
    // 「매핑 수정」 버튼 — 목업부터 있던 버튼인데 핸들러가 없었다 (눌러도 조용).
    from: ["class=v-btn v-btn--primary", "onClick={impRun}"],
    to: ["onClick={impEditMap}", "class=v-btn v-btn--primary", "onClick={impRun}"],
    why:
      "«매핑 수정» 버튼에 첫 일을 줬다 (B1) — 필드 매핑 화면으로 간다. 지금 보던 " +
      "양식이 선택된 채 열린다 (§20 규칙 1 개정의 «펼치면 전체 표»로 가는 길). " +
      "눌러도 조용한 버튼은 고장으로 읽힌다 — impRun 가드에서 세운 그 규율이다",
  },
  {
    field: "holes",
    from: ["impCanRun", "impRun"],
    to: ["impEditMap", "impCanRun", "impRun"],
    why: "위 «매핑 수정» 핸들러의 holes 쪽 짝 — 동적 자리가 하나 늘었다",
  },
  // ── 필드 매핑 — 확인 완료 배선 (2026-08-19 B2) ───────────────────
  {
    field: "texts",
    from: ["이 양식은 아직 확인되지 않았습니다. 확인 필요 열을 확정해야 다음 파일이 자동으로 처리됩니다."],
    to: [],
    why:
      "배너 문장이 동적 자리(`fmWarnText`)가 됐다 — 목업의 배너는 «미확인 양식» " +
      "하나만 말했는데, B2부터 이 배너가 **초안의 상태**(고친 개수·저장의 뜻·저장할 " +
      "수 없는 이유)도 말해야 한다. 확인 버튼을 조용히 죽이는 대신 이유를 그 자리에서 " +
      "말한다 (LOCK 6). 미확인 양식일 때는 동결 문구를 글자 그대로 그린다",
  },
  {
    field: "holes",
    from: ["fmConfirmable", "confirmFm"],
    to: ["fmWarnText", "fmConfirmable", "confirmFm"],
    why: "위 «배너 문장 동적화»의 holes 쪽 짝 — 텍스트가 빠진 만큼 홀이 하나 생겼다",
  },
  {
    field: "attrs",
    from: ["onChange={c.onPick}", "value={o}"],
    to: ["onChange={c.onPick}", "disabled={c.locked}", "value={o}"],
    why:
      "구조 역할(행 식별 키·라우팅·리스팅…) 열의 드롭다운을 **잠근다** (B2 v1 컷 " +
      "라인 — 그 선언들은 값 하나가 아니라 적재의 구조를 바꾼다). 목업의 드롭다운은 " +
      "전부 살아 있었지만 그건 저장 경로가 없던 시절의 그림이다 — 살아 있는 척하며 " +
      "고른 것을 버리는 쪽이 더 나쁘다. 잠긴 이유는 근거 열이 이미 말하고 있다",
  },
  {
    field: "holes",
    from: ["c.onPick", "c.fieldColor"],
    to: ["c.onPick", "c.locked", "c.fieldColor"],
    why: "위 «드롭다운 잠금»의 holes 쪽 짝 — `disabled` 속성의 동적 자리",
  },

  // ── 정산 조정 팝오버 (ADR-020) ────────────────────────────────────
  {
    field: "attrs",
    from: ["placeholder=사유 (선택)", "class=v-btn v-btn--primary", "onClick={s.addAdj}"],
    to: [
      "placeholder=사유 (필수)",
      "class=v-btn v-btn--primary",
      "onClick={s.addAdj}",
      "disabled={adjBlocked}",
    ],
    why:
      "★ 조정의 **사유를 필수로 만든다** (2026-08-20 · ADR-020 A5) ★ 목업은 「사유 " +
      "(선택)」이고 사유 없이 넣으면 스택에 «사유 없음»으로 남는다. 목업 시절에는 그게 " +
      "무해했다 — 저장이 없었으므로 새로고침이면 사라지는 화면 상태였다. 우리는 이것을 " +
      "**장부에 영구히 쌓는다.** 사유 없는 조정은 몇 달 뒤에 오타와 구별되지 않고, " +
      "애초에 조정 레이어를 «복제 시트에서 값 고치기» 대신 고른 근거 셋 중 하나가 " +
      "「`reason`이 NOT NULL이라 왜 고쳤는지가 반드시 남는다」였다. 선택으로 열면 그 " +
      "근거가 무너지고 NOT NULL은 장식이 된다. 필수로 만든 이상 버튼도 따라간다 — " +
      "`disabled`는 위 «드롭다운 잠금»과 같은 처방이고, 왜 막혔는지는 바로 위 " +
      "`data-s21=\"settle-adj-guard\"` 한 줄이 말한다 (§21-1)",
  },
  {
    field: "styles",
    from: [
      "flex:1",
      "minWidth:0",
      "height:27px",
      "fontSize:12px",
      "display:flex",
      "alignItems:center",
      "gap:6px",
      "height:27px",
      "height:27px",
    ],
    to: [
      "flex:1",
      "minWidth:0",
      "height:27px",
      "fontSize:12px",
      "display:flex",
      "alignItems:center",
      "gap:6px",
      "height:27px",
      "opacity:{adjAddOpacity}",
      "height:27px",
    ],
    why:
      "위 «사유 필수»의 styles 쪽 짝 — 「조정 추가」 버튼의 `opacity`. `disabled`만으로는 " +
      "파란 primary 버튼이 그대로 파랗게 남아 눌리는 줄 알고 누른다 (`fixSaveOpacity` · " +
      "`product.ts`의 `saveOpacity`와 같은 판례). 앞뒤 항목을 길게 붙인 것은 " +
      "「height:27px」가 팝오버 안에만 네 곳이라 구간을 유일하게 짚기 위해서다",
  },
  {
    field: "holes",
    from: ["adjWhy", "setAdjWhy", "s.addAdj", "s.hasAdj", "s.resetAdj"],
    to: [
      "adjWhy",
      "setAdjWhy",
      "adjBlockWhy",
      "adjAddOpacity",
      "s.addAdj",
      "adjBlocked",
      "s.hasAdj",
      "s.resetAdj",
    ],
    why:
      "위 «사유 필수»의 holes 쪽 짝. `adjBlockWhy`가 **구간 밖에 한 번 더** 나오는 것은 " +
      "`data-s21=\"settle-adj-guard\"`를 **감싼 조건**이기 때문이다 — 구간 자체는 대조에서 " +
      "빠지지만 감싼 `{vals.adjBlockWhy && …}`는 부모에 남는다 (`periodPick` 판례). " +
      "막힐 이유가 없으면 그 줄을 아예 그리지 않는다: 아무것도 안 쓴 상태는 «틀림»이 " +
      "아니라 «아직»이라, 팝오버를 열자마자 빨간 줄이 뜨면 그게 거짓말이다",
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
      "§21-4 «매출 구성» — **둘을 데이터가 고른다** (2026-08-16 개정). 처음에는 도넛을 " +
      "폐기하고 가로 막대만 두었는데, 그 근거였던 실측(매출 7,896,500원 · 광고비 " +
      "15,700,534원 = **198.8%**)이 참인 것은 «합이 매출을 넘을 때»뿐이다. 그래서 금지가 " +
      "아니라 조건으로 갈랐다: 「일곱 항 + 기여이익 = 매출」이면 도넛(목업 그대로 · 112px · " +
      "가운데 기여이익률), 비용이 매출을 먹었으면 가로 막대 + 그 %를 숫자로. 사람이 다시 " +
      "켤 일이 없다 — 광고비가 매출을 넘는 달에 화면이 스스로 막대로 내려간다. " +
      "목업의 조각별 `clip-path` 겹침과 호버 툴팁은 옮기지 않는다: 금액을 범례에 " +
      "인라인으로 두면 호버 없이 읽히고(§9), 그러면 툴팁이 답할 질문이 남지 않는다",
  },
  {
    id: "period-picker",
    removeWhenWired: null,
    mockupStyle: null,
    why:
      "월 선택기 — 신설 (MVP 1, 2026-08-16). 목업의 헤더 부제는 «2026년 8월»이라는 " +
      "**박힌 문자열**이었고 앱의 기간도 상수였다 — 8월 파일을 넣으면 가져오기는 " +
      "성공하는데 화면은 영영 7월을 그린다. 부제 span은 목업 그대로 두고 그 옆에 " +
      "칩 하나(현재 달 + 데이터가 있는 달 목록)를 세운다. 새 화면을 만들지 않는다",
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
    id: "shell-loading",
    mockupStyle: null,
    removeWhenWired: null,
    why:
      "★ 「아직 모른다」 — 첫 조회가 끝나기 전의 세 번째 상태 (2026-08-21) ★ " +
      "목업에는 화면 상태가 둘뿐이었다: `firstRun`(데이터가 하나도 없다)과 " +
      "`notFirstRun`(있다). 시드가 전 화면을 채우는 목업에서는 그걸로 족했지만, " +
      "실물은 조회가 **비동기**라 그 사이에 답을 모르는 구간이 있다. 그때 목업의 " +
      "이분법을 그대로 쓰면 앱이 뜨자마자 「데이터가 하나도 없습니다」를 그렸다가 " +
      "조회가 끝나면 대시보드로 갈아치운다 — 사용자가 «앱 열자마자 대시보드로 " +
      "점프한다»고 물은 그 현상이다(웹판은 wasm + demo.sqlite를 네트워크로 받아 " +
      "그 구간이 길다). " +
      "★ 그런데 진짜 문제는 깜빡임이 아니라 거짓말이다 ★ 그동안 앱은 「없다」고 " +
      "말하지만 실은 «아직 모른다»이고, §22의 «부재는 boolean이 아니다»가 금지하는 " +
      "바로 그 자리다. 본문을 대신 그리는 것은 더 나쁘다 — 0원을 사실인 척하게 된다. " +
      "그래서 셋으로 가른다: **모름 · 없음 · 있음**. 침묵하지 않고 «아직 데이터가 " +
      "있는지 없는지 모릅니다»라고 **말한다**(LOCK 6 · §21-7이 화면에 대해 이미 같은 " +
      "결론을 냈다 — 빈 화면이 침묵하면 «없다»가 아니라 «깨졌다»로 읽힌다)",
  },
  {
    id: "scope-bar",
    mockupStyle: null,
    removeWhenWired: null,
    why:
      "★ 「보는 범위」 — 어느 파일들을 합쳐 볼 것인가 (2026-08-21 · ADR-021 · 013) ★ " +
      "사용자가 물었다: *«앱이 무비판적으로 모든 파일을 받아들여 합치는 것 같다. " +
      "합쳐야 될 파일들을 유저가 직접 선택해야 하는 거 아니냐.»* 실측하면 맞았다 — " +
      "`active_*` 뷰 다섯의 조건은 `b.status = 'committed'` 하나뿐이고, 그 조건의 원래 " +
      "목적은 「적재 중 배제」였다. 목업에 대응물이 없는 이유도 같다: 목업은 **모든 " +
      "파일이 늘 합쳐진 세계**를 그렸고 「어느 파일을 볼까」라는 물음 자체가 없었다 " +
      "(§21-6 «전제의 시차»). " +
      "★ 왜 새 화면이 아닌가 ★ 새 NAV 키는 여섯 곳이 동시에 움직인다(shell.ts NAV· " +
      "TITLES · vals의 v/nav/go 세 레코드 · 사이드바 마크업 · empty-render SCREENS · " +
      "screen-safety VIEWS). 가져오기 기록은 이미 batch 단위 목록·되돌리기·행 미리보기를 " +
      "갖고 있어 재료가 전부 있다 — ADR-021이 미결로 남긴 「파일 목록 화면의 자리」를 " +
      "수술 면적으로 정했다. " +
      "★ 이 화면만 범위에 안 걸린다 ★ 파일 목록이 범위로 걸러지면 «담을 파일을 고르는 " +
      "화면»이 자기 자신을 가린다. `batchHistory`는 늘 전부를 준다. " +
      "★ 빼기 ≠ 되돌리기 ★ 같은 화면에 두 버튼이 붙으므로 문구를 갈랐다 — 되돌리기는 " +
      "«행이 사라진다», 빼기는 «계산에서만 빠진다». 그리고 막지 않는다: 뺀 것의 **금액**을 " +
      "함께 보인다(ADR-021 — 앱은 경고하고 결과를 보이는 데까지고 결정은 사용자 몫이다). " +
      "★ 조건 없이 그린다 ★ 구간을 `{vals.X && …}`로 감싸면 그 홀이 부모 IR에 남아 " +
      "holes DEVIATIONS를 하나 더 요구한다. 늘 그리고 안쪽에서 갈라 선언을 하나로 줄였다",
  },
  {
    id: "history-rows",
    mockupStyle: null,
    removeWhenWired: null,
    why:
      "★ 「가져온 것들의 테이블」 — 적재된 행 패널 (2026-08-21) ★ 사용자가 물었다: " +
      "*«가져오기로 가져온 것들 어디서 테이블을 볼 수 있다는 거야?»* 실측한 답은 " +
      "**어디서도 못 본다**였다 — 주문 화면은 가공된 뷰, 정산은 집계, 가져오기 기록은 " +
      "파일 단위 요약이고, 넣은 행 자체를 보는 자리가 없었다. `batch_id`로 Fact 행에 " +
      "닿는 SQL조차 **DELETE 하나뿐**(되돌리기)이라, 앱은 넣은 것을 지울 줄만 알고 " +
      "보여줄 줄은 몰랐다. 목업도 같은 전제였다 — `syncRows`의 행 클릭이 빈 함수이고 " +
      "이 파일 주석이 «상세 패널은 아직 없다»라고 적어 뒀다 (§21-6 «전제의 시차»). " +
      "★ 원본 파일이 아니다 ★ 적재 후에 남는 것은 앱이 **해석한** Fact 행이다 — " +
      "`batch.source_bytes`는 파일 크기지 내용이 아니고, 원본 행은 어디에도 저장되지 " +
      "않는다. 그래서 제목이 «넣은 결과»라고 말한다. 원본 그대로는 적재 **전**의 " +
      "격자(`import-grid`)가 담당하고, 둘을 같은 말로 부르면 사용자가 「내 파일을 " +
      "다시 본다」고 기대했다가 Canonical 필드를 만난다. " +
      "★ 편집 어포던스 0 ★ Fact 행이라 LOCK 9가 인라인 편집 UI를 금지한다 — 값을 " +
      "고치는 자리는 조정 레이어다 (ADR-020). 페이징은 LOCK 5다: 8만 행 batch가 정기 " +
      "입력이라 한 페이지 50행만 읽는다. 컬럼은 **거부 목록**으로 고른다(허용 목록이 " +
      "아니다 — `discount_amount`처럼 표에는 있는데 등록부에 없는 열이 실재해서, " +
      "허용 목록이면 그 값이 조용히 사라진다)",
  },
  {
    id: "dash-partial-ack",
    mockupStyle: null,
    removeWhenWired: null,
    why:
      "제외 배너의 **「확인하고 접기」** — 신설 (2026-08-21 · 마이그레이션 012). " +
      "사용자 지적: *«파일에서 7행이 제외됐습니다 — 이게 계속 떠서 불편함. 한 번 " +
      "확인하고 접거나 이런 버튼이 있어야 할 듯»*. 목업에는 접는 자리가 없다 — " +
      "시드가 한 상태만 그렸으니 «봤다»라는 시간축이 없었다 (§21-6 «전제의 시차»). " +
      "★ 그냥 닫으면 LOCK 6 위반이다 ★ 제외 7행 중 5행은 「읽지 못한 행」이고 그건 " +
      "양식 해석이 틀렸다는 신호다 — 닫는 버튼이 그 신호를 영영 지우면 배너가 있던 " +
      "이유가 사라진다. 그래서 **배너만 접고 히어로의 칩은 남긴다**(«일부 제외 · " +
      "확인함»). ADR-016의 `pending_cost.dismissed`가 «삭제가 아니라 세고 있는 " +
      "부재»인 것과 같은 모양이다. " +
      "★ 수가 늘면 다시 펴진다 ★ 012가 «확인 당시의 수»를 저장하는 이유다 — 확인은 " +
      "«이 배너를 봤다»가 아니라 «7행이라는 그 사실을 봤다»이고, 새 파일로 12행이 " +
      "되면 확인한 적 없는 새 소식이다. 「봤다」만 남기면 문제가 커져도 화면이 " +
      "조용해진다",
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
  // ── 상품 화면 ③ — 원가 입력 (2026-08-14) ──────────────────────────
  //
  // §21-7 «unbuilt-products» 안내가 **여기 있다가 지워졌다.** 화면이 배선되면서
  // 임시물의 수명이 다한 것이고, 그 신호는 «배선 시 제거» 단언이 먼저 깨지며 왔다.
  {
    id: "cost-input",
    removeWhenWired: null,
    mockupStyle: "text-align: right; border-color: var(--pnl-warn)",
    why:
      "매입원가 칸 «교체». 목업의 입력칸 하나가 세 가지를 못 한다 — ① 초안(`costDraft`)이 " +
      "화면에 **하나뿐**이라 61행이 공유한다(한 칸에 치면 61칸에 뜬다) ② **적용일이 없다** " +
      "③ 채운 뒤엔 못 고친다(`costFilled`가 읽기 전용 텍스트). ②가 가장 무겁다: 목업의 " +
      "`costQuick`은 SKU당 숫자 하나라 «8월부터 원가가 올랐다»를 표현할 수 없고, 그 모델대로 " +
      "저장하면 **과거 주문에 새 원가가 소급 적용된다** — 7월 손익이 8월에 원가를 고칠 때마다 " +
      "바뀐다. 001의 `cost_history`는 처음부터 `effective_from`을 갖고 있었으므로, 목업을 " +
      "따라가면 스키마가 이미 아는 답을 화면이 되묻는 꼴이 된다. 금액 · 적용일(기본 오늘, " +
      "상시 노출) · 저장 버튼(§21-1대로 못 누르면 사유 표시) · 이력 건수가 들어온다",
  },
  {
    id: "cost-gauge",
    removeWhenWired: null,
    mockupStyle: null,
    why:
      "원가 입력 진척 게이지 — 신설. **분모는 SKU 수**다(§22 «원가는 하나라도가 아니라 " +
      "전부여야 열린다»와 같은 분모). 품목 수로 세면 많이 팔린 SKU 하나만 넣어도 게이지가 " +
      "차 보여 «거의 다 됐다»는 거짓 신호가 된다. 아래 줄은 §22-3-b의 «온전함» 몫이다 — " +
      "게이지가 꽉 차도 `fact_order_item`이 비어 있는 동안은 손익의 매입원가가 움직이지 " +
      "않으므로 그 사실을 말한다. 품목 적재가 생기면 그 줄은 **스스로 사라진다**",
  },
  // ── 가져오기 위저드 — 목업에 없던 다섯 자리 ────────────────────────────
  // 목업 위저드는 «파일이 이미 골라진 세계»를 그렸다. 고르는 자리도, 시트를 고르는
  // 자리도, 넣은 뒤의 결과도 없다. §21-6 ②와 같은 «전제의 시차»다.
  {
    id: "import-pick",
    mockupStyle: null,
    removeWhenWired: null,
    why:
      "파일을 고르는 자리 — 신설. 목업 위저드는 `srcWizard`가 참인 상태부터 그려서 " +
      "**파일이 없을 때 아무것도 렌더되지 않는다.** ADR-013대로 웹 표준 " +
      '`<input type="file">`이고 IPC 표면이 0이다',
  },
  {
    id: "import-reference",
    mockupStyle: null,
    removeWhenWired: null,
    why:
      "기준 데이터의 **적용 시작일** — 신설 (2026-08-19). 목업 위저드는 사실 파일만 " +
      "그렸고 사실 파일은 행마다 날짜를 들고 온다. 기준 데이터(원가)는 **상태**라 " +
      "«언제부터»가 데이터 밖에 있고 — 실측 원가표 7열 어디에도 없다 — 지어내면 " +
      "과거 주문에 새 원가가 소급돼 **지난달 손익이 이번 달에 바뀐다**. " +
      "`product.ts`의 목업 결함 ②와 같은 문제이고 답도 같다: 사람에게 묻는다. " +
      "묻는 자리가 없어서 신설했고, 날짜가 비면 실행 버튼이 안 눌린다 — 빈 채로 " +
      "오늘을 채워 넣으면 그게 곧 지어낸 값이다",
  },
  {
    id: "import-error",
    mockupStyle: null,
    removeWhenWired: null,
    why: "실패 사유를 말하는 자리 — 신설. 못 읽은 이유를 숨기지 않는다 (LOCK 6)",
  },
  {
    id: "import-big",
    mockupStyle: null,
    removeWhenWired: null,
    why:
      "큰 파일 고지 — 신설. 위저드 v1은 파이프라인을 **메인 스레드**에서 돌린다 " +
      "(ADR-001 조건 2 위반 · 인지된 부채). 8만 행이면 9.5~10.4초 화면이 멈추는데, " +
      "**고지 없는 프리즈는 강제 종료를 부른다** — 사용자의 자연스러운 반응이 " +
      '"죽었나?"이기 때문이다. 미리 말하면 같은 10초가 "크니까 그렇구나"가 된다. ' +
      "Worker로 옮기면 이 구간을 지운다",
  },
  {
    id: "import-sheets",
    mockupStyle: null,
    removeWhenWired: null,
    why:
      "§18 시트 선택 — 신설. 시트가 여럿일 때만 뜬다. 역할·행수·수식비율을 함께 보이는데, " +
      "**수식으로 계산된 시트를 사실로 적재하면 숫자가 두 번 더해진다** — 그 판단 재료를 " +
      "사람에게 넘기는 것이 §18-A/B의 요구다",
  },
  {
    id: "import-grid",
    mockupStyle: null,
    removeWhenWired: null,
    why:
      "★ 원본 표 미리보기 (격자) — 신설 (2026-08-20) ★ 목업 위저드의 표 머리글은 " +
      "「파일 헤더 | 샘플 값 | Canonical 필드 | 추론 근거 | 확신도」로 **우리 구현과 " +
      "글자까지 같고**, 목업 전체를 훑어도 행×열 격자는 없다. 즉 「열 한 줄씩」 세로 " +
      "목록은 우리가 임의로 만든 것이 아니라 목업 그대로이고, 격자는 순수 신설이다 " +
      "(§21-6의 «전제의 시차» — 목업은 «파일이 이미 이해된 세계»를 그렸다). " +
      "없으면 무엇이 거짓이 되나: 사용자는 넣기 전에 «이게 내 파일이 맞나»를 **열 " +
      "이름만 보고** 판단한다. 열 목록은 «이 열이 무슨 뜻인가»에 답하지 «파일이 어떻게 " +
      "생겼나»에 답하지 않는다 — 그래서 대체가 아니라 **병치**다. " +
      "★ 행 번호는 파일 좌표다 ★ `a.sample`은 헤더·합계·빈 행이 이미 빠진 «파이프라인이 " +
      "본 것»이라, 순서대로 1,2,3…을 그리면 파일에 없는 좌표를 지어내는 것이 된다 " +
      "(LOCK 6). 실측 「파워클릭 보고서」는 표본 17행이 물리 6~65에 흩어져 있고 16~34행이 " +
      "통째로 비어 있다 — 순서로 그렸으면 «17행짜리 정상 표»로 보였다. 빠진 자리는 " +
      "제자리에 접어 남긴다(헌장 C-5 «제외 행 삭선 + 카운트»). " +
      "★ 편집 어포던스 0 ★ 원본 셀은 사실층이고 §21-1이 «못 누르는 버튼을 그려놓고 " +
      "막는 것이 아니라 아예 안 그린다»고 못박았다 (LOCK 9의 시각적 대응). 값을 고치는 " +
      "자리는 복제 시트가 아니라 조정 레이어다 (ADR-020)",
  },
  {
    id: "import-digest",
    mockupStyle: null,
    removeWhenWired: null,
    why:
      "다이제스트 — 신설. **`batch_exclusion`을 사유별로 읽는 첫 화면이다.** 그 테이블은 " +
      "지금까지 넣기만 하고 아무도 읽지 않았다 — 「128행 적재」만 말하고 제외 2건을 두고 " +
      "오면 그게 곧 조용한 실패다 (LOCK 6)",
  },
  {
    id: "cost-fixed-save",
    mockupStyle: null,
    removeWhenWired: null,
    why:
      "고정비의 **적용일 · 항목 추가 · 저장 · 「두지 않습니다」 선언** — 신설 (2026-08-19). " +
      "목업의 고정비 표는 「금액 칸 4개를 고친다」를 정확히 그렸는데, 그 옆에 없는 것이 " +
      "둘이다: ① **적용일**이 없어 저장하면 오늘 값이 과거 전체에 소급된다 — 지난달 " +
      "순이익이 이번 달에 임대료를 고칠 때마다 바뀐다(`product.ts`가 원가 칸에서 만난 " +
      "것과 같은 문제) ② **항목을 못 더한다** — 시드 4개가 고정인데 고정비 항목은 " +
      "사람마다 다르다. ★ 그래도 목업 표를 치우지 않았다 ★ 표가 못 하는 것은 표 " +
      "자체가 아니라 그 옆에 없는 것들이라, 갈아엎는 대신 아래에 제어부 한 블록을 " +
      "붙인다 — 수술 면적이 작을수록 목업과 어긋난 자리를 세기 쉽다. " +
      "「두지 않습니다」가 함께 있는 이유는 §22다: 「0원」과 「0원이 맞다」를 구분하지 " +
      "못하면 일부러 안 넣는 사용자에게 진단이 영영 「미입력」이라고 잔소리하고, " +
      "지워지지 않는 경고 하나가 화면 전체를 안 보게 만든다",
  },
  {
    id: "cost-ops-save",
    mockupStyle: null,
    removeWhenWired: null,
    why:
      "운영비의 **적용일 · 부담 기준 · 항목 추가 · 저장 · 「두지 않습니다」** — 신설 " +
      "(2026-08-21). `cost-fixed-save`와 **같은 결함의 같은 처방**이다: 목업은 운영비 " +
      "표를 그렸지만 넣는 문이 없었고, 시드가 채운 표만 있었다. 그래서 저장·조회는 " +
      "010부터 다 있는데(`overhead`의 `kind`가 처음부터 `FIXED|OPS` 둘이다) **화면만** " +
      "없어서 손익 3층의 「− 운영비」가 영영 0이었다. " +
      "★ 고정비 블록과 한 칸 다르다 — **부담 기준** ★ 010이 `FIXED`는 `MONTH`만 " +
      "쓴다고 못박았으므로 고정비에는 고를 것이 없다. 운영비는 `ORDER`(주문당)와 " +
      "`UNIT`(개당)로 갈리고 그 선택이 손익을 바꾼다 — 택배비 3,000원을 주문당으로 " +
      "두면 주문 수만큼, 개당으로 두면 품목 수만큼 빠진다. **앱이 고를 수 없는 값이라 " +
      "사람이 고른다**(ADR-010 계보 — 미지의 값을 기본으로 흘리지 않는다). " +
      "초안을 고정비와 나눠 든 것도 같은 이유다: 한 벌을 쓰면 「고정비 적용일을 고르고 " +
      "운영비를 저장」했을 때 운영비가 조용히 남의 날짜로 들어간다",
  },
  {
    id: "settle-adj-guard",
    mockupStyle: null,
    removeWhenWired: null,
    why:
      "정산 조정 팝오버의 **「왜 못 누르나」 한 줄** — 신설 (2026-08-20 · ADR-020 A5). " +
      "목업 팝오버에는 금액·사유 입력과 「조정 추가」 버튼만 있고 막힌 이유를 말할 자리가 " +
      "없다. 목업에서는 사유가 **선택**이라 막힐 일 자체가 없었기 때문인데, 우리는 사유를 " +
      "**필수**로 만들었다 — 사유 없는 조정은 나중에 오타와 구별되지 않고, 조정 레이어를 " +
      "복제 시트 대신 고른 근거 자체가 「왜 고쳤는지가 반드시 남는다」였다. 필수로 만든 " +
      "이상 §21-1이 요구한다: **누를 수 없으면 사유를 함께** 낸다. 아무 말 없이 회색인 " +
      "버튼은 «고장»으로 읽힌다. 열자마자 뜨지는 않는다 — 아직 아무것도 안 쓴 상태는 " +
      "«틀림»이 아니라 «아직»이다",
  },
  {
    id: "link-cost-pending",
    mockupStyle: null,
    removeWhenWired: null,
    why:
      "원가 대기 탭 — 신설 (2026-08-19 D2 · 마이그레이션 011). 사용자 실파일(카드 " +
      "단가표)이 200블록 읽히고도 상품번호가 없어 0건이 붙었고, 못 붙은 행이 대기실에 " +
      "쌓인다. «이 품명 = 이 상품»은 리스팅 연결과 같은 종류의 판단이라(§21-6 — " +
      "데이터에 답이 없어 사람이 정한다) 같은 화면의 탭으로 들어온다. 목업에는 이 " +
      "탭이 없다 — 목업은 원가가 상품번호로 저절로 붙는 세계만 그렸고, 상품번호 없는 " +
      "단가표는 전제 밖이었다 (§21-6의 «전제의 시차»). 후보는 모델 정확 일치가 이름 " +
      "유사도를 이기고(코드 일치는 확률이 아니라 사실 — %를 말하지 않는다), 확정의 " +
      "주체는 언제나 사람이다. clear만 primary — 경합을 골라주면 사람은 그대로 누른다",
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
