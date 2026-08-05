import { ArchwayCoin, ArchwayCoinReversed } from "./BrandMark";

const paper = "#faf6f1";
const ink = "#292522";
const umber = "#655d56";
const signal = "#ff3c00";
const hairline = "#ded7d0";
const muted = "#837a72";
const dark = "#121419";

const style = `
  .brand-plate{min-height:1000px;width:950px;box-sizing:border-box;background:${paper};color:${ink};padding:34px 56px 42px;font-family:"Schibsted Grotesk",sans-serif}
  .brand-head{height:35px;border-bottom:1px solid ${hairline};display:flex;justify-content:space-between;align-items:flex-start;color:${muted};font:10px/1.2 "DM Mono",monospace;letter-spacing:.14em;text-transform:uppercase}
  .brand-title{font:500 22px/1 "Fraunces",serif;letter-spacing:-.02em;margin:26px 0 8px}.brand-kicker{font:10px/1.2 "DM Mono",monospace;letter-spacing:.12em;color:${muted};text-transform:uppercase}
  .digital-section{border-top:1px solid ${hairline};margin-top:22px;padding-top:13px}.digital-label{display:flex;justify-content:space-between;color:${muted};font:9px "DM Mono",monospace;letter-spacing:.12em;text-transform:uppercase;margin-bottom:13px}
  .icon-row{display:flex;gap:18px;align-items:end}.icon-item{display:flex;flex-direction:column;align-items:center;gap:6px;font:8px "DM Mono",monospace;color:${muted}}.icon-ground{width:92px;height:92px;display:grid;place-items:center;border:1px solid ${hairline};background:${paper};overflow:hidden}.icon-ground svg{max-width:72px;max-height:72px}.icon-ground.dark{background:${dark};border-color:#282c34}
  .social-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.social-card{border:1px solid ${hairline};overflow:hidden;background:white}.profile-banner{height:73px;background:${paper};border-bottom:1px solid ${hairline};position:relative;padding:13px 16px;font:20px/1 "Fraunces",serif}.profile-banner .mini-coin{position:absolute;right:12px;bottom:-17px}.profile-body{height:74px;padding:25px 15px 10px;display:flex;justify-content:space-between;align-items:end}.profile-name{font:10px "DM Mono",monospace;letter-spacing:.1em}.profile-meta{font-size:10px;color:${muted}}.linkedin-banner{height:95px;background:${ink};padding:17px 19px;color:${paper};font:26px/.95 "Fraunces",serif;position:relative}.linkedin-banner small{display:block;color:#a39a91;font:9px "DM Mono",monospace;letter-spacing:.13em;margin-top:12px}.linkedin-banner .mini-coin{position:absolute;right:18px;bottom:15px}.og-card{background:${dark};height:193px;color:${paper};display:grid;grid-template-columns:1.15fr .85fr;padding:20px}.og-copy{align-self:end}.og-title{font:29px/.95 "Fraunces",serif}.og-label{font:8px "DM Mono",monospace;color:#8a909b;letter-spacing:.13em;margin-top:10px}.og-mark{display:grid;place-items:center}.email-card{border:1px solid ${hairline};padding:17px;display:grid;grid-template-columns:44px 1fr 130px;gap:14px;align-items:center}.email-name{font:14px "Fraunces",serif}.email-info{font:10px/1.5 "DM Mono",monospace;color:${muted}}.email-rule{height:38px;border-left:1px solid ${hairline};padding-left:14px;font:9px/1.4 "DM Mono",monospace;color:${muted}}.tiny-coin{width:40px;height:40px}
`;

function IconProof({ size, darkGround = false }: { size: number; darkGround?: boolean }) {
  return <div className={`icon-ground ${darkGround ? "dark" : ""}`}><ArchwayCoin size={size} /></div>;
}

export default function BrandDigitalKit() {
  return <main className="brand-plate"><style>{style}</style><header className="brand-head"><span>ARCANUM BRAND — DIGITAL KIT</span><span>APPLICATIONS · 02</span></header>
    <h1 className="brand-title">The mark, at every useful distance.</h1><div className="brand-kicker">DIGITAL APPLICATIONS / ICON · SOCIAL · SIGNATURE</div>
    <section className="digital-section"><div className="digital-label"><span>FAVICON / APP ICON PROOF</span><span>SAME MASTER · LIGHT + DARK GROUND</span></div><div className="icon-row">{[16,32,64,180].map(size=><div className="icon-item" key={`light-${size}`}><IconProof size={size}/><span>{size} / paper</span></div>)}{[16,32,64,180].map(size=><div className="icon-item" key={`dark-${size}`}><IconProof size={size} darkGround/><span>{size} / foundry</span></div>)}</div></section>
     <section className="digital-section"><div className="digital-label"><span>SOCIAL PROFILE SYSTEM</span><span>PROFILE · BANNER</span></div><div className="social-grid"><div className="social-card"><div className="profile-banner">A governed<br/>treasury.<span className="mini-coin"><ArchwayCoin size={48}/></span></div><div className="profile-body"><div><div className="profile-name">ARCANUM</div><div className="profile-meta">governed treasury for agents</div></div><span style={{ color: signal, fontSize: 20 }}>+</span></div></div><div className="social-card"><div className="linkedin-banner">Infrastructure<br/>for agency.<small>ARCANUM — GOVERNED TREASURY</small><span className="mini-coin"><ArchwayCoinReversed size={48}/></span></div><div className="profile-body"><div><div className="profile-name">ARCANUM</div><div className="profile-meta">financial infrastructure</div></div><span style={{ color: umber, fontSize: 11 }}>FOLLOW</span></div></div></div></section>
     <section className="digital-section"><div className="digital-label"><span>OPEN GRAPH / 1200 × 630</span><span>SAME MASTER · DARK FOUNDRY</span></div><div className="og-card"><div className="og-copy"><div className="og-title">Money with<br/>a policy layer.</div><div className="og-label">ARCANUM · GOVERNED TREASURY</div></div><div className="og-mark"><ArchwayCoinReversed size={122}/></div></div></section>
    <section className="digital-section"><div className="digital-label"><span>EMAIL SIGNATURE</span><span>PLAIN, NOT PLAIN</span></div><div className="email-card"><ArchwayCoin size={40}/><div><div className="email-name">Mira Sen</div><div className="email-info">Policy & Partnerships · ARCANUM<br/>mira@thearcanum.in · thearcanum.in</div></div><div className="email-rule">GOVERNED<br/>MONEY FOR<br/>AUTONOMOUS<br/>AGENTS.</div></div></section>
  </main>;
}