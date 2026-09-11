import type { Address, Hex } from "viem";

/**
 * Immutable CCTP v2 route. These are Circle contracts, not Arcanum deployments.
 *
 * Sources:
 * - https://developers.circle.com/cctp/references/contract-addresses
 * - https://developers.circle.com/cctp/quickstarts/transfer-usdc-ethereum-to-arc
 */
export const CCTP_ROUTE = {
  sourceChainId: 11_155_111,
  destinationChainId: 5_042_002,
  sourceDomain: 0,
  destinationDomain: 26,
  sourceUsdc: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238" as Address,
  sourceTokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as Address,
  sourceMessageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as Address,
  destinationTokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as Address,
  destinationMessageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as Address,
  destinationUsdc: "0x3600000000000000000000000000000000000000" as Address,
  sourceRpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
  destinationRpcUrl: "https://rpc.testnet.arc.network",
  sourceExplorerUrl: "https://sepolia.etherscan.io",
  destinationExplorerUrl: "https://testnet.arcscan.app",
} as const;

export const CCTP_FINALITY_STANDARD = 2_000;
export const CCTP_FORWARD_HOOK_V1 =
  "0x636374702d666f72776172640000000000000000000000000000000100000000" as Hex;
export const CCTP_ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;
export const CCTP_IRIS_URL = "https://iris-api-sandbox.circle.com";
export const CCTP_QUOTE_TTL_MS = 120_000;
