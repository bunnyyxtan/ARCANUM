from __future__ import annotations

import asyncio
import json
import threading
from collections.abc import Awaitable, Callable
from typing import Any, Literal

from eth_account.signers.local import LocalAccount
from web3 import AsyncHTTPProvider, AsyncWeb3, Web3

from .abi import (
    ERC20_ABI,
    ESCALATION_MANAGER_ABI,
    GUARDED_WALLET_ABI,
    POLICY_ENGINE_ABI,
    VENDOR_REGISTRY_ABI,
)
from .errors import (
    AgentNotAuthorizedError,
    EscalationRequiredError,
    InsufficientUSDCError,
    PolicyDeniedError,
    TransferRevertedError,
    WalletFrozenError,
)
from .types import (
    ChainConfig,
    Escalation,
    ExecuteUSDCResult,
    JsonMetadata,
    PolicyEnvelope,
    SimulationResult,
    VendorInfo,
)

VERDICTS = ("ALLOW", "ESCALATE", "DENY", "FREEZE")
REASONS = (
    "NONE",
    "ALLOWLIST_REQUIRED",
    "PER_TX_CAP",
    "DAILY_CAP",
    "ESCALATION_THRESHOLD",
    "BLOCKED_VENDOR",
    "CATEGORY_DISABLED",
    "MONTHLY_CAP",
    "PER_VENDOR_CAP",
)
ESCALATION_STATUSES = (
    "PENDING",
    "EXECUTED",
    "REJECTED",
    "EXPIRED",
    "DENIED",
    "CANCELLED",
    "INVALIDATED",
)
ExecutionStep = Literal["DENY", "SUBMIT", "REVERTED", "COMPLETE"]


