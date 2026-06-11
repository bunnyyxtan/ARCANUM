export const GuardedWalletAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "owner_",
        type: "address",
        internalType: "address",
      },
      {
        name: "usdc_",
        type: "address",
        internalType: "address",
      },
      {
        name: "policyEngine_",
        type: "address",
        internalType: "contract IPolicyEngine",
      },
      {
        name: "escalationManager_",
        type: "address",
        internalType: "contract IEscalationManager",
      },
      {
        name: "anomalyOracle_",
        type: "address",
        internalType: "contract IAnomalyOracle",
      },
      {
        name: "vendorRegistry_",
        type: "address",
        internalType: "contract IVendorRegistry",
      },
      {
        name: "initialPolicy",
        type: "tuple",
        internalType: "struct PolicyEnvelope",
        components: [
          {
            name: "perTxCap",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "daily24hCap",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "monthlyRollingCap",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "allowedCategories",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "escalationThreshold",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "requireAllowlist",
            type: "bool",
            internalType: "bool",
          },
        ],
      },
      {
        name: "initialSigners",
        type: "address[]",
        internalType: "address[]",
      },
      {
        name: "escalationCouncil",
        type: "address[]",
        internalType: "address[]",
      },
      {
        name: "escalationThreshold",
        type: "uint8",
        internalType: "uint8",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addSigner",
    inputs: [
      {
        name: "signer",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addVendor",
    inputs: [
      {
        name: "vendor",
        type: "address",
        internalType: "address",
      },
      {
        name: "category",
        type: "uint8",
        internalType: "uint8",
      },
      {
        name: "perVendorCap",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "metadataHash",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "agentSigners",
    inputs: [
      {
        name: "signer",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "authorized",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "anomalyFreezeThresholdBps",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "anomalyOracle",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IAnomalyOracle",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "blockVendor",
    inputs: [
      {
        name: "vendor",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "configureEscalation",
    inputs: [
      {
        name: "requiredSigners",
        type: "address[]",
        internalType: "address[]",
      },
      {
        name: "threshold",
        type: "uint8",
        internalType: "uint8",
      },
      {
        name: "expirySeconds",
        type: "uint64",
        internalType: "uint64",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "dailySpent",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "escalationManager",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IEscalationManager",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "executeEscalatedTransfer",
    inputs: [
      {
        name: "to",
        type: "address",
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "executeUSDC",
    inputs: [
      {
        name: "to",
        type: "address",
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "reason",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "frozen",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lastSpendReset",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "policy",
    inputs: [],
    outputs: [
      {
        name: "perTxCap",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "daily24hCap",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "monthlyRollingCap",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "allowedCategories",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "escalationThreshold",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "requireAllowlist",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "policyEngine",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IPolicyEngine",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "removeSigner",
    inputs: [
      {
        name: "signer",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "removeVendor",
    inputs: [
      {
        name: "vendor",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "rotateModule",
    inputs: [
      {
        name: "module",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "newModule",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setAnomalyFreezeThresholdBps",
    inputs: [
      {
        name: "thresholdBps",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setPolicy",
    inputs: [
      {
        name: "nextPolicy",
        type: "tuple",
        internalType: "struct PolicyEnvelope",
        components: [
          {
            name: "perTxCap",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "daily24hCap",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "monthlyRollingCap",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "allowedCategories",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "escalationThreshold",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "requireAllowlist",
            type: "bool",
            internalType: "bool",
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "sweepNonUSDC",
    inputs: [
      {
        name: "token",
        type: "address",
        internalType: "address",
      },
      {
        name: "to",
        type: "address",
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "triggerFreeze",
    inputs: [
      {
        name: "reason",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "unfreeze",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "usdc",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "vendorRegistry",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IVendorRegistry",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Frozen",
    inputs: [
      {
        name: "wallet",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "reason",
        type: "uint8",
        indexed: true,
        internalType: "enum EscalationReason",
      },
      {
        name: "data",
        type: "bytes",
        indexed: false,
        internalType: "bytes",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ModuleRotated",
    inputs: [
      {
        name: "wallet",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "module",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "newModule",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "NonUSDCSwept",
    inputs: [
      {
        name: "wallet",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "token",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "to",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PolicyUpdated",
    inputs: [
      {
        name: "wallet",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SignerAdded",
    inputs: [
      {
        name: "wallet",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "signer",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SignerRemoved",
    inputs: [
      {
        name: "wallet",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "signer",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TransferEscalated",
    inputs: [
      {
        name: "escalationId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "wallet",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "to",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "reason",
        type: "bytes",
        indexed: false,
        internalType: "bytes",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TransferExecuted",
    inputs: [
      {
        name: "wallet",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "signer",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "to",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Unfrozen",
    inputs: [
      {
        name: "wallet",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "AddressEmptyCode",
    inputs: [
      {
        name: "target",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "AddressInsufficientBalance",
    inputs: [
      {
        name: "account",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "FailedInnerCall",
    inputs: [],
  },
  {
    type: "error",
    name: "FrozenWallet",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidModule",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidPolicy",
    inputs: [],
  },
  {
    type: "error",
    name: "NotAnomalyOracle",
    inputs: [],
  },
  {
    type: "error",
    name: "NotEscalationManager",
    inputs: [],
  },
  {
    type: "error",
    name: "NotOwner",
    inputs: [],
  },
  {
    type: "error",
    name: "NotSigner",
    inputs: [],
  },
  {
    type: "error",
    name: "ProtectedUSDC",
    inputs: [],
  },
  {
    type: "error",
    name: "Reentrancy",
    inputs: [],
  },
  {
    type: "error",
    name: "SafeERC20FailedOperation",
    inputs: [
      {
        name: "token",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "TransferDenied",
    inputs: [
      {
        name: "reason",
        type: "uint8",
        internalType: "enum EscalationReason",
      },
    ],
  },
  {
    type: "error",
    name: "ZeroAddress",
    inputs: [],
  },
] as const;

export const PolicyEngineAbi = [
  {
    type: "function",
    name: "evaluate",
    inputs: [
      {
        name: "policy",
        type: "tuple",
        internalType: "struct PolicyEnvelope",
        components: [
          {
            name: "perTxCap",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "daily24hCap",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "monthlyRollingCap",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "allowedCategories",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "escalationThreshold",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "requireAllowlist",
            type: "bool",
            internalType: "bool",
          },
        ],
      },
      {
        name: "to",
        type: "address",
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "dailySpent",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "vendorRegistry",
        type: "address",
        internalType: "contract IVendorRegistry",
      },
    ],
    outputs: [
      {
        name: "verdict",
        type: "uint8",
        internalType: "enum Verdict",
      },
      {
        name: "reason",
        type: "uint8",
        internalType: "enum EscalationReason",
      },
    ],
    stateMutability: "view",
  },
] as const;

export const EscalationManagerAbi = [
  {
    type: "function",
    name: "approve",
    inputs: [
      {
        name: "escalationId",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "configureWallet",
    inputs: [
      {
        name: "requiredSigners",
        type: "address[]",
        internalType: "address[]",
      },
      {
        name: "threshold",
        type: "uint8",
        internalType: "uint8",
      },
      {
        name: "expirySeconds",
        type: "uint64",
        internalType: "uint64",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getEscalation",
    inputs: [
      {
        name: "escalationId",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "wallet",
        type: "address",
        internalType: "address",
      },
      {
        name: "to",
        type: "address",
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "reason",
        type: "bytes",
        internalType: "bytes",
      },
      {
        name: "createdAt",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "expiresAt",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "threshold",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "signaturesCount",
        type: "uint8",
        internalType: "uint8",
      },
      {
        name: "status",
        type: "uint8",
        internalType: "enum IEscalationManager.Status",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "holdTransfer",
    inputs: [
      {
        name: "to",
        type: "address",
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "reason",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [
      {
        name: "escalationId",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isRequiredSigner",
    inputs: [
      {
        name: "wallet",
        type: "address",
        internalType: "address",
      },
      {
        name: "signer",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "required",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "reject",
    inputs: [
      {
        name: "escalationId",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "signed",
    inputs: [
      {
        name: "escalationId",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "signer",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "signed",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "statusOf",
    inputs: [
      {
        name: "escalationId",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "status",
        type: "uint8",
        internalType: "enum IEscalationManager.Status",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "sweepExpired",
    inputs: [
      {
        name: "escalationId",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "walletNonces",
    inputs: [
      {
        name: "wallet",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "nonce",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "EscalationApproved",
    inputs: [
      {
        name: "escalationId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "signer",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "count",
        type: "uint8",
        indexed: false,
        internalType: "uint8",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "EscalationExecuted",
    inputs: [
      {
        name: "escalationId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "EscalationExpired",
    inputs: [
      {
        name: "escalationId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "EscalationRejected",
    inputs: [
      {
        name: "escalationId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "signer",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TransferEscalated",
    inputs: [
      {
        name: "escalationId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "wallet",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "to",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "reason",
        type: "bytes",
        indexed: false,
        internalType: "bytes",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "WalletRegistered",
    inputs: [
      {
        name: "wallet",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "threshold",
        type: "uint8",
        indexed: false,
        internalType: "uint8",
      },
      {
        name: "expirySeconds",
        type: "uint64",
        indexed: false,
        internalType: "uint64",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "AlreadySigned",
    inputs: [],
  },
  {
    type: "error",
    name: "EscalationExpiredError",
    inputs: [],
  },
  {
    type: "error",
    name: "EscalationMissing",
    inputs: [],
  },
  {
    type: "error",
    name: "EscalationNotExpired",
    inputs: [],
  },
  {
    type: "error",
    name: "EscalationNotPending",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidCouncil",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidThreshold",
    inputs: [],
  },
  {
    type: "error",
    name: "NotRequiredSigner",
    inputs: [],
  },
  {
    type: "error",
    name: "WalletNotRegistered",
    inputs: [],
  },
  {
    type: "error",
    name: "ZeroAddress",
    inputs: [],
  },
] as const;

export const AnomalyOracleAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "oracleSigner_",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "latestSigmaBps",
    inputs: [
      {
        name: "wallet",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "sigmaBps",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "oracleSigner",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "submitScore",
    inputs: [
      {
        name: "wallet",
        type: "address",
        internalType: "address",
      },
      {
        name: "sigmaBps",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "signature",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "triggerFreeze",
    inputs: [
      {
        name: "wallet",
        type: "address",
        internalType: "address",
      },
      {
        name: "reason",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "AnomalyScoreSubmitted",
    inputs: [
      {
        name: "wallet",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "sigmaBps",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "timestamp",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "ECDSAInvalidSignature",
    inputs: [],
  },
  {
    type: "error",
    name: "ECDSAInvalidSignatureLength",
    inputs: [
      {
        name: "length",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "error",
    name: "ECDSAInvalidSignatureS",
    inputs: [
      {
        name: "s",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
  },
  {
    type: "error",
    name: "OracleOptOut",
    inputs: [],
  },
  {
    type: "error",
    name: "SignatureInvalid",
    inputs: [],
  },
  {
    type: "error",
    name: "ThresholdNotMet",
    inputs: [],
  },
  {
    type: "error",
    name: "ZeroAddress",
    inputs: [],
  },
] as const;

export const VendorRegistryAbi = [
  {
    type: "function",
    name: "addVendor",
    inputs: [
      {
        name: "vendor",
        type: "address",
        internalType: "address",
      },
      {
        name: "category",
        type: "uint8",
        internalType: "uint8",
      },
      {
        name: "perVendorCap",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "metadataHash",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "blockVendor",
    inputs: [
      {
        name: "vendor",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getVendor",
    inputs: [
      {
        name: "vendor",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "vendorData",
        type: "tuple",
        internalType: "struct IVendorRegistry.Vendor",
        components: [
          {
            name: "allowed",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "blocked",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "category",
            type: "uint8",
            internalType: "uint8",
          },
          {
            name: "perVendorCap",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "metadataHash",
            type: "bytes32",
            internalType: "bytes32",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVendorFor",
    inputs: [
      {
        name: "wallet",
        type: "address",
        internalType: "address",
      },
      {
        name: "vendor",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "vendorData",
        type: "tuple",
        internalType: "struct IVendorRegistry.Vendor",
        components: [
          {
            name: "allowed",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "blocked",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "category",
            type: "uint8",
            internalType: "uint8",
          },
          {
            name: "perVendorCap",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "metadataHash",
            type: "bytes32",
            internalType: "bytes32",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isAllowed",
    inputs: [
      {
        name: "vendor",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isAllowedFor",
    inputs: [
      {
        name: "wallet",
        type: "address",
        internalType: "address",
      },
      {
        name: "vendor",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isBlocked",
    inputs: [
      {
        name: "vendor",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isBlockedFor",
    inputs: [
      {
        name: "wallet",
        type: "address",
        internalType: "address",
      },
      {
        name: "vendor",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "removeVendor",
    inputs: [
      {
        name: "vendor",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "VendorAdded",
    inputs: [
      {
        name: "wallet",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "vendor",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "category",
        type: "uint8",
        indexed: false,
        internalType: "uint8",
      },
      {
        name: "perVendorCap",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "metadataHash",
        type: "bytes32",
        indexed: false,
        internalType: "bytes32",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "VendorBlocked",
    inputs: [
      {
        name: "wallet",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "vendor",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "VendorRemoved",
    inputs: [
      {
        name: "wallet",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "vendor",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "InvalidCategory",
    inputs: [],
  },
  {
    type: "error",
    name: "ZeroAddress",
    inputs: [],
  },
] as const;

export const WalletFactoryAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "usdc_",
        type: "address",
        internalType: "address",
      },
      {
        name: "policyEngine_",
        type: "address",
        internalType: "contract IPolicyEngine",
      },
      {
        name: "escalationManager_",
        type: "address",
        internalType: "contract IEscalationManager",
      },
      {
        name: "anomalyOracle_",
        type: "address",
        internalType: "contract IAnomalyOracle",
      },
      {
        name: "vendorRegistry_",
        type: "address",
        internalType: "contract IVendorRegistry",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "anomalyOracle",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IAnomalyOracle",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "createWallet",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
      {
        name: "label",
        type: "string",
        internalType: "string",
      },
      {
        name: "initialPolicy",
        type: "tuple",
        internalType: "struct PolicyEnvelope",
        components: [
          {
            name: "perTxCap",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "daily24hCap",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "monthlyRollingCap",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "allowedCategories",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "escalationThreshold",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "requireAllowlist",
            type: "bool",
            internalType: "bool",
          },
        ],
      },
      {
        name: "initialSigners",
        type: "address[]",
        internalType: "address[]",
      },
      {
        name: "escalationCouncil",
        type: "address[]",
        internalType: "address[]",
      },
      {
        name: "escalationThreshold",
        type: "uint8",
        internalType: "uint8",
      },
    ],
    outputs: [
      {
        name: "wallet",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "escalationManager",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IEscalationManager",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nonces",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "nonce",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "policyEngine",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IPolicyEngine",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "predictWallet",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
      {
        name: "label",
        type: "string",
        internalType: "string",
      },
      {
        name: "nonce",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "initialPolicy",
        type: "tuple",
        internalType: "struct PolicyEnvelope",
        components: [
          {
            name: "perTxCap",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "daily24hCap",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "monthlyRollingCap",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "allowedCategories",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "escalationThreshold",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "requireAllowlist",
            type: "bool",
            internalType: "bool",
          },
        ],
      },
      {
        name: "initialSigners",
        type: "address[]",
        internalType: "address[]",
      },
      {
        name: "escalationCouncil",
        type: "address[]",
        internalType: "address[]",
      },
      {
        name: "escalationThreshold",
        type: "uint8",
        internalType: "uint8",
      },
    ],
    outputs: [
      {
        name: "predicted",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "usdc",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "vendorRegistry",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IVendorRegistry",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "WalletCreated",
    inputs: [
      {
        name: "wallet",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "owner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "label",
        type: "string",
        indexed: false,
        internalType: "string",
      },
      {
        name: "timestamp",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "ZeroAddress",
    inputs: [],
  },
] as const;
