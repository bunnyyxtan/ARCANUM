import importlib
import json
from pathlib import Path

import pytest

from arcanum_sdk import chains

SPEC_PATH = (
    Path(__file__).resolve().parents[2]
    / "shared"
    / "src"
    / "chains"
    / ("network-metadata.test.json")
)


def test_python_defaults_match_shared_typescript_network_metadata(monkeypatch):
    for name in (
        "ARC_MAINNET_RPC_URL",
        "ARC_MAINNET_EXPLORER_URL",
        "ARC_MAINNET_USDC_ADDRESS",
        "ARC_NETWORK",
    ):
        monkeypatch.delenv(name, raising=False)
    defaults = importlib.reload(chains)
    metadata = json.loads(SPEC_PATH.read_text(encoding="utf-8"))

    assert {
        "chainId": defaults.ARC_TESTNET_CHAIN_ID,
        "name": defaults.arc_testnet["name"],
        "rpcUrl": defaults.ARC_TESTNET_RPC_URL,
        "explorerUrl": defaults.ARC_TESTNET_EXPLORER_URL,
        "usdcAddress": defaults.ARC_TESTNET_USDC_ADDRESS,
    } == metadata["testnet"]
    assert {
        "chainId": defaults.ARC_MAINNET_CHAIN_ID,
        "name": defaults.arc_mainnet["name"],
        "rpcUrl": defaults.ARC_MAINNET_RPC_URL,
        "explorerUrl": defaults.ARC_MAINNET_EXPLORER_URL,
        "usdcAddress": defaults.ARC_MAINNET_USDC_ADDRESS,
    } == metadata["mainnet"]

    # Python intentionally publishes snake_case dictionaries and no WebSocket
    # endpoint. The common spec verifies facts, not language-specific shapes.
    assert set(defaults.arc_testnet) == {"id", "name", "rpc_url", "explorer_url", "usdc"}


def test_resolve_chain_normalizes_explicit_and_environment_names(monkeypatch):
    monkeypatch.setenv("ARC_NETWORK", " MAINNET ")

    assert chains.resolve_chain() is chains.arc_mainnet
    assert chains.resolve_chain(" TestNet ") is chains.arc_testnet

    with pytest.raises(ValueError, match="Invalid Arc network"):
        chains.resolve_chain("devnet")
