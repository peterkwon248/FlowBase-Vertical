/**
 * SHA-1 — **어디서든 도는 동기 구현.**
 *
 * 원래 `node:crypto`의 `createHash("sha1")`를 썼는데, 실제 앱(Tauri 웹뷰)에서
 * 파이프라인을 처음 돌리자 모듈 로드 단계에서 죽었다. `node:crypto`는 브라우저에
 * 없다. 테스트와 하네스가 전부 Node에서 도니 그때까지 드러날 일이 없었다.
 *
 * ★ 왜 Web Crypto가 아닌가 ★
 * `crypto.subtle.digest`는 **비동기**다. 이 해시는 청크 안에서 행마다 불리는
 * 자리라(`contentKey`) 비동기로 바꾸면 매핑 루프 전체가 await로 물든다.
 * 8만 행 × await는 구조도 성능도 손해다.
 *
 * ★ 왜 다른 해시로 갈아타지 않았나 ★
 * `source_key`가 이 값에서 나온다. 해시를 바꾸면 **같은 파일을 다시 가져올 때
 * 다른 키가 생겨 UPSERT 멱등성이 깨진다**(헌장 2). 표준 SHA-1을 그대로 구현하면
 * 값이 한 비트도 바뀌지 않는다 — `tests/sha1.test.ts`가 `node:crypto`와
 * 대조해서 그걸 증명한다.
 */

/** 32비트 왼쪽 회전. */
function rotl(n: number, b: number): number {
  return ((n << b) | (n >>> (32 - b))) >>> 0
}

/**
 * UTF-8 문자열의 SHA-1. 20바이트를 돌려준다.
 *
 * 구현은 FIPS 180-4 그대로다 — 패딩(0x80 + 0 + 64비트 길이), 80라운드,
 * 라운드별 상수 네 개.
 */
export function sha1(input: string): Uint8Array {
  const msg = new TextEncoder().encode(input)
  const bitLen = msg.length * 8

  // 패딩: 메시지 + 0x80 + 0…0 + 길이(64비트 빅엔디언)
  const withPad = new Uint8Array(((msg.length + 8) >> 6 << 6) + 64)
  withPad.set(msg)
  withPad[msg.length] = 0x80
  const view = new DataView(withPad.buffer)
  // 길이는 마지막 8바이트. 안전 정수 범위를 넘는 입력은 이 앱에 오지 않는다.
  view.setUint32(withPad.length - 8, Math.floor(bitLen / 0x100000000))
  view.setUint32(withPad.length - 4, bitLen >>> 0)

  let h0 = 0x67452301
  let h1 = 0xefcdab89
  let h2 = 0x98badcfe
  let h3 = 0x10325476
  let h4 = 0xc3d2e1f0

  const w = new Uint32Array(80)

  for (let off = 0; off < withPad.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4)
    for (let i = 16; i < 80; i++) {
      w[i] = rotl((w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!) >>> 0, 1)
    }

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4

    for (let i = 0; i < 80; i++) {
      let f: number
      let k: number
      if (i < 20) {
        f = (b & c) | (~b & d)
        k = 0x5a827999
      } else if (i < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d)
        k = 0x8f1bbcdc
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6
      }
      const t = (rotl(a, 5) + (f >>> 0) + e + k + w[i]!) >>> 0
      e = d
      d = c
      c = rotl(b, 30)
      b = a
      a = t
    }

    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
  }

  const out = new Uint8Array(20)
  const ov = new DataView(out.buffer)
  ov.setUint32(0, h0)
  ov.setUint32(4, h1)
  ov.setUint32(8, h2)
  ov.setUint32(12, h3)
  ov.setUint32(16, h4)
  return out
}

/**
 * 다이제스트 앞 6바이트를 정수로. `Buffer.readUIntBE(0, 6)`과 같은 값이다.
 *
 * 48비트라 안전 정수 범위(2^53) 안이고, 부동소수 오차 없이 정확하다 —
 * 원래 주석이 말하던 그대로다.
 */
export function readUInt48BE(b: Uint8Array): number {
  return (
    b[0]! * 2 ** 40 + b[1]! * 2 ** 32 + b[2]! * 2 ** 24 + b[3]! * 2 ** 16 + b[4]! * 2 ** 8 + b[5]!
  )
}
