# bench/sqlite — ADR-003 실측

`rusqlite` 적재 처리량. 세션 2의 스키마·PRAGMA·청크 크기(1,000행)를 그대로 쓴다.

```bash
cargo run --release        # Rust 툴체인 + MSVC 링커 필요
```

측정값과 해석은 [ADR-003](../../docs/ADR-003-sqlite-바인딩.md)에 있다.
비교 대상인 `node:sqlite` 쪽 수치는 `npm run e2e` / `SKIP_LOAD=1 npm run e2e`로 재현한다.
