/**
 * 실패가 나면 앱이 **아무 말도 안 하던 자리 셋** (2026-08-20 · 조사 3.9 · LOCK 6).
 *
 * ─────────────────────────────────────────────────────────────
 * ① **렌더 예외 → 빈 흰 창**
 *    `ErrorBoundary`·`componentDidCatch`·`window.onerror`·`unhandledrejection`이
 *    저장소 전체에 **0건**이었다. React 19는 경계가 없으면 트리를 통째로
 *    언마운트하고, **릴리즈 웹뷰에는 콘솔이 없다** — 사용자가 보는 것은
 *    아무 글자도 없는 흰 창뿐이다.
 *
 * ② **마이그레이션이 한 번 실패하면 재시작 말고는 길이 없었다**
 *    `migrated ??= migrate(db).then(…)` — `??=`는 **거절된 프라미스도
 *    non-nullish**로 보므로 실패가 세션 내내 캐시됐다. DB 잠김·디스크 부족처럼
 *    **곧 풀리는** 실패에도 앱을 다시 켜야 했다.
 *
 * ③ **미래에서 온 DB를 말없이 열었다**
 *    `done.has(m.version)`만 보고 「내가 아는 최대 번호보다 큰 적용본」은 아무도
 *    안 봤다. 기기를 오가며 쓰는 앱이라 실제로 일어난다 — 노트북에서 015를 만들고
 *    데스크톱의 옛 빌드로 같은 DB를 여는 순간이다. 조용히 열면 **새 스키마가 담은
 *    값이 사라진다.**
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { applyMigrations, type MigratableDb, type Migration } from "../src/core/store/migrate.js"

/**
 * ★ 주석을 벗긴다 ★ 이 저장소가 이미 아는 자해다 — `user-invariants.test.ts:28`에
 * 「내가 단 주석이 내 게이트를 통과시켰다」가 적혀 있다. 여기서는 반대 방향으로
 * 걸렸다: **주석 안의 「Template」이 「Template에 기대지 않는다」 가드를 붉혔다.**
 * 소스를 문자로 보는 게이트는 반드시 주석을 먼저 벗긴다.
 */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")

const MAIN = readFileSync("src/app/main.tsx", "utf8")
const CRASH_RAW = readFileSync("src/app/crash.tsx", "utf8")
const CRASH = stripComments(CRASH_RAW)
const DATA = readFileSync("src/app/data.ts", "utf8")

