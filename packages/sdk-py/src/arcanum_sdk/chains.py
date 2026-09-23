import os

ARC_TESTNET_CHAIN_ID = 5_042_002
ARC_TESTNET_RPC_URL = "https://rpc.testnet.arc.network"
ARC_TESTNET_EXPLORER_URL = "https://testnet.arcscan.app"
ARC_TESTNET_USDC_ADDRESS = "0x3600000000000000000000000000000000000000"

arc_testnet = {
    "id": ARC_TESTNET_CHAIN_ID,
    "name": "Arc Testnet",
    "rpc_url": ARC_TESTNET_RPC_URL,
    "explorer_url": ARC_TESTNET_EXPLORER_URL,
    "usdc": ARC_TESTNET_USDC_ADDRESS,
}

# Arc Mainnet parameters as published by Circle at the public launch on
# 16 September 2026 (docs.arc.io, "Connect to Arc"). Each value except the chain
# id can be overridden from the environment, for example to use a keyed RPC
# provider. The chain id is fixed by the network: it is signed into every
# transaction, so it is not something to configure.
ARC_MAINNET_CHAIN_ID = 5042
ARC_MAINNET_RPC_URL = os.getenv("ARC_MAINNET_RPC_URL") or "https://rpc.mainnet.arc.io"
ARC_MAINNET_EXPLORER_URL = os.getenv("ARC_MAINNET_EXPLORER_URL") or "https://explorer.arc.io"
ARC_MAINNET_USDC_ADDRESS = (
    os.getenv("ARC_MAINNET_USDC_ADDRESS") or "0x3600000000000000000000000000000000000000"
)

arc_mainnet = {
    "id": ARC_MAINNET_CHAIN_ID,
    "name": "Arc",
    "rpc_url": ARC_MAINNET_RPC_URL,
    "explorer_url": ARC_MAINNET_EXPLORER_URL,
    "usdc": ARC_MAINNET_USDC_ADDRESS,
}


def resolve_chain(network: str | None = None) -> dict:
    """Return the chain config for ``network`` ("testnet" or "mainnet").

    Defaults to ``ARC_NETWORK`` and then to testnet, so existing callers keep
    the behaviour they have today.
    """
    selected = (network or os.getenv("ARC_NETWORK") or "testnet").strip().lower()

    if selected == "testnet":
        return arc_testnet

    if selected != "mainnet":
        raise ValueError(f'Invalid Arc network "{selected}" (expected "testnet" or "mainnet").')

    return arc_mainnet
