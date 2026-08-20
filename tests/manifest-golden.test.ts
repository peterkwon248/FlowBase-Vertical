/**
 * ★ 매니페스트 골든 대조 — 세션 1 합격 기준 ①의 집행자 ★
 *
 * 헌장은 *"픽스처 15개 전부 `expectedProfile`/`expectedSheets`/`expectedHeader`/
 * `expectedRowCount` 통과"*를 세션 1의 합격 조건으로 걸었고, `fixtures/manifest/
 * manifest.json`(15개)은 그때부터 커밋돼 있다. 그런데 **그 파일을 읽는 시험이
 * 하나도 없었다** (2026-08-20 감사 B-1).
 *
 * ★ 왜 그게 위험한가 ★
 * `npm run harness`는 가드 없이 매니페스트를 덮어쓴다. 파서가 회귀해도 하네스를
 * 한 번 돌리면 **정답지가 새 오답을 따라간다** — 정답지가 자기 자신을 따라가는
 * 순환이다. `docs/픽스처-대조표.md`가 «우리 파서로 만들지 않았다»고 못박은
 * 독립 실측이 있는데도, 그 대조가 코드에서는 아무 때도 일어나지 않았다.
 *
 * 이 시험이 그 고리를 끊는다. **덮어쓰기는 이제 시험을 붉게 만든다.**
 * 파서를 의도적으로 바꿨다면 매니페스트를 다시 뜨고 **그 diff를 검토해서** 커밋한다 —
 * 그게 이 시험이 강제하는 유일한 것이다: 정답지의 변경을 **눈에 띄게 만든다.**
 *
 * ★ 시간은 안 본다 ★ `elapsedMs`는 기기와 회차마다 다르다. 그것까지 대조하면
 * B-3(«코드 회귀가 아니라 실행 환경을 재고 있다»)을 여기서 반복하는 꼴이 된다.
 */

import { describe, expect, it } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { buildManifest, type FixtureManifest } from "../tools/harness/build-manifest.js"
import { FIXTURE_DIR, FIXTURES } from "./fixtures.js"

const here = dirname(fileURLToPath(import.meta.url))
const GOLDEN = join(here, "..", "fixtures", "manifest", "manifest.json")

/** 픽스처가 한 개라도 없으면 대조가 성립하지 않는다 — 조용히 통과시키지 않고 건너뛴다. */
const present = FIXTURES.every((f) => existsSync(join(FIXTURE_DIR, f.file)))

/** 시간만 뺀다. 나머지는 전부 대조 대상이다. */
const stable = (m: FixtureManifest): unknown => {
  const { elapsedMs: _drop, ...rest } = m
  return rest
}

describe.skipIf(!present)("매니페스트 골든 대조 (B-1 · 세션 1 합격 기준 ①)", () => {
  const golden = JSON.parse(readFileSync(GOLDEN, "utf8")) as FixtureManifest[]

  it("★ 지금 파서가 뽑는 값이 커밋된 정답지와 같다 ★", { timeout: 120_000 }, async () => {
    const now = await buildManifest()

    // 먼저 «몇 개인가»부터 — 파일이 빠지면 뒤의 대조가 통째로 헛돈다
    expect(now.map((m) => m.file)).toEqual(golden.map((m) => m.file))

    // 어느 픽스처의 무엇이 달라졌는지 이름으로 말한다. 전체 객체를 통으로 비교하면
    // 15개 × 27열짜리 diff가 쏟아져서 **무엇이 깨졌는지 못 읽는다**.
    const drift: string[] = []
    for (const [i, g] of golden.entries()) {
      const n = now[i]!
      const a = JSON.stringify(stable(g))
      const b = JSON.stringify(stable(n))
      if (a !== b) drift.push(`#${g.id} ${g.file}`)
    }
    expect(
      drift,
      "파서 출력이 커밋된 매니페스트와 다르다. 의도한 변경이면 `npm run harness`로 " +
        "다시 뜨고 **그 diff를 읽어서** 커밋해라 — 조용히 덮어쓰면 정답지가 오답을 따라간다",
    ).toEqual([])
  })

  /**
   * 정답지가 **비어 있는 채로 통과**하는 사고를 막는다. 골든 파일이 실수로
   * `[]`가 되면 위 시험은 그냥 통과한다 — 대조할 게 없으니까.
   */
  it("정답지가 15개를 갖고 있다 — 빈 정답지로 통과하지 않는다", () => {
    expect(golden).toHaveLength(FIXTURES.length)
    expect(golden.every((g) => g.expectedSheets.length > 0)).toBe(true)
  })
})
