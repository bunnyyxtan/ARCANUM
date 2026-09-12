# Testnet evidence

Real runs of the receipt workflow on Arc Testnet, recorded as they happen,
with separate CCTP funding evidence below.
Receipt runs are made with `scripts/receipts-demo.ts` against the deployed API
(see the walkthrough in [`docs/PAYMENT-RECEIPTS.md`](../PAYMENT-RECEIPTS.md)),
and the envelope it writes to `demo-output/` is what the verification column
refers to. Rows are filled in only after the run exists.

Explorer: [Arcscan testnet](https://testnet.arcscan.app). Receipt links open
the dashboard and need a signed-in workspace member; the `/verify` page does
not.

## Runs

| Scenario | Receipt id | Verdict / reason | Evaluated at block | Transaction | Evidence rows | Offline verification |
| --- | --- | --- | --- | --- | --- | --- |
| Allowed payment (5 USDC to the approved vendor) | `e68e068d-90b0-4366-940d-700b1b1c8c60` | allow / NONE | 61419538 | [`0x214b1ddb…62fc781c`](https://testnet.arcscan.app/tx/0x214b1ddba2b8018eda6d4692d9c1647907d79b0046bdb2b8bd80c3cf62fc781c) (block 61419543) | `execution/executed` | `verifyPaymentReceipt`: ok; digest `0x6fea6a19…2654ac6d` verified, issuer `arc-testnet-2026-09` verified, request signature verified |
| Denied payment (1 USDC to an address with no vendor record) | `3fb578b8-454d-4f3d-bf2f-64407e8b88ed` | deny / ALLOWLIST_REQUIRED | 61419566 | none (a deny never reaches the chain) | none | `verifyPaymentReceipt`: ok; digest `0x1b16fc6f…b552a69` verified, issuer `arc-testnet-2026-09` verified, request signature verified |
| Escalated payment (12 USDC to the approved vendor, above the 10 USDC review threshold) | `8d050a43-82a9-4c69-88a3-8ea7436f1749` | escalate / ESCALATION_THRESHOLD | 61419573 | [`0x4cf0dd6a…11221b`](https://testnet.arcscan.app/tx/0x4cf0dd6a21401b242fc4d8ba0a4348a51d722cdda9260e76b4d9879feb11221b) (block 61419577): the contract held the transfer instead of paying, escalation key `0x8d65c003…fb7b55` | `execution/escalated` (onchain outcome matched the verdict), `escalation/pending` | `verifyPaymentReceipt`: ok; digest `0x321e0534…e20c54` verified, issuer `arc-testnet-2026-09` verified, request signature verified |
| Council decision on the hold | `8d050a43-82a9-4c69-88a3-8ea7436f1749` (same receipt) | escalate / ESCALATION_THRESHOLD (the receipt is unchanged; the council acts after it) | 61419573 | [`0x6e9e123c…56b4b7c`](https://testnet.arcscan.app/tx/0x6e9e123cbcdcc9d0e20336bb3239d36f95d01df13ece4d03922fc760556b4b7c) (block 61423511): the council member approved the hold, quorum 1 of 1, and the 12 USDC transfer executed in that transaction | `escalation/released`, appended by linking the hold transaction again once the escalation had been executed; a council outcome is not a verdict claim, so `verdictMatches` is `null` | same envelope as the row above |
| Allowed payment signed by a Circle developer-controlled wallet (0.5 USDC to the approved vendor) | `d6cd633b-c78a-4e67-8bbc-f602ef0a679c` | allow / NONE | 61565033 | [`0x7e62f73b…d619a3`](https://testnet.arcscan.app/tx/0x7e62f73b8281230148f7139b5c7d7339e9f799ec9deda58b7b7cc649add619a3) (block 61565039, `from` = the Circle wallet) | `execution/executed` | `verifyPaymentReceipt`: ok; digest `0xc1cc89fa…74d842a5` verified, issuer `arc-testnet-2026-09` verified, request signature verified |

## Tamper test

A copy of the allowed run's envelope with one field changed in the body
(`amountBaseUnits` 5000000 → 6000000, saved as
`demo-output/tampered-e68e068d.json`) was run through `verifyPaymentReceipt`,
the same verifier the `/verify` page uses. Result: `ok: false`, with each
check reported on its own: `receiptDigest` mismatch (expected
`0x6fea6a19…2654ac6d`, computed `0xd4f9d869…9265fe`), issuer
`invalid_signature` (the signature is over the original digest), request
`amount_mismatch` (signed 5000000, body 6000000). The envelope format itself
is still `valid`, which is the point: a well-formed envelope can still be a
lie, and the verifier says which part.

## Notes

- Wallet: `0x9f044588539DC7FD7C2e666dE55557abC3539b32` ("Receipts demo
  agent"), created at block 61419372 on the v2 contracts listed in the
  README. Agent signer: `0x24a727c925f8be49206442f7e4a67c59ac4c4790`.
- Policy during the runs: per-payment cap 20 USDC, 24-hour budget 40 USDC,
  30-day budget 200 USDC, review threshold 10 USDC (anything above is held
  for the council), approved vendors required, freeze on blocked vendor on,
  all five categories enabled.
- Approved vendor: `0x97c5356fa33d4ccc3e139b2cae7c2ca6086fe75e` ("Demo API
  vendor", category API, no per-vendor cap). The escalated run pays the same
  vendor; only the amount (12 USDC, above the 10 USDC review threshold) sends
  it to the council. The linking rule that produced its evidence rows: the
  attach path accepts the agent's own `executeUSDC` transaction, so the
  council's approve transaction is not linked directly; relinking the hold
  transaction after the release reads the escalation's final state from the
  chain and appends `escalation/released`. The denied run targets
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

## CCTP inbound funding (2026-09-11)

This is a funding deposit, not a Payment Decision Receipt or a governed
outbound payment. It does not change the wallet's policy or signer permissions.
The local `scripts/cctp-fund.ts start 5 --confirm` runner used the existing
Circle developer-controlled signer for both source transactions.

| Field | Verified result |
| --- | --- |
| Route | Ethereum Sepolia (chain 11155111, domain 0) → Arc Testnet (chain 5042002, domain 26), CCTP V2 standard finality; forwarding requested, destination completed by explicit manual relay |
| Source signer | `0xbf4be36ce2614b6c17261a593c937e0442675c39` |
| Destination governed wallet | `0x9f044588539dc7fd7c2e666de55557abc3539b32` |
| Exact approval | [Sepolia `0xa2b17287…53bab21`](https://sepolia.etherscan.io/tx/0xa2b1728738a52047089ab8af7d5b6bed9bf227f810dac379d05848e1a53bab21), success, nonce 0, block 11683432 |
| Source burn | [Sepolia `0xe53412c4…a28bbd9`](https://sepolia.etherscan.io/tx/0xe53412c49a9e3524105e893b48812fa1e7859fb68c27d8160c3b70b82a28bbd9), success, nonce 1, block 11683433 |
| Total burned | 5 USDC; source USDC balance 20 → 15 |
| Reviewed maximum forwarding fee | 0.016921 USDC; minimum received 4.983079 USDC. These were source quote bounds; actual settlement is recorded separately below. |
| Source safety check | Exactly one approval and one burn; source nonce is now 2 and remaining token-messenger allowance is 0 |
| Source gas | 0.000177585240703335 Sepolia ETH across the two successful source transactions |
| Attestation | Circle returned a source-bound V2 attestation with executed finality 2000, nonce `0xd994dfc684d240a4ea97396cc83cb7d7a2e4a0ffdbd63c8d27d840c07be37055` |
| Destination settlement | [Arc `0xe0e35685…2219103`](https://testnet.arcscan.app/tx/0xe0e35685f6544674928af995fe1749ae2cbf1ba9a981b89b37a7710062219103), success, block 61607690, 2026-09-11 18:33:34 UTC |
| Actual amount received | 5 USDC; governed wallet balance 0.5 → 5.5 USDC |
| Actual CCTP fee deducted | 0 USDC, verified against the executed message and mint |
| Manual relay gas | 0.003565276 native USDC, paid separately by the existing Circle signer; below the explicitly approved 0.01-USDC cap |
| Final source check | Sepolia balance remains 15 USDC and transaction count remains 2; no second approval or burn |

The source hash is retained in the durable CLI record under `demo-output/cctp/`.
Status checks are read-only onchain and never repeat the burn.
The bounded watcher originally ended without settlement and retained the pending
guard. After explicit maintainer approval, `scripts/cctp-relay.ts` used the
existing Circle signer to sign one Arc `receiveMessage` transaction with the
same attestation. Its hash was saved before broadcast. SDK verification checked
the source identity, destination calldata, successful receipt, `MessageReceived`
nonce and native-USDC mint. Only then did the regular CLI status path mark the
transfer complete and clear the source guard.

This proves a real CCTP burn, attestation and mint, completed through a
**manual relay**. It does **not** prove successful automatic Circle forwarding.
The reason forwarding did not complete during the observation window is not
established; the version-1 forwarding frame matches Circle's published format.
The local `demo-output/cctp/settlement-evidence.json` retains both chain hashes,
amounts, timestamps and separately accounted gas.
