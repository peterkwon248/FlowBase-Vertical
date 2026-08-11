/**
 * Worker 부트스트랩.
 *
 * tsx의 ESM 로더는 worker thread로 전파되지 않는다 (`execArgv`를 물려줘도
 * 마찬가지다). 워커 진입점을 `.mjs`로 두고 여기서 로더를 직접 등록한 뒤
 * TypeScript 워커를 불러온다.
 *
 * 세션 2에서 실제 앱을 빌드하면 워커도 번들되므로 이 파일은 사라진다 —
 * 하네스 전용이다.
 */

import { register } from "tsx/esm/api"

register()
await import("./perf-worker.ts")
