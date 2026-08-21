/**
 * [합성 + 실측] 통의 **깊은 층** — 파싱된 표 보관 ([ADR-027](docs/ADR-027-원본-표-보관-형태.md)).
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 합성이 필요한가 — 오늘 픽스처로는 무손실을 못 시험한다 ★
 *
 * 실측(2026-08-21): 픽스처 #13 80,138행에 **탭 든 셀 0개 · 개행 든 셀 0개**다.
 * 그래서 손실 있는 TSV로 담아도 **아무 시험이 안 깨진다** — 「우연히 안 터지는 중」이
 * 정확히 그 모양이고, 상품명에 개행이 든 마켓 파일이 오는 날 조용히 망가진다.
 *
 * 그 함정을 여기서 판다: 탭·개행·따옴표·`null`·빈 문자열·숫자/문자열 구분을
 * **일부러 넣고** 왕복시킨다.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it } from "vitest"
import {
  BLOCK_ROWS,
  blockAccumulator,
  packBlock,
  readPage,
  unpackBlock,
  type SheetBlock,
  type SheetCell,
} from "../src/core/store/sheet-block.js"

/** 행 n개짜리 가짜 표. 값에 행 번호를 심어 두면 페이지가 어긋났을 때 바로 보인다. */
const table = (n: number, cols = 3): SheetCell[][] =>
  Array.from({ length: n }, (_, i) => Array.from({ length: cols }, (_, c) => `r${i}c${c}`))

describe("왕복이 무손실이다 (ADR-027 따름 조건 1)", () => {
  it("★★ 탭·개행이 든 셀이 살아 돌아온다 — TSV였다면 여기서 죽는다 ★★", async () => {
    const rows: SheetCell[][] = [
      ["탭\t가운데", "개행\n가운데", "둘\t다\n있다"],
      ["따옴표 \"큰\" 과 '작은'", "역슬래시 \\ 하나", "쉼표, 세미콜론;"],
    ]
    const back = await unpackBlock(await packBlock(0, rows))
    expect(back).toEqual(rows)
  })

  it("★ `null`과 빈 문자열이 안 뭉개진다 ★", async () => {
    const rows: SheetCell[][] = [[null, "", "x"]]
    const back = await unpackBlock(await packBlock(0, rows))
    expect(back).toEqual([[null, "", "x"]])
    // 「비었다」와 「없다」는 다른 사실이다 (§22).
    expect(back[0]![0]).toBeNull()
    expect(back[0]![1]).toBe("")
  })

  it("★ 숫자와 «숫자처럼 보이는 문자열»이 안 뭉개진다 ★", async () => {
    // 마켓 주문번호는 **문자열로 유지한다** — 숫자로 바꾸면 정밀도를 잃는다 (ADR-002).
    const rows: SheetCell[][] = [[1234, "1234", "0091", 0, false, true]]
    const back = await unpackBlock(await packBlock(0, rows))
    expect(back).toEqual([[1234, "1234", "0091", 0, false, true]])
    expect(typeof back[0]![0]).toBe("number")
    expect(typeof back[0]![1]).toBe("string")
    // 앞의 0이 붙은 코드가 살아 있어야 한다
    expect(back[0]![2]).toBe("0091")
  })

  it("한글·이모지·긴 제목이 그대로다", async () => {
    const rows: SheetCell[][] = [["머레이 3in1 무선충전기 · 색상:블랙-1개", "★☆♥", "…" .repeat(500)]]
    const back = await unpackBlock(await packBlock(0, rows))
    expect(back).toEqual(rows)
  })

  it("빈 블록이 «한 행»을 지어내지 않는다", async () => {
    expect(await unpackBlock(await packBlock(0, []))).toEqual([])
  })

  it("열 수가 유지된다 — `undefined`가 칸을 지우지 않는다", async () => {
    // 파서가 짧은 행을 줄 수 있다. 담는 쪽이 칸을 없애면 **다른 표**가 된다.
    const rows = [[1, undefined, 3] as unknown as SheetCell[]]
    const back = await unpackBlock(await packBlock(0, rows))
    expect(back[0]).toHaveLength(3)
    expect(back[0]![1]).toBeNull()
  })
})

describe("블록 나누기 — 전 행을 모으지 않는다 (LOCK 5)", () => {
  it(`${BLOCK_ROWS}행마다 한 블록이고, 꼬리도 빠지지 않는다`, async () => {
    const rows = table(BLOCK_ROWS * 2 + 7)
    const out: SheetBlock[] = []
    const acc = blockAccumulator(async (b) => {
      out.push(b)
    })
    // 청크가 오는 대로 — 크기가 블록과 안 맞는 것이 **정상**이다
    for (let i = 0; i < rows.length; i += 137) await acc.push(rows.slice(i, i + 137))
    await acc.flush()

    expect(out.map((b) => b.rowCount)).toEqual([BLOCK_ROWS, BLOCK_ROWS, 7])
    expect(out.map((b) => b.firstRow)).toEqual([0, BLOCK_ROWS, BLOCK_ROWS * 2])
    expect(acc.written()).toBe(rows.length)
  })

  it("★ 다 차기 전에는 안 내보낸다 — 그래야 손에 한 블록만 남는다 ★", async () => {
    const out: SheetBlock[] = []
    const acc = blockAccumulator(async (b) => {
      out.push(b)
    })
    await acc.push(table(BLOCK_ROWS - 1))
    expect(out, "덜 찼는데 내보냈다").toHaveLength(0)
    await acc.push(table(1))
    expect(out, "찼는데 안 내보냈다").toHaveLength(1)
  })

  it("행이 하나도 없으면 블록도 없다 — 빈 블록을 만들지 않는다", async () => {
    const out: SheetBlock[] = []
    const acc = blockAccumulator(async (b) => {
      out.push(b)
    })
    await acc.push([])
    await acc.flush()
    expect(out).toHaveLength(0)
  })
})

