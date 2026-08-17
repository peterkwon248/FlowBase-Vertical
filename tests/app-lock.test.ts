/**
 * 앱 잠금 — **잡았으면 반드시 놓는다.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 이 시험이 생겼나 (2026-08-16) ★
 *
 * 사용자가 [확인하고 가져오기]를 눌렀는데 **아무 일도 일어나지 않았다.**
 * 그 신고를 파는 동안 내가 잠금 해제를 `.then` 안에서 `.finally`로 옮기다
 * **`write()`의 해제를 통째로 빠뜨렸다** — 그 상태로 나갔으면 상품 연결을 한
 * 번 한 뒤부터 앱의 모든 버튼이 조용히 죽었다. 커밋 전에 diff를 읽다 잡았다.
 *
 * 즉 이 결함은 «주의하면 안 나는 것»이 아니라 **주의해도 나는 것**이다.
 * 사람이 다섯 자리를 눈으로 맞추는 한 언젠가 또 한 자리가 빠진다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 왜 소스 검사인가 ★
 * 이 잠금은 `useRef` 하나이고 그것을 만지는 것은 이벤트 핸들러들이다. 그
 * 조합을 실제로 돌리려면 DOM·Tauri·실파일이 모두 필요해서, 잡으려는 결함
 * («한 자리에서 해제가 빠졌다»)에 비해 장치가 너무 커진다. `dev-db-isolation`이
 * 「어떤 테스트도 원본 DB를 직접 열지 않는다」를 소스로 검사한 것과 같은 판단이다.
 */

import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const APP = "src/app/App.tsx"
const src = readFileSync(APP, "utf8")

/** 주석은 뺀다 — 설명문에 적힌 `acquire()`가 실제 호출로 세어지면 시험이 거짓말을 한다. */
const code = src
  .split("\n")
  .filter((l) => {
    const t = l.trim()
    return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*")
  })
  .join("\n")

const count = (needle: string): number => code.split(needle).length - 1

describe("DB에 닿는 동작의 잠금 — 잡은 만큼 놓는다", () => {
  it("★ `acquire()` 수와 `.finally(release)` 수가 같다 ★", () => {
    const taken = count("acquire()")
    const freed = count(".finally(release)")
    expect(taken, "잠금을 잡는 자리가 하나도 없다 — 시험이 헛돈다").toBeGreaterThan(0)
    expect(freed, `잡은 곳 ${taken} · 놓는 곳 ${freed} — 한 자리가 빠졌다`).toBe(taken)
  })

  /**
   * ★ `.then` 안에서 놓으면 그 뒤가 던졌을 때 영영 안 놓인다 ★
   *
   * 실제로 그 모양이었다: 위저드는 `take(r)` **뒤에** 놓고 있었고, `take`가
   * 던지면 잠금이 남는다. `finally`는 던지든 말든 돈다 — 그래서 «놓는 방법»을
   * 하나로 못박는다.
   */
  it("`release()`를 `finally` 밖에서 부르지 않는다", () => {
    const bare = count("release()") - count(".finally(release)") * 0
    // `release()` 호출은 정의(`const release = useCallback`) 말고는 없어야 한다.
    // `.finally(release)`는 **호출이 아니라 전달**이라 여기 안 잡힌다.
    expect(bare, "finally 밖에서 release()를 부르는 자리가 있다").toBe(0)
  })

  it("잠금을 잡는 자리는 전부 «못 잡으면 아무 일도 안 한다»로 시작한다", () => {
    // `if (!acquire())` 또는 `|| !acquire()` 형태만 허용한다. 잡은 결과를 버리고
    // 그냥 진행하는 자리가 있으면 잠금이 있으나 마나가 된다.
    const guarded = count("!acquire()")
    expect(guarded, "acquire()의 결과를 안 보는 자리가 있다").toBe(count("acquire()"))
  })
})

describe("가져오기 버튼은 **조용히** 되돌아 나가지 않는다 (LOCK 6)", () => {
  /**
   * 사용자가 겪은 그 화면이다. 조건 다섯이 한 줄에서 똑같이 침묵하면 무엇이
   * 막았는지 사용자도 우리도 알 수 없다.
   */
  it("가드가 걸리면 이유를 화면에 남긴다", () => {
    const confirmBlock = code.slice(code.indexOf("confirm: () => {"))
    const guard = confirmBlock.slice(0, confirmBlock.indexOf("const stamp"))
    expect(guard, "가드에 «왜 안 되는지» 만드는 자리가 없다").toContain("stop(")
    expect(guard).toContain("BUSY_WHY")
    // 예전 모양(조건들을 한 줄에 모아 그냥 return)이 되돌아오면 잡는다.
    expect(guard).not.toMatch(/\|\|\s*!acquire\(\)\)\s*return\s*$/m)
  })

  it("적재 실패는 모달로도 말한다 — 인라인 오류 칸은 매핑표 위에 있다", () => {
    expect(code).toContain('sayConfirm("가져오지 못했습니다"')
  })
})
