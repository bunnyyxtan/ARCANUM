# Testnet evidence

Real runs of the receipt workflow on Arc Testnet, recorded as they happen.
Each run is made with `scripts/receipts-demo.ts` against the deployed API
(see the walkthrough in [`docs/PAYMENT-RECEIPTS.md`](../PAYMENT-RECEIPTS.md)),
and the envelope it writes to `demo-output/` is what the verification column
refers to. Rows are filled in only after the run exists; a row marked
_pending_ has not been recorded here yet.

Explorer: [Arcscan testnet](https://testnet.arcscan.app). Receipt links open
the dashboard and need a signed-in workspace member; the `/verify` page does
not.

## Runs

| Scenario | Receipt id | Verdict / reason | Evaluated at block | Transaction | Evidence rows | Offline verification |
| --- | --- | --- | --- | --- | --- | --- |
| Allowed payment (5 USDC to the approved vendor) | `e68e068d-90b0-4366-940d-700b1b1c8c60` | allow / NONE | 61419538 | [`0x214b1ddb…62fc781c`](https://testnet.arcscan.app/tx/0x214b1ddba2b8018eda6d4692d9c1647907d79b0046bdb2b8bd80c3cf62fc781c) (block 61419543) | `execution/executed` | `verifyPaymentReceipt`: ok; digest `0x6fea6a19…2654ac6d` verified, issuer `arc-testnet-2026-09` verified, request signature verified |
| Denied payment (1 USDC to an address with no vendor record) | `3fb578b8-454d-4f3d-bf2f-64407e8b88ed` | deny / ALLOWLIST_REQUIRED | 61419566 | none (a deny never reaches the chain) | none | `verifyPaymentReceipt`: ok; digest `0x1b16fc6f…b552a69` verified, issuer `arc-testnet-2026-09` verified, request signature verified |
| Escalated payment | _pending_ | | | | | |
| Council decision on the hold | _pending_ (same receipt) | | | | | |

## Tamper test

A copy of one envelope above with a single character changed in the body,
pasted into `/verify`: expected result is a `receiptDigest` mismatch with the
issuer signature still reported separately. Recorded as _pending_ until run.

## Notes

- Wallet: `0x9f044588539DC7FD7C2e666dE55557abC3539b32` ("Receipts demo
  agent"), created at block 61419372 on the v2 contracts listed in the
  README. Agent signer: `0x24a727c925f8be49206442f7e4a67c59ac4c4790`.
- Policy during the runs: per-payment cap 20 USDC, 24-hour budget 40 USDC,
  30-day budget 200 USDC, review threshold 10 USDC (anything above is held
  for the council), approved vendors required, freeze on blocked vendor on,
  all five categories enabled.
- Approved vendor: `0x97c5356fa33d4ccc3e139b2cae7c2ca6086fe75e` ("Demo API
  vendor", category API, no per-vendor cap). The denied run targets
  `0xf4934ee499484983c799625f2238c7662fb9f161`, which has no vendor record on
  this wallet.
- Offline verification runs `verifyPaymentReceipt` from `@arcanum/sdk` on the
  envelope file in `demo-output/` with the default issuer registry. Each
  check is reported on its own: envelope format, receipt digest, issuer
  signature, and the agent's request signature.
