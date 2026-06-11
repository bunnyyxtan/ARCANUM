GUARDED_WALLET_ABI = [
    {"type": "function", "name": "policy", "inputs": [], "outputs": [{"type": "tuple", "components": [
        {"name": "perTxCap", "type": "uint256"},
        {"name": "daily24hCap", "type": "uint256"},
        {"name": "monthlyRollingCap", "type": "uint256"},
        {"name": "allowedCategories", "type": "uint256"},
        {"name": "escalationThreshold", "type": "uint256"},
        {"name": "requireAllowlist", "type": "bool"},
    ]}], "stateMutability": "view"},
    {"type": "function", "name": "dailySpent", "inputs": [], "outputs": [{"type": "uint256"}], "stateMutability": "view"},
    {"type": "function", "name": "policyEngine", "inputs": [], "outputs": [{"type": "address"}], "stateMutability": "view"},
    {"type": "function", "name": "vendorRegistry", "inputs": [], "outputs": [{"type": "address"}], "stateMutability": "view"},
    {"type": "function", "name": "escalationManager", "inputs": [], "outputs": [{"type": "address"}], "stateMutability": "view"},
    {"type": "function", "name": "agentSigners", "inputs": [{"type": "address"}], "outputs": [{"type": "bool"}], "stateMutability": "view"},
    {"type": "function", "name": "frozen", "inputs": [], "outputs": [{"type": "bool"}], "stateMutability": "view"},
    {"type": "function", "name": "executeUSDC", "inputs": [{"type": "address"}, {"type": "uint256"}, {"type": "bytes"}], "outputs": [], "stateMutability": "nonpayable"},
]

POLICY_ENGINE_ABI = [
    {"type": "function", "name": "evaluate", "inputs": [
        {"type": "tuple", "components": [
            {"name": "perTxCap", "type": "uint256"},
            {"name": "daily24hCap", "type": "uint256"},
            {"name": "monthlyRollingCap", "type": "uint256"},
            {"name": "allowedCategories", "type": "uint256"},
            {"name": "escalationThreshold", "type": "uint256"},
            {"name": "requireAllowlist", "type": "bool"},
        ]},
        {"type": "address"},
        {"type": "uint256"},
        {"type": "uint256"},
        {"type": "address"},
    ], "outputs": [{"type": "uint8"}, {"type": "uint8"}], "stateMutability": "view"},
]

VENDOR_REGISTRY_ABI = [
    {"type": "function", "name": "getVendorFor", "inputs": [{"type": "address"}, {"type": "address"}], "outputs": [{"type": "tuple", "components": [
        {"name": "allowed", "type": "bool"},
        {"name": "blocked", "type": "bool"},
        {"name": "category", "type": "uint8"},
        {"name": "perVendorCap", "type": "uint256"},
        {"name": "metadataHash", "type": "bytes32"},
    ]}], "stateMutability": "view"},
]

ESCALATION_MANAGER_ABI = [
    {"type": "function", "name": "statusOf", "inputs": [{"type": "bytes32"}], "outputs": [{"type": "uint8"}], "stateMutability": "view"},
]

ERC20_ABI = [
    {"type": "function", "name": "balanceOf", "inputs": [{"type": "address"}], "outputs": [{"type": "uint256"}], "stateMutability": "view"},
]
