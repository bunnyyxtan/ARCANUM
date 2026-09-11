# Changelog

## Unreleased

- Added `arcanum-sdk/circle`: `circleWalletAccount` turns a Circle
  developer-controlled wallet into the agent signer (viem local account over
  Circle's signing API), with every signature and signed transaction verified
  against the request before use. Node.js only.

## 3.0.0

- Updated exported contract ABIs and SDK types for contracts v2, including policy and escalation changes.
- Renamed payment intent `idempotencyKey` to `reference`; references do not make retries idempotent.
- Added receipt-status enforcement, `confirm(txHash)`, and `TransferRevertedError`.
- The workspace remains `@arcanum/sdk` for offline workspace linking; `build:publish`
  writes a deterministic `dist-publish/package.json` named `arcanum-sdk`.