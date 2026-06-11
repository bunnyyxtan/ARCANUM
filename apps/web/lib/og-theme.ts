export const ogTheme = {
  width: 1200,
  height: 630,
  color: {
    coal: "#121419",
    panel: "#181b21",
    panelMid: "#15171b",
    line: "#282c34",
    ash: "#d7dbe0",
    ashBright: "#edf0f3",
    ashMuted: "#5b626c",
    hazard: "#ff5a1f",
    hazardDark: "#120a05",
    steelGreen: "#6e9e7c",
    amber: "#e0a04a",
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
