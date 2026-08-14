/**
 * 상품 화면이 읽는 **단 하나의 조회** — 조회 단일화 여섯 번째.
 *
 * ★ 이 화면이 하는 일은 ③이다 ★
 * ```
 * ① 프로파일 확장 → 리스팅 적재     ✅
 * ② 리스팅 → SKU (연결 화면)        ✅
 * ③ 원가 입력 UI (상품 화면)        ← 여기
 * ④ 원가 → 손익 (costAt)            → core/profit/snapshot.ts
 * ```
 *
 * ★ 원가 이력을 메모리로 읽는다 — LOCK 5 위반이 아니다 ★
 * LOCK 5가 막는 것은 **Fact의 전량 적재**다(80,138행이 정기 입력이라는 것이 그
 * 조항의 근거다). 원가는 기준 데이터이고 크기가 «SKU 수 × 종류 × 정정 횟수»라
 * 오늘 61 SKU에서 수십 행이다. 그리고 메모리로 읽는 데는 값이 있다 — 판정을
 * `costAt` **한 곳**에서만 하게 된다. SQL로 하려면 「가장 늦은 것」 규칙을 서브쿼리에
 * 한 번 더 적어야 하고, 그 순간 규칙이 두 벌이 된다.
 *
 * 손익 쪽은 반대다 — 주문 품목 8만 행에 원가를 붙여야 하므로 거기서는 SQL이 맞고,
 * 그래서 `costAtSql`이 따로 있다. 두 답이 갈리지 않는 것은 `tests/cost.test.ts`가
 * 직접 대조하기 때문이다.
 */

import type { Driver } from "../store/driver.js"
import { Repository } from "../store/repository.js"
import { costAt, COST_KINDS, type CostEntry, type CostKind } from "../cost/index.js"

export interface ProductSkuRow {
  readonly skuId: string
  /** `SKU-0001`. 사람이 읽는 코드지 내부 키가 아니다 (헌장 C-4). */
  readonly code: string
  readonly name: string
  readonly productName: string
  readonly status: string
  /**
   * 기준일에 유효한 매입원가. **`null`은 «미상»이고 0이 아니다** (`costAt`).
   * 화면은 이 자리에 0을 그리지 않는다 — 그리면 «공짜로 떼 온 상품»이 된다.
   */
  readonly cost: number | null
  /** 그 값이 적용되기 시작한 날. 원가가 언제부터인지 보이지 않으면 이력이 무의미하다. */
  readonly costFrom: string | null
  /** 이 SKU에 쌓인 원가 이력 줄 수 (종류 불문). 2 이상이면 «이력 있음»이다. */
  readonly costEntries: number
  /** 연결된 마켓 이름 — 목업의 칩. 중복은 걷었다. */
  readonly channels: readonly string[]
  readonly listingCount: number
  /**
   * 기간 판매 수량. **`null`은 «미상»이다** — `fact_order_item`이 비어 있으면
   * «0개 팔았다»가 아니라 «품목 단위 데이터가 아직 없다»이다 (아래 `hasOrderItems`).
   */
  readonly soldQty: number | null
}

export interface ProductView {
  readonly rows: readonly ProductSkuRow[]
  /** 원가가 붙은 SKU 수 — 게이지의 분자. */
  readonly costed: number
  /** 전체 SKU 수 — 게이지의 분모. **SKU 단위**다 (§22 «전부여야 열린다»와 같은 분모). */
  readonly total: number
  /**
   * 주문이 **품목 단위로** 들어와 있는가.
   *
   * **이 기간의** 주문에 품목이 붙어 있는가. 주문이 아예 없으면 참이다 —
   * 팔 것이 없었던 것이지 데이터가 미상인 게 아니다.
   */
  readonly hasOrderItems: boolean
  /**
   * 이 기간 주문 중 품목이 안 붙은 건수. 게이지 아래 줄이 이 값으로 말한다.
   * 손익의 `cogsBasis.ordersWithoutItems`와 **같은 창**을 본다.
   */
  readonly ordersWithoutItems: number
}

