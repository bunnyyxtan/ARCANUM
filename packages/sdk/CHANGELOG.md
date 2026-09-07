# Changelog

## 3.0.0

- Updated exported contract ABIs and SDK types for contracts v2, including policy and escalation changes.
- Renamed payment intent `idempotencyKey` to `reference`; references do not make retries idempotent.
- Added receipt-status enforcement, `confirm(txHash)`, and `TransferRevertedError`.
- The workspace remains `@arcanum/sdk` for offline workspace linking; `build:publish`
  writes a deterministic `dist-publish/package.json` named `arcanum-sdk`.