describe("① 렌더 예외에 빈 흰 창을 남기지 않는다", () => {
  it("★ 앱 전체가 경계 안에 있다 ★", () => {
    expect(MAIN, "경계가 없다 — 렌더 예외 하나에 흰 창만 남는다").toMatch(/<Crash>/)
    expect(MAIN, "경계가 App을 감싸지 않는다").toMatch(/<Crash>[\s\S]*<App \/>[\s\S]*<\/Crash>/)
  })

  it("경계가 실제 React 경계다 — getDerivedStateFromError를 쓴다", () => {
    expect(CRASH).toMatch(/static getDerivedStateFromError/)
    expect(CRASH).toMatch(/componentDidCatch/)
  })

  /**
   * ★ 오류 화면을 React로 그리지 않는다 ★
   * 방금 React가 죽은 자리다. 거기서 `vals`·`Template`에 기대면 그 렌더가 또 죽고,
   * 그러면 다시 흰 창이다. 오류 화면은 앱의 어떤 코드에도 기대지 않는다.
   */
  it("★ 오류 화면이 앱 코드(Template·vals)에 기대지 않는다 ★", () => {
    expect(CRASH, "죽은 자리에서 앱 컴포넌트를 다시 그린다").not.toMatch(
      /from "\.\/generated\/|Template|emptyVals/,
    )
    expect(CRASH, "DOM으로 그리지 않는다").toMatch(/document\.createElement/)
  })

  /**
   * 사용자가 가장 먼저 걱정하는 것은 **데이터**다. 그 한 줄이 없으면
   * 「내 데이터도 날아갔나」부터 묻게 된다.
   */
  it("★ 데이터가 안전하다고 말한다 ★", () => {
    expect(CRASH).toMatch(/데이터는 그대로 있습니다/)
  })

  it("다음 동작을 준다 — 다시 열기", () => {
    expect(CRASH).toMatch(/다시 열기/)
    expect(CRASH).toMatch(/location\.reload\(\)/)
  })

  /**
   * 경계는 **렌더 단계만** 본다. 이 앱의 쓰기는 전부 비동기라 거기서 터진 것은
   * 경계에 안 걸린다 — 그래서 창(window) 쪽도 듣는다.
   */
  it("★ 렌더 밖의 사고(unhandledrejection)도 듣는다 ★", () => {
    expect(CRASH).toMatch(/addEventListener\("unhandledrejection"/)
    expect(CRASH).toMatch(/addEventListener\("error"/)
    expect(MAIN, "듣기만 하고 켜지 않는다").toMatch(/watchUnhandled\(\)/)
  })

  /**
   * ★ 비동기 사고에 전면 오류 화면을 띄우지 않는다 ★
   * 렌더는 멀쩡한데 프라미스 하나가 터진 것뿐일 수 있다. 그때 화면을 덮으면
   * **멀쩡한 앱을 우리가 죽이는 셈**이다.
   */
  it("비동기 사고는 구석의 알약으로만 말한다 — 화면을 덮지 않는다", () => {
    const watch = CRASH.slice(CRASH.indexOf("export function watchUnhandled"))
    expect(watch, "구석이 아니라 전면을 덮는다").toMatch(/position:fixed[\s\S]*bottom:10px/)
    expect(watch, "치울 수 없는 고지는 화면을 영구히 좁힌다").toMatch(/pill\.remove\(\)/)
  })
})

describe("② 마이그레이션이 실패해도 다시 시도할 수 있다", () => {
  it("★ 실패한 프라미스를 캐시하지 않는다 ★", () => {
    const block = DATA.slice(DATA.indexOf("let migrated"), DATA.indexOf("let migrated") + 1400)
    expect(
      block,
      "`??=`가 거절된 프라미스도 붙잡는다 — 실패가 세션 내내 캐시돼 재시작이 유일한 복구가 된다",
    ).toMatch(/\.catch\([\s\S]*migrated = null/)
  })
})

describe("③ 미래에서 온 DB는 열지 않는다", () => {
  /** 최소 목업 — `appliedVersions`가 읽는 것만 흉내낸다. */
  const dbWith = (versions: readonly number[]): MigratableDb => {
    const execed: string[] = []
    return {
      exec: async (sql: string) => {
        execed.push(sql)
      },
      prepare: () => ({
        all: async () => versions.map((v) => ({ version: v })),
        get: async () => ({}),
        run: async () => ({ changes: 0 }),
      }),
      transaction: async (fn: () => Promise<void>) => fn(),
      __execed: execed,
    } as unknown as MigratableDb & { __execed: string[] }
  }

  const M = (version: number): Migration =>
    ({ version, name: `${version}`, sql: `-- ${version}` }) as Migration

  it("★ DB가 앱보다 앞서 있으면 거부한다 ★", async () => {
    // 앱은 001~003을 아는데 DB에는 005가 적용돼 있다 — 더 새 앱이 만든 DB다.
    await expect(applyMigrations(dbWith([1, 2, 3, 5]), [M(1), M(2), M(3)])).rejects.toThrow(
      /더 새 버전의 앱/,
    )
  })

  it("★ 거부하면서 **무엇을 하면 되는지** 말한다 (LOCK 6) ★", async () => {
    const err = await applyMigrations(dbWith([1, 9]), [M(1)]).catch((e: unknown) => e)
    const msg = String(err)
    expect(msg, "DB 쪽 번호를 안 말한다").toContain("9")
    expect(msg, "앱이 아는 번호를 안 말한다").toContain("1")
    expect(msg, "다음 동작을 안 말한다").toMatch(/최신으로 올린 뒤/)
  })

  it("같거나 뒤처진 DB는 그대로 따라잡는다 — 막지 않는다", async () => {
    await expect(applyMigrations(dbWith([1]), [M(1), M(2)])).resolves.toHaveLength(1)
    await expect(applyMigrations(dbWith([1, 2]), [M(1), M(2)])).resolves.toHaveLength(0)
  })

  it("빈 DB(적용 0건)도 막지 않는다 — 처음 여는 자리다", async () => {
    await expect(applyMigrations(dbWith([]), [M(1), M(2)])).resolves.toHaveLength(2)
  })
})
