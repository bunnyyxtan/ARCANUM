import { truncateAddress } from "@/lib/format";
import { foundryOgContentType, foundryOgImage, foundryOgSize } from "@/lib/og-foundry";

export const size = foundryOgSize;
export const contentType = foundryOgContentType;

export default async function Image({ params }: Readonly<{ params: Promise<{ wallet: string }> }>) {
  const { wallet } = await params;
  const compromised = wallet.toLowerCase().includes("dev") || wallet.toLowerCase().includes("c74b");

  return foundryOgImage({
    page: "PUBLIC EXPLORER",
    statLabel: truncateAddress(wallet, 8, 6),
    statValue: compromised ? "12" : "87",
    detail: compromised ? "COMPROMISED / RESTRAINT ACTIVE" : "FORTIFIED / GOVERNED WALLET",
    hazard: compromised,
  });
}
