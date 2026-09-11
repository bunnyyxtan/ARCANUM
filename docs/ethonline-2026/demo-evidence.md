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
| Allowed payment signed by a Circle developer-controlled wallet (0.5 USDC to the approved vendor) | `d6cd633b-c78a-4e67-8bbc-f602ef0a679c` | allow / NONE | 61565033 | [`0x7e62f73b…d619a3`](https://testnet.arcscan.app/tx/0x7e62f73b8281230148f7139b5c7d7339e9f799ec9deda58b7b7cc649add619a3) (block 61565039, `from` = the Circle wallet) | `execution/executed` | `verifyPaymentReceipt`: ok; digest `0xc1cc89fa…74d842a5` verified, issuer `arc-testnet-2026-09` verified, request signature verified |

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
- Circle signer: `0xbf4be36ce2614b6c17261a593c937e0442675c39`, a Circle
  developer-controlled EOA (wallet id `c4f41325-b03f-55e9-b73b-ca6ed25fd206`
  on Circle's `EVM-TESTNET` identifier), authorized by the owner in
  [`0x0069221c…7a89a2`](https://testnet.arcscan.app/tx/0x0069221c91dc80d4ff699cd3e72901233d066400535cd10f4decd5ceb67a89a2)
  (block 61564406) and given 0.5 USDC for gas in
  [`0xe613d2f5…137dba`](https://testnet.arcscan.app/tx/0xe613d2f5f648a8cc69b21932734dc9de75ba5dffab4df4d0da1569d0d5137dba).
  For its run the intent signature and the `executeUSDC` transaction were
  both produced by Circle's signing API through `arcanum-sdk/circle`
  (`scripts/receipts-demo.ts allow --execute` with the four `CIRCLE_*`
  variables); the receipt's `agentSignerAddress` and the transaction `from`
  are that address. See `docs/CIRCLE-WALLETS.md` for what this does and does
  not prove.
- Offline verification runs `verifyPaymentReceipt` from `@arcanum/sdk` on the
  envelope file in `demo-output/` with the default issuer registry. Each
  check is reported on its own: envelope format, receipt digest, issuer
  signature, and the agent's request signature.
