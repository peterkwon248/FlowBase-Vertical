/**
 * ★ 내부 키는 화면에 나오지 않는다 (헌장 C-4) — **화면 전체를 한 곳에서 지킨다** ★
 *
 * `connection_id`·`batch_id`·`source_key`·`listing_key`는 우리 안에서만 뜻을 갖는
 * 값이다. 사용자에게 `conn-11st`나 `batch-esm`이 보이면 그건 우리가 이름을 안 붙였다는
 * 뜻이지 사용자가 알아야 할 사실이 아니다. 채널 이름의 출처는 프로파일이 선언한
 * `displayName`이고 `connection.display_name`에 산다.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 화면별이 아니라 공용인가 — 이 파일의 존재 이유다 ★
 *
 * 처음엔 `order-rows.test.ts` 안에 있었다. 정산과 주문 둘을 한 번에 지키려고 묶은
 * 것인데, 이유는 **다음 화면에서도 같은 실수가 나오기 때문**이었다. 실제로 났다 —
 * 상품 연결의 `listing_key`는 U+0001로 이어 붙인 합성 키(ADR-006)라, 목업이 그리던
 * `{r.key}`를 그대로 두면 **보이지 않는 제어문자**가 HTML에 섞여 나갔다.
 *
 * 화면이 늘 때마다 공용 검사가 자동으로 따라붙는 것이 목적이므로, 파일 이름이
 * `order-rows`에 묶여 있는 것이 오히려 그 목적을 가렸다. 내용은 한 곳 그대로 두고
 * 이름만 옮겼다 — **새 화면은 아래 `VIEWS`에 한 줄을 더한다. 새 파일을 만들지 않는다.**
 * ─────────────────────────────────────────────────────────────
 */

import { beforeAll, describe, expect, it } from "vitest"
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository } from "../src/core/store/repository.js"
import { runImport } from "../src/core/import/run.js"
import type { MappingProfile } from "../src/core/import/mapping/index.js"
import { FIXTURES, fixturePath, CLEAN_DIR } from "./fixtures.js"
import { loadOrderRows } from "../src/core/order/rows.js"
import { loadSettlementRows } from "../src/core/settlement/rows.js"
import { loadLinkingView } from "../src/core/linking/view.js"
import { KEY_SEP } from "../src/core/import/mapping/listing.js"
import { krLinkingMatcher } from "../src/packs/kr-marketplace/linking-matcher.js"
import type { Period } from "../src/core/profit/index.js"
import { orderVals } from "../src/app/order.js"
import { settlementVals } from "../src/app/settlement.js"
import { detailVals, settlementDetailKey } from "../src/app/detail.js"
import { linkingVals } from "../src/app/linking.js"
import { Template } from "../src/app/generated/Template.js"
import { emptyVals } from "../src/app/generated/vals.js"
import { shellVals, shellStateFor } from "../src/app/shell.js"

const DB = ".tmp/screen-safety.sqlite"
const PERIOD: Period = { from: "2026-07-01", to: "2026-07-31" }
const LIB = "lib-1"
const NOW = "2026-08-14T00:00:00.000Z"

/**
 * ★ 자기 세계를 짓는다 — 개발용 DB를 빌리지 않는다 ★
 *
 * 처음엔 `.tmp/pnl.sqlite`를 읽었다. 사용자가 2d에서 리스팅 86개를 **전부** 연결하자
 * `todo`가 비어 이 파일이 빨개졌다 — `linking-screen`이 먼저 겪은 것과 **같은 결함**인데
 * 그때 한 곳만 고쳤다.
 *
 * 교훈은 하나다: **개발용 DB는 사람이 제품을 쓰면 변한다.** 그걸 고정된 세계로 읽는
 * 테스트는 사용자를 벌준다. 픽스처에서 `runImport`로 지으면 앱을 얼마나 쓰든 안 깨진다.
 */
const SEED = [
  { fixture: 6, profile: "11st-settlement@1.json", conn: "conn-11st" },
  { fixture: 8, profile: "esm-order@1.json", conn: "conn-esm" },
] as const

const ready = SEED.every((c) => {
  const f = FIXTURES.find((x) => x.id === c.fixture)
  return f !== undefined && existsSync(fixturePath(f, CLEAN_DIR))
})
const run = ready ? describe : describe.skip

if (!ready) console.warn("[screen-safety] fixtures/clean이 없어 건너뛴다")

