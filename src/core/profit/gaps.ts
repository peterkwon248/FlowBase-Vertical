/**
 * **이 숫자가 담지 못한 것** — 손익 옆에 반드시 따라붙는 단서.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 core에 있는가 ★
 *
 * 이 판정은 원래 `tools/harness/pnl.ts`(3b-0 CLI)의 **출력부 안에만** 있었다.
 * 화면에 숫자만 옮기고 단서를 두고 오면 그 순간 화면이 조용히 거짓말을 한다 —
 * 사용자는 순이익을 완성된 숫자로 읽지만, 실제로는 한 연결의 광고비를 다른
 * 연결의 매출에서 뺀 미완성 합성이다 (헌장 A-5).
 *
 * 그래서 **판정을 한 곳에 둔다.** 문장은 표면마다 달라도 된다 — CLI는 여러 줄,
 * 화면은 한 줄이다. 갈라지면 안 되는 것은 문장이 아니라 **"무엇이 빠졌는가"의
 * 조건**이다. 단일 계산기 원칙(C-3)이 계산기 → 조회 계층(`snapshot`)에 이어
 * **단서 계층**까지 확장된 것이다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 마켓을 모른다 ★ (LOCK 4)
 * "11번가 정산인데 11번가 주문이 없다"가 아니라 **"정산 N건이 주문에 이어지지
 * 않는다"**라고 쓴다. 마켓 이름은 이 파일에 들어올 수 없고, 그래도 사용자가
 * 알아야 할 사실은 온전히 전달된다. 어느 마켓인지는 연결 목록이 말해준다.
 */

import type { PnlSnapshot } from "./snapshot.js"

export type PnlGapId =
  | "settlement-unjoined"
  | "claim-proxy-date"
  | "period-aggregated"
  | "period-spilling"
  | "cogs-missing"
  | "overhead-missing"
  | "connections-mixed"

/**
 * 단서 하나. **표시용 문자열까지 여기서 만든다** — 표면이 제각기 문장을 지어내면
 * 같은 사실이 화면마다 다르게 읽힌다.
 *
 * 세 조각으로 나눠 주는 것은 화면 행이 세 칸(이름 · 상태 · 수치)이기 때문이고,
 * `detail`은 그 한 줄로 부족한 곳(CLI·툴팁)이 쓴다.
 */
export interface PnlGap {
  readonly id: PnlGapId
  /** 무엇이 — 화면 행 왼쪽. */
  readonly label: string
  /** 어떤 상태인지 한 단어 — 화면 행 오른쪽. */
  readonly state: string
  /** 수치 — 화면 행 끝. 셀 자리가 없으면 빈 문자열. */
  readonly note: string
  /** 한 문장 설명. 왜 빠졌고 무엇을 하면 채워지는지. */
  readonly detail: string
  /** `warn` = 숫자를 왜곡한다 · `info` = 아직 안 넣었을 뿐이다. */
  readonly tone: "warn" | "info"
}

const won = (n: number): string =>
  `${n < 0 ? "-" : ""}${Math.abs(Math.round(n)).toLocaleString("ko-KR")}원`

/**
 * 스냅샷 하나에서 단서를 뽑는다. **추가 조회를 하지 않는다** — 스냅샷이 이미
 * 들고 있는 값만 본다. 새 단서가 새 집계를 요구하면 스냅샷을 넓힌다.
 */