describe("페이지 — 블록 경계를 넘어도 이어 준다 (따름 조건 2)", () => {
  const build = async (n: number): Promise<SheetBlock[]> => {
    const out: SheetBlock[] = []
    const acc = blockAccumulator(async (b) => {
      out.push(b)
    })
    await acc.push(table(n))
    await acc.flush()
    return out
  }

  it("★★ 경계를 걸치는 페이지가 온전하다 — 여기가 제일 틀리기 쉽다 ★★", async () => {
    const blocks = await build(BLOCK_ROWS * 2 + 50)
    const page = await readPage(blocks, BLOCK_ROWS - 10, 20)
    expect(page).toHaveLength(20)
    expect(page[0]![0]).toBe(`r${BLOCK_ROWS - 10}c0`)
    expect(page[19]![0]).toBe(`r${BLOCK_ROWS + 9}c0`)
  })

  it("첫 페이지 · 마지막 페이지 · 끝을 넘는 요청", async () => {
    const n = BLOCK_ROWS + 5
    const blocks = await build(n)
    expect((await readPage(blocks, 0, 3)).map((r) => r[0])).toEqual(["r0c0", "r1c0", "r2c0"])
    // 남은 것보다 많이 달라고 하면 **있는 만큼만** 준다 — 빈 행을 지어내지 않는다
    const tail = await readPage(blocks, n - 2, 10)
    expect(tail).toHaveLength(2)
    expect(await readPage(blocks, n + 100, 10)).toEqual([])
    expect(await readPage(blocks, 0, 0)).toEqual([])
  })

  it("블록 순서가 뒤섞여 와도 페이지는 순서대로다 — SQL 정렬에 기대지 않는다", async () => {
    const blocks = await build(BLOCK_ROWS * 2)
    const shuffled = [...blocks].reverse()
    const page = await readPage(shuffled, BLOCK_ROWS - 2, 4)
    expect(page.map((r) => r[0])).toEqual([
      `r${BLOCK_ROWS - 2}c0`,
      `r${BLOCK_ROWS - 1}c0`,
      `r${BLOCK_ROWS}c0`,
      `r${BLOCK_ROWS + 1}c0`,
    ])
  })

  it("★ 필요한 블록만 편다 — 나머지는 압축 상태로 둔다 (LOCK 5) ★", async () => {
    const blocks = await build(BLOCK_ROWS * 5)
    // 세 번째 블록 안의 페이지. 다섯 블록을 다 펴면 이 시험이 그것을 못 잡으므로
    // **펴진 블록 수**를 직접 센다.
    let unpacked = 0
    const counted = blocks.map((b) => ({
      ...b,
      get gz(): string {
        unpacked++
        return b.gz
      },
    }))
    await readPage(counted, BLOCK_ROWS * 2 + 10, 5)
    expect(unpacked, "관계없는 블록까지 폈다").toBe(1)
  })
})

describe("저장 형태가 실제로 작다 (ADR-027 결정 1)", () => {
  /**
   * 이 시험은 «얼마나 작나»를 못박지 않는다 — 그건 데이터에 따라 변한다.
   * 못박는 것은 **압축이 실제로 걸려 있다**는 사실이다. 어느 리팩터가 평문으로
   * 되돌려 놓으면 여기서 붉어진다.
   */
  it("압축이 실제로 걸려 있다 — 평문으로 되돌리면 여기서 붉어진다", async () => {
    /**
     * ⚠ **이 합성 표는 압축에 최악이다** — 셀마다 값이 전부 다르다(`r0c0`·`r1c0`…).
     * 실데이터는 같은 캠페인명·같은 날짜·빈 칸이 반복돼 훨씬 잘 줄고, 실측이
     * 그것을 보여준다: 픽스처 #13은 평문 43.0MB → base64 1.46MB(**29배**).
     *
     * 그래서 여기 문턱은 «얼마나 작나»를 못박는 것이 아니라 **압축이 켜져 있나**를
     * 묻는 최소선이다. 배수를 조이면 데이터가 바뀔 때마다 흔들리는 시험이 된다.
     */
    const rows = table(BLOCK_ROWS)
    const plain = rows.map((r) => JSON.stringify(r)).join("\n").length
    const block = await packBlock(0, rows)
    expect(block.gz.length, "평문보다 작지 않다 — 압축이 꺼졌나").toBeLessThan(plain / 2)
  })

  it("★ 반복이 많은 진짜 표 모양에서는 훨씬 더 줄어든다 ★", async () => {
    // 같은 값이 되풀이되는 열(캠페인명·날짜·상태)이 실제 파일의 모습이다.
    const rows: SheetCell[][] = Array.from({ length: BLOCK_ROWS }, (_, i) => [
      "2026-07-01",
      "매출 최적화",
      "머레이 3in1 무선충전기 Z10",
      i % 7,
      null,
    ])
    const plain = rows.map((r) => JSON.stringify(r)).join("\n").length
    const block = await packBlock(0, rows)
    expect(block.gz.length).toBeLessThan(plain / 20)
  })
})
