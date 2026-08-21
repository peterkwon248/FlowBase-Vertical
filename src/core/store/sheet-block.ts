/**
 * 파싱된 표의 **보관 형태** — gzip 블록 · 2,000행 · JSONL ([ADR-027](docs/ADR-027-원본-표-보관-형태.md)).
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 압축인가 — 재서 골랐다 ★
 *
 * 픽스처 #13(원본 10.05MB · 80,138행 × 43열)을 실제 SQLite에 넣고 잰 값
 * (2026-08-21 · 이 기기):
 *
 *     행당 TSV 평문      43.0MB   4.3배
 *     셀당 한 행         24.2바이트/셀 → 344만 «행»
 *     gzip 블록 2,000행   1.02MB   ★ 42배 작다
 *
 * ★ 왜 `CompressionStream`인가 — `node:zlib`이 아니라 ★
 * 이 파일은 `core/`에 산다. `node:zlib`을 들이면 ADR-011(실행 환경 중립)이 깨지고
 * **웹판이 모듈 로드 단계에서 죽는다** — 세션 1·2가 실제로 겪은 고장이다.
 * `tests/core-env-neutral.test.ts`가 그 자리를 지킨다.
 *
 * ★ 왜 JSONL인가 — 무손실에 5%를 낸다 ★
 * gzip TSV 1.02MB vs gzip JSONL 1.08MB. TSV는 탭·개행이 든 셀을 망가뜨리고
 * `null`과 `""`, 숫자와 문자열을 뭉갠다. **오늘 픽스처에 그런 셀이 0개라 TSV를
 * 골라도 아무 시험이 안 깨진다** — 그게 함정이다. 이 층의 존재 이유가 「원본 표를
 * 다시 본다」인데 다시 본 표가 원본과 다르면 없느니만 못하다.
 * ─────────────────────────────────────────────────────────────
 */

/**
 * 한 블록이 드는 행 수. **실측으로 골랐다** (ADR-027 결정 2):
 * 500행 → 1.2MB · 1,684ms · 2,000행 → 1.1MB · 1,001ms. 더 작고 더 빠르다.
 * 읽기는 한 블록 펼치기 **13ms**(2,000행)라 페이지 요청이 이 크기를 감당한다.
 */
export const BLOCK_ROWS = 2000

/** 표의 한 칸. 파서가 정규화해 준 값 그대로다 — 우리가 다시 손대지 않는다 (LOCK 3). */
export type SheetCell = string | number | boolean | null

export interface SheetBlock {
  readonly firstRow: number
  readonly rowCount: number
  /**
   * gzip 바이트를 **base64 문자열**로 담는다 (ADR-027 결정 7).
   *
   * ★ 왜 BLOB이 아닌가 ★ 드라이버 계약이 `SqlValue = string | number | null`이다.
   * BLOB을 넣으려면 구현 셋(node·wasm·tauri)과 경계 시험을 함께 넓혀야 하는데,
   * **재보니 그럴 값어치가 없었다** (2026-08-21 · 픽스처 #13):
   *
   *     gzip 바이트   1.08MB
   *     base64 TEXT   1.46MB   (+33%)   ← 평문 43.0MB의 **1/29**. 원본 xlsx보다 작다
   *
   * 380KB 때문에 좁게 유지해 온 계약을 넓히지 않는다. 저장이 실제로 문제가 되면
   * ADR-027의 재검토 트리거(「합이 실 DB의 절반을 넘으면」)가 그때 연다.
   */
  readonly gz: string
}

/**
 * 바이트 ↔ base64. **환경 중립이다** — `btoa`/`atob`는 Node·브라우저 양쪽에 있다
 * (`Buffer`는 Node 전용이라 여기서 못 쓴다 — ADR-011).
 *
 * 청크로 나눠 부르는 이유는 `String.fromCharCode(...arr)`가 인자 수 한도에 걸리기
 * 때문이다. 블록 하나가 압축 상태로 ~25KB라 오늘은 안 걸리지만, 한도에 기대는 코드는
 * 파일이 커지는 날 조용히 죽는다.
 */
function toBase64(bytes: Uint8Array): string {
  let bin = ""
  const STEP = 0x8000
  for (let i = 0; i < bytes.length; i += STEP) {
    bin += String.fromCharCode(...bytes.subarray(i, i + STEP))
  }
  return btoa(bin)
}

function fromBase64(text: string): Uint8Array {
  const bin = atob(text)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const parts: Uint8Array[] = []
  let total = 0
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value)
    total += value.length
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/**
 * ⚠ `bytes()`를 거치는 이유 — TypeScript 5.7이 `Uint8Array`에 버퍼 종류를 붙이면서
 * `Uint8Array<ArrayBufferLike>`가 `BufferSource`에 안 맞는다. 값은 그대로이고
 * **타입만 좁히는** 자리다. `as any`를 쓰지 않는다 (이 저장소는 사람 코드에 `any`가 0이다).
 */