export function pnlGaps(snap: PnlSnapshot): PnlGap[] {
  const gaps: PnlGap[] = []
  const { pnl, settlement } = snap

  // ① 주문에 이어지지 않은 정산 — 그만큼의 수수료가 손익에서 통째로 빠진다.
  //
  // ★ CLI보다 넓게 잡는다 ★
  // CLI의 조건은 `joined.count === 0`이었다 — **한 건도** 안 이어질 때만 말한다.
  // 절반만 이어지면 나머지 수수료가 조용히 빠지는데 화면도 CLI도 아무 말을 하지
  // 않는다. 오늘 데이터에서는 두 조건의 결과가 같지만(조인 0건), 이건 정확히
  // "추정으로 넘어간 자리는 나중에 그대로 버그가 된다"에 해당하는 자리다.
  const unjoined = settlement.all.count - settlement.joined.count
  if (unjoined > 0) {
    const missingFee = settlement.all.fee - settlement.joined.fee
    gaps.push({
      id: "settlement-unjoined",
      label: "주문에 이어지지 않은 정산",
      state: "수수료 빠짐",
      note: won(missingFee),
      tone: "warn",
      detail:
        `수수료 ${won(missingFee)}가 손익에서 빠졌다 — 정산 ${unjoined.toLocaleString("ko-KR")}건이 ` +
        `주문에 이어지지 않는다. 정산 파일은 있는데 같은 연결의 **주문** 파일이 없어 ` +
        `order_source_key 조인이 비어 있다. ` +
        `(정산 자체 합계: 판매 ${won(settlement.all.gross)} · 공제 ${won(settlement.all.fee)} · ` +
        `정산 ${won(settlement.all.net)})`,
    })
  }

  // ② 발생일이 추정인 클레임 — 달 경계에서 어느 달에 잡히는지가 흔들린다.
  if (snap.proxyDatedClaims > 0) {
    gaps.push({
      id: "claim-proxy-date",
      label: "발생일이 추정인 클레임",
      state: "날짜 추정",
      note: `${snap.proxyDatedClaims.toLocaleString("ko-KR")}건`,
      tone: "warn",
      detail:
        `클레임 ${snap.proxyDatedClaims}건의 발생일이 **추정**이다 — 양식에 클레임 일자 컬럼이 ` +
        `없어 결제일을 프록시로 썼다(date_precision='proxy'). 실제 반품일이 다음 달이면 그 달에 ` +
        `잡혀야 하지만 파일이 말해주지 않는다 (ADR-009 ①-보완)`,
    })
  }

  // ★ 기간 집계 — 월 합계는 온전한데 일별로는 못 쪼갠다 ★
  //
  // 마켓이 건별 데이터를 주지 않는 채널이 여기 잡힌다 (§22-5 개정: «건별이
  // 존재하지 않는 사실의 집계는 그 사실의 원본이다»). 원본이므로 손익에는
  // 온전히 들어가지만, **일별 그래프에서는 통째로 빠진다.** 말하지 않으면
  // 사용자는 일별 합이 월 숫자와 다른 것을 보고 어느 쪽이 틀렸는지 모른다.
  //
  // `tone: "info"` — 숫자를 왜곡하지 않는다. 표현 방식의 한계일 뿐이다.
  const pa = snap.periodAggregated
  if (pa.count > 0) {
    gaps.push({
      id: "period-aggregated",
      label: "기간으로만 오는 매출",
      state: "일별 분해 불가",
      note: won(pa.amount),
      tone: "info",
      detail:
        `매출 ${won(pa.amount)}(${pa.count.toLocaleString("ko-KR")}행)가 **기간 집계**로 들어왔다 — ` +
        `마켓이 건별 데이터를 주지 않아 파일이 기간 합계만 준다. 월 합계에는 온전히 들어가지만 ` +
        `**일별 그래프에는 나타나지 않는다** (date_precision='period', 마이그레이션 005)`,
    })
  }

  // 기간이 조회 범위를 넘어가면 귀속이 애매해진다. 월 파일을 월로 보는 한 0이다.
  if (pa.spilling > 0) {
    gaps.push({
      id: "period-spilling",
      label: "기간이 조회 범위를 넘는 집계",
      state: "귀속 애매",
      note: `${pa.spilling.toLocaleString("ko-KR")}행`,
      tone: "warn",
      detail:
        `기간 집계 ${pa.spilling}행의 기간이 보고 있는 범위 **밖까지 걸쳐 있다.** ` +
        `그 매출의 일부는 다음 기간의 것인데 시작일 기준으로 이 기간에 전부 잡혔다 — ` +
        `범위를 파일의 기간에 맞추면 사라지는 단서다`,
    })
  }

  // ③④ 기준 데이터 — 파일이 아니라 사람이 넣는 값이라 "아직 없음"이 정상이다.
  if (pnl.cogs === 0) {
    gaps.push({
      id: "cogs-missing",
      label: "매입원가",
      state: "미입력",
      note: "0원",
      tone: "info",
      detail: "원가 0 — cost_history가 비어 있다. 기준 데이터라 파일이 아니라 사람이 넣는다",
    })
  }
  if (pnl.fixed === 0 && pnl.ops === 0) {
    gaps.push({
      id: "overhead-missing",
      label: "고정비·운영비",
      state: "미입력",
      note: "0원",
      tone: "info",
      detail: "고정비·운영비 0 — 같은 이유. 기준 데이터 화면이 생기면 채워진다",
    })
  }

  // ⑤ 연결이 섞여 있다 — **이 목록에서 가장 무거운 단서다.**
  //
  // 매출과 광고비가 서로 다른 연결에서 왔다면 순이익은 한 연결의 성과가 아니다.
  // CLI는 이 문장을 무조건 출력했지만(픽스처를 알고 있으니까) 여기서는 **판정**한다 —
  // 한 연결만 온전히 들어오면 이 단서는 스스로 사라져야 옳다.
  if (snap.contributingConnections > 1) {
    gaps.push({
      id: "connections-mixed",
      label: "여러 연결이 섞인 기간",
      state: `연결 ${snap.contributingConnections}개`,
      note: "",
      tone: "warn",
      detail:
        `연결 ${snap.contributingConnections}개의 데이터가 한 숫자로 합쳐졌다 — 매출·광고비·정산이 ` +
        `같은 연결에서 오지 않았다. 한 채널의 완결된 손익이 아니므로 순이익을 채널 성과로 읽으면 안 된다`,
    })
  }

  return gaps
}
