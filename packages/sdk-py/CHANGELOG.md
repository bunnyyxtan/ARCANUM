# Changelog

## 3.0.0

- Updated generated ABI fragments and SDK types for contracts v2.
- Renamed retry metadata terminology to `reference`; references do not make retries idempotent.
- Added receipt-status enforcement, `confirm(tx_hash)`, and `TransferRevertedError`.