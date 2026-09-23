# arcanum-sdk

Python SDK for direct GuardedWallet execution on Arc (mainnet and testnet). It
signs transactions with the caller's agent account and never talks to an
Arcanum-hosted API.

The example below targets Arc Mainnet, where the hosted product runs; mainnet
wallets hold real USDC and the contracts are unaudited, so keep pilot caps
small. For development use `arc_testnet` and `ARC_TESTNET_RPC_URL` instead; the
deployed addresses for both networks are in `packages/contracts/deployments/`.
Never hard-code private keys, commit `.env` files, or paste wallet secrets into
issues, screenshots, or logs.

```python
import os

from eth_account import Account
from arcanum_sdk import ArcanumClient, arc_mainnet

agent_signer = Account.from_key(os.environ["AGENT_PRIVATE_KEY"])

arc = ArcanumClient(
    wallet_address="0x0000000000000000000000000000000000000001",
    agent_signer=agent_signer,
    chain=arc_mainnet,
    rpc_url=arc_mainnet["rpc_url"],
)

result = arc.execute_usdc(
    to="0x0000000000000000000000000000000000000002",
    amount=50_000_000,
    reason="OpenAI API top-up",
    metadata={"category": "API"},
)
```

`reference` values in reason metadata are descriptive, not idempotency keys.
If receipt waiting times out, do not submit the transfer again: retain the hash
and call `arc.confirm(tx_hash)`. Resubmission can transfer funds twice.
