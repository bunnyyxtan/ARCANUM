export {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_EXPLORER_URL,
  ARC_TESTNET_RPC_URL,
  ARC_TESTNET_USDC_ADDRESS,
  ARC_TESTNET_WS_URL,
  arcTestnet,
  usdcErc20,
  usdcGas,
} from "./chains/arc-testnet";
export type { Erc20USDC, GasUSDC } from "./chains/arc-testnet";
export {
  ARC_MAINNET_CHAIN_ID,
  ARC_MAINNET_EXPLORER_URL,
  ARC_MAINNET_RPC_URL,
  ARC_MAINNET_USDC_ADDRESS,
  ARC_MAINNET_WS_URL,
  arcMainnet,
} from "./chains/arc-mainnet";
export {
  ARC_CHAIN_ID,
  ARC_EXPLORER_URL,
  ARC_NETWORK,
  ARC_NETWORK_BADGE,
  ARC_NETWORK_NAME,
  ARC_RPC_URL,
  ARC_USDC_ADDRESS,
  ARC_WS_URL,
  IS_ARC_MAINNET,
  arcChain,
} from "./chains/network";
export * from "./workspace";
export * from "./schemas";