class ArcanumClient:
    def __init__(
        self,
        wallet_address: str,
        agent_signer: LocalAccount,
        chain: ChainConfig,
        rpc_url: str,
        dashboard_url: str | None = None,
        polling_interval_seconds: float = 4.0,
    ):
        self.wallet_address = Web3.to_checksum_address(wallet_address)
        self.agent_signer = agent_signer
        self.chain = chain
        self.dashboard_url = dashboard_url
        self.polling_interval_seconds = polling_interval_seconds
        self.web3 = Web3(Web3.HTTPProvider(rpc_url))
        self.wallet = self.web3.eth.contract(address=self.wallet_address, abi=GUARDED_WALLET_ABI)

    def get_policy(self) -> PolicyEnvelope:
        policy = self.wallet.functions.policy().call()
        return PolicyEnvelope(*policy)

    def get_daily_spent(self) -> int:
        return self.wallet.functions.dailySpent().call()

    def get_monthly_spent(self) -> int:
        return self.wallet.functions.monthlySpent().call()

    def simulate(self, to: str, amount: int) -> SimulationResult:
        policy_engine = self.wallet.functions.policyEngine().call()
        vendor_registry = self.wallet.functions.vendorRegistry().call()
        engine = self.web3.eth.contract(address=policy_engine, abi=POLICY_ENGINE_ABI)
        verdict, reason = engine.functions.evaluate(
            tuple(self.get_policy().__dict__.values()),
            Web3.to_checksum_address(to),
            amount,
            self.get_daily_spent(),
            self.get_monthly_spent(),
            vendor_registry,
        ).call({"from": self.wallet_address})
        return SimulationResult(VERDICTS[int(verdict)], REASONS[int(reason)])

    def get_vendor(self, address: str) -> VendorInfo:
        registry_address = self.wallet.functions.vendorRegistry().call()
        registry = self.web3.eth.contract(address=registry_address, abi=VENDOR_REGISTRY_ABI)
        vendor = registry.functions.getVendorFor(
            self.wallet_address,
            Web3.to_checksum_address(address),
        ).call()
        return VendorInfo(*vendor)

    def get_escalation(self, escalation_id: str) -> Escalation:
        manager_address = self.wallet.functions.escalationManager().call()
        manager = self.web3.eth.contract(address=manager_address, abi=ESCALATION_MANAGER_ABI)
        values = manager.functions.getEscalation(escalation_id).call()
        return _escalation(values)

    def execute_usdc(
        self,
        to: str,
        amount: int,
        reason: str,
        metadata: JsonMetadata | None = None,
    ) -> ExecuteUSDCResult:
        self._assert_ready()
        simulation = self.simulate(to, amount)
        if _execution_step(simulation.verdict) == "DENY":
            return ExecuteUSDCResult("DENY", error=PolicyDeniedError(simulation.reason))
        if simulation.verdict == "ALLOW":
            self._assert_sufficient_balance(amount)

        nonce = self.web3.eth.get_transaction_count(self.agent_signer.address)
        tx = self.wallet.functions.executeUSDC(
            Web3.to_checksum_address(to),
            amount,
            _reason_bytes(reason, metadata),
        ).build_transaction(
            {
                "from": self.agent_signer.address,
                "nonce": nonce,
                "chainId": int(self.chain["id"]),
            }
        )
        signed = self.agent_signer.sign_transaction(tx)
        tx_hash = self.web3.eth.send_raw_transaction(signed.rawTransaction).hex()
        receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash)
        self._assert_receipt_succeeded(tx_hash, receipt)

        if simulation.verdict == "ESCALATE":
            escalation_id = _find_escalation_id(receipt)
            self._log_escalation_link(escalation_id)
        else:
            escalation_id = None
        return _execution_result(simulation, tx_hash, escalation_id)

    def confirm(self, tx_hash: str) -> Any:
        """Confirm a submitted hash; resubmitting after a timeout can transfer twice."""
        receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash)
        self._assert_receipt_succeeded(tx_hash, receipt)
        return receipt

    def on_escalation_resolved(
        self,
        escalation_id: str,
        callback: Callable[[dict[str, str]], None],
    ) -> Callable[[], None]:
        stop_event = threading.Event()

        manager_address = self.wallet.functions.escalationManager().call()
        manager = self.web3.eth.contract(address=manager_address, abi=ESCALATION_MANAGER_ABI)

        def _poll() -> None:
            last_status = "PENDING"
            while not stop_event.is_set():
                status = ESCALATION_STATUSES[
                    int(manager.functions.statusOf(escalation_id).call())
                ]
                if status != last_status:
                    last_status = status
                    callback({"escalation_id": escalation_id, "status": status})
                stop_event.wait(self.polling_interval_seconds)

        thread = threading.Thread(
            target=_poll,
            name=f"arcanum-escalation-{escalation_id}",
            daemon=True,
        )
        thread.start()

        def stop() -> None:
            stop_event.set()

        return stop

    def _assert_ready(self) -> None:
        signer = Web3.to_checksum_address(self.agent_signer.address)
        if not self.wallet.functions.agentSigners(signer).call():
            raise AgentNotAuthorizedError(signer)
        if self.wallet.functions.frozen().call():
            raise WalletFrozenError()

    def _assert_sufficient_balance(self, amount: int) -> None:
        usdc = self.web3.eth.contract(
            address=Web3.to_checksum_address(self.chain["usdc"]), abi=ERC20_ABI
        )
        balance = usdc.functions.balanceOf(self.wallet_address).call()
        if balance < amount:
            raise InsufficientUSDCError(amount, balance)

    def _assert_receipt_succeeded(self, tx_hash: str, receipt: Any) -> None:
        if _execution_step("ALLOW", _receipt_status(receipt)) == "COMPLETE":
            return
        raise TransferRevertedError(tx_hash, _recover_revert_name(self.web3, tx_hash, receipt))

    def _log_escalation_link(self, escalation_id: str | None) -> None:
        if self.dashboard_url and escalation_id:
            print(
                f"Arcanum escalation queued: "
                f"{self.dashboard_url}/escalations?focus={escalation_id}"
            )


