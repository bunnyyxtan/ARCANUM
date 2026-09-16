import {
  ARC_MAINNET_CHAIN_ID,
  ARC_MAINNET_EXPLORER_URL,
  ARC_MAINNET_RPC_URL,
  ARC_MAINNET_USDC_ADDRESS,
  ARC_MAINNET_WS_URL,
  arcMainnet,
} from "./arc-mainnet";
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_EXPLORER_URL,
  ARC_TESTNET_RPC_URL,
  ARC_TESTNET_USDC_ADDRESS,
  ARC_TESTNET_WS_URL,
  arcTestnet,
} from "./arc-testnet";

/**
 * Single switch that selects which Arc network the whole system talks to.
 *
 * Defaults to testnet so nothing changes until the switch is flipped
 * deliberately. The mainnet values default to the parameters Circle published
 * at launch; an operator override that blanks one of them fails loudly at
 * startup instead of silently reading the wrong chain.
 */
const publicNetwork = process.env.NEXT_PUBLIC_ARC_NETWORK?.trim().toLowerCase();
const serverNetwork = process.env.ARC_NETWORK?.trim().toLowerCase();

// Both variables name the same switch (the public one exists so the browser
// bundle can see it). A server that has them disagreeing would sign for one
// chain while its pages point at the other, so that is a startup error, not
// a precedence rule.
if (publicNetwork && serverNetwork && publicNetwork !== serverNetwork) {
  throw new Error(
    `NEXT_PUBLIC_ARC_NETWORK="${publicNetwork}" and ARC_NETWORK="${serverNetwork}" disagree; set both to the same Arc network.`,
  );
}

const rawNetwork = publicNetwork || serverNetwork || "testnet";

if (rawNetwork !== "testnet" && rawNetwork !== "mainnet") {
  throw new Error(
    `Invalid Arc network "${rawNetwork}" (set NEXT_PUBLIC_ARC_NETWORK / ARC_NETWORK to "testnet" or "mainnet").`,
  );
}

export const ARC_NETWORK: "testnet" | "mainnet" = rawNetwork;
export const IS_ARC_MAINNET = ARC_NETWORK === "mainnet";

if (IS_ARC_MAINNET) {
  const missing = [
    ["NEXT_PUBLIC_ARC_MAINNET_RPC_URL", ARC_MAINNET_RPC_URL],
    ["NEXT_PUBLIC_ARC_MAINNET_EXPLORER_URL", ARC_MAINNET_EXPLORER_URL],
    ["NEXT_PUBLIC_ARC_MAINNET_USDC_ADDRESS", ARC_MAINNET_USDC_ADDRESS],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Arc network is set to mainnet but these values are blank: ${missing.join(
        ", ",
      )}. Unset the override to use the published Arc Mainnet value, or set a valid one.`,
    );
  }
}

/** The active viem chain - use this instead of arcTestnet/arcMainnet directly. */
export const arcChain = IS_ARC_MAINNET ? arcMainnet : arcTestnet;

export const ARC_CHAIN_ID = IS_ARC_MAINNET ? ARC_MAINNET_CHAIN_ID : ARC_TESTNET_CHAIN_ID;
export const ARC_RPC_URL = IS_ARC_MAINNET ? ARC_MAINNET_RPC_URL : ARC_TESTNET_RPC_URL;
export const ARC_WS_URL = IS_ARC_MAINNET ? ARC_MAINNET_WS_URL : ARC_TESTNET_WS_URL;
export const ARC_EXPLORER_URL = IS_ARC_MAINNET
  ? ARC_MAINNET_EXPLORER_URL
  : ARC_TESTNET_EXPLORER_URL;
export const ARC_USDC_ADDRESS = (
  IS_ARC_MAINNET ? ARC_MAINNET_USDC_ADDRESS : ARC_TESTNET_USDC_ADDRESS
) as `0x${string}`;

export const ARC_NETWORK_NAME = IS_ARC_MAINNET ? "Arc Mainnet" : "Arc Testnet";
export const ARC_NETWORK_BADGE = IS_ARC_MAINNET ? "ARC MAINNET" : "ARC TESTNET";