/** 기간. 판매 수량에만 쓴다 — 원가·연결은 «기준»이라 기간으로 자르지 않는다. */
export interface ProductPeriod {
  readonly from: string
  readonly to: string
}

export async function loadProductRows(
  db: Driver,
  libraryId: string,
  period: ProductPeriod,
  /** 원가를 «언제 기준»으로 볼 것인가. 화면은 오늘을 준다. */
  on: string,
): Promise<ProductView> {
  const skus = await db
    .prepare(
      `SELECT s.id, s.code, s.name, s.status, p.name AS product_name
         FROM sku s JOIN product p ON p.id = s.product_id
        WHERE s.library_id = ?
        ORDER BY s.code`,
    )
    .all(libraryId)

  const history = groupHistory(await new Repository(db).costHistory(libraryId))

  const chan = await db
    .prepare(
      `SELECT ml.sku_id AS sku, c.display_name AS name, COUNT(*) AS n
         FROM marketplace_listing ml
         JOIN connection c ON c.id = ml.connection_id
        WHERE ml.library_id = ? AND ml.sku_id IS NOT NULL AND ml.link_state = 'linked'
        GROUP BY ml.sku_id, c.display_name
        ORDER BY c.display_name`,
    )
    .all(libraryId)

  const channels = new Map<string, string[]>()
  const listingCount = new Map<string, number>()
  for (const r of chan) {
    const sku = String(r["sku"] ?? "")
    const list = channels.get(sku) ?? []
    list.push(String(r["name"] ?? ""))
    channels.set(sku, list)
    listingCount.set(sku, (listingCount.get(sku) ?? 0) + Number(r["n"] ?? 0))
  }

  /**
   * 품목 단위 판매. 기간 판정은 **주문 쪽 `ordered_at`**이 한다 — 품목에는 날짜가
   * 없고, 손익이 주문일로 인식하므로(ADR-009 ①) 여기도 같아야 한다.
   *
   * SKU는 `fact_order_item.sku_id`가 아니라 **리스팅을 거쳐** 얻는다. 적재 시점에
   * 박아 넣으면 나중에 연결한 리스팅의 과거 판매가 영원히 안 붙는다 —
   * `snapshot.ts`의 `ITEM_JOIN`과 같은 이유이고, 두 조회가 같은 규칙을 써야
   * 화면의 판매 수량과 손익의 매입원가가 같은 모집단을 본다.
   *
   * 날짜 상한에 `BETWEEN`을 쓰지 않는다 — `ordered_at`이 시각을 달고 있으면 마지막
   * 날이 통째로 빠진다 (`tests/range-boundary.test.ts`가 잡은 97,600원).
   */
  const sold = await db
    .prepare(
      `SELECT ml.sku_id AS sku, COALESCE(SUM(oi.quantity),0) AS q
         FROM active_order_item oi
         JOIN active_order o ON o.id = oi.order_id
         JOIN marketplace_listing ml ON ml.id = oi.listing_id AND ml.link_state = 'linked'
        WHERE oi.library_id = ? AND ml.sku_id IS NOT NULL
          AND o.ordered_at >= ? AND o.ordered_at < date(?, '+1 day')
        GROUP BY ml.sku_id`,
    )
    .all(libraryId, period.from, period.to)
  const soldBy = new Map(sold.map((r) => [String(r["sku"] ?? ""), Number(r["q"] ?? 0)]))

  /**
   * ★ «품목이 하나도 없다»와 «이 SKU가 안 팔렸다»는 다르다 ★
   * 앞은 미상(화면이 «—»), 뒤는 0이다.
   *
   * ★ 라이브러리 전역 EXISTS였다가 **기간 안 주문 기준**으로 바뀌었다 ★
   * 전역으로 물으면 품목 있는 파일 하나가 들어오는 순간 «이 기간 주문에는 품목이
   * 없다»가 참인데도 `true`가 되고, 화면은 팔린 적 없다는 듯 `0`을 그린다.
   * 손익 쪽(`cogsBasis.ordersWithoutItems`)과 **같은 창으로** 본다.
   */
  const cover = await db
    .prepare(
      `SELECT COUNT(*) AS orders,
              SUM(CASE WHEN EXISTS(SELECT 1 FROM active_order_item i WHERE i.order_id = o.id)
                       THEN 1 ELSE 0 END) AS with_items
         FROM active_order o
        WHERE o.library_id = ? AND o.ordered_at >= ? AND o.ordered_at < date(?, '+1 day')`,
    )
    .get(libraryId, period.from, period.to)
  const ordersInPeriod = Number(cover?.["orders"] ?? 0)
  const ordersWithItems = Number(cover?.["with_items"] ?? 0)
  // 주문이 아예 없으면 «수량 미상»이 아니다 — 팔 것이 없었을 뿐이라 0이 사실이다.
  const hasOrderItems = ordersInPeriod === 0 || ordersWithItems > 0

  const rows = skus.map((s): ProductSkuRow => {
    const id = String(s["id"] ?? "")
    const entries = history.get(id) ?? []
    const cost = costAt(entries, "COGS", on)
    return {
      skuId: id,
      code: String(s["code"] ?? ""),
      name: String(s["name"] ?? ""),
      productName: String(s["product_name"] ?? ""),
      status: String(s["status"] ?? ""),
      cost,
      costFrom: cost === null ? null : effectiveFromOf(entries, "COGS", on),
      costEntries: entries.length,
      channels: channels.get(id) ?? [],
      listingCount: listingCount.get(id) ?? 0,
      soldQty: hasOrderItems ? (soldBy.get(id) ?? 0) : null,
    }
  })

  return {
    rows,
    costed: rows.filter((r) => r.cost !== null).length,
    total: rows.length,
    hasOrderItems,
    ordersWithoutItems: ordersInPeriod - ordersWithItems,
  }
}

