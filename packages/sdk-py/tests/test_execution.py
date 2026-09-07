from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from web3 import Web3

from arcanum_sdk.client import (
    ArcanumClient,
    AsyncArcanumClient,
    _error_name,
    _execution_step,
)
from arcanum_sdk.errors import TransferRevertedError
from arcanum_sdk.types import SimulationResult

TX_HASH = "0x" + "12" * 32
ADDRESS = Web3.to_checksum_address("0x" + "01" * 20)
VENDOR = Web3.to_checksum_address("0x" + "02" * 20)


def sync_client(verdict: str, status: int = 1) -> tuple[ArcanumClient, MagicMock]:
    client = object.__new__(ArcanumClient)
    client.wallet_address = ADDRESS
    client.agent_signer = MagicMock(address=ADDRESS)
    client.agent_signer.sign_transaction.return_value = SimpleNamespace(rawTransaction=b"signed")
    client.chain = {"id": 1, "usdc": ADDRESS}
    client.dashboard_url = None
    client._assert_ready = MagicMock()
    client._assert_sufficient_balance = MagicMock()
    client.simulate = MagicMock(return_value=SimulationResult(verdict, "BLOCKED_VENDOR"))

    execute = MagicMock()
    execute.build_transaction.return_value = {"to": ADDRESS}
    client.wallet = MagicMock()
    client.wallet.functions.executeUSDC.return_value = execute

    eth = MagicMock()
    eth.get_transaction_count.return_value = 0
    eth.send_raw_transaction.return_value.hex.return_value = TX_HASH
    eth.wait_for_transaction_receipt.return_value = {
        "status": status,
        "blockNumber": 10,
        "logs": [],
    }
    eth.get_transaction.side_effect = RuntimeError("historical transaction unavailable")
    client.web3 = MagicMock(eth=eth)
    return client, eth


def async_client(verdict: str, status: int = 1) -> tuple[AsyncArcanumClient, MagicMock]:
    client = object.__new__(AsyncArcanumClient)
    client.wallet_address = ADDRESS
    client.agent_signer = MagicMock(address=ADDRESS)
    client.agent_signer.sign_transaction.return_value = SimpleNamespace(rawTransaction=b"signed")
    client.chain = {"id": 1, "usdc": ADDRESS}
    client.dashboard_url = None
    client._assert_ready = AsyncMock()
    client._assert_sufficient_balance = AsyncMock()
    client.simulate = AsyncMock(return_value=SimulationResult(verdict, "BLOCKED_VENDOR"))

    execute = MagicMock()
    execute.build_transaction = AsyncMock(return_value={"to": ADDRESS})
    client.wallet = MagicMock()
    client.wallet.functions.executeUSDC.return_value = execute

    tx_result = MagicMock()
    tx_result.hex.return_value = TX_HASH
    eth = MagicMock()
    eth.get_transaction_count = AsyncMock(return_value=0)
    eth.send_raw_transaction = AsyncMock(return_value=tx_result)
    eth.wait_for_transaction_receipt = AsyncMock(
        return_value={"status": status, "blockNumber": 10, "logs": []}
    )
    eth.get_transaction = AsyncMock(side_effect=RuntimeError("historical transaction unavailable"))
    client.web3 = MagicMock(eth=eth)
    return client, eth


@pytest.mark.parametrize("verdict", ["ALLOW", "ESCALATE", "DENY", "FREEZE"])
@pytest.mark.asyncio
async def test_sync_and_async_follow_the_same_execution_state_machine(verdict: str):
    sync, sync_eth = sync_client(verdict)
    asynchronous, async_eth = async_client(verdict)

    sync_result = sync.execute_usdc(VENDOR, 1, "invoice", {"reference": "invoice-1"})
    async_result = await asynchronous.execute_usdc(
        VENDOR, 1, "invoice", {"reference": "invoice-1"}
    )

    assert sync_result.verdict == async_result.verdict
    assert sync_result.tx_hash == async_result.tx_hash
    assert sync_result.escalation_id == async_result.escalation_id
    assert type(sync_result.error) is type(async_result.error)
    if sync_result.error is not None and async_result.error is not None:
        assert sync_result.error.args == async_result.error.args
    expected_submissions = 0 if verdict == "DENY" else 1
    assert sync_eth.send_raw_transaction.call_count == expected_submissions
    assert async_eth.send_raw_transaction.await_count == expected_submissions
    assert _execution_step(verdict) == ("DENY" if verdict == "DENY" else "SUBMIT")


@pytest.mark.parametrize("verdict", ["ALLOW", "ESCALATE", "FREEZE"])
@pytest.mark.asyncio
async def test_sync_and_async_raise_for_reverted_receipts(verdict: str):
    sync, _ = sync_client(verdict, status=0)
    asynchronous, _ = async_client(verdict, status=0)

    with pytest.raises(TransferRevertedError) as sync_error:
        sync.execute_usdc(VENDOR, 1, "invoice")
    with pytest.raises(TransferRevertedError) as async_error:
        await asynchronous.execute_usdc(VENDOR, 1, "invoice")

    assert sync_error.value.tx_hash == TX_HASH
    assert async_error.value.tx_hash == TX_HASH


@pytest.mark.asyncio
async def test_confirm_checks_receipt_status_sync_and_async():
    sync, _ = sync_client("ALLOW", status=0)
    asynchronous, _ = async_client("ALLOW", status=0)

    with pytest.raises(TransferRevertedError):
        sync.confirm(TX_HASH)
    with pytest.raises(TransferRevertedError):
        await asynchronous.confirm(TX_HASH)


def test_custom_error_name_is_decoded_from_revert_data():
    selector = Web3.keccak(text="ZeroAmount()").hex()[:10]

    assert _error_name({"data": selector}) == "ZeroAmount"