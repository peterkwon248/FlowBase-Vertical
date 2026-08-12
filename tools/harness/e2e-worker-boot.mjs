/** Worker 부트스트랩 — tsx 로더는 worker thread로 전파되지 않는다. */
import { register } from "tsx/esm/api"
register()
await import("./e2e-worker.ts")
