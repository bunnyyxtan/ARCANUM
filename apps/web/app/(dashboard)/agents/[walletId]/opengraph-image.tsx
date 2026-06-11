import { ImageResponse } from "next/og";

import { ogBaseStyle, ogTheme } from "@/lib/og-theme";

export const size = { width: ogTheme.width, height: ogTheme.height };
export const contentType = "image/png";

type ImageProps = Readonly<{
  params: Promise<{ walletId: string }>;
}>;

export default async function Image({ params }: ImageProps) {
  const { walletId } = await params;
  const label = agentLabel(walletId);
  const posture = walletId.toLowerCase().includes("dev") ? 42 : 87;

  return new ImageResponse(
    <div
      style={{
        ...ogBaseStyle,
        alignItems: "center",
        justifyContent: "center",
        padding: 72,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          border: `1px solid ${ogTheme.color.line}`,
          background: ogTheme.color.panel,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 58,
        }}
      >
        <div
          style={{
            color: ogTheme.color.hazard,
            display: "flex",
            fontSize: 24,
            letterSpacing: 8,
          }}
        >
          AGENT DOSSIER
        </div>
        <div style={{ color: ogTheme.color.ashBright, display: "flex", fontSize: 74 }}>{label}</div>
        <div style={{ alignItems: "flex-end", display: "flex", justifyContent: "space-between" }}>
          <div style={{ color: ogTheme.color.ashMuted, display: "flex", fontSize: 28 }}>
            Last action - indexed on Arc testnet
          </div>
          <div
            style={{
              color: ogTheme.color.ashBright,
              display: "flex",
              fontSize: 158,
              lineHeight: 0.8,
            }}
          >
            {posture}
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}

function agentLabel(walletId: string) {
  if (walletId.toLowerCase().includes("dev")) {
    return "DevAgent-01";
  }

  if (walletId.toLowerCase().includes("treasury")) {
    return "TreasuryRebalancer";
  }

  return "ResearchAgent";
}
