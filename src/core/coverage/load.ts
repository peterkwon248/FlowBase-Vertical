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
import { coverage, type Coverage, type DocType } from "./index.js"

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

  // 보유 판정은 **커밋된 batch**로 한다. 되돌린 batch는 데이터가 사라졌으므로
  // 보유가 아니고, 열려 있는(open) batch는 아직 적재 중이라 세면 안 된다.
  const batches = await db
    .prepare(
      `SELECT DISTINCT connection_id AS cid, mapping_version AS mv
         FROM batch WHERE library_id = ? AND status = 'committed'`,
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

  // ★ 원가는 «하나라도»가 아니라 «전부»여야 열린다 ★
  // 절반만 입력된 원가로 기여이익을 그리면 **원가가 과소계상되어 이익이 부풀려진다.**
  // 부재를 0으로 바꾸지 않는다는 규율(§22)이 여기서는 "덜 입력된 것은 아직 안 열린
  // 것"이라는 뜻이 된다.
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
    if (cost !== undefined && cost.skus > 0 && cost.n === cost.skus) set.add("cost")

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
      coverage: coverage([...set], { settlementGross: gross.get(id) ?? 0 }),
    }
  })
}

/** 화면이 «전부 열렸다»를 말할 수 있는지. 연결이 하나도 없으면 판정 자체가 없다. */
export const anyLocked = (list: readonly ConnectionCoverage[]): boolean =>
  list.some((c) => c.coverage.hasLocked)

export type { Coverage }
