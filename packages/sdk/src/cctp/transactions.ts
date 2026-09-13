import {
  type Address,
  type Hex,
  encodeFunctionData,
  getAddress,
  isAddress,
  zeroAddress,
} from "viem";

import {
  CCTP_FINALITY_STANDARD,
  CCTP_FORWARD_HOOK_V1,
  CCTP_ROUTE,
  CCTP_ZERO_BYTES32,
} from "../cctp/constants";
import { type CctpQuote, parseUint256 } from "./quote";

export interface BuildCctpTransactionsInput {
  recipient: Address;
  quote: CctpQuote;
}

export interface CctpTransactions {
  approval: { to: Address; data: Hex };
  burn: { to: Address; data: Hex };
}

const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const cctpTokenMessengerAbi = [
  {
    type: "function",
    name: "depositForBurnWithHook",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

/** Encodes only the two user-submitted calls; it never signs or broadcasts. */
export function buildCctpTransactions(input: BuildCctpTransactionsInput): CctpTransactions {
  const recipient = checkedRecipient(input.recipient);
  const { amount, maxFee } = checkedQuote(input.quote);
  const mintRecipient = `0x${recipient.slice(2).padStart(64, "0")}` as Hex;

  return {
    approval: {
      to: CCTP_ROUTE.sourceUsdc,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [CCTP_ROUTE.sourceTokenMessenger, amount],
      }),
    },
    burn: {
      to: CCTP_ROUTE.sourceTokenMessenger,
      data: encodeFunctionData({
        abi: cctpTokenMessengerAbi,
        functionName: "depositForBurnWithHook",
        args: [
          amount,
          CCTP_ROUTE.destinationDomain,
          mintRecipient,
          CCTP_ROUTE.sourceUsdc,
          CCTP_ZERO_BYTES32,
          maxFee,
          CCTP_FINALITY_STANDARD,
          CCTP_FORWARD_HOOK_V1,
        ],
      }),
    },
  };
}

export function checkedRecipient(value: Address): Address {
  if (typeof value !== "string" || !isAddress(value, { strict: false })) {
    throw new Error("CCTP recipient must be a valid EVM address.");
  }
  const recipient = getAddress(value);
  if (recipient.toLowerCase() === zeroAddress)
    throw new Error("CCTP recipient cannot be the zero address.");
  return recipient;
}

/** Shared validation prevents a stale/tampered JSON quote from being encoded. */
export function checkedQuote(quote: CctpQuote): { amount: bigint; maxFee: bigint } {
  if (!quote || typeof quote !== "object") throw new Error("A CCTP quote is required.");
  const keys = Object.keys(quote);
  const expected = ["amountBaseUnits", "maxFeeBaseUnits", "minimumReceivedBaseUnits", "expiresAt"];
  if (keys.length !== expected.length || keys.some((key) => !expected.includes(key))) {
    throw new Error("CCTP quote contains unsupported fields.");
  }
  if (!Number.isSafeInteger(quote.expiresAt) || quote.expiresAt <= Date.now()) {
    throw new Error("CCTP quote has expired or has an invalid expiry.");
  }
  const amount = parseUint256(quote.amountBaseUnits, "quote amount");
  const maxFee = parseUint256(quote.maxFeeBaseUnits, "quote max fee");
  const minimum = parseUint256(quote.minimumReceivedBaseUnits, "quote minimum received");
  if (amount === 0n || maxFee >= amount || minimum !== amount - maxFee) {
    throw new Error("CCTP quote has invalid amount or fee fields.");
  }
  return { amount, maxFee };
}