class AsyncArcanumClient:
    def __init__(
        self,
        wallet_address: str,
        agent_signer: LocalAccount,
        chain: ChainConfig,
        rpc_url: str,
        dashboard_url: str | None = None,
        polling_interval_seconds: float = 4.0,
    ):
        self.wallet_address = Web3.to_checksum_address(wallet_address)
        self.agent_signer = agent_signer
        self.chain = chain
        self.dashboard_url = dashboard_url
        self.polling_interval_seconds = polling_interval_seconds
        self.web3 = AsyncWeb3(AsyncHTTPProvider(rpc_url))
        self.wallet = self.web3.eth.contract(address=self.wallet_address, abi=GUARDED_WALLET_ABI)

    async def get_policy(self) -> PolicyEnvelope:
        policy = await self.wallet.functions.policy().call()
        return PolicyEnvelope(*policy)

    async def get_daily_spent(self) -> int:
        return await self.wallet.functions.dailySpent().call()

    async def get_monthly_spent(self) -> int:
        return await self.wallet.functions.monthlySpent().call()

    async def simulate(self, to: str, amount: int) -> SimulationResult:
        policy_engine = await self.wallet.functions.policyEngine().call()
        vendor_registry = await self.wallet.functions.vendorRegistry().call()
        engine = self.web3.eth.contract(address=policy_engine, abi=POLICY_ENGINE_ABI)
        policy = await self.get_policy()
        verdict, reason = await engine.functions.evaluate(
            tuple(policy.__dict__.values()),
            Web3.to_checksum_address(to),
            amount,
            await self.get_daily_spent(),
            await self.get_monthly_spent(),
            vendor_registry,
        ).call({"from": self.wallet_address})
        return SimulationResult(VERDICTS[int(verdict)], REASONS[int(reason)])

    async def get_escalation(self, escalation_id: str) -> Escalation:
        manager_address = await self.wallet.functions.escalationManager().call()
        manager = self.web3.eth.contract(address=manager_address, abi=ESCALATION_MANAGER_ABI)
        values = await manager.functions.getEscalation(escalation_id).call()
        return _escalation(values)

    async def execute_usdc(
        self,
        to: str,
        amount: int,
        reason: str,
        metadata: JsonMetadata | None = None,
    ) -> ExecuteUSDCResult:
        await self._assert_ready()
        simulation = await self.simulate(to, amount)
        if _execution_step(simulation.verdict) == "DENY":
            return ExecuteUSDCResult("DENY", error=PolicyDeniedError(simulation.reason))
        if simulation.verdict == "ALLOW":
            await self._assert_sufficient_balance(amount)

        nonce = await self.web3.eth.get_transaction_count(self.agent_signer.address)
        tx = await self.wallet.functions.executeUSDC(
            Web3.to_checksum_address(to),
            amount,
            _reason_bytes(reason, metadata),
        ).build_transaction(
            {
                "from": self.agent_signer.address,
                "nonce": nonce,
                "chainId": int(self.chain["id"]),
            }
        )
        signed = self.agent_signer.sign_transaction(tx)
        tx_hash = (await self.web3.eth.send_raw_transaction(signed.rawTransaction)).hex()
        receipt = await self.web3.eth.wait_for_transaction_receipt(tx_hash)
        await self._assert_receipt_succeeded(tx_hash, receipt)

        if simulation.verdict == "ESCALATE":
            escalation_id = _find_escalation_id(receipt)
            self._log_escalation_link(escalation_id)
        else:
            escalation_id = None
        return _execution_result(simulation, tx_hash, escalation_id)

    async def confirm(self, tx_hash: str) -> Any:
        """Confirm a submitted hash; resubmitting after a timeout can transfer twice."""
        receipt = await self.web3.eth.wait_for_transaction_receipt(tx_hash)
        await self._assert_receipt_succeeded(tx_hash, receipt)
        return receipt

    async def on_escalation_resolved(
        self,
        escalation_id: str,
        callback: Callable[[dict[str, str]], Awaitable[None]],
    ) -> None:
        manager_address = await self.wallet.functions.escalationManager().call()
        manager = self.web3.eth.contract(address=manager_address, abi=ESCALATION_MANAGER_ABI)
        last_status = "PENDING"
        while True:
            status_index = int(await manager.functions.statusOf(escalation_id).call())
            status = ESCALATION_STATUSES[status_index]
            if status != last_status:
                last_status = status
                await callback({"escalation_id": escalation_id, "status": status})
            await asyncio.sleep(self.polling_interval_seconds)

    async def _assert_ready(self) -> None:
        signer = Web3.to_checksum_address(self.agent_signer.address)
        if not await self.wallet.functions.agentSigners(signer).call():
            raise AgentNotAuthorizedError(signer)
        if await self.wallet.functions.frozen().call():
            raise WalletFrozenError()

    async def _assert_sufficient_balance(self, amount: int) -> None:
        usdc = self.web3.eth.contract(
            address=Web3.to_checksum_address(self.chain["usdc"]), abi=ERC20_ABI
        )
        balance = await usdc.functions.balanceOf(self.wallet_address).call()
        if balance < amount:
            raise InsufficientUSDCError(amount, balance)

    async def _assert_receipt_succeeded(self, tx_hash: str, receipt: Any) -> None:
        if _execution_step("ALLOW", _receipt_status(receipt)) == "COMPLETE":
            return
        error_name = await _recover_revert_name_async(self.web3, tx_hash, receipt)
        raise TransferRevertedError(tx_hash, error_name)

    def _log_escalation_link(self, escalation_id: str | None) -> None:
        if self.dashboard_url and escalation_id:
            print(
                f"Arcanum escalation queued: "
                f"{self.dashboard_url}/escalations?focus={escalation_id}"
            )


