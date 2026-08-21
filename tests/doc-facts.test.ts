/**
 * 문서의 «저장소 사실»이 실측과 같은가 (2026-08-21).
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 시험인가 — CLI만으로는 아무도 안 부른다 ★
 *
 * `npm run facts -- --check`가 같은 판정을 하지만, **부르는 사람이 없으면 게이트가
 * 아니라 리포트다.** 이 저장소는 그 실패를 이미 겪었다 — `wiring.ts`가
 * `process.exitCode`를 한 번도 안 세워서 「남은 일 100건이어도 exit 0」이었다
 * (2026-08-20 감사 B-5). 판정자는 `npm test` 안에 있어야 한다.
 *
 * ★ 무엇을 무는가 ★
 * **기기와 무관한 숫자만** 문다. 배선/컷 수와 스키마 정본은 어느 기기에서 돌려도
 * 같으므로 CI가 검증할 수 있다. 실 DB 행 수 같은 **기기 사실은 애초에 문서에
 * 안 적는다** — gitignore라 CI가 영원히 못 재고, 못 재는 주장은 안 쓰는 것이
 * 유일한 처방이다 (`/after-work` ⑤ · `docs/사용자-불변식.md`의 규율).
 *
 * ★ 실제로 낡아 있었다 ★ 이 시험을 켜기 직전 `작업-상태.md`는 「배선 249 / 컷 220」,
 * 그 옆 줄은 「배선 246 / 컷 223」이라 적고 있었고 실측은 **255 / 214**였다.
 * 손으로 적은 저장소 사실은 **고칠 이유가 생길 때까지 아무도 안 본다.**
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { facts, apply, expiries, overdue } from "../tools/harness/facts.js"

const DOC = "docs/작업-상태.md"

describe("문서의 저장소 사실 — 기계가 적고 기계가 검사한다", () => {
  const src = readFileSync(DOC, "utf8")
  const f = facts()
  const { out, missing } = apply(src, f)

  it("마커가 살아 있다 — 사라지면 문서가 사실을 안 물게 된다", () => {
    expect(
      missing,
      `${DOC}에 이 마커가 없다. <!-- facts:<id> -->…<!-- /facts --> 를 넣어라`,
    ).toEqual([])
  })

  it("★★ 문서에 적힌 배선·스키마가 지금 실측과 같다 ★★", () => {
    const now = Object.entries(f)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join("\n")
    expect(
      out,
      `${DOC}의 저장소 사실이 낡았다. \`npm run facts -- --write\`로 갱신해라.\n지금 실측:\n${now}`,
    ).toBe(src)
  })

  it("기기 사실은 여기서 안 문다 — 못 재는 것을 무는 척하지 않는다", () => {
    /*
     * `facts()`가 내는 것에 DB 내용이 섞이면 이 시험이 **기기마다 다른 답**을 내고,
     * CI에서는 영영 붉다. 그 순간 사람이 이 시험을 끄게 되고 게이트가 죽는다.
     * 그래서 경계를 시험이 지킨다 — `state`(기기)와 `facts`(저장소)는 안 섞인다.
     */
    const values = Object.values(f).join(" ")
    expect(values, "facts에 기기 사실이 섞였다 — state 쪽이 잴 것이다").not.toMatch(
      /batch|주문 \d|정산 \d|리스팅|SKU|MB|sqlite/,
    )
  })
})

/**
 * ★ 만료 — «나가는 문»이 실제로 열려 있는가 (2026-08-21) ★
 *
 * 한시 문서 둘이 스스로 「소비되면 지운다」고 적어 놓고 몇 주째 남아 있었다.
 * **선언이 있는데 집행이 없으면 규칙이 아니라 소망이다** — 이 저장소가 컷 선언에서
 * 세 번 겪은 것과 같은 병이고, 처방도 같다: 기계가 문다.
 *
 * ★ 이 시험은 코드가 안 바뀌어도 언젠가 붉어진다 ★ 그게 **의도**다. 자명종이므로
 * 「갑자기 빨개졌다」가 고장이 아니다. 연장하려면 날짜를 손으로 늘려야 하고,
 * 그때 「정말 아직 필요한가」를 한 번 묻게 된다 — 그 질문이 이 장치의 전부다.
 */
describe("한시 문서의 만료 — 넣는 문만 있고 나가는 문이 없으면 문서는 단조 증가한다", () => {
  const DOCS = readdirSync("docs")
    .filter((f) => f.endsWith(".md"))
    .map((f) => `docs/${f}`)
    .concat(["CLAUDE.md"])
  const all = expiries(DOCS)

  it("만료를 선언한 문서가 실재한다 — 0이면 이 시험이 헛돈다", () => {
    expect(all.length, "expires 태그가 하나도 없다 — 규칙만 있고 쓰는 데가 없다").toBeGreaterThan(0)
  })

  it("★ 지난 만료가 없다 — 있으면 지우거나 «아직 필요한 이유»와 함께 날짜를 늘려라 ★", () => {
    // KST로 오늘. 업무 날짜라 UTC를 쓰면 아침 아홉 시간이 어제가 된다 (`data.ts`의 kstNow와 같은 판단).
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const late = overdue(all, today)
    const report = late.map((e) => `  ${e.file} (${e.on}) — ${e.reason}`).join(" / ")
    expect(late.map((e) => e.file), `오늘(${today}) 기준 만료가 지났다:
${report}`).toEqual([])
  })
})
