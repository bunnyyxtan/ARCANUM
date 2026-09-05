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

# Circle publishes the mainnet chain parameters at launch, so every mainnet
# value is read from the environment instead of being guessed here. The chain id
# has no default on purpose: it is signed into every transaction, so a guessed
# value produces transactions the network rejects. Mainnet is a configuration
# change, not a code change.
ARC_MAINNET_CHAIN_ID = int(os.getenv("ARC_MAINNET_CHAIN_ID") or 0)
ARC_MAINNET_RPC_URL = os.getenv("ARC_MAINNET_RPC_URL", "")
ARC_MAINNET_EXPLORER_URL = os.getenv("ARC_MAINNET_EXPLORER_URL", "")
ARC_MAINNET_USDC_ADDRESS = os.getenv("ARC_MAINNET_USDC_ADDRESS", "")

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
    the behaviour they have today. Selecting mainnet before Circle's values are
    configured raises instead of returning a config that would silently read
    the wrong chain or send USDC to the zero address.
    """
    selected = (network or os.getenv("ARC_NETWORK") or "testnet").lower()

    if selected == "testnet":
        return arc_testnet

    if selected != "mainnet":
        raise ValueError(f'Invalid Arc network "{selected}" (expected "testnet" or "mainnet").')

    missing = [
        name
        for name, value in (
            ("ARC_MAINNET_CHAIN_ID", ARC_MAINNET_CHAIN_ID),
            ("ARC_MAINNET_RPC_URL", ARC_MAINNET_RPC_URL),
            ("ARC_MAINNET_USDC_ADDRESS", ARC_MAINNET_USDC_ADDRESS),
        )
        if not value
    ]

    if missing:
        raise ValueError(
            "Arc network is set to mainnet but these values are not configured: "
            + ", ".join(missing)
            + ". Circle publishes them at mainnet launch - set them before switching."
        )

    return arc_mainnet
