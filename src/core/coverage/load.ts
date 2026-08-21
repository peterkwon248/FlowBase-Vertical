/**
 * 커버리지 조회 — **연결별로** 무엇이 들어와 있고 무엇이 잠겼는가 (§22-1).
 *
 * ★ 왜 스냅샷을 쓰지 않고 따로 조회하는가 ★
 * `PnlSnapshot`은 **라이브러리 전체**의 합이다. 오늘 `settlement.all.gross`가
 * 11번가 값과 같은 것은 정산 파일이 하나뿐이라서지 구조 때문이 아니다 — 정산
 * 파일이 둘이 되는 날 그 숫자는 두 채널의 합이 되고, 채널 카드에 남의 금액이 뜬다.
 * 커버리지는 채널 단위 판정이므로 **처음부터 연결별로** 센다.
 *
 * ★ 마켓을 모른다 ★ (LOCK 4)
 * `mapping_version`("…/settlement/…@1")에서 성격을 읽어내려면 팩의 명명 규칙을
 * 알아야 한다. 그래서 그 해석은 **호출자가 주입**한다(`resolveDocType`).
 * core는 넘겨받은 `DocType`만 다룬다.
 */

import type { Driver } from "../store/driver.js"
import { coverage, DOC_TYPES, type Coverage, type DocType } from "./index.js"

/** `batch.mapping_version` → 문서 성격. 팩 사전을 아는 쪽이 준다. */
export type DocTypeResolver = (mappingVersion: string) => DocType | null

export interface ConnectionCoverage {
  readonly connectionId: string
  /** 사람이 읽는 채널 이름. 내부 키를 화면에 내보내지 않는다 (헌장 C-4). */
  readonly channel: string
  /**
   * 팩 사전을 찾는 키. **화면에 내보내지 않는다** — 문구 재료를 고르는 데만 쓴다.
   * `connection_id`를 숨기기로 한 것과 같은 계열이고, 다른 점은 이것이 core가 아니라
   * 팩에서만 뜻을 갖는다는 것뿐이다.
   */
  readonly marketplaceKey: string
  /** 연결 상태 — 스키마의 7종 중 하나. 새 상태를 발명하지 않는다 (헌장 C-7). */
  readonly state: string
  /** 성격별로 얼마나 들어와 있는가 — 3절 문장 ①«있다»가 쓴다. */
  readonly counts: Readonly<Record<DocType, number>>
  /**
   * 이 연결에 붙은 SKU 수. `counts.cost`와 함께 **원가가 «일부»인지**를 가른다 —
   * 둘이 같으면 열렸고, 0 < counts.cost < skuCount면 반쯤 채워진 것이다.
   */
  readonly skuCount: number
  /** 마지막으로 커밋된 batch 시각. 한 번도 없으면 `null`. */
  readonly lastImportAt: string | null
  /**
   * 이 연결의 정산 판매금액합계 — `coverage`가 «잠긴 매출»의 크기를 재는 재료다.
   *
   * `coverage.entries[…].lockedValue`에서 되읽지 않고 따로 낸다. 되읽으면 «지금
   * lockedValue를 내는 것이 매출 하나뿐»이라는 **오늘의 우연**에 기대게 되고,
   * 두 번째가 생기는 날 범위 합계가 조용히 두 값을 더한다.
   */
  readonly settlementGross: number
  readonly coverage: Coverage
}

const num = (r: Record<string, unknown>, k: string): number => Number(r[k] ?? 0)

