# Free indexer top-up (GitHub Actions)

The indexer is a long-running worker, and the development workspace only runs
it while the workspace is open. Instead of paying for an always-on host, a GitHub
Actions cron job catches the read model up every 3 hours. On a private
repository this fits inside GitHub's 2000 free minutes per month, so the total
cost is zero. The tradeoff is honesty about freshness: with the workspace
closed, onchain activity can take up to ~3 hours to appear on the site.

Ponder's checkpoint for these runs lives in the `ponder_app` schema of the
Supabase database, so every run resumes exactly where the last one stopped.
The very first run backfills from the deployment start block and may hit its
timeout before reaching the tip - that is fine; each run keeps the progress it
made and the next one continues.

## One-time setup (~5 minutes, all in the GitHub web UI)

The workflow lives at `.github/workflows/indexer-topup.yml`. It only needs its
three repository secrets before the schedule can run.

1. **Add the three secrets.** GitHub → the ARCANUM repository → Settings →
   Secrets and variables → Actions → "New repository secret":

   | Secret name | Value (copy from the development environment secrets) |
   | --- | --- |
   | `INDEXER_DATABASE_URL` | the value of `SUPABASE_DB_URL` |
   | `SUPABASE_URL` | the value of `NEXT_PUBLIC_SUPABASE_URL` |
   | `SUPABASE_SERVICE_ROLE_KEY` | the value of `SUPABASE_SERVICE_ROLE_KEY` |

   The workflow runs one job per Arc network, and one database serves one
   network. The three secrets above belong to the stack behind thearcanum.in,
   which serves Arc Mainnet since 2026-09-16 (its testnet rows were archived
   in the `testnet_archive` schema before the switch). The mainnet job sets
   `ARC_NETWORK=mainnet`, which selects
   `packages/contracts/deployments/arc-mainnet.json` and the `arcMainnet`
   chain namespace; the backfill reads from Tenderly's public Arc gateway
   (`https://arc.gateway.tenderly.co`) unless `INDEXER_RPC_URL` names a keyed
   provider (`ARC_RPC_URL`, the override shared with the app, is used second
   unless it names an official endpoint). The official
   `https://rpc.mainnet.arc.io` endpoint is not usable here: it rejects the
   merged 13-topic GuardedWallet query at any block range, so the indexer
   ignores it with a warning even when `ARC_RPC_URL` points at it (see the note
   in `packages/indexer/ponder.config.ts`). A testnet job reads
   `INDEXER_DATABASE_URL_TESTNET`, `SUPABASE_URL_TESTNET` and
   `SUPABASE_SERVICE_ROLE_KEY_TESTNET`, which must point at a separate
   database, and skips itself while they are absent.

2. **Run it once by hand.** Actions tab → "Indexer top-up" → "Run workflow".
   The first run does the historical backfill; if it stops at the timeout,
   run it once or twice more until a run ends quickly. After that the
   schedule takes over.

## Living with it

- The development workspace indexer keeps running as before; the two use separate
  checkpoints and their writes to the read model are the same rows, so they
  never fight.
- The backfill runs against the public Tenderly gateway
  (`arc-testnet.gateway.tenderly.co`) at one request per second, the only free
  endpoint that fits the way Ponder fetches logs (measured 2026-09-12):

  | Endpoint | `eth_getLogs` range | Rate | Long topic lists |
  | --- | --- | --- | --- |
  | `arc-testnet.gateway.tenderly.co` | 100,000 blocks | ~80 requests/minute, then "rate limit exceeded" for the rest of the minute | accepted |
  | `rpc.testnet.arc.network` (official) | 10,000 blocks | ~2 requests/second (429 above) | rejects more than ~8 `topic0` values with "requested range too large", whatever the block range |
  | `arc-testnet.drpc.org` (free plan) | 100 blocks | - | - |

  Ponder 0.17 merges all events of a contract into one `eth_getLogs` per
  block range (the wallet contract has 12), which is what makes a backfill
  take a handful of requests per 10,000 blocks instead of one per event, and
  also why the official endpoint cannot serve it. Ponder's batch estimator
  aims at ten seconds per batch and never grows a batch that took longer, so
  an endpoint that needs more than ten seconds for one batch's requests keeps
  the backfill at 25 blocks per batch forever; that is the symptom of the
  wrong endpoint, not of a slow chain. Rate-limit warnings in the run log are
  normal, failures are not.
- A run that stops with `Schema "ponder_app" was previously used by a different
  Ponder app` means the indexer build changed in a way Ponder will not resume
  across. The recovery is a full replay: drop the `ponder_app` schema (Ponder's
  bookkeeping only; the read model and the `ponder_sync` RPC cache are separate)
  **and** delete this deployment's `indexer_checkpoints` row. The read-model
  sync refuses to move a checkpoint backwards, so a replay against the old row
  fails on its first event with `current deployment checkpoint ... is ahead of
  event block ...`. A replay against a deleted row starts a fresh checkpoint.
- Catch-up evidence is refused while a staged `unlinked_ledger_events` row is
  still pending for the deployment. Rows without a deployment identity count
  only from the deployment's start block on: an earlier deployment's staged
  row below that block can never be replayed by this indexer, so it is left
  alone rather than allowed to block evidence forever.
- If a keyed RPC ever arrives, set `INDEXER_RPC_URL` (and a matching
  `INDEXER_RPC_REQUESTS_PER_SECOND`) in the workflow's indexer step and, if
  wanted, tighten the cron to every hour. The indexer deliberately ignores
  `ARC_TESTNET_RPC`, which names the official endpoint for the app's own reads.
- To pause everything: Actions tab → "Indexer top-up" → "…" → Disable
  workflow.
