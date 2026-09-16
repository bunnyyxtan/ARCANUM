import { defineChain } from "viem";

/**
 * Arc Mainnet parameters.
 *
 * Circle published the mainnet chain parameters with the public launch on
 * 16 September 2026 (docs.arc.io, "Connect to Arc"). The published values are
 * the defaults below; each can still be overridden from the environment so an
 * operator can point at a keyed RPC provider or a different explorer without a
 * code change. The chain id is fixed by the network and is not overridable.
 *
 * There is no public WebSocket endpoint on the default RPC host, so the
 * WebSocket URL stays empty unless an operator supplies a provider that offers
 * one.
 *
 * NEXT_PUBLIC_* reads must stay literal property accesses so Next.js can
 * inline them into the browser bundle at build time.
 */
export const ARC_MAINNET_CHAIN_ID = 5042;
export const ARC_MAINNET_RPC_URL =
  process.env.NEXT_PUBLIC_ARC_MAINNET_RPC_URL ??
  process.env.ARC_MAINNET_RPC_URL ??
  "https://rpc.mainnet.arc.io";
export const ARC_MAINNET_WS_URL =
  process.env.NEXT_PUBLIC_ARC_MAINNET_WS_URL ?? process.env.ARC_MAINNET_WS_URL ?? "";
export const ARC_MAINNET_EXPLORER_URL =
  process.env.NEXT_PUBLIC_ARC_MAINNET_EXPLORER_URL ??
  process.env.ARC_MAINNET_EXPLORER_URL ??
  "https://explorer.arc.io";
/** USDC is the native asset on Arc; this precompile exposes the ERC-20 view of it. */
export const ARC_MAINNET_USDC_ADDRESS = (process.env.NEXT_PUBLIC_ARC_MAINNET_USDC_ADDRESS ??
  process.env.ARC_MAINNET_USDC_ADDRESS ??
  "0x3600000000000000000000000000000000000000") as `0x${string}`;

export const arcMainnet = defineChain({
  id: ARC_MAINNET_CHAIN_ID,
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: {
      http: [ARC_MAINNET_RPC_URL],
      webSocket: [ARC_MAINNET_WS_URL].filter(Boolean),
    },
  },
  blockExplorers: { default: { name: "Arc Explorer", url: ARC_MAINNET_EXPLORER_URL } },
  contracts: { usdc: { address: ARC_MAINNET_USDC_ADDRESS } },
});
