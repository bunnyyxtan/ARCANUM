import { defineChain } from "viem";

/**
 * Arc Mainnet parameters.
 *
 * Circle has not published the mainnet chain params yet (as of Aug 2026 the
 * docs say they arrive "separately when available"). Every value therefore
 * comes from the environment so that launch day is a config change, not a
 * code change. Chain id 5042 is the strongly signalled default (viem chain
 * definition authored by Circle + The Graph registry) and can be overridden
 * the moment Circle confirms.
 *
 * NEXT_PUBLIC_* reads must stay literal property accesses so Next.js can
 * inline them into the browser bundle at build time.
 */
export const ARC_MAINNET_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_ARC_MAINNET_CHAIN_ID ?? process.env.ARC_MAINNET_CHAIN_ID ?? 5042,
);
export const ARC_MAINNET_RPC_URL =
  process.env.NEXT_PUBLIC_ARC_MAINNET_RPC_URL ?? process.env.ARC_MAINNET_RPC_URL ?? "";
export const ARC_MAINNET_WS_URL =
  process.env.NEXT_PUBLIC_ARC_MAINNET_WS_URL ?? process.env.ARC_MAINNET_WS_URL ?? "";
export const ARC_MAINNET_EXPLORER_URL =
  process.env.NEXT_PUBLIC_ARC_MAINNET_EXPLORER_URL ?? process.env.ARC_MAINNET_EXPLORER_URL ?? "";
export const ARC_MAINNET_USDC_ADDRESS =
  process.env.NEXT_PUBLIC_ARC_MAINNET_USDC_ADDRESS ?? process.env.ARC_MAINNET_USDC_ADDRESS ?? "";

export const arcMainnet = defineChain({
  id: ARC_MAINNET_CHAIN_ID,
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: {
      http: [ARC_MAINNET_RPC_URL].filter(Boolean),
      webSocket: [ARC_MAINNET_WS_URL].filter(Boolean),
    },
  },
  ...(ARC_MAINNET_EXPLORER_URL
    ? { blockExplorers: { default: { name: "Arcscan", url: ARC_MAINNET_EXPLORER_URL } } }
    : {}),
  ...(ARC_MAINNET_USDC_ADDRESS
    ? { contracts: { usdc: { address: ARC_MAINNET_USDC_ADDRESS as `0x${string}` } } }
    : {}),
});
