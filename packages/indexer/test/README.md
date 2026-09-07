Tests live here, not under `src/`.

Ponder loads every file in `src/` as indexing code when it starts, so a test
file there is executed inside the indexer process: importing `vitest` outside a
vitest run throws "Vitest failed to access its internal state" and `ponder
start` exits before indexing a block. Keep `src/` to code Ponder should run.
