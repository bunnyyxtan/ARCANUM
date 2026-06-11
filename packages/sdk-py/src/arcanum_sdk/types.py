from dataclasses import dataclass
from typing import Any, Literal

Verdict = Literal["ALLOW", "ESCALATE", "DENY", "FREEZE"]


@dataclass(frozen=True)
class PolicyEnvelope:
    per_tx_cap: int
    daily_24h_cap: int
    monthly_rolling_cap: int
    allowed_categories: int
    escalation_threshold: int
    require_allowlist: bool


@dataclass(frozen=True)
class VendorInfo:
    allowed: bool
    blocked: bool
    category: int
    per_vendor_cap: int
    metadata_hash: str


@dataclass(frozen=True)
class SimulationResult:
    verdict: Verdict
    reason: str


@dataclass(frozen=True)
class ExecuteUSDCResult:
    verdict: Verdict
    tx_hash: str | None = None
    escalation_id: str | None = None
    error: Exception | None = None


JsonMetadata = dict[str, str | int | bool]
ChainConfig = dict[str, Any]
