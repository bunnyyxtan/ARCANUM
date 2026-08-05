const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";
const DARK_BG = "#121419";
const DARK_RAISED = "#16181d";
const DARK_SURFACE = "#181b21";
const LIGHT_LINE = "#ded7d0";
const DARK_LINE = "#282c34";
const LIGHT_BODY = "#655d56";
const DARK_BODY = "#aab0b9";
const LIGHT_MUTE = "#837a72";
const DARK_MUTE = "#8a909b";
const MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, monospace';
const DISPLAY = 'Fraunces, Georgia, serif';
const BODY = '"Schibsted Grotesk", system-ui, sans-serif';

/**
 * ARCANUM — 46C IN SITU
 *
 * Source-of-truth tokens are transcribed from apps/web/app/globals.css:
 * light --wl-bg #faf6f1, --wl-line #ded7d0, --wl-body #655d56,
 * --wl-secondary #837a72; foundry --wl-bg #121419, --wl-raised #16181d,
 * --wl-surface #181b21, --wl-line #282c34, --wl-body #aab0b9,
 * --wl-secondary #8a909b. Header structure follows components/warm/Header.tsx:
 * 68px bar, Fraunces ARCANUM wordmark, six operational links, ARC TESTNET,
 * theme, notifications, command, and read-only account.
 *
 * Dark adaptation: the coin reverses its container and passage colors only:
 * light coin = ink container / paper cutout; foundry coin = light text container
 * / dark surface cutout. This keeps the negative arch legible on #121419 while
 * preserving the single orange signal. The dark token's actual hazard orange
 * #ff5a1f is used in the foundry strip; 46C's public orange remains #ff3c00.
 */

const links = ["DASHBOARD", "AGENTS", "VENDORS", "LEDGER", "ESCALATIONS", "ANOMALIES"];

function Coin({ dark = false, size = 30 }: { dark?: boolean; size?: number }) {
  const container = dark ? "#edf0f3" : INK;
  const cutout = dark ? DARK_SURFACE : PAPER;
  const accent = dark ? "#ff5a1f" : SIGNAL;
  return (
    <svg width={size} height={size} viewBox="56 56 288 288" role="img" aria-label="The Archway Coin" style={{ width: size, height: size, display: "block", flex: "none" }}>
      <rect x="80" y="80" width="240" height="240" rx="42" fill={container} />
      <path d="M116 86 Q116 84 118 84 H282 Q284 84 284 86 V296 Q284 298 282 298 H238 V220 C238 190 222 174 200 174 C178 174 162 190 162 220 V298 H118 Q116 298 116 296 Z" fill={cutout} />
      <circle cx="200" cy="196" r="7" fill={accent} />
    </svg>
  );
}

