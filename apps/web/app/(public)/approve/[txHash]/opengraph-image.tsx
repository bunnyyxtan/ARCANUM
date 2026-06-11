import { foundryOgContentType, foundryOgImage, foundryOgSize } from "@/lib/og-foundry";

export const size = foundryOgSize;
export const contentType = foundryOgContentType;

export default async function Image({ params }: Readonly<{ params: Promise<{ txHash: string }> }>) {
  const { txHash } = await params;

  return foundryOgImage({
    page: "APPROVAL REQUEST",
    statLabel: "HELD TRANSACTION",
    statValue: "$73.42",
    detail: `${txHash.slice(0, 12)} / AWS BEDROCK`,
    hazard: true,
  });
}
