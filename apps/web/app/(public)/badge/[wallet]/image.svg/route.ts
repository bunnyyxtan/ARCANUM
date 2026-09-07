import { getAddress, isAddress } from "viem";

const cacheHeaders = {
  "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  "Content-Type": "image/svg+xml; charset=utf-8",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ wallet: string }> },
): Promise<Response> {
  const { wallet: encodedWallet } = await params;
  const wallet = decodeURIComponent(encodedWallet);
  if (!isAddress(wallet, { strict: true })) {
    return new Response("Invalid wallet address", { status: 400 });
  }

  const address = getAddress(wallet);
  const short = `${address.slice(0, 8)}…${address.slice(-6)}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="72" viewBox="0 0 360 72" role="img" aria-labelledby="title desc"><title id="title">Governed by Arcanum</title><desc id="desc">Governance badge for wallet ${address}</desc><rect width="360" height="72" rx="4" fill="#171512"/><rect x="1" y="1" width="358" height="70" rx="3" fill="none" stroke="#5f574b"/><rect x="12" y="12" width="48" height="48" rx="2" fill="#d65936"/><text x="36" y="43" text-anchor="middle" font-family="ui-monospace,monospace" font-size="19" font-weight="700" fill="#fff">A.</text><text x="76" y="31" font-family="ui-sans-serif,system-ui,sans-serif" font-size="16" font-weight="700" fill="#f5f0e8">GOVERNED BY ARCANUM</text><text x="76" y="50" font-family="ui-monospace,monospace" font-size="11" fill="#b8aa98">${short}</text></svg>`;
  return new Response(svg, { headers: cacheHeaders });
}
