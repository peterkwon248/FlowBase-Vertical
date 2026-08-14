/// <reference types="vite/client" />
/**
 * 마켓 사전 — 커버리지 문장의 **재료**만 담는다 (§22-2).
 *
 * ★ 왜 팩에 있는가 ★
 * core는 «주문 파일»이라고만 말할 수 있다 (LOCK 4). *"11번가 주문 파일을 넣으면
 * 매출이 열립니다"*를 만들려면 **마켓 통칭**과 **그 마켓이 각 문서를 뭐라 부르는지**가
 * 필요하고, 그건 팩의 지식이다. `MappingProfile.displayName`이 여기 사는 것과
 * 같은 원리다.
 *
 * 그리고 **마켓마다 다를 수 있다** — 어느 마켓의 주문 파일에 수수료가 이미 들어
 * 있다면 그 마켓의 `docTypes.order.gives`는 다르게 쓴다. 그래서 core의 상수가
 * 아니라 마켓별 파일이다.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 형식화 금지 ★ (§22-2)
 * 이것은 **설정 파일**이지 팩 매니페스트가 아니다. 스키마 검증 · 로더 추상 ·
 * 버전 계약 같은 일반화는 **§21-5 보류 그대로**다. 파일이 셋 생겼다고 프레임워크를
 * 짓지 않는다 — 필요해지면 그때 짓는다.
 * ─────────────────────────────────────────────────────────────
 */

import type { DocType } from "../../../core/coverage/index.js"
import type { DocTypeResolver } from "../../../core/coverage/load.js"
import { profileVersion } from "../../../core/import/mapping/index.js"
import { loadProfiles } from "../profiles/index.js"

export interface MarketDocType {
  /** 이 마켓이 그 문서를 부르는 이름 — «주문» · «정산» · «광고». */
  readonly label: string
  /** 그 문서가 여는 것들. 문장 ③«하면 된다»의 재료. */
  readonly gives: readonly string[]
}

export interface MarketDict {
  readonly marketplaceKey: string
  readonly displayName: string
  /** 배지 두 글자 — 목업 시드의 값 그대로 (`11` · `ES` · `CP`). */
  readonly abbr: string
  /** 배지 색 — 마켓의 브랜드 식별이라 팩이 안다. 지어내지 않고 목업에서 가져왔다. */
  readonly color: string
  readonly docTypes: Readonly<Record<string, MarketDocType>>
  /**
   * **이 마켓의 어떤 문서를 실제로 읽을 수 있나** — 프로파일이 있는 성격만.
   *
   * ★ 왜 필요한가 (2026-08-14 실기기에서 드러남) ★
   * 채널 화면이 쿠팡에 *"주문·정산 파일을 넣으면 열립니다"*라고 말했는데, 사용자가
   * 쿠팡 매출 파일을 넣자 *"맞는 매핑 프로파일이 없습니다 — 이 파일은 넣을 수
   * 없습니다"*가 떴다. **앱이 못 지킬 약속을 하고 있었다.**
   *
   * 오늘 9칸(마켓 3 × 성격 3) 중 읽을 수 있는 것은 **3칸뿐**이다. 그래서 «하면
   * 된다»는 문장은 프로파일이 있을 때만 할 수 있다.
   *
   * JSON에 적지 않고 **프로파일 레지스트리에서 파생시킨다** — 손으로 적으면
   * 프로파일을 더한 날 갱신을 잊고, 그 순간 다시 거짓말이 된다.
   */
  readonly readable: readonly DocType[]
}

const RAW = import.meta.glob("./*.json", { import: "default", eager: true }) as Record<string, unknown>

/** 마켓별로 읽을 수 있는 문서 성격 — **프로파일이 있는 것만.** */
export function readableDocTypes(): ReadonlyMap<string, readonly DocType[]> {
  const byMarket = new Map<string, DocType[]>()
  for (const p of loadProfiles()) {
    const dt = p.docType
    if (dt !== "order" && dt !== "settlement" && dt !== "ad") continue
    const list = byMarket.get(p.marketplaceKey) ?? []
    if (!list.includes(dt)) list.push(dt)
    byMarket.set(p.marketplaceKey, list)
  }
  return byMarket
}

/** 이 팩이 아는 마켓 전부. 파일을 더하면 자동으로 잡힌다 (프로파일 레지스트리와 같은 규율). */
export function marketDicts(): readonly MarketDict[] {
  const readable = readableDocTypes()
  return (Object.values(RAW) as Omit<MarketDict, "readable">[]).map((m) => ({
    ...m,
    readable: readable.get(m.marketplaceKey) ?? [],
  }))
}

/**
 * 연결의 `marketplace_key`로 사전을 찾는다.
 *
 * **없으면 `null`이다.** 기본 사전을 지어내면 모르는 마켓에 대해 화면이 아는 척하게
 * 된다 (ADR-010 «미지의 값을 기본 경로로 흘리지 않는다»와 같은 계열).
 */
export function marketDict(marketplaceKey: string): MarketDict | null {
  return marketDicts().find((m) => m.marketplaceKey === marketplaceKey) ?? null
}

/**
 * `batch.mapping_version` → 문서 성격.
 *
 * 문자열을 쪼개지 않고 **프로파일에게 되묻는다** — `profileVersion()`이 만든 문자열을
 * 같은 함수로 다시 만들어 맞춘다. 형식이 바뀌어도 양쪽이 함께 바뀌므로 어긋나지 않는다.
 */
export function krDocTypeResolver(): DocTypeResolver {
  const byVersion = new Map<string, string>()
  for (const p of loadProfiles()) byVersion.set(profileVersion(p), p.docType)

  return (mappingVersion: string): DocType | null => {
    const dt = byVersion.get(mappingVersion)
    if (dt === "order" || dt === "settlement" || dt === "ad") return dt
    // `cost`는 파일로 들어오지 않는다. 그 외 미지의 docType도 여기서 걸러진다.
    return null
  }
}
