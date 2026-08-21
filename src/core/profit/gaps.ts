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
  | "shipping-source"
  /** 원가를 넣어도 곱할 품목이 없다 — «미입력»과 전혀 다른 처방을 요구한다 (③④). */
  | "cogs-unappliable"
  /** 품목은 있는데 리스팅이 SKU에 안 이어졌다 — 처방은 «연결»이지 «원가»가 아니다. */
  | "cogs-unlinked"
  /** 기간 집계 행의 원가가 기간 시작일 단가로 계산됐다 — 조용한 근사 금지 (조건 2). */
  | "cogs-period-approx"
  | "overhead-missing"
  /** 운영비의 부재는 고정비와 **따로** 센다 — 하나를 넣었다고 다른 하나가 메워지지 않는다. */
  | "ops-missing"
  /**
   * ★ 광고비가 상품까지 못 내려간 세 이유 (014 · ADR-022) ★
   * 처방이 서로 다르므로 한 덩어리로 뭉치지 않는다 — `cogs-unlinked`와
   * `cogs-missing`을 가른 것과 같은 판단이다.
   */
  | "ad-unlinked"
  | "ad-no-listing"
  | "ad-no-key"
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

  /**
   * ③④ 매입원가 — **«0원»의 뜻이 셋이라 한 문장으로 말할 수 없다.**
   *
   * ★ 여기 있던 한 줄은 곧 거짓말이 될 문장이었다 ★
   * *"원가 0 — cost_history가 비어 있다"*. `pnl.cogs === 0`이면 무조건 그렇게 말했으니,
   * 사용자가 상품 화면에서 원가를 넣는 **바로 그 순간** 이 문장은 거짓이 된다 —
   * cost_history는 더 이상 비어 있지 않은데 화면은 계속 비었다고 말한다.
   *
   * 실기기가 이미 같은 계열을 두 번 잡았다(결함 47의 «2026년 8월», 결함 52의 시드 3·7):
   * **화면이 데이터를 안 보고 하는 말은 데이터가 바뀌는 날 거짓이 된다.** 그래서
   * `cogsBasis`를 근거로 갈라 말한다.
   */
  const cb = snap.cogsBasis

  /**
   * ① 곱할 것이 **없는 주문** — 그 주문에는 원가를 넣어도 안 붙는다.
   *
   * ★ boolean을 건수로 바꿨다 (적대적 검토가 잡은 자리) ★
   * 전에는 «라이브러리에 품목이 하나라도 있나»였다. 그래서 품목 있는 파일 **하나만**
   * 들어오면 나머지 파일의 부재가 전 표면에서 조용해졌다 — 파일을 하나씩 다시 넣는
   * 사용자의 **바로 다음 동작** 위에 있던 침묵이다. §22가 요구하는 것은 «있나»가
   * 아니라 «몇 건이 모집단 밖인가»이고, boolean은 그 질문에 답할 수 없다.
   *
   * 옛 문구도 이제 거짓이다 — «2단계 적재 미구현»이라고 했지만 구현됐다. 그리고
   * 처방이 «기다려라»가 아니라 **«그 파일을 다시 넣어라»**다: 소급되지 않는다.
   *
   * `warn`인 이유: 매출에는 잡히고 매입원가에는 안 잡혀 기여이익이 그만큼 부푼다.
   */
  if (cb.ordersWithoutItems > 0) {
    const none = cb.ordersWithItems === 0
    gaps.push({
      id: "cogs-unappliable",
      label: "품목 없이 들어온 주문",
      state: none ? "원가 적용 불가" : "일부 적용 불가",
      note: won(cb.amountWithoutItems),
      tone: "warn",
      detail:
        `주문 ${cb.ordersWithoutItems.toLocaleString("ko-KR")}건(매출 ${won(cb.amountWithoutItems)})에 ` +
        `**품목이 붙어 있지 않다.** 원가는 «어느 SKU가 몇 개 팔렸나»에 곱해지므로 그 주문들은 ` +
        `원가 계산에서 통째로 빠지고, 그만큼 기여이익이 부풀어 있다. 품목 적재 이전에 들어온 ` +
        `batch가 이 상태이며 **소급되지 않는다** — 그 파일을 가져오기에서 **다시 넣으면** ` +
        `품목이 생긴다(source_key가 같아 행은 늘지 않는다)` +
        (none ? "" : ` · 나머지 ${cb.ordersWithItems.toLocaleString("ko-KR")}건은 품목이 붙어 있다`),
    })
  }

  {
    /**
     * ② 곱할 것은 있다. 그러면 «왜 빠졌나»가 **두 갈래**로 갈린다.
     *
     * ★ 처방이 다르면 다른 단서다 ★
     * 연결이 없는 품목은 상품 **연결** 화면에서 SKU를 이어야 하고, 원가가 없는
     * 품목은 상품 화면에서 **원가**를 넣어야 한다. 뭉뚱그려 «원가 미입력 N건»이라
     * 말하면 사용자는 원가를 다 넣고도 숫자가 안 맞는 이유를 영영 모른다.
     */
    if (cb.itemsWithoutLink > 0) {
      gaps.push({
        id: "cogs-unlinked",
        label: "SKU에 연결되지 않은 판매",
        state: "원가 못 붙음",
        note: `${cb.itemsWithoutLink.toLocaleString("ko-KR")}품목`,
        tone: "warn",
        detail:
          `판매 품목 ${cb.items.toLocaleString("ko-KR")}건 중 ${cb.itemsWithoutLink.toLocaleString("ko-KR")}건이 ` +
          `아직 SKU에 이어지지 않았다. 원가는 SKU에 붙으므로 **연결 전에는 원가를 넣어도 ` +
          `이 판매에 닿지 않는다.** 상품 연결 화면에서 리스팅을 SKU에 이으면 ` +
          `과거 판매까지 소급해서 붙는다 — 연결은 적재 시점에 박히지 않고 조회할 때 이어진다`,
      })
    }

    /**
     * ★ 광고비가 왜 상품까지 못 내려갔나 (014 · ADR-022) ★
     *
     * 「미배분 15,700,534원」만 보이면 사용자는 **할 수 있는 일이 무엇인지 모른다.**
     * 그런데 실측하면 그 대부분이 «연결만 하면 붙는» 돈이다 — 2026-08-20 개발 DB에서
     * 14,955,098원(95.3%)이 그렇다. 그건 막힌 것이 아니라 **한 동작 남은 것**이다.
     *
     * 세 갈래는 처방이 다르므로 따로 말한다 (`cogs-unlinked`/`cogs-missing`을 가른
     * 것과 같은 판단):
     *   noLink     연결하면 **소급해서** 붙는다      ← 사용자가 지금 할 수 있다
     *   noListing  그 옵션의 주문 파일을 넣으면 붙는다 ← 파일이 더 필요하다
     *   noKey      파일이 상품을 안 말한다           ← 할 수 있는 일이 없다
     */
    const ad = snap.adSplit
    if (ad.noLink > 0) {
      gaps.push({
        id: "ad-unlinked",
        label: "연결만 하면 상품에 붙는 광고비",
        state: "연결 대기",
        note: `${ad.noLink.toLocaleString("ko-KR")}원`,
        tone: "warn",
        detail:
          `광고비 ${ad.noLink.toLocaleString("ko-KR")}원이 **어느 상품 것인지 파일이 말하고 ` +
          `있는데** 그 상품이 아직 SKU에 이어지지 않아 상품 손익에 못 붙는다. ` +
          `지금은 채널 기여이익(2층)에서만 빠지므로 **「이 상품이 남는가」의 답이 낙관적이다.** ` +
          `상품 연결 화면에서 이으면 과거 광고비까지 소급해서 붙는다`,
      })
    }
    if (ad.noListing > 0) {
      gaps.push({
        id: "ad-no-listing",
        label: "주문 파일이 없는 광고비",
        state: "파일 없음",
        note: `${ad.noListing.toLocaleString("ko-KR")}원`,
        tone: "info",
        detail:
          `광고비 ${ad.noListing.toLocaleString("ko-KR")}원이 가리키는 상품의 **주문 파일이 ` +
          `아직 없다.** 그 기간의 주문 파일을 넣으면 리스팅이 생기고, 연결하면 붙는다`,
      })
    }
    if (ad.noKey > 0) {
      gaps.push({
        id: "ad-no-key",
        label: "상품을 알 수 없는 광고비",
        state: "파일이 안 말함",
        note: `${ad.noKey.toLocaleString("ko-KR")}원`,
        tone: "info",
        detail:
          `광고비 ${ad.noKey.toLocaleString("ko-KR")}원은 **어느 상품 것인지 파일 자체가 ` +
          `말해주지 않는다** (일자별 집계만 주는 양식). 이건 «0원»이 아니라 «모름»이고, ` +
          `연결을 아무리 해도 상품까지 내려가지 않는다 — 채널 단위로만 볼 수 있다`,
      })
    }

    /**
     * ★ 배송비의 **출처를 가른다** (ADR-029 결정 2 · LOCK 6) ★
     *
     * 3층의 «배송» 줄에는 두 사건이 합산돼 있다 — 마켓이 정산에서 공제한 돈과, 내가
     * 택배사에 낸 돈(원가표의 `배송비` → `LOGISTICS`). 합쳐서 빼는 것은 맞지만
     * **합쳐서 말하면** 사용자는 틀렸을 때 어느 파일을 고쳐야 할지 모른다.
     *
     * `tone: "info"` — 결핍이 아니라 **구성의 설명**이다. 원가표에 배송비가 없으면
     * 이 줄은 아예 안 뜬다 (없는 것을 결핍으로 부르지 않는다 · §22).
     */
    const sb = snap.shippingBasis
    if (sb.costTable > 0) {
      gaps.push({
        id: "shipping-source",
        label: "배송비",
        state: sb.settlement === 0 ? "원가표에서만" : "출처 둘",
        note: won(sb.settlement + sb.costTable),
        tone: "info",
        detail:
          `배송비 ${won(sb.settlement + sb.costTable)}은 **두 사건의 합**이다 — ` +
          `정산 공제 ${won(sb.settlement)} · 원가표 ${won(sb.costTable)}. ` +
          `앞은 마켓이 떼 간 돈이고 뒤는 내가 택배사에 낸 돈이라 **이중 계상이 아니다.** ` +
          (sb.settlement === 0
            ? `지금 정산 파일은 배송비를 주지 않아 0이다 — 그래서 이 숫자는 전부 원가표에서 왔다. `
            : ``) +
          `원가표 쪽이 틀렸으면 그 파일의 「배송비」 열을, 정산 쪽이 틀렸으면 정산 파일을 본다`,
      })
    }

    if (cb.itemsWithoutCost > 0) {
      // 전부인지 일부인지가 다르다 — 일부면 순이익이 «어중간하게» 틀려 있어서
      // 오히려 알아채기 어렵다.
      const linked = cb.items - cb.itemsWithoutLink
      const all = cb.itemsWithoutCost === linked
      gaps.push({
        id: "cogs-missing",
        label: "매입원가",
        state: all ? "미입력" : "일부 미입력",
        note: `${cb.itemsWithoutCost.toLocaleString("ko-KR")}품목`,
        tone: all ? "info" : "warn",
        detail:
          `SKU에 이어진 판매 품목 ${linked.toLocaleString("ko-KR")}건 중 ` +
          `${cb.itemsWithoutCost.toLocaleString("ko-KR")}건의 원가를 모른다` +
          `(수량 ${cb.qtyWithoutCost.toLocaleString("ko-KR")}개). ` +
          `모르는 것을 0으로 세지 않으므로 그 품목은 매입원가에서 **빠져 있고**, 그만큼 ` +
          `기여이익이 부풀어 있다. 상품 화면에서 SKU별 원가를 넣으면 채워진다 — ` +
          `원가는 마켓이 주지 않는 값이라 파일이 아니라 사람이 넣는다` +
          (all ? "" : " · 절반만 넣은 원가가 «전부 넣은 것»처럼 보이는 자리라 일부러 갈라 적는다"),
      })
    }

    /**
     * ★ 조건 2 — 기간 집계의 원가는 근사다. **조용히 넘기지 않는다** ★
     *
     * 기간 안에서 원가가 바뀐 행이 있을 때만 뜬다. 근사가 실재하지 않으면
     * 아무 말도 하지 않으므로, 이 줄이 보인다는 것 자체가 «지금 그 일이 일어나고
     * 있다»는 뜻이다. `period-aggregated`(일별 분해 불가)와 다른 사실이라 따로 센다 —
     * 그쪽은 표현의 한계고 이쪽은 **금액의 근사**다.
     */
    if (cb.periodApproxItems > 0) {
      gaps.push({
        id: "cogs-period-approx",
        label: "기간 집계의 매입원가",
        state: "근사",
        note: `${cb.periodApproxItems.toLocaleString("ko-KR")}품목`,
        tone: "warn",
        detail:
          `기간으로 들어온 판매 ${cb.periodApproxItems.toLocaleString("ko-KR")}건의 원가가 ` +
          `**기간 시작일 단가로 계산됐다.** 그 기간 안에서 원가가 바뀌었으므로 후반 판매분은 ` +
          `옛 단가로 잡혀 있다 — 파일이 일별 분해를 주지 않아 더 정확히 계산할 방법이 없다 ` +
          `(ADR-009 ①-보완 2). 정확히 맞추려면 원가의 적용 시작일을 기간 경계에 맞추면 된다`,
      })
    }
  }
  /**
   * ★ 「0원」에는 두 가지 뜻이 있다 (2026-08-19) ★
   *
   * 여기 조건은 `pnl.fixed === 0` 하나뿐이었다. 그래서 **일부러** 고정비를 두지
   * 않는 사용자에게 — 원가에 이미 넣었거나, 임대료가 없는 1인 사업자거나 —
   * 영영 「미입력」이라고 말했다. 지워지지 않는 줄이 진단 화면에 하나 박히면
   * 사용자는 그 화면 전체를 안 보게 되고, **경고 하나가 죽으면 옆의 진짜 경고도
   * 같이 죽는다.**
   *
   * 그래서 「두지 않는다」를 선언으로 받고(마이그레이션 010) 셋으로 가른다.
   * 판정은 여기, 저장은 `overhead_stance`, 묻는 것은 화면이다.
   */
  const st = snap.overheadStance
  const declared = (d: typeof st.fixed): string =>
    d?.reason === "in-cogs"
      ? "원가에 이미 포함돼 있다고 하셨습니다"
      : d?.reason === "not-applicable"
        ? "해당 없다고 하셨습니다"
        : (d?.reason ?? "두지 않기로 하셨습니다")

  if (pnl.fixed === 0 && st.fixed?.stance === "none") {
    // ★ 이건 결손이 아니다 ★ 그래도 목록에서 빼지는 않는다 — 「고정비가 안 빠진
    // 순이익」이라는 사실 자체는 숫자를 읽는 데 필요하고, 선언을 되짚을 자리도
    // 여기밖에 없다. 「말하되 재촉하지 않는다」가 §22의 자세다.
    gaps.push({
      id: "overhead-missing",
      label: "고정비",
      state: "두지 않음",
      note: declared(st.fixed),
      tone: "info",
      detail:
        `고정비를 두지 않기로 선언돼 있어 **회사 순이익 = 채널 기여이익**입니다. ` +
        (st.fixed.reason === "in-cogs"
          ? "원가에 이미 들어 있다고 하셨으므로 여기 또 넣으면 두 번 빠집니다."
          : "비용 화면에서 언제든 바꿀 수 있습니다."),
    })
  } else if (pnl.fixed === 0 && st.fixed?.stance === "later") {
    // 나중에 넣겠다고 한 사람을 재촉하지 않는다. 사실만 남긴다.
    gaps.push({
      id: "overhead-missing",
      label: "고정비",
      state: "나중에",
      note: "아직 0원",
      tone: "info",
      detail:
        "고정비를 나중에 넣기로 하셨습니다. 넣기 전까지 회사 순이익은 채널 기여이익과 같습니다.",
    })
  } else if (pnl.fixed === 0) {
    // 미선언 — **이때만 묻는다.**
    gaps.push({
      id: "overhead-missing",
      label: "고정비",
      state: "미입력",
      note: "0원",
      tone: "info",
      detail:
        "임대료·인건비 같은 고정비가 0원이라 **회사 순이익이 채널 기여이익과 같습니다.** " +
        "두 줄이 같은 수인 것은 고정비가 없어서가 아니라 아직 안 넣어서입니다 — " +
        "비용 화면에서 넣거나, 「두지 않는다」를 선언하면 이 줄이 사라집니다.",
    })
  }

  // 운영비는 따로 센다. 고정비를 넣었다고 운영비의 부재가 메워지지 않는다.
  if (pnl.ops === 0 && st.ops === null) {
    gaps.push({
      id: "ops-missing",
      label: "운영비",
      state: "미입력",
      note: "0원",
      tone: "info",
      detail:
        "포장·부자재·물류 수수료 같은 운영비가 0원입니다. 원가에 이미 포함시켜 두셨다면 " +
        "비용 화면에서 「두지 않는다」를 선언하면 이 줄이 사라집니다.",
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