async function buildWorld(): Promise<void> {
  rmSync(DB, { force: true })
  const db = openNodeDriver(DB)
  try {
    await migrate(db)
    const repo = new Repository(db)
    await repo.ensureLibrary(LIB, "기본", NOW)
    for (const c of SEED) {
      const f = FIXTURES.find((x) => x.id === c.fixture)!
      const profile = JSON.parse(
        readFileSync(`src/packs/kr-marketplace/profiles/${c.profile}`, "utf-8"),
      ) as MappingProfile
      await repo.ensureConnection(
        {
          id: c.conn, libraryId: LIB, packId: profile.packId,
          marketplaceKey: profile.marketplaceKey, displayName: profile.displayName,
        },
        NOW,
      )
      await runImport(repo, {
        bytes: new Uint8Array(readFileSync(fixturePath(f, CLEAN_DIR))),
        fileName: f.file, profile, sheetIndex: 0,
        libraryId: LIB, connectionId: c.conn, batchId: `batch-${c.conn}`, now: NOW,
      })
    }
  } finally {
    await db.close()
  }
}

function emptyActions() {
  const noop = (): void => {}
  return { go: noop, toggleNav: noop, closeNav: noop, openNav: noop, goImport: noop, toggleTheme: noop }
}

/**
 * 화면에 절대 나오면 안 되는 문자열.
 *
 * `KEY_SEP`(U+0001)은 **소스에서 보이지 않는다.** 리터럴로 적지 않고 상수에서
 * 가져오는 이유가 그것이다 — 눈으로 검토할 수 없는 문자를 손으로 적으면, 언젠가
 * 누가 «이 빈 문자열 뭐지» 하고 지운다.
 */
const LEAKS: readonly [string, string][] = [
  ["conn-", "연결 id"],
  ["batch-", "batch id"],
  ["lst-", "리스팅 id"],
  ["sku-lib", "SKU id (사용자가 보는 것은 SKU-0001 코드다)"],
  ["prd-lib", "상품 id"],
  ["source_key", "컬럼명"],
  ["listing_key", "컬럼명"],
  ["connection_id", "컬럼명"],
  ["library_id", "컬럼명"],
  [KEY_SEP, "★ 합성 키 구분자 (ADR-006) — 보이지 않으므로 눈으로는 못 잡는다"],
]

// 상수가 정말 그 문자인지 **먼저** 확인한다. 빈 문자열이 들어오면 `includes("")`가
// 늘 참이라 검사가 통째로 뒤집힌다 — 보이지 않는 값을 검사할 때는 검사 대상부터
// 검사한다 (작업 리듬 8 — 틀린 실측은 틀린 추정보다 위험하다).
if (KEY_SEP.length !== 1 || KEY_SEP.codePointAt(0) !== 1) {
  throw new Error(`KEY_SEP이 U+0001이 아니다: ${JSON.stringify(KEY_SEP)}`)
}

