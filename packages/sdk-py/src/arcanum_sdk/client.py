from __future__ import annotations

import asyncio
import json
import time
from collections.abc import Awaitable, Callable
from typing import Any

from eth_account.signers.local import LocalAccount
from web3 import AsyncHTTPProvider, AsyncWeb3, Web3

from .abi import (
    ERC20_ABI,
    ESCALATION_MANAGER_ABI,
    GUARDED_WALLET_ABI,
    POLICY_ENGINE_ABI,
    VENDOR_REGISTRY_ABI,
)
from .chains import ARC_TESTNET_USDC_ADDRESS
from .errors import (
    AgentNotAuthorizedError,
    EscalationRequiredError,
    InsufficientUSDCError,
    PolicyDeniedError,
    WalletFrozenError,
)
from .types import (
    ChainConfig,
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
)
ESCALATION_STATUSES = ("PENDING", "EXECUTED", "REJECTED", "EXPIRED")


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

    def simulate(self, to: str, amount: int) -> SimulationResult:
        policy_engine = self.wallet.functions.policyEngine().call()
        vendor_registry = self.wallet.functions.vendorRegistry().call()
        engine = self.web3.eth.contract(address=policy_engine, abi=POLICY_ENGINE_ABI)
        verdict, reason = engine.functions.evaluate(
            tuple(self.get_policy().__dict__.values()),
            Web3.to_checksum_address(to),
            amount,
            self.get_daily_spent(),
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

    def execute_usdc(
        self,
        to: str,
        amount: int,
        reason: str,
        metadata: JsonMetadata | None = None,
    ) -> ExecuteUSDCResult:
        self._assert_ready(amount)
        simulation = self.simulate(to, amount)
        if simulation.verdict == "DENY":
            return ExecuteUSDCResult("DENY", error=PolicyDeniedError(simulation.reason))
        if simulation.verdict == "FREEZE":
            return ExecuteUSDCResult("FREEZE", error=WalletFrozenError(simulation.reason))

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

        if simulation.verdict == "ESCALATE":
            escalation_id = _find_escalation_id(receipt)
            self._log_escalation_link(escalation_id)
            return ExecuteUSDCResult(
                "ESCALATE",
                escalation_id=escalation_id,
                error=EscalationRequiredError(simulation.reason, escalation_id),
            )

        return ExecuteUSDCResult("ALLOW", tx_hash=tx_hash)

    def on_escalation_resolved(
        self,
        escalation_id: str,
        callback: Callable[[dict[str, str]], None],
    ) -> Callable[[], None]:
        stopped = False

        def stop() -> None:
            nonlocal stopped
            stopped = True

        manager_address = self.wallet.functions.escalationManager().call()
        manager = self.web3.eth.contract(address=manager_address, abi=ESCALATION_MANAGER_ABI)
        last_status = "PENDING"

        while not stopped:
            status = ESCALATION_STATUSES[int(manager.functions.statusOf(escalation_id).call())]
            if status != last_status:
                last_status = status
                callback({"escalation_id": escalation_id, "status": status})
            time.sleep(self.polling_interval_seconds)

        return stop

    def _assert_ready(self, amount: int) -> None:
        signer = Web3.to_checksum_address(self.agent_signer.address)
        if not self.wallet.functions.agentSigners(signer).call():
            raise AgentNotAuthorizedError(signer)
        if self.wallet.functions.frozen().call():
            raise WalletFrozenError()
        usdc = self.web3.eth.contract(address=ARC_TESTNET_USDC_ADDRESS, abi=ERC20_ABI)
        balance = usdc.functions.balanceOf(self.wallet_address).call()
        if balance < amount:
            raise InsufficientUSDCError(amount, balance)

    def _log_escalation_link(self, escalation_id: str | None) -> None:
        if self.dashboard_url and escalation_id:
            print(f"Arcanum escalation queued: {self.dashboard_url}/escalations?focus={escalation_id}")


class AsyncArcanumClient:
    def __init__(
        self,
        wallet_address: str,
        agent_signer: LocalAccount,
        chain: ChainConfig,
        rpc_url: str,
    ):
        self.wallet_address = Web3.to_checksum_address(wallet_address)
        self.agent_signer = agent_signer
        self.chain = chain
        self.web3 = AsyncWeb3(AsyncHTTPProvider(rpc_url))
        self.wallet = self.web3.eth.contract(address=self.wallet_address, abi=GUARDED_WALLET_ABI)

    async def get_policy(self) -> PolicyEnvelope:
        policy = await self.wallet.functions.policy().call()
        return PolicyEnvelope(*policy)

    async def get_daily_spent(self) -> int:
        return await self.wallet.functions.dailySpent().call()

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
            vendor_registry,
        ).call({"from": self.wallet_address})
        return SimulationResult(VERDICTS[int(verdict)], REASONS[int(reason)])

    async def execute_usdc(
        self,
        to: str,
        amount: int,
        reason: str,
        metadata: JsonMetadata | None = None,
    ) -> ExecuteUSDCResult:
        simulation = await self.simulate(to, amount)
        if simulation.verdict == "DENY":
            return ExecuteUSDCResult("DENY", error=PolicyDeniedError(simulation.reason))
        if simulation.verdict == "FREEZE":
            return ExecuteUSDCResult("FREEZE", error=WalletFrozenError(simulation.reason))

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
        return ExecuteUSDCResult(simulation.verdict, tx_hash=tx_hash if simulation.verdict == "ALLOW" else None)

    async def on_escalation_resolved(
        self,
        escalation_id: str,
        callback: Callable[[dict[str, str]], Awaitable[None]],
    ) -> None:
        manager_address = await self.wallet.functions.escalationManager().call()
        manager = self.web3.eth.contract(address=manager_address, abi=ESCALATION_MANAGER_ABI)
        last_status = "PENDING"
        while True:
            status = ESCALATION_STATUSES[int(await manager.functions.statusOf(escalation_id).call())]
            if status != last_status:
                last_status = status
                await callback({"escalation_id": escalation_id, "status": status})
            await asyncio.sleep(4)


def _reason_bytes(reason: str, metadata: JsonMetadata | None) -> bytes:
    payload: str = reason if metadata is None else json.dumps({"reason": reason, "metadata": metadata})
    return payload.encode("utf-8")


def _find_escalation_id(receipt: Any) -> str | None:
    for log in receipt.get("logs", []):
        topics = log.get("topics", [])
        if len(topics) > 1:
            return topics[1].hex()
    return None
