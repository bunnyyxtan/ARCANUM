import { foundryOgContentType, foundryOgImage, foundryOgSize } from "@/lib/og-foundry";

export const size = foundryOgSize;
export const contentType = foundryOgContentType;

export default function Image() {
  return foundryOgImage({
    page: "OVERVIEW",
    statLabel: "POSTURE INDEX",
    statValue: "87",
    detail: "FORTIFIED / 01 PENDING ESCALATION",
  });
}
