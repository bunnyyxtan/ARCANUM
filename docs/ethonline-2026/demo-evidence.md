# Testnet evidence

Real runs of the receipt workflow on Arc Testnet, recorded as they happen.
Each run is made with `scripts/receipts-demo.ts` against the deployed API
(see the walkthrough in [`docs/PAYMENT-RECEIPTS.md`](../PAYMENT-RECEIPTS.md)),
and the envelope it writes to `demo-output/` is what the verification column
refers to. Rows are filled in only after the run exists; a row marked
_pending_ has not been run yet.

Explorer: [Arcscan testnet](https://testnet.arcscan.app). Receipt links open
the dashboard and need a signed-in workspace member; the `/verify` page does
not.

## Runs

| Scenario | Receipt id | Verdict / reason | Evaluated at block | Transaction | Evidence rows | Offline verification |
| --- | --- | --- | --- | --- | --- | --- |
| Allowed payment | _pending_ | | | | | |
| Denied payment | _pending_ | | | none (a deny never reaches the chain) | none | |
| Escalated payment | _pending_ | | | | | |
| Council decision on the hold | _pending_ (same receipt) | | | | | |

## Tamper test

A copy of one envelope above with a single character changed in the body,
pasted into `/verify`: expected result is a `receiptDigest` mismatch with the
issuer signature still reported separately. Recorded as _pending_ until run.

## Notes

- Amounts, vendors and the policy thresholds used are listed here once the
  runs are done, so the verdicts can be read against the policy that produced
  them.
