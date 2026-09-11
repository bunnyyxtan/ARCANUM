import { getCctpStatus } from "@/lib/cctp";
import { isAddress, zeroAddress } from "viem";
import { guardRequest, jsonResponse, upstreamError } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rejected = guardRequest(request);
  if (rejected) return rejected;

  const params = new URL(request.url).searchParams;
  const burnTxHash = params.get("burnTxHash");
  const mintTxHash = params.get("mintTxHash");
  const recipient = params.get("recipient");
  if (!burnTxHash || !/^0x[0-9a-fA-F]{64}$/.test(burnTxHash)) {
    return jsonResponse({ error: "Enter a valid Sepolia burn transaction hash." }, 400);
  }
  if (!recipient || !isAddress(recipient, { strict: false }) || recipient === zeroAddress) {
    return jsonResponse({ error: "Enter the destination governed wallet address." }, 400);
  }
  if (mintTxHash !== null && !/^0x[0-9a-fA-F]{64}$/.test(mintTxHash)) {
    return jsonResponse({ error: "Enter a valid Arc mint transaction hash." }, 400);
  }
  try {
    return jsonResponse({
      transfer: await getCctpStatus({
        burnTxHash: burnTxHash as `0x${string}`,
        recipient: recipient as `0x${string}`,
        ...(mintTxHash === null ? {} : { mintTxHash: mintTxHash as `0x${string}` }),
      }),
    });
  } catch (error) {
    return upstreamError(error);
  }
}
