import { foundryOgContentType, foundryOgImage, foundryOgSize } from "@/lib/og-foundry";

export const size = foundryOgSize;
export const contentType = foundryOgContentType;

export default function Image() {
  return foundryOgImage({
    page: "AGENTS",
    statLabel: "ACTIVE AGENTS",
    statValue: "04 / 05",
    detail: "TREASURY GUARD AGENT UNDER RESTRAINT",
  });
}
