/**
 * DB 파일의 자리 — **설치본이 자기 데이터 폴더를 여는가** (ADR-024 · 조사 2.9).
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 소스 검사인가 ★
 *
 * 이 규칙은 **런타임에 재현할 수 없다.** `import.meta.env.DEV`는 vitest에서 늘
 * 참이고, `appDataDir()`는 Tauri 런타임이 있어야 답한다. 즉 시험이 실제로 부르는
 * 경로는 영원히 개발 쪽 한 갈래뿐이라 «설치본이 어디를 여는가»를 못 잰다.
 *
 * 그래서 무는 자리를 **소스**로 옮긴다 — `head-more`·`user-invariants`가 세운
 * 방식 그대로다. 소스 검사가 「보이나」를 못 보는 것은 사실이지만, 여기서 지켜야
 * 할 것은 보임이 아니라 **구조**다: 경로를 만드는 자리가 하나인가, 도구가 사용자
 * DB를 건드리지 않는가. 둘 다 문자열로 정확히 판정된다.
 *
 * 폴더 생성(ADR-024 결정 3)은 Rust 쪽 `없는_폴더에도_db를_연다`가 실물로 잰다.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync } from "node:fs"

/** 주석 안의 문자열이 정규식을 만족시키는 사고를 막는다 (user-invariants와 같은 처방). */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

const DATA_RAW = readFileSync("src/app/data.ts", "utf8")
const DATA = stripComments(DATA_RAW)

/** `src/app`의 모든 배선 파일. 새 파일이 생겨도 자동으로 사정권에 든다. */
const APP_FILES = readdirSync("src/app")
  .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
  .map((f) => ({ file: `src/app/${f}`, src: stripComments(readFileSync(`src/app/${f}`, "utf8")) }))

const TOOL_FILES = readdirSync("tools/harness")
  .filter((f) => f.endsWith(".ts"))
  .map((f) => ({ file: `tools/harness/${f}`, src: readFileSync(`tools/harness/${f}`, "utf8") }))