export async function loadCoverage(
  db: Driver,
  libraryId: string,
  resolveDocType: DocTypeResolver,
): Promise<readonly ConnectionCoverage[]> {
  const conns = await db
    .prepare(
      `SELECT id, display_name AS name, marketplace_key AS mk, state
         FROM connection WHERE library_id = ? ORDER BY display_name`,
    )
    .all(libraryId)

  const lastRows = await db
    .prepare(
      `SELECT connection_id AS cid, MAX(committed_at) AS at
         FROM batch WHERE library_id = ? AND status = 'committed' GROUP BY connection_id`,
    )
    .all(libraryId)
  const lastAt = new Map(
    lastRows.map((r) => [String(r["cid"] ?? ""), r["at"] == null ? null : String(r["at"])]),
  )

  /**
   * 보유 판정은 **`active_batch`**로 한다 (017).
   *
   * 되돌린 batch는 데이터가 사라졌으므로 보유가 아니고, 열려 있는(open) batch는
   * 아직 적재 중이라 세면 안 된다 — 그 조건은 뷰 안에 있다.
   *
   * ★ 2026-08-21까지 여기가 `FROM batch`였고, 그래서 **한 함수가 두 기준을 썼다** ★
   * 아래 `counts`는 `active_*` 뷰라 묶음을 지키는데 `held`만 안 지켰다. 「7월 결산」을
   * 골라도 8월 광고 파일이 「광고비 열림」을 유지시켰고, 열린 지표가 0을 그렸다 —
   * §22가 금지한 «부재를 0으로 바꾸기»가 반대 방향에서 일어난 자리다 (ADR-023 확인 ①).
   */
  const batches = await db
    .prepare(
      `SELECT DISTINCT connection_id AS cid, mapping_version AS mv
         FROM active_batch WHERE library_id = ?`,
    )
    .all(libraryId)

  const held = new Map<string, Set<DocType>>()
  for (const b of batches) {
    const dt = resolveDocType(String(b["mv"] ?? ""))
    if (dt === null) continue // 모르는 프로파일은 조용히 넘긴다 — 판정 대상이 아니다
    const cid = String(b["cid"] ?? "")
    const set = held.get(cid) ?? new Set<DocType>()
    set.add(dt)
    held.set(cid, set)
  }

  const countOf = async (view: string): Promise<Map<string, number>> => {
    const rows = await db
      .prepare(`SELECT connection_id AS cid, COUNT(*) AS n FROM ${view} WHERE library_id = ? GROUP BY connection_id`)
      .all(libraryId)
    return new Map(rows.map((r) => [String(r["cid"] ?? ""), num(r, "n")]))
  }

  const orderCount = await countOf("active_order")
  const settleCount = await countOf("active_settlement")
  const adCount = await countOf("active_ad_spend")

  const grossRows = await db
    .prepare(
      `SELECT connection_id AS cid, COALESCE(SUM(gross_amount),0) AS g
         FROM active_settlement WHERE library_id = ? GROUP BY connection_id`,
    )
    .all(libraryId)
  const gross = new Map(grossRows.map((r) => [String(r["cid"] ?? ""), num(r, "g")]))

  /**
   * ★ 원가는 **«하나라도» 있으면 열린다** — 부족분은 말한다 ★
   *
   * 2026-08-21까지 여기는 `costed === skus`, 즉 **100%짜리 비율 절단점**이었다.
   * [ADR-023](docs/ADR-023-통-묶음-자격-입구순서.md) 확인 ②가 그것을 뒤집었다
   * (§22-3 ①에도 적었다 — 번복은 양쪽에 적는다):
   *
   *     옛   236/261 → 「매입원가 잠김」 · 「상품 기여이익 잠김」
   *     새   236/261 → **열린다.** 그리고 「원가 미입력 25건 — 이익이 실제보다 큽니다」
   *
   * 옛 근거(「덜 넣은 원가로 그리면 이익이 부풀려진다」)는 **여전히 참이고**, 처방만
   * 바뀌었다: 안 보여주는 대신 보여주고 그 자리에서 말한다. 손익 층(`pnlGaps`의
   * `cogs-missing`)은 **이미 그렇게 하고 있었다** — 이 줄만 뒤처져 있어서 같은 사실에
   * 두 화면이 다른 답을 냈다 (ADR-023 따름 조건 5가 금지한 모양).
   *
   * 잠기는 것은 이제 **«아예 없을 때»뿐**이다 — `costed === 0`. 그건 부족이 아니라
   * 부재이고, §22-1이 처음부터 그렇게 적었다.
   */
  const costRows = await db
    .prepare(
      `SELECT ml.connection_id AS cid,
              COUNT(DISTINCT ml.sku_id) AS skus,
              COUNT(DISTINCT CASE WHEN EXISTS(
                     SELECT 1 FROM cost_history ch
                      WHERE ch.library_id = ml.library_id AND ch.sku_id = ml.sku_id
                   ) THEN ml.sku_id END) AS costed
         FROM marketplace_listing ml
        WHERE ml.library_id = ? AND ml.sku_id IS NOT NULL
        GROUP BY ml.connection_id`,
    )
    .all(libraryId)
  const costed = new Map(costRows.map((r) => [String(r["cid"] ?? ""), { skus: num(r, "skus"), n: num(r, "costed") }]))

  return conns.map((c): ConnectionCoverage => {
    const id = String(c["id"] ?? "")
    const set = held.get(id) ?? new Set<DocType>()
    const cost = costed.get(id)
    if (cost !== undefined && cost.n > 0) set.add("cost")

    const counts: Record<DocType, number> = {
      order: orderCount.get(id) ?? 0,
      settlement: settleCount.get(id) ?? 0,
      ad: adCount.get(id) ?? 0,
      cost: cost?.n ?? 0,
    }

    return {
      connectionId: id,
      channel: String(c["name"] ?? ""),
      marketplaceKey: String(c["mk"] ?? ""),
      state: String(c["state"] ?? ""),
      counts,
      skuCount: cost?.skus ?? 0,
      lastImportAt: lastAt.get(id) ?? null,
      settlementGross: gross.get(id) ?? 0,
      coverage: coverage([...set], {
        settlementGross: gross.get(id) ?? 0,
        // 분모를 아는 성격은 `cost` 하나다. 나머지는 «파일이 몇 개여야 하나»를
        // 앱이 모르므로 여기 넣지 않는다 — 넣으면 모르는 것을 아는 척한다.
        partial: cost === undefined ? {} : { cost: { have: cost.n, need: cost.skus } },
      }),
    }
  })
}