run("내부 키가 화면에 새지 않는다 (헌장 C-4)", () => {
  beforeAll(buildWorld)

  it("배선된 전 화면 어디에도 내부 키가 없다", async () => {
    const db = openNodeDriver(DB, { pragmas: false })
    const settlement = await loadSettlementRows(db, LIB, PERIOD)
    const orders = await loadOrderRows(db, LIB, PERIOD)
    const linking = await loadLinkingView(db, LIB, krLinkingMatcher)
    await db.close()

    // 화면마다 나오는 채널이 다르다 — 정산은 11번가, 주문은 ESM에서 왔다.
    // 그 자체가 "연결 3개가 섞여 있다"는 단서의 다른 표현이다.
    const VIEWS = [
      {
        key: "settlement",
        channel: "11번가",
        detail: false,
        wire: (v: never) => settlementVals(v, settlement, PERIOD),
      },
      {
        key: "orders",
        channel: "ESM",
        detail: false,
        wire: (v: never) => orderVals(v, orders, PERIOD),
      },
      {
        key: "linking",
        channel: "11번가",
        detail: false,
        wire: (v: never) => linkingVals(v, linking, "todo", new Set()),
      },
      /**
       * ★ §21-2 L2 근거 패널 (2026-08-21) ★
       * 새 표면이라 여기 한 줄을 더한다 — 이 파일 머리 주석이 요구하는 그대로다.
       * 패널은 정산 화면 옆에 서므로 화면 키는 `settlement`이고, `<aside>`는
       * `connection_id`를 **주소로만** 들고 사람에게는 채널 이름을 보인다.
       */
      {
        key: "settlement",
        channel: "11번가",
        detail: true,
        wire: (v: never) => {
          settlementVals(v, settlement, PERIOD)
          const first = settlement[0]
          if (first === undefined) return
          detailVals(
            v,
            { kind: "settlement", key: settlementDetailKey(first) },
            {
              period: PERIOD,
              products: [],
              channels: [],
              orders,
              settlements: settlement,
              skus: [],
            },
            { close: () => {}, go: () => {} },
          )
        },
      },
    ] as const

    for (const view of VIEWS) {
      const vals = shellVals(shellStateFor(false), emptyActions() as never)
      view.wire(vals as never)
      vals.firstRun = false
      vals.notFirstRun = true
      ;(vals.v as Record<string, boolean>)[view.key] = true

      const html = renderToString(createElement(Template, { vals }))
      // 배선이 조용히 no-op이 되면 이 검사도 조용히 아무것도 안 본다 — 그래서
      // «이 view가 실제로 무엇을 그렸나»를 먼저 못박는다 (LOCK 6의 시험판).
      if (view.detail === true) {
        expect(html, "근거 패널이 안 떴다 — 이 view의 누출 검사는 헛돈다").toContain(
          "detail-side",
        )
      }
      for (const [leak, what] of LEAKS) {
        expect(
          html.includes(leak),
          `${view.key} 화면에 ${what}(${JSON.stringify(leak)})가 보인다`,
        ).toBe(false)
      }
      expect(html, `${view.key} 화면에 채널 이름이 없다`).toContain(view.channel)
    }
  })

  /**
   * ★ 가드를 부러뜨려 확인한다 (작업 리듬 3) ★
   *
   * U+0001 검사는 **눈으로 통과 여부를 알 수 없는** 유일한 항목이다. 다른 것들은
   * `conn-`처럼 읽히기라도 하지만 이건 렌더 결과를 봐도 보이지 않는다. 그래서
   * "안 잡혔다"가 «없다»인지 «가드가 무르다»인지 확인해 둔다.
   */
  it("U+0001이 섞이면 실제로 잡힌다 — 안 잡는 가드는 없느니만 못하다", async () => {
    const db = openNodeDriver(DB, { pragmas: false })
    const linking = await loadLinkingView(db, LIB, krLinkingMatcher)
    await db.close()

    // ★ 아무 리스팅이나 쓰면 안 된다 ★ ESM은 키 컬럼이 «상품번호» 하나뿐이라
    // 합성이 일어나지 않는다 — 구분자 없는 키로 시험하면 흠집이 안 나고, 그러면
    // "가드가 잡았다"가 아니라 **시험 자체가 성립하지 않은 것**이다.
    const composite = linking.todo
      .flatMap((c) => c.listings)
      .find((l) => l.listingKey.includes(KEY_SEP))
    expect(composite, "합성 키를 가진 리스팅(11번가 옵션)이 있어야 시험이 성립한다").toBeTruthy()

    const vals = shellVals(shellStateFor(false), emptyActions() as never)
    linkingVals(vals, linking, "todo", new Set())
    // 조회는 조각을 나눠 주지만 합성 키 자체는 여전히 들고 있다. 화면이 실수로
    // 그것을 그리는 상황을 흉내 낸다.
    ;(vals.linkRows as { ext: string }[])[0]!.ext = composite!.listingKey
    vals.firstRun = false
    vals.notFirstRun = true
    vals.v.linking = true

    const html = renderToString(createElement(Template, { vals }))
    expect(html.includes(KEY_SEP), "흠집을 냈는데 가드가 못 봤다").toBe(true)
  })
})

/**
 * ★ LOCK 10의 기계화 — §17-3 금지어 ★
 *
 * "동기화"는 양방향·자동이 실존하기 전까지 금지다. 우리 어휘는 **연결 / 가져오기 /
 * batch**다. 세 번 걸렸고(결함 46 · 48 · 50) 그때마다 **사람이 눈으로** 찾았다 —
 * 그게 이 블록이 생긴 이유다.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 렌더만 보면 안 되나 — 결함 50이 그 증거다 ★
 *
 * 세 번째 «동기화»는 상품 화면 원가 안내문(`ctCogs`) 안에 있었는데, `emptyVals()`가
 * `ctCogs: false`를 주므로 **어떤 렌더 검사로도 그 문장은 나오지 않는다.** 렌더만
 * 봤다면 게이트는 녹색인데 위반은 그대로 남아 있었을 것이다.
 *
 * 그래서 두 층으로 본다. 어느 한쪽도 다른 쪽을 대신하지 못한다:
 *
 *   소스 전수  조건 뒤에 숨은 정적 카피를 잡는다   ← 결함 50이 여기서 잡힌다
 *   렌더      vals가 **런타임에 만든** 문구를 잡는다  ← 소스에는 없는 말
 * ─────────────────────────────────────────────────────────────
 */