/**
 * 그 값이 **언제부터**인지. `costAt`이 고른 것과 같은 줄을 골라야 하므로 규칙을
 * 다시 적지 않고 `costAt`이 낸 금액으로 되짚는다 — 같은 `effective_from`이 둘일 수
 * 없으므로(001의 UNIQUE) 되짚기가 유일하다.
 */
function effectiveFromOf(
  entries: readonly CostEntry[],
  kind: CostKind,
  on: string,
): string | null {
  let best: CostEntry | null = null
  for (const e of entries) {
    if (e.kind !== kind || e.effectiveFrom > on) continue
    if (best === null || e.effectiveFrom > best.effectiveFrom) best = e
  }
  return best?.effectiveFrom ?? null
}

/** 리포지토리의 원시 행 → `CostEntry`. SKU별로 묶는다. */
function groupHistory(raw: readonly Record<string, unknown>[]): Map<string, CostEntry[]> {
  const out = new Map<string, CostEntry[]>()
  for (const r of raw) {
    const kind = String(r["kind"] ?? "")
    // 스키마의 CHECK가 이미 막지만, 사전에 없는 값이 오면 조용히 넘기지 않고
    // **빼고 만다** — 모르는 종류를 COGS인 척 계산에 태우는 것이 더 나쁘다.
    if (!(COST_KINDS as readonly string[]).includes(kind)) continue
    const sku = String(r["sku_id"] ?? "")
    const list = out.get(sku) ?? []
    list.push({
      kind: kind as CostKind,
      amount: Number(r["amount"] ?? 0),
      effectiveFrom: String(r["effective_from"] ?? ""),
      note: r["note"] == null ? null : String(r["note"]),
      enteredAt: String(r["entered_at"] ?? ""),
      enteredBy: String(r["entered_by"] ?? "user") === "import" ? "import" : "user",
    })
    out.set(sku, list)
  }
  return out
}
