import { defineChain, parseUnits } from "viem";

export type GasUSDC = bigint & { __gas: true };
export type Erc20USDC = bigint & { __erc20: true };

export const ARC_TESTNET_CHAIN_ID = 5_042_002;
export const ARC_TESTNET_RPC_URL = "https://rpc.testnet.arc.network";
export const ARC_TESTNET_WS_URL = "wss://rpc.testnet.arc.network/ws";
export const ARC_TESTNET_EXPLORER_URL = "https://testnet.arcscan.app";
export const ARC_TESTNET_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

export const arcTestnet = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: {
      http: [ARC_TESTNET_RPC_URL],
      webSocket: [ARC_TESTNET_WS_URL],
    },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: ARC_TESTNET_EXPLORER_URL },
  },
  contracts: {
    usdc: { address: ARC_TESTNET_USDC_ADDRESS },
  },
});

export function usdcGas(amount: number): GasUSDC {
  return parseUnits(amount.toString(), 18) as GasUSDC;
}

export function usdcErc20(amount: number): Erc20USDC {
  return parseUnits(amount.toString(), 6) as Erc20USDC;
}
