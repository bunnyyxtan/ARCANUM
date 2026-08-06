# Free indexer top-up (GitHub Actions)

The indexer is a long-running worker, and the Replit workspace only runs it
while the workspace is open. Instead of paying for an always-on host, a GitHub
Actions cron job catches the read model up every 3 hours. On a private
repository this fits inside GitHub's 2000 free minutes per month, so the total
cost is zero. The tradeoff is honesty about freshness: with the workspace
closed, on-chain activity can take up to ~3 hours to appear on the site.

Ponder's checkpoint for these runs lives in the `ponder_app` schema of the
Supabase database, so every run resumes exactly where the last one stopped.
The very first run backfills from the deployment start block and may hit its
timeout before reaching the tip — that is fine; each run keeps the progress it
made and the next one continues.

## One-time setup (~10 minutes, all in the GitHub web UI)

Replit's GitHub connection is not allowed to push files under
`.github/workflows/`, so this one file has to be placed by hand.

1. **Add the three secrets.** GitHub → the ARCANUM repository → Settings →
   Secrets and variables → Actions → "New repository secret":

   | Secret name | Value (copy from the Replit Secrets pane) |
   | --- | --- |
   | `INDEXER_DATABASE_URL` | the value of `SUPABASE_DB_URL` |
   | `SUPABASE_URL` | the value of `NEXT_PUBLIC_SUPABASE_URL` |
   | `SUPABASE_SERVICE_ROLE_KEY` | the value of `SUPABASE_SERVICE_ROLE_KEY` |

2. **Create the workflow file.** Repository → "Add file" → "Create new file" →
   name it exactly:

   ```
   .github/workflows/indexer-topup.yml
   ```

   Paste the entire contents of [`docs/indexer-topup.yml`](./indexer-topup.yml)
   and commit straight to `main`.

3. **Run it once by hand.** Actions tab → "Indexer top-up" → "Run workflow".
   The first run does the historical backfill; if it stops at the timeout,
   run it once or twice more until a run ends quickly. After that the
   schedule takes over.

## Living with it

- The Replit workspace indexer keeps running as before; the two use separate
  checkpoints and their writes to the read model are the same rows, so they
  never fight.
- The free dRPC endpoint rate-limits occasionally (HTTP 429). Ponder retries
  and gets through; warnings in the run log are normal, failures are not.
- If a paid RPC key ever arrives, change `ARC_TESTNET_RPC` in the workflow to
  the keyed URL and, if wanted, tighten the cron to every hour.
- To pause everything: Actions tab → "Indexer top-up" → "…" → Disable
  workflow.