def _reason_bytes(reason: str, metadata: JsonMetadata | None) -> bytes:
    payload = reason if metadata is None else json.dumps({"reason": reason, "metadata": metadata})
    return payload.encode("utf-8")


def _find_escalation_id(receipt: Any) -> str | None:
    event = next(
        entry
        for entry in GUARDED_WALLET_ABI
        if entry.get("type") == "event" and entry.get("name") == "TransferEscalated"
    )
    signature = f"{event['name']}({','.join(item['type'] for item in event['inputs'])})"
    event_topic = Web3.keccak(text=signature).hex().lower()
    for log in receipt.get("logs", []):
        topics = log.get("topics", [])
        if len(topics) > 1 and _hex(topics[0]).lower() == event_topic:
            return _hex(topics[1])
    return None


def _execution_step(verdict: str, receipt_status: int | None = None) -> ExecutionStep:
    if receipt_status is not None:
        return "COMPLETE" if receipt_status == 1 else "REVERTED"
    return "DENY" if verdict == "DENY" else "SUBMIT"


def _execution_result(
    simulation: SimulationResult, tx_hash: str, escalation_id: str | None
) -> ExecuteUSDCResult:
    if simulation.verdict == "ESCALATE":
        return ExecuteUSDCResult(
            "ESCALATE",
            tx_hash=tx_hash,
            escalation_id=escalation_id,
            error=EscalationRequiredError(simulation.reason, escalation_id),
        )
    if simulation.verdict == "FREEZE":
        return ExecuteUSDCResult(
            "FREEZE", tx_hash=tx_hash, error=WalletFrozenError(simulation.reason)
        )
    return ExecuteUSDCResult("ALLOW", tx_hash=tx_hash)


def _receipt_status(receipt: Any) -> int:
    status = receipt.get("status")
    if isinstance(status, str):
        return int(status, 16) if status.startswith("0x") else int(status)
    return int(status)


def _escalation(values: Any) -> Escalation:
    return Escalation(
        wallet=values[0],
        to=values[1],
        amount=values[2],
        reason=values[3],
        created_at=values[4],
        expires_at=values[5],
        threshold=values[6],
        signatures_count=values[7],
        status=ESCALATION_STATUSES[int(values[8])],
        policy_version=values[9],
        held_council_version=values[10],
    )


def _hex(value: Any) -> str:
    return value if isinstance(value, str) else value.hex()


def _error_name(value: object) -> str | None:
    revert_data = _find_revert_data(value)
    if revert_data is None:
        return None
    selector = revert_data[:10].lower()
    for entry in GUARDED_WALLET_ABI:
        if entry.get("type") != "error":
            continue
        signature = f"{entry['name']}({','.join(item['type'] for item in entry['inputs'])})"
        if Web3.keccak(text=signature).hex()[:10].lower() == selector:
            return str(entry["name"])
    return None


def _find_revert_data(value: object) -> str | None:
    if isinstance(value, str):
        return value if value.startswith("0x") and len(value) >= 10 else None
    if isinstance(value, dict):
        for nested in value.values():
            found = _find_revert_data(nested)
            if found is not None:
                return found
    if isinstance(value, (list, tuple)):
        for nested in value:
            found = _find_revert_data(nested)
            if found is not None:
                return found
    for attribute in ("data", "args"):
        if hasattr(value, attribute):
            found = _find_revert_data(getattr(value, attribute))
            if found is not None:
                return found
    return None


def _call_input(transaction: Any) -> dict[str, object]:
    return {
        "from": transaction["from"],
        "to": transaction["to"],
        "data": transaction["input"],
        "value": transaction["value"],
    }


def _recover_revert_name(web3: Web3, tx_hash: str, receipt: Any) -> str | None:
    try:
        transaction = web3.eth.get_transaction(tx_hash)
        web3.eth.call(_call_input(transaction), block_identifier=receipt["blockNumber"])
    except Exception as error:
        return _error_name(error)
    return None


async def _recover_revert_name_async(
    web3: AsyncWeb3, tx_hash: str, receipt: Any
) -> str | None:
    try:
        transaction = await web3.eth.get_transaction(tx_hash)
        await web3.eth.call(_call_input(transaction), block_identifier=receipt["blockNumber"])
    except Exception as error:
        return _error_name(error)
    return None
