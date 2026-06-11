# arcanum-sdk

Python SDK for direct GuardedWallet execution on Arc Testnet. It signs
transactions with the caller's agent account and never talks to an
Arcanum-hosted API.

The example below is for local Arc Testnet development. Never hard-code private
keys, commit `.env` files, or paste wallet secrets into issues, screenshots, or
logs.

```python
import os

from arcanum_sdk import ArcanumClient, arc_testnet
from eth_account import Account

agent_signer = Account.from_key(os.environ["AGENT_PRIVATE_KEY"])

arc = ArcanumClient(
    wallet_address="0x0000000000000000000000000000000000000001",
    agent_signer=agent_signer,
    chain=arc_testnet,
    rpc_url=os.environ.get("ARC_TESTNET_RPC", "https://rpc.testnet.arc.network"),
)

result = arc.execute_usdc(
    to="0x0000000000000000000000000000000000000002",
    amount=50_000_000,
    reason="OpenAI API top-up",
    metadata={"category": "API"},
)
```