describe("§17-3 금지어가 화면에 없다 (LOCK 10)", () => {
  const BANNED: readonly [string, string][] = [
    ["동기화", "LOCK 10 — 양방향·자동이 실존하지 않는다. 어휘는 연결 / 가져오기 / batch"],
    // 규칙이 아니라 **회귀 방지**다. ADR-012가 보증하는 것은 같은 `listing_key`의
    // 보존이지 새 리스팅의 자동 연결이 아니다 (결함 48).
    ["자동으로 붙습니다", "결함 48 — ADR-012가 보증하지 않는 약속"],
  ]

  it("마크업 소스에 금지어가 없다 — 조건 뒤에 숨은 카피까지", () => {
    const src = readFileSync("src/app/generated/Template.tsx", "utf8")
    for (const [word, why] of BANNED) {
      expect(src.includes(word), `Template.tsx에 "${word}"가 있다 — ${why}`).toBe(false)
    }
  })

  /**
   * ★ 배선 모듈도 카피를 만든다 — 여기가 비어 있었다 ★
   *
   * 금지어 검사가 `Template.tsx`만 보고 있었는데, 화면 문구의 **절반은 배선 모듈이
   * 만든다**(`linkEmptyMsg` · `orderScope` · `foldLabel` …). 앞으로 지을 가져오기
   * 위저드는 판정·오류·제외 사유를 전부 런타임 문자열로 만들 것이라 이 구멍이 곧
   * 커진다.
   *
   * **주석은 뺀다.** 이 저장소가 이미 두 번 배운 것이다 (`node:` 가드 · core 마켓명
   * 가드) — 금지어를 «왜 금지인지» 설명하는 주석까지 잡으면 가드가 시끄러워지고,
   * 시끄러운 가드는 곧 꺼진다. 코드와 문자열만 본다.
   */
  it("배선 모듈이 만드는 문구에도 금지어가 없다", () => {
    const files = readdirSync("src/app").filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    expect(files.length, "배선 모듈을 하나도 못 찾았다 — 경로가 바뀌었나").toBeGreaterThan(5)

    for (const f of files) {
      const code = readFileSync(`src/app/${f}`, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1")
      for (const [word, why] of BANNED) {
        expect(code.includes(word), `src/app/${f}의 코드에 "${word}"가 있다 — ${why}`).toBe(false)
      }
    }
  })

  /**
   * 화면 문구를 vals가 만드는 경우는 소스 검사가 못 본다. 데이터가 없어도 도는
   * 검사라 `.tmp/pnl.sqlite` 유무와 무관하게 **늘 실행된다** — 카피 가드가 픽스처에
   * 매여 있으면 새 기기에서 조용히 꺼진다.
   */
  it("전 화면 렌더에도 금지어가 없다 — vals가 만든 문구까지", () => {
    for (const key of Object.keys(emptyVals().v)) {
      const vals = emptyVals()
      ;(vals.v as Record<string, boolean>)[key] = true
      vals.firstRun = false
      vals.notFirstRun = true
      const html = renderToString(createElement(Template, { vals }))
      for (const [word, why] of BANNED) {
        expect(html.includes(word), `${key} 화면에 "${word}"가 있다 — ${why}`).toBe(false)
      }
    }
  })

  /** 가드를 부러뜨려 확인한다 (작업 리듬 3) — 소스 검사가 정말 읽고 있는가. */
  it("금지어를 넣으면 소스 검사가 잡는다", () => {
    const src = readFileSync("src/app/generated/Template.tsx", "utf8")
    const scarred = src.replace("가져오기가 덮어쓰지 않습니다", "동기화가 덮어쓰지 않습니다")
    expect(scarred, "치환이 실제로 일어나야 시험이 성립한다").not.toBe(src)
    expect(scarred.includes("동기화")).toBe(true)
  })
})
