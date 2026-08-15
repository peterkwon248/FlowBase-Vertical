/// <reference types="vite/client" />
/**
 * 팩이 가진 프로파일 **전부**를 번들에서 읽는다 — 가져오기 위저드의 판정 단계가 쓴다.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 이게 없으면 위저드가 성립하지 않는가 ★
 *
 * 오늘 프로파일을 쓰는 곳은 전부 **하나를 손으로 박아 넣는다**:
 *
 * ```
 * smoke.ts          coupang-ad-report@1.json 을 리터럴 경로로 import
 * pnl.ts · e2e      matchProfiles([profile], …)   ← 후보가 처음부터 한 개
 * ```
 *
 * 즉 "이 파일이 무엇인지" 묻는 코드가 아니라 **답을 미리 아는** 코드였다. 하네스는
 * 어떤 픽스처를 넣는지 알고 있으니 그래도 됐지만, 사용자가 파일을 고르는 순간
 * 그 전제가 사라진다. 판정이 성립하려면 **후보 목록**이 있어야 한다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 왜 `src/packs`이고 `src/core`가 아닌가 ★
 * 두 가지 이유가 겹친다.
 *   · LOCK 4 — core에는 마켓 어휘가 금지다 (`tests/core-env-neutral.test.ts`)
 *   · ADR-011 — `import.meta.glob`은 번들러 전용이라 core에 두면 실행환경 중립이 깨진다
 * `migrate-web.ts`가 `-web` 접미를 달고 core 밖의 사정을 떠맡은 것과 같은 꼴이다.
 *
 * ★ `eager: true`인 이유 ★ 목록을 손으로 관리하면 **하나를 빠뜨리는 날이 온다.**
 * 파일을 더하면 자동으로 잡힌다 (`migrate-web.ts`가 마이그레이션에 대해 하는 말과 같다).
 *
 * ⚠ 이 모듈은 **번들러(Vite/vitest) 안에서만** 동작한다. `tsx`로 도는 하네스는
 * `import.meta.glob`을 모르므로 여기 기대지 않는다 — 하네스는 지금처럼 자기가 쓸
 * 프로파일을 명시한다. 그쪽은 "무엇이 들어올지 아는" 코드라 그것이 맞다.
 */

import type { MappingProfile } from "../../../core/import/mapping/index.js"
import { formatDefects, validateProfiles } from "../../../core/import/mapping/validate.js"

const RAW = import.meta.glob("./*.json", {
  import: "default",
  eager: true,
}) as Record<string, unknown>

/**
 * 이 팩의 프로파일 전부. 순서는 파일명순이고, **우선순위가 아니다** —
 * 어느 것이 맞는지는 `matchProfiles`가 confidence로 정한다.
 *
 * ★ 문에서 검증한다 (2026-08-15) ★
 * 프로파일 결함은 **사용자의 잘못이 아니다.** 가져오기 도중에 터뜨리면 사용자가
 * 남의 잘못을 «내 파일이 문제인가»로 만난다. 그래서 프로파일이 들어오는 이 문에서
 * 막는다 — 여기서 던지면 앱이 아예 안 뜨고, 그건 «양식 하나가 조용히 틀린 채
 * 도는 것»보다 낫다 (LOCK 6).
 *
 * 내장 프로파일은 `tests/profile-registry.test.ts`가 디스크에서 전수로 돌므로
 * 이 던지기는 **실전에서 도달하지 않는다** — 미래의 프로파일(양식 구독·사용자
 * 확정분)이 들어올 자리를 지키는 가드다.
 */
export function loadProfiles(): readonly MappingProfile[] {
  const list = Object.values(RAW) as MappingProfile[]
  if (list.length === 0) {
    throw new Error("번들에 프로파일이 하나도 없다 — glob 경로를 확인해야 한다")
  }
  const defects = validateProfiles(list)
  if (defects.size > 0) {
    throw new Error(`프로파일 선언이 자기모순이다 — 고쳐야 한다\n${formatDefects(defects)}`)
  }
  return list
}