describe("ADR-024 — 설치본은 자기 데이터 폴더를 연다", () => {
  it("★★ 앱의 열기가 **구워진 프로젝트 경로**를 직접 쓰지 않는다 (조사 2.9) ★★", () => {
    /*
     * 이것이 결함 그 자체다. `openTauriDriver(DEV_DB_PATH, …)`는 빌드한 기계의
     * 절대경로(`vite.config.ts`의 `__PROJECT_ROOT__`)를 그대로 연다 — 다른 PC에
     * 설치하면 그 폴더가 없어 첫 열기에서 끝난다.
     */
    const open = DATA.match(/openTauriDriver\(([^,]+),/)
    expect(open, "data.ts에 openTauriDriver 호출이 없다 — 시험이 낡았다").not.toBeNull()
    expect(open![1]!.trim()).toBe("await appDbPath()")
    expect(DATA).not.toMatch(/openTauriDriver\(\s*DEV_DB_PATH/)
  })

  it("★ 자리를 정하는 곳은 **하나**다 — 갈리면 「앱은 되는데 스모크는 안 되는」 자리가 생긴다 ★", () => {
    /*
     * ADR-024 따름 조건 1. `isWebDemo`를 한 곳에 둔 것과 같은 규율이다.
     *
     * ★ 파일이 아니라 **호출 자리**를 센다 ★ 처음엔 「`appDataDir`을 쓰는 파일이
     * data.ts 하나」로 썼는데, 자해에서 **같은 파일 안에 둘째 함수를 만들자
     * 통과했다.** 규칙은 「한 파일」이 아니라 「한 자리」다 — 한 글자 차이로
     * 가드가 무뎌지는 자리였다 (작업 리듬 17).
     */
    const sites = APP_FILES.flatMap((f) =>
      [...f.src.matchAll(/appDataDir\s*\(/g)].map(() => f.file),
    )
    expect(sites, "appDataDir을 부르는 자리가 하나가 아니다").toEqual(["src/app/data.ts"])

    // import도 한 번뿐이어야 한다 — 두 번째 import는 두 번째 자리의 전조다.
    const imports = [...DATA.matchAll(/@tauri-apps\/api\/path/g)]
    expect(imports.length, "경로 API를 여러 번 들여온다").toBe(1)
  })

  it("판정은 **프론트 빌드 모드**를 따른다 — 릴리즈 바이너리가 dev 경로로 새면 재현이 안 된다", () => {
    /*
     * `tauri build --no-bundle`로 구운 릴리즈를 개발 기계에서 돌리는 것이 이
     * 결함의 재현 방법이다. Rust의 `debug_assertions`로 갈랐다면 그때도 dev
     * 경로로 새서 영영 재현이 안 된다 (ADR-024 결정 1).
     */
    expect(DATA).toMatch(/import\.meta\.env\.DEV/)
    expect(DATA).toMatch(/appDataDir/)
  })

  it("★ 개발 DB를 앱 데이터 폴더로 **복사해 오지 않는다** (U-7) ★", () => {
    // 남의 기계에서 만든 35MB를 몰래 가져오면 「내가 넣은 적 없는 데이터」가 생긴다.
    // 새 설치의 첫 화면은 빈 DB이고 그게 참이다 — §22가 「이 기간 파일 없음」을 말한다.
    expect(DATA, "복사 흔적이 있다 — ADR-024 결정 2를 뒤집는 코드다").not.toMatch(
      /copyFile|copyfile|writeFile.*DEV_DB_PATH|DEV_DB_PATH.*writeFile/,
    )
  })

  it("★ 도구는 **개발 경로만** 쓴다 — 하네스가 사용자 DB를 열면 실험이 사고가 된다 ★", () => {
    /*
     * ADR-024 따름 조건 2.
     *
     * ★ `selftest.ts`는 예외다 — 그리고 그 예외를 공짜로 주지 않는다 (2026-08-21) ★
     * 자가시험은 **자해 페이로드로** `appDataDir` 문자열을 담는다(`db-path-one-site`
     * 케이스가 둘째 호출 자리를 심는다). 부르는 게 아니라 **글자로 들고 있는 것**이라
     * 이 규칙의 취지 밖이다. 그런데 「예외」라고만 적으면 그 파일에서 진짜로 DB를
     * 열어도 아무도 모른다. 그래서 **더 센 것으로 바꿔 문다**: 그 파일은 어떤
     * 드라이버도 열지 않는다.
     */
    const EXEMPT = "tools/harness/selftest.ts"
    const bad = TOOL_FILES.filter((f) => f.file !== EXEMPT && /appDataDir/.test(f.src)).map(
      (f) => f.file,
    )
    expect(bad, "하네스가 앱 데이터 폴더를 본다").toEqual([])

    const self = TOOL_FILES.find((f) => f.file === EXEMPT)
    expect(self, `${EXEMPT}가 없다 — 예외 선언이 낡았다`).toBeDefined()

    /*
     * ★ 코드 패턴으로 못 가른다 — **import로 판정한다** ★
     *
     * 처음엔 `/openTauriDriver|DatabaseSync|Connection::open/`로 걸었는데
     * **자기 자신을 물었다.** 이 파일은 자해 페이로드로 `openTauriDriver(…)`를
     * 통째로 들고 있고 설명문에 `Connection::open`도 적혀 있다. 내용이 «코드 조각»인
     * 파일은 어떤 코드 패턴이든 만족시킨다 — `user-invariants` 2회차에서 정규식이
     * 자기 설명 주석에 걸렸던 것과 같은 병이다.
     *
     * TS 파일이 DB를 열려면 **드라이버를 import해야** 한다. 문자열 페이로드로는
     * 못 한다. 그래서 import 목록을 본다 — 더 정확하고 더 세다.
     */
    const imports = [...self!.src.matchAll(/^\s*import\s[^"']*["']([^"']+)["']/gm)].map((m) => m[1]!)
    expect(imports.length, "import를 하나도 못 찾았다 — 시험이 낡았다").toBeGreaterThan(0)
    expect(
      imports.filter((i) => !i.startsWith("node:")),
      "자가시험이 node 기본 모듈 밖을 들여온다 — DB를 열 길이 생겼다",
    ).toEqual([])
  })

  it("`vite.config.ts`의 「dev에서만 쓴다」가 이제 **참이다**", () => {
    /*
     * 그 주석은 2.9가 열려 있는 동안 거짓이었다 — 주입된 경로가 실제로는 앱의
     * 유일한 DB 경로였다. 문서와 코드가 어긋난 자리를 코드로 닫았으므로, 주석이
     * 다시 거짓이 되는 것도 여기서 막는다.
     */
    const vite = readFileSync("vite.config.ts", "utf8")
    expect(vite).toMatch(/__PROJECT_ROOT__/)
    // 앱의 열기 경로에서 `root`가 직접 쓰이는 자리는 개발 DB 상수 하나뿐이다.
    const uses = [...DATA.matchAll(/\$\{root\}/g)]
    expect(uses.length, "data.ts가 구워진 루트를 여러 곳에서 쓴다").toBe(1)
  })
})
