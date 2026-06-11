import { foundryOgContentType, foundryOgImage, foundryOgSize } from "@/lib/og-foundry";

export const size = foundryOgSize;
export const contentType = foundryOgContentType;

export default function Image() {
  return foundryOgImage({
    page: "FOUNDRY CONSOLE",
    statLabel: "GOVERNANCE POSTURE",
    statValue: "87",
    detail: "BUILT FOR AUTONOMOUS AI MONEY ON ARC",
  });
}
