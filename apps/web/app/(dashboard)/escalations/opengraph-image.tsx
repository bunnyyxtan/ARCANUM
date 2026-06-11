import { foundryOgContentType, foundryOgImage, foundryOgSize } from "@/lib/og-foundry";

export const size = foundryOgSize;
export const contentType = foundryOgContentType;

export default function Image() {
  return foundryOgImage({
    page: "RESTRAINT QUEUE",
    statLabel: "PENDING ESCALATIONS",
    statValue: "04",
    detail: "$73.42 TO AWS BEDROCK / HUMAN QUORUM REQUIRED",
    hazard: true,
  });
}
