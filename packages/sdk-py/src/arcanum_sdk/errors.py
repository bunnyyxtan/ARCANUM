class ArcanumError(Exception):
    def __init__(self, code: str, verdict: str, reason: str | None = None):
        self.code = code
        self.verdict = verdict
        self.reason = reason
        super().__init__(reason or code)


class PolicyDeniedError(ArcanumError):
    def __init__(self, reason: str):
        super().__init__("POLICY_DENIED", "DENY", reason)


class EscalationRequiredError(ArcanumError):
    def __init__(self, reason: str, escalation_id: str | None = None):
        self.escalation_id = escalation_id
        super().__init__("ESCALATION_REQUIRED", "ESCALATE", reason)


class WalletFrozenError(ArcanumError):
    def __init__(self, reason: str = "WALLET_FROZEN"):
        super().__init__("WALLET_FROZEN", "FREEZE", reason)


class AgentNotAuthorizedError(ArcanumError):
    def __init__(self, agent: str):
        super().__init__("AGENT_NOT_AUTHORIZED", "DENY", f"Signer not authorized: {agent}")


class InsufficientUSDCError(ArcanumError):
    def __init__(self, required: int, available: int):
        super().__init__(
            "INSUFFICIENT_USDC",
            "DENY",
            f"required {required}, available {available}",
        )


class TransferRevertedError(ArcanumError):
    def __init__(self, tx_hash: str, custom_error_name: str | None = None):
        self.tx_hash = tx_hash
        self.custom_error_name = custom_error_name
        super().__init__("TRANSFER_REVERTED", "DENY", custom_error_name)
