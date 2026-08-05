import { ArchwayCoin } from "./BrandMark";

const paper = "#faf6f1";
const ink = "#292522";
const umber = "#655d56";
const signal = "#ff3c00";
const hairline = "#ded7d0";
const muted = "#837a72";
const fine = "#9b9289";
const dark = {
  bg: "#121419",
  raised: "#16181d",
  soft: "#181b21",
  line: "#282c34",
  ink: "#edf0f3",
  body: "#aab0b9",
  signal: "#ff5a1f",
};

const swatches = [
  { name: "PAPER", hex: paper, color: paper, text: ink, width: "57%", note: "Primary field · quiet, warm ground" },
  { name: "INK", hex: ink, color: ink, text: paper, width: "27%", note: "Structure · governance, type, mark" },
  { name: "UMBER", hex: umber, color: umber, text: paper, width: "11%", note: "Secondary tone · metadata, depth" },
  { name: "SIGNAL", hex: signal, color: signal, text: paper, width: "5%", note: "Human attention · use sparingly" },
];
const darkSwatches = [
  ["WL DARK / BASE", dark.bg],
  ["WL DARK / RAISED", dark.raised],
  ["WL DARK / SOFT", dark.soft],
  ["WL DARK / LINE", dark.line],
];

const style = `
  .brand-plate{min-height:1000px;width:950px;box-sizing:border-box;background:${paper};color:${ink};padding:34px 56px 42px;font-family:"Schibsted Grotesk",sans-serif}
  .brand-head{height:35px;border-bottom:1px solid ${hairline};display:flex;justify-content:space-between;align-items:flex-start;color:${muted};font:10px/1.2 "DM Mono",monospace;letter-spacing:.14em;text-transform:uppercase}
  .brand-title{font:500 22px/1 "Fraunces",serif;letter-spacing:-.02em;margin:26px 0 8px}.brand-kicker{font:10px/1.2 "DM Mono",monospace;letter-spacing:.12em;color:${muted};text-transform:uppercase}
  .color-grid{display:grid;grid-template-columns:1.25fr .75fr;gap:18px;margin-top:26px}.swatch-card{border:1px solid ${hairline};min-height:138px;padding:16px;position:relative}.swatch-card .chip{height:56px;margin:-16px -16px 15px}.swatch-name{font:11px "DM Mono",monospace;letter-spacing:.1em}.swatch-hex{font:12px "DM Mono",monospace;color:${muted};margin-left:9px}.swatch-note{font-size:12px;color:${muted};margin-top:8px}.ratio{display:flex;height:5px;margin-top:17px;background:${hairline}}.ratio b{display:block;height:100%}
  .dark-panel{background:${dark.bg};padding:18px;color:${dark.ink};border:1px solid ${dark.line};min-height:138px}.dark-label{font:9px "DM Mono",monospace;letter-spacing:.12em;color:${dark.body};margin-bottom:15px}.dark-list{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dark-chip{height:31px;border:1px solid ${dark.line};display:flex;align-items:center;gap:9px;padding:7px;font:9px "DM Mono",monospace;color:${dark.body}}.dark-dot{width:15px;height:15px;display:block}
  .section-rule{border-top:1px solid ${hairline};margin:26px 0 18px;padding-top:13px;display:flex;justify-content:space-between;color:${muted};font:9px "DM Mono",monospace;letter-spacing:.12em;text-transform:uppercase}.type-grid{display:grid;grid-template-columns:1fr 1fr;gap:35px}.display-sample{font:52px/.93 "Fraunces",serif;letter-spacing:-.04em;margin:8px 0 18px}.display-sample.small{font-size:35px}.ui-sample{font:15px/1.45 "Schibsted Grotesk",sans-serif;max-width:330px}.mono-sample{font:12px/1.5 "DM Mono",monospace;color:${muted};border-left:2px solid ${signal};padding-left:13px}.annotation{font:9px "DM Mono",monospace;color:${fine};letter-spacing:.1em;text-transform:uppercase}
  .mark-mini{border-left:1px solid ${hairline};padding-left:28px;display:flex;justify-content:center;align-items:center;min-height:128px}
`;

export default function BrandColorType() {
  return (
    <main className="brand-plate">
      <style>{style}</style>
      <header className="brand-head"><span>ARCANUM BRAND — COLOR / TYPE</span><span>WARM LEDGER · 01</span></header>
      <h1 className="brand-title">A controlled vocabulary of warmth.</h1>
      <div className="brand-kicker">COLOR SYSTEM / 01–04 · RATIO BAR = SURFACE ALLOCATION</div>
      <section className="color-grid">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {swatches.map((item) => <article className="swatch-card" key={item.name}><div className="chip" style={{ background: item.color }} /><div><span className="swatch-name">{item.name}</span><span className="swatch-hex">{item.hex}</span></div><div className="swatch-note">{item.note}</div><div className="ratio"><b style={{ width: item.width, background: item.color }} /></div></article>)}
        </div>
        <div className="dark-panel"><div className="dark-label">DARK FOUNDRY / REAL WL-DARK TOKENS</div><div className="dark-list">{darkSwatches.map(([name, color]) => <div className="dark-chip" key={name}><i className="dark-dot" style={{ background: color }} />{name}<span style={{ marginLeft: "auto" }}>{color}</span></div>)}</div><div style={{ marginTop: 22, font: "10px/1.4 'DM Mono',monospace", color: dark.body }}>#121419 base · 38px white grid @ 1.8% · signal swaps to #ff5a1f</div></div>
      </section>
      <div className="section-rule"><span>TYPE SYSTEM / DISPLAY · UI · DATA</span><span>FRAUNCES / SCHIBSTED / DM MONO</span></div>
      <section className="type-grid">
        <div><div className="annotation">Display / 52px · 500 · negative tracking</div><div className="display-sample">The<br />governed gate.</div><div className="annotation">Display / 35px · 500 · editorial emphasis</div><div className="display-sample small">A quiet system<br />for moving money.</div></div>
        <div><div className="annotation">UI / 15px · 420 · reading texture</div><p className="ui-sample">ARCanum gives autonomous agents room to act, then makes every consequential move legible to a human signer. Warmth is the surface. Policy is the architecture.</p><div className="annotation" style={{ marginTop: 26 }}>Data / 12px · 400 · traceable facts</div><p className="mono-sample">POLICY 04.17 / APPROVED<br />USDC 12,480.00 / ARC MAINNET<br />HUMAN SIGNATURE / REQUIRED</p></div>
      </section>
      <div className="section-rule"><span>MARK IN CONTEXT / 240 UNIT EXTRACTION</span><span>THE ARCHWAY COIN · 46C</span></div>
      <div className="mark-mini"><ArchwayCoin size={128} /></div>
    </main>
  );
}