const bytes = (u: Uint8Array): ArrayBufferView<ArrayBuffer> =>
  new Uint8Array(u.slice().buffer as ArrayBuffer)

async function gzip(text: string): Promise<Uint8Array> {
  const cs = new CompressionStream("gzip")
  const w = cs.writable.getWriter()
  void w.write(bytes(new TextEncoder().encode(text)))
  void w.close()
  return drain(cs.readable)
}

async function gunzip(buf: Uint8Array): Promise<string> {
  const ds = new DecompressionStream("gzip")
  const w = ds.writable.getWriter()
  void w.write(bytes(buf))
  void w.close()
  return new TextDecoder().decode(await drain(ds.readable))
}

/**
 * 행들을 한 블록으로 싼다.
 *
 * `undefined`는 `null`로 눕힌다 — JSON이 `undefined`를 표현하지 못해서 그냥 두면
 * 배열 길이가 줄거나 항목이 사라진다. **열 수가 바뀌면 그건 다른 표다.**
 */
export async function packBlock(
  firstRow: number,
  rows: readonly (readonly SheetCell[])[],
): Promise<SheetBlock> {
  const text = rows.map((r) => JSON.stringify(r.map((v) => v ?? null))).join("\n")
  return { firstRow, rowCount: rows.length, gz: toBase64(await gzip(text)) }
}

/** 블록을 편다. 넣은 것과 **같은 것**이 나와야 한다 (ADR-027 따름 조건 1). */
export async function unpackBlock(block: SheetBlock): Promise<readonly (readonly SheetCell[])[]> {
  const text = await gunzip(fromBase64(block.gz))
  // 빈 블록은 `""`가 되고 `"".split("\n")`은 `[""]`이라 한 행을 지어낸다.
  if (text === "") return []
  return text.split("\n").map((line) => JSON.parse(line) as SheetCell[])
}

/**
 * ★ 청크가 오는 대로 블록을 흘려보낸다 — 전 행을 모으지 않는다 (LOCK 5) ★
 *
 * 80,138행을 배열에 담아 놓고 압축하면 그 자체가 「전체 메모리 적재」다. 이 누산기는
 * **2,000행이 차는 순간 블록을 내보내고 버린다** — 손에 남는 것은 늘 한 블록 분량뿐이다.
 *
 * 쓰는 쪽:
 * ```
 * const acc = blockAccumulator(async (b) => { await repo.putSheetBlock(id, b) })
 * for await (const chunk of src.stream(0)) await acc.push(chunk.rows)
 * await acc.flush()   // 남은 꼬리
 * ```
 */
export function blockAccumulator(emit: (block: SheetBlock) => Promise<void>): {
  push(rows: readonly (readonly SheetCell[])[]): Promise<void>
  flush(): Promise<void>
  /** 지금까지 내보낸 행 수 — 부르는 쪽이 「몇 행 보관했나」를 말할 수 있게. */
  written(): number
} {
  let buf: (readonly SheetCell[])[] = []
  let first = 0
  let done = 0

  const emitFull = async (): Promise<void> => {
    while (buf.length >= BLOCK_ROWS) {
      const slice = buf.slice(0, BLOCK_ROWS)
      buf = buf.slice(BLOCK_ROWS)
      await emit(await packBlock(first, slice))
      first += slice.length
      done += slice.length
    }
  }

  return {
    async push(rows) {
      if (rows.length > 0) buf.push(...rows)
      await emitFull()
    },
    async flush() {
      await emitFull()
      if (buf.length === 0) return
      const slice = buf
      buf = []
      await emit(await packBlock(first, slice))
      first += slice.length
      done += slice.length
    },
    written: () => done,
  }
}

/**
 * 블록들에서 **페이지**를 뽑는다 — 블록 경계를 넘어도 이어 준다.
 *
 * 페이지가 두 블록에 걸치는 것은 예외가 아니라 **기본**이다(2,000으로 나눠떨어지는
 * 페이지 크기를 쓸 이유가 없다). 그 자리를 부르는 쪽마다 다시 짜면 한 곳은 틀린다.
 */
export async function readPage(
  blocks: readonly SheetBlock[],
  offset: number,
  limit: number,
): Promise<readonly (readonly SheetCell[])[]> {
  if (limit <= 0) return []
  const end = offset + limit
  const out: (readonly SheetCell[])[] = []
  // 겹치는 블록만 편다 — 나머지는 압축 상태로 둔다 (LOCK 5).
  for (const b of [...blocks].sort((x, y) => x.firstRow - y.firstRow)) {
    const bEnd = b.firstRow + b.rowCount
    if (bEnd <= offset || b.firstRow >= end) continue
    const rows = await unpackBlock(b)
    const from = Math.max(0, offset - b.firstRow)
    const to = Math.min(rows.length, end - b.firstRow)
    out.push(...rows.slice(from, to))
  }
  return out
}