/** 화면이 «전부 열렸다»를 말할 수 있는지. 연결이 하나도 없으면 판정 자체가 없다. */
export const anyLocked = (list: readonly ConnectionCoverage[]): boolean =>
  list.some((c) => c.coverage.hasLocked)

/**
 * ★★ 묶음 단위 판정 — 시각화의 «자격»은 여기서 난다 (ADR-023 결정 2 · 확인 ①) ★★
 *
 * 연결별 판정(§22-1)은 **채널 화면의 것**이다. 채널 카드는 「이 채널에 무엇이
 * 들어와 있나」를 말하므로 그 단위가 맞다. 그런데 사용자가 말한 것은 다른 질문이다:
 *
 *   *"데이터 묶음을 만들기 전까지는 시각화가 되어선 안 됨."*
 *
 * 대시보드는 채널 하나가 아니라 **지금 고른 범위 전체**를 그린다. 그 범위가
 * 「7월 결산」이면 11번가의 정산과 ESM의 주문이 **합쳐져** 기여이익을 만든다 —
 * 어느 연결도 혼자서는 그 지표를 열지 못하는데 범위로는 열린다. 그래서 판정이
 * 연결에 머물면 대시보드가 자기 자격을 물을 자리가 없다.
 *
 * ★ 새 판정 기계를 만들지 않는다 ★ 따름 조건 5 — 「묶음 자격 판정은 §22의
 * `metric → requires` 한 곳에서만」. 그래서 여기서는 **연결별 결과를 합쳐 같은
 * `coverage()`를 다시 부른다.** 두 단위가 다른 답을 낼 길이 구조적으로 없다.
 */
export interface ScopeCoverage {
  /**
   * 지금 활성인 묶음의 이름. **`null`이면 「전체」**다 — 013이 「전체는 행이 아니다」로
   * 정한 그대로이고, 화면은 이 null을 「전체」로 읽는다.
   */
  readonly collectionName: string | null
  /** 범위 안에 든 성격별 건수 — 연결별 `counts`의 합. */
  readonly counts: Readonly<Record<DocType, number>>
  /** 범위 안 SKU 수(원가의 분모). 연결에 붙은 SKU가 겹치면 겹친 만큼 겹쳐 센다. */
  readonly skuCount: number
  readonly coverage: Coverage
}

/**
 * 연결별 판정을 범위 하나로 접는다. **조회하지 않는다** — 넘겨받은 것만 본다
 * (core의 `coverage()`와 같은 규율).
 *
 * ★ 보유는 **합집합**이다 ★ 「11번가 정산 + ESM 주문」이 든 묶음은 `order`도
 * `settlement`도 가진 것이다. 교집합으로 접으면 «모든 채널이 모든 서류를 내야
 * 한다»가 되고, 그건 §22가 처음 문장에서 버린 **숙제 검사**다.
 */
export function scopeCoverage(
  list: readonly ConnectionCoverage[],
  collectionName: string | null,
): ScopeCoverage {
  const held = new Set<DocType>()
  const counts: Record<DocType, number> = { order: 0, settlement: 0, ad: 0, cost: 0 }
  let skus = 0
  let gross = 0

  for (const c of list) {
    for (const d of c.coverage.held) held.add(d)
    for (const d of DOC_TYPES) counts[d] += c.counts[d]
    skus += c.skuCount
    // 잠긴 매출의 크기도 범위 전체로 더한다 — 연결 하나의 금액을 범위 문장에 쓰면
    // 정산 파일이 둘이 되는 날 남의 금액이 뜬다 (이 파일 머리의 경고와 같은 자리).
    gross += c.settlementGross
  }

  return {
    collectionName,
    counts,
    skuCount: skus,
    coverage: coverage([...held], {
      settlementGross: gross,
      partial: { cost: { have: counts.cost, need: skus } },
    }),
  }
}

/**
 * 지금 활성인 묶음의 이름. 없으면 `null` = 「전체」.
 *
 * `Repository.activeCollection`은 id만 낸다. 화면이 필요한 것은 **사람의 말**이고
 * (U-5 — 저장 분류는 화면의 언어가 아니다), id를 화면까지 들고 가면 그 규율이 깨진다.
 */
export async function activeCollectionName(db: Driver, libraryId: string): Promise<string | null> {
  const r = await db
    .prepare(
      `SELECT c.name AS name FROM collection_active ca
         JOIN collection c ON c.id = ca.collection_id
        WHERE ca.library_id = ?`,
    )
    .get(libraryId)
  return r === undefined ? null : String(r["name"] ?? "")
}

export type { Coverage }
