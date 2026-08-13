/**
 * `src/core`는 **실행 환경에 중립인가** — ADR-011의 경계 테스트.
 *
 * ADR이 문서로만 있으면 6개월 뒤 누가 편하다고 `node:path`를 다시 들인다.
 * 그러면 앱은 **다시 모듈 로드 단계에서 죽고**, 테스트는 전부 녹색이라
 * 아무도 모른 채 배포된다 — 실제로 그 상태로 세션 1·2가 지나갔다.
 *
 * 환경에 묶이는 코드가 필요하면 **어댑터로 분리**한다. `driver-node.ts`와
 * `migrate-node.ts`가 그 자리이고, 그 둘만 예외다.
 */

import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

/** Node에 묶여도 되는 곳 — **어댑터뿐이다.** 늘리려면 ADR-011부터 고쳐야 한다. */
const NODE_ADAPTERS = new Set(["driver-node.ts", "migrate-node.ts"])

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (name.endsWith(".ts")) out.push(p)
  }
  return out
}

const FILES = walk("src/core")

describe("src/core — 실행 환경 중립 (ADR-011)", () => {
  it("훑을 파일이 실제로 있다 — 빈 통과를 막는다", () => {
    expect(FILES.length).toBeGreaterThan(20)
  })

  for (const file of FILES) {
    const base = file.replace(/\\/g, "/").split("/").pop() ?? file
    const isAdapter = NODE_ADAPTERS.has(base)

    it(`${base}${isAdapter ? " (어댑터 — 예외)" : ""}`, () => {
      const src = readFileSync(file, "utf8")
      // 주석 속 설명("node:crypto를 쓰지 않는다")까지 잡으면 시끄럽다.
      // 실제 import/require만 본다.
      const hits = [
        ...src.matchAll(/(?:from|import)\s*\(?\s*["']node:([a-z/]+)["']/g),
        ...src.matchAll(/require\s*\(\s*["']node:([a-z/]+)["']/g),
      ].map((m) => m[1])

      if (isAdapter) {
        // 어댑터는 Node에 묶여도 된다. 다만 **그게 이 파일의 존재 이유**여야 하므로
        // 아무것도 안 쓰면 오히려 이상하다.
        expect(hits.length, `${base}가 어댑터인데 node: 모듈을 쓰지 않는다`).toBeGreaterThan(0)
        return
      }

      expect(
        hits,
        `${base}가 node:${hits.join(", node:")}를 쓴다 — 앱(웹뷰)에서 이 모듈은 로드조차 되지 않는다. ` +
          `환경에 묶이는 코드는 어댑터로 분리한다 (ADR-011)`,
      ).toEqual([])
    })
  }
})

/**
 * `src/core`는 **마켓도 모른다** — LOCK 4의 경계 테스트.
 *
 * 스키마 쪽은 `schema.test.ts`가 이미 지키지만 그건 **DB 스키마 SQL만** 본다.
 * core의 소스는 아무도 보고 있지 않았다. `gaps.ts`가 core에 처음으로 **사용자에게
 * 보일 한국어 문구**를 들이면서 그 구멍이 위험해졌다 — 단서 문장은 "11번가 정산인데
 * 11번가 주문이 없다"라고 쓰고 싶어지는 자리다. 그렇게 쓰는 순간 마켓 지식이
 * core로 새고, `packs/`가 있어야 할 이유가 사라진다.
 */
describe("src/core — 마켓을 모른다 (LOCK 4)", () => {
  const BANNED = ["쿠팡", "네이버", "지마켓", "G마켓", "옥션", "11번가", "ESM", "coupang", "gmarket", "auction"]

  /**
   * **주석은 본다고 치지 않는다.** 위 `node:` 가드가 이미 배운 것과 같은 교훈이다 —
   * "11번가라고 쓰지 않는다"라고 설명하는 주석까지 잡으면 가드가 시끄러워지고,
   * 시끄러운 가드는 곧 꺼진다. 잡아야 할 것은 **코드와 문자열**이다: 분기 조건에
   * 박힌 마켓 이름, 사용자에게 나갈 문구 속 마켓 이름.
   */
  const stripComments = (src: string): string =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join("\n")

  for (const file of FILES) {
    const base = file.replace(/\\/g, "/").split("/").pop() ?? file
    it(base, () => {
      const code = stripComments(readFileSync(file, "utf8")).toLowerCase()
      for (const word of BANNED) {
        expect(
          code.includes(word.toLowerCase()),
          `${base}의 코드·문자열에 "${word}"가 있다 — 마켓 지식은 packs/kr-marketplace/ 안에만 산다 (LOCK 4)`,
        ).toBe(false)
      }
    })
  }
})

describe("어댑터 짝이 갖춰져 있다", () => {
  it("Node 어댑터마다 환경 중립 짝이 있다", () => {
    // driver-node.ts ↔ driver.ts · migrate-node.ts ↔ migrate.ts
    for (const adapter of NODE_ADAPTERS) {
      const neutral = adapter.replace("-node.ts", ".ts")
      const found = FILES.some((f) => f.endsWith(neutral))
      expect(found, `${adapter}의 짝인 ${neutral}이 없다`).toBe(true)
    }
  })

  it("웹 어댑터도 node:를 쓰지 않는다", () => {
    const web = FILES.filter((f) => /-(web|tauri)\.ts$/.test(f))
    expect(web.length, "웹 쪽 어댑터가 하나도 없다").toBeGreaterThan(0)
    for (const f of web) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/(?:from|import)\s*\(?\s*["']node:/)
    }
  })
})