function HeaderStrip({ dark = false }: { dark?: boolean }) {
  const bg = dark ? DARK_BG : PAPER;
  const line = dark ? DARK_LINE : LIGHT_LINE;
  const ink = dark ? "#edf0f3" : INK;
  const body = dark ? DARK_BODY : LIGHT_BODY;
  const mute = dark ? DARK_MUTE : LIGHT_MUTE;
  const signal = dark ? "#ff5a1f" : SIGNAL;
  return (
    <div style={{ background: bg, color: ink, borderBottom: `1px solid ${line}`, fontFamily: BODY }}>
      <header style={{ height: 68, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "0 28px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flex: "none" }}>
            <Coin dark={dark} size={30} />
            <span style={{ fontFamily: DISPLAY, fontSize: 18, lineHeight: 1, fontWeight: 700, letterSpacing: "-.015em", whiteSpace: "nowrap" }}>ARCANUM<span style={{ color: signal }}>.</span></span>
          </div>
          <nav aria-label="ARCanum primary navigation" style={{ display: "flex", alignItems: "center", gap: 20, minWidth: 0, overflow: "hidden", height: "100%" }}>
            {links.map((link, index) => (
              <span key={link} style={{ position: "relative", display: "flex", alignItems: "center", height: "100%", whiteSpace: "nowrap", color: index === 0 ? ink : body, fontSize: 12, fontWeight: 500, letterSpacing: "-.01em" }}>
                {link}
                {index === 0 ? <i style={{ position: "absolute", height: 2, bottom: -1, left: 0, right: 0, background: signal }} /> : null}
              </span>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
          <span style={{ color: mute, fontFamily: MONO, fontSize: 9, letterSpacing: ".16em", whiteSpace: "nowrap" }}>ARC TESTNET</span>
          <span style={{ color: body, fontFamily: MONO, fontSize: 15, lineHeight: 1 }}>◐</span>
          <span style={{ color: body, fontFamily: MONO, fontSize: 15, lineHeight: 1 }}>⌕</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${line}`, borderRadius: 99, padding: "6px 10px", fontFamily: MONO, fontSize: 10, whiteSpace: "nowrap" }}><b style={{ display: "grid", placeItems: "center", width: 22, height: 22, margin: "-3px 0 -3px -5px", borderRadius: "50%", background: ink, color: bg, fontSize: 9 }}>RO</b>READ-ONLY <span style={{ color: mute }}>⌄</span></span>
        </div>
      </header>
      <div style={{ height: 32, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 9, padding: "0 12px", borderTop: `1px solid ${line}`, background: dark ? DARK_RAISED : "#fbf8f4", color: body }}>
        <Coin dark={dark} size={16} />
        <span style={{ fontFamily: BODY, fontSize: 11, fontWeight: 500, letterSpacing: ".01em" }}>ARCANUM</span>
        <span style={{ marginLeft: "auto", color: mute, fontFamily: MONO, fontSize: 10 }}>×</span>
      </div>
    </div>
  );
}

function Strip({ dark = false }: { dark?: boolean }) {
  const bg = dark ? DARK_BG : PAPER;
  const line = dark ? DARK_LINE : LIGHT_LINE;
  const mute = dark ? DARK_MUTE : LIGHT_MUTE;
  const signal = dark ? "#ff5a1f" : SIGNAL;
  return (
    <section style={{ border: `1px solid ${line}`, background: bg, overflow: "hidden", boxShadow: dark ? "0 10px 0 #0e1014" : "0 10px 0 #f0e9e2" }}>
      <div style={{ height: 30, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", borderBottom: `1px solid ${line}`, color: mute, fontFamily: MONO, fontSize: 9, letterSpacing: ".16em" }}>
        <span style={{ color: signal }}>◼ {dark ? "DARK / FOUNDRY" : "LIGHT / PUBLIC"}</span>
        <span>ACTUAL HEADER REPLICA · 68PX</span>
      </div>
      <HeaderStrip dark={dark} />
      <div style={{ height: 116, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 34px", borderTop: `1px solid ${line}`, background: dark ? DARK_SURFACE : "#fbf8f4" }}>
        <div>
          <p style={{ margin: 0, color: signal, fontFamily: MONO, fontSize: 9, letterSpacing: ".15em" }}>{dark ? "FOUNDRY / GOVERNANCE" : "PUBLIC / GOVERNANCE"}</p>
          <p style={{ margin: "9px 0 0", color: dark ? "#edf0f3" : INK, fontFamily: DISPLAY, fontSize: 26, lineHeight: 1.05, letterSpacing: "-.02em" }}>The governed gate, at home.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: mute, fontFamily: MONO, fontSize: 9, letterSpacing: ".12em" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: signal }} />46C / ARCHWAY COIN</div>
      </div>
    </section>
  );
}

export default function ArcanumInSitu() {
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 24px 30px", fontFamily: MONO }}>
      <header style={{ width: "100%", maxWidth: 850, margin: "0 auto 18px", display: "flex", justifyContent: "space-between", color: LIGHT_MUTE, fontSize: 10, lineHeight: 1.2, letterSpacing: ".14em", textTransform: "uppercase" }}>
        <span>ARCANUM — 46C IN SITU</span><span>THE ARCHWAY COIN / CONTEXT PLATE</span>
      </header>
      <div style={{ width: "100%", maxWidth: 850, margin: "0 auto", display: "grid", gap: 22 }}>
        <Strip />
        <Strip dark />
      </div>
      <p style={{ width: "100%", maxWidth: 850, margin: "19px auto 0", color: LIGHT_MUTE, fontSize: 9, lineHeight: 1.35, letterSpacing: ".12em", textTransform: "uppercase" }}>46C HOLDS ITS ARCHWAY AT 30PX, ITS FAVICON AT 16PX, AND ITS SIGNAL THROUGH BOTH SURFACES.</p>
    </main>
  );
}