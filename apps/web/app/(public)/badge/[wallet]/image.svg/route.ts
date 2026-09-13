import { createSupabaseServiceRoleClient } from "@arcanum/api/server";
import { getAddress, isAddress } from "viem";

export const runtime = "nodejs";

const cacheHeaders = {
  // An opted-out profile must not remain publicly embeddable in an intermediary
  // cache after the publication flag changes.
  "Cache-Control": "no-store",
  "Content-Type": "image/svg+xml; charset=utf-8",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ wallet: string }> },
): Promise<Response> {
  const { wallet: encodedWallet } = await params;
  let wallet: string;
  try {
    wallet = decodeURIComponent(encodedWallet);
  } catch {
    return new Response("Invalid wallet address", { status: 400 });
  }
  if (!isAddress(wallet)) {
    return new Response("Invalid wallet address", { status: 400 });
  }

  let address: string;
  try {
    address = getAddress(wallet);
  } catch {
    return new Response("Invalid wallet address", { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) {
    return new Response("Public profile service is unavailable", { status: 503 });
  }

  try {
    const [profile] = await supabase.selectRows("public_wallet_profiles", {
      filters: { wallet_address: address.toLowerCase() },
      limit: 1,
    });
    // A syntactically valid address is not an endorsement. The image is
    // generated only for a profile that explicitly opted into publication.
    if (!profile || (profile.show_public_badge !== true && profile.show_public_badge !== "true")) {
      return new Response("No public governance profile", { status: 404 });
    }
  } catch {
    return new Response("Public profile service is unavailable", { status: 503 });
  }

  const short = `${address.slice(0, 8)}…${address.slice(-6)}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="72" viewBox="0 0 360 72" role="img" aria-labelledby="title desc"><title id="title">Governed by Arcanum</title><desc id="desc">Governance badge for wallet ${address}</desc><rect width="360" height="72" rx="4" fill="#171512"/><rect x="1" y="1" width="358" height="70" rx="3" fill="none" stroke="#5f574b"/><rect x="12" y="12" width="48" height="48" rx="2" fill="#d65936"/><text x="36" y="43" text-anchor="middle" font-family="ui-monospace,monospace" font-size="19" font-weight="700" fill="#fff">A.</text><text x="76" y="31" font-family="ui-sans-serif,system-ui,sans-serif" font-size="16" font-weight="700" fill="#f5f0e8">GOVERNED BY ARCANUM</text><text x="76" y="50" font-family="ui-monospace,monospace" font-size="11" fill="#b8aa98">${short}</text></svg>`;
  return new Response(svg, { headers: cacheHeaders });
}
