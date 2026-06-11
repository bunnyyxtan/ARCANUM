import { ImageResponse } from "next/og";

export const foundryOgSize = { width: 1200, height: 630 };
export const foundryOgContentType = "image/png";

type FoundryOgImageProps = Readonly<{
  page: string;
  statLabel: string;
  statValue: string;
  detail?: string;
  hazard?: boolean;
}>;

export function foundryOgImage({
  page,
  statLabel,
  statValue,
  detail,
  hazard,
}: FoundryOgImageProps) {
  const accent = hazard ? "#ff5a1f" : "#6e9e7c";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#121419",
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)",
        backgroundSize: "38px 38px",
        color: "#d7dbe0",
        fontFamily: "Arial Narrow, Arial, sans-serif",
        padding: 56,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#5b626c", fontSize: 26, letterSpacing: 8 }}>
            ARCANUM / GOVERNANCE
          </div>
          <div
            style={{
              color: "#edf0f3",
              fontSize: 86,
              fontWeight: 700,
              letterSpacing: 4,
              lineHeight: 0.95,
              maxWidth: 880,
            }}
          >
            {page}
          </div>
        </div>
        <div
          style={{
            border: "1px solid #282c34",
            background: "#181b21",
            padding: "18px 22px",
            display: "flex",
            position: "absolute",
            right: 56,
            top: 56,
          }}
        >
          <div style={{ color: "#8a909b", fontSize: 22, letterSpacing: 5 }}>
            ARC-TESTNET / BLK 5,042,118
          </div>
        </div>
      </div>

      <div
        style={{
          border: `2px solid ${accent}`,
          background: hazard ? "#1a1207" : "#15171b",
          display: "flex",
          flexDirection: "column",
          padding: 36,
          width: 760,
        }}
      >
        <div style={{ color: "#8a909b", fontSize: 28, letterSpacing: 7 }}>{statLabel}</div>
        <div style={{ color: accent, fontSize: 116, fontWeight: 700, lineHeight: 0.9 }}>
          {statValue}
        </div>
        {detail ? (
          <div style={{ color: "#d7dbe0", fontSize: 28, marginTop: 16 }}>{detail}</div>
        ) : null}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "#edf0f3", fontSize: 26, fontWeight: 700, letterSpacing: 7 }}>
          ARCANUM / FOUNDRY CONSOLE
        </div>
        <div style={{ color: "#5b626c", fontSize: 22, letterSpacing: 5 }}>
          BUILT ON ARC / OPEN PROTOCOL / MIT
        </div>
      </div>
    </div>,
    foundryOgSize,
  );
}
