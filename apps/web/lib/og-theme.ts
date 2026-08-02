export const ogTheme = {
  width: 1200,
  height: 630,
  color: {
    coal: "var(--wl-page)",
    panel: "var(--wl-panel)",
    panelMid: "var(--wl-panel-mid)",
    line: "var(--wl-hairline)",
    ash: "var(--wl-text-body)",
    ashBright: "var(--wl-text-primary)",
    ashMuted: "var(--wl-text-muted)",
    hazard: "var(--wl-signal)",
    hazardDark: "var(--wl-hazard-tint)",
    steelGreen: "var(--wl-green)",
    amber: "var(--wl-amber)",
  },
} as const;

export const ogBaseStyle = {
  width: "100%",
  height: "100%",
  display: "flex",
  background: ogTheme.color.coal,
  color: ogTheme.color.ash,
  fontFamily: "monospace",
} as const;
