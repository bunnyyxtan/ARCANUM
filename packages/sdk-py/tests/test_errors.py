from arcanum_sdk import PolicyDeniedError, WalletFrozenError


def test_policy_denied_error_shape():
    error = PolicyDeniedError("PER_TX_CAP")

    assert error.code == "POLICY_DENIED"
    assert error.verdict == "DENY"
    assert error.reason == "PER_TX_CAP"


def test_wallet_frozen_error_shape():
    error = WalletFrozenError("BLOCKED_VENDOR")

    assert error.code == "WALLET_FROZEN"
    assert error.verdict == "FREEZE"
    assert error.reason == "BLOCKED_VENDOR"
