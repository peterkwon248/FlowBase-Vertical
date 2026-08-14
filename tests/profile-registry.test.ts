/**
 * 프로파일 레지스트리 — **판정이 성립하려면 후보 목록이 있어야 한다.**
 *
 * 오늘 프로파일을 쓰는 곳은 전부 하나를 손으로 박아 넣는다(`matchProfiles([profile], …)`).
 * 즉 "이 파일이 무엇인지" 묻는 코드가 아니라 **답을 미리 아는** 코드였다. 하네스는
 * 어떤 픽스처를 넣는지 아니까 그래도 됐지만, 사용자가 파일을 고르는 순간 그 전제가 사라진다.
 *
 * ★ 이 테스트가 진짜로 묻는 것 ★
 * 목록이 몇 개인가가 아니라 — **엉뚱한 프로파일이 이기지 않는가**이다. 후보가 하나뿐이던
 * 시절에는 검증할 수 없었던 성질이고, 프로파일이 늘수록 위험해지는 성질이다.
 *
 * ★ 2026-08-14: 쿠팡 매출 2종이 들어오며 전제 하나가 깨졌다 ★
 * 「마켓 × 성격」이 유일하다고 단언하고 있었는데, 쿠팡은 이제 `order` 문서가 **둘**이다
 * (판매자 배송 = 건별 · 로켓그로스 = 기간 집계). 유일해야 하는 것은 그것이 아니라
 * `mapping_version`(grain 포함)이다.
 */

import { describe, expect, it } from "vitest"
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { loadProfiles } from "../src/packs/kr-marketplace/profiles/index.js"
import { matchProfiles, profileVersion } from "../src/core/import/mapping/index.js"
import { sniff } from "../src/core/import/recognition/sniff.js"
import { parserFor } from "../src/core/import/parsers/index.js"
import { streamSheet } from "../src/core/import/pipeline.js"
import { FIXTURES, fixturePath, CLEAN_DIR } from "./fixtures.js"

describe("프로파일 레지스트리", () => {
  it("팩의 프로파일을 전부 읽는다 — 목록을 손으로 관리하지 않는다", () => {
    const all = loadProfiles()

    // ★ 개수를 손으로 적지 않는다 ★ 전에는 `toBe(3)`이었는데, 그건 «목록을 손으로
    // 관리하지 않는다»를 시험하면서 정작 **개수를 손으로 관리**하는 모순이었다.
    // 디렉터리와 대조한다 — 파일을 더하면 통과하고, glob이 깨지면 잡힌다.
    const onDisk = readdirSync("src/packs/kr-marketplace/profiles").filter((f) => f.endsWith(".json"))
    expect(all.length, "glob이 읽은 수가 디스크와 다르다").toBe(onDisk.length)
    expect(all.length, "프로파일이 하나도 없다").toBeGreaterThan(0)

    // ★ 유일해야 하는 것은 `mapping_version`이지 «마켓 × 성격»이 아니다 ★
    // 쿠팡은 `order` 문서가 둘이다 — 판매자 배송(건별)과 로켓그로스(기간 집계).
    // 같은 성격이라도 grain이 다르면 다른 양식이고, batch가 기록하는 것도 grain을
    // 포함한 `mapping_version`이다 (헌장 B-6).
    const versions = all.map(profileVersion)
    expect(versions.length, `mapping_version이 겹친다: ${versions.join(" · ")}`).toBe(
      new Set(versions).size,
    )
    const ids = all.map((p) => p.id)
    expect(ids.length).toBe(new Set(ids).size)
    for (const p of all) {
      expect(p.displayName, `${p.id}에 채널 통칭이 없다`).toBeTruthy()
      // 채널 통칭과 문서 이름은 다른 것이다 — 섞이면 화면 채널 열에 문서 제목이 뜬다
      expect(p.displayName).not.toBe(p.label)
    }
  })
})

/**
 * ★ 실파일로 «판정»을 시험한다 ★
 *
 * 후보 3개를 전부 주고 파일을 넣었을 때 **맞는 것이 1등**이어야 한다. 이게 위저드
 * 판정 단계의 전부이고, 여기가 틀리면 사용자는 엉뚱한 매핑으로 적재하게 된다.
 */
const CASES = [
  { fixture: 6, want: "11st" },
  { fixture: 8, want: "esm" },
  { fixture: 13, want: "coupang" },
] as const

const ready = CASES.every((c) => {
  const f = FIXTURES.find((x) => x.id === c.fixture)
  return f !== undefined && existsSync(fixturePath(f, CLEAN_DIR))
})
const run = ready ? describe : describe.skip

if (!ready) console.warn("[profile-registry] fixtures/clean이 없어 건너뛴다")

run("판정 — 후보 셋을 주면 맞는 것이 1등이다", () => {
  for (const c of CASES) {
    it(`픽스처 #${c.fixture} → ${c.want}`, async () => {
      const f = FIXTURES.find((x) => x.id === c.fixture)!
      const bytes = new Uint8Array(readFileSync(fixturePath(f, CLEAN_DIR)))
      const rec = sniff(bytes, f.file)
      const top = rec.candidates[0]!
      const src = await parserFor(top.format).open(bytes, {
        chunkSize: 200,
        ...(top.encoding === undefined ? {} : { encoding: top.encoding }),
        ...(top.delimiter === undefined ? {} : { delimiter: top.delimiter }),
      })
      try {
        const { chunks, getSummary } = streamSheet(src, 0, { chunkSize: 200 })
        // 헤더는 첫 청크를 흘려야 잡힌다
        for await (const _ of chunks) break
        const headers = [...getSummary().header.columns]

        const m = matchProfiles(loadProfiles(), {
          containerFormat: top.format,
          headers,
          fileName: f.file,
        })
        expect(m.length, "아무 프로파일도 맞지 않는다").toBeGreaterThan(0)
        expect(m[0]!.profile.marketplaceKey, "1등이 틀렸다").toBe(c.want)
        // 근거를 들고 온다 — 위저드가 "왜 이걸로 봤는지"를 보여줄 수 있어야 한다 (헌장 C-5)
        expect(m[0]!.evidence.length, "판정 근거가 비었다").toBeGreaterThan(0)
        expect(m[0]!.confidence).toBeGreaterThan(0)
      } finally {
        src.close()
      }
    })
  }

  it("엉뚱한 헤더에는 아무것도 맞지 않는다 — 억지로 1등을 만들지 않는다", () => {
    const m = matchProfiles(loadProfiles(), {
      containerFormat: "delimited",
      headers: ["이름", "나이", "취미"],
      fileName: "주소록.csv",
    })
    expect(m, "관계없는 파일에 프로파일이 붙었다").toHaveLength(0)
  })
})
