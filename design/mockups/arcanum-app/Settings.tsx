import { useState, type CSSProperties, type ReactNode } from "react";

function AppShell({ children }: { children: ReactNode }) {
  const links = ["DASHBOARD", "AGENTS", "VENDORS", "LEDGER", "ESCALATIONS", "ANOMALIES"];
  return (
    <main className="min-h-[100dvh] bg-[#faf6f1] text-[#292522]" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter+Tight:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box}.font-mono{font-family:'DM Mono',monospace}
        .warm-pill{position:relative;isolation:isolate;overflow:hidden;box-shadow:0 1px 2px rgba(41,37,34,.06);transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 320ms cubic-bezier(.16,1,.3,1),color 220ms ease,border-color 220ms ease}
        .warm-pill::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:#d63200;transform:translateY(102%);transition:transform 320ms cubic-bezier(.16,1,.3,1)}
        .warm-pill:hover{box-shadow:0 10px 28px -8px rgba(255,60,0,.38),0 2px 6px rgba(41,37,34,.08);transform:translateY(-1px)}.warm-pill:hover::before{transform:translateY(0)}
        .warm-pill-ghost::before{background:#292522}.warm-pill-ghost:hover{color:#faf6f1;border-color:#292522}
        .warm-reveal{animation:rowIn 420ms cubic-bezier(.16,1,.3,1) calc(var(--i,0) * 90ms) both}
        @keyframes rowIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .member-row{transition:transform 220ms cubic-bezier(.16,1,.3,1),background-color 220ms ease}.member-row:hover{transform:translateX(3px);background:#f5f0ea}.remove-action{opacity:0;transform:translateX(6px);transition:opacity 220ms ease,transform 220ms cubic-bezier(.16,1,.3,1)}.member-row:hover .remove-action,.member-row:focus-within .remove-action{opacity:1;transform:translateX(0)}
        .settings-tab{transition:color 220ms ease,background-color 220ms ease}.settings-tab:hover{background:#f5f0ea}
        @media (prefers-reduced-motion:reduce){.warm-pill,.warm-pill::before,.warm-reveal,.member-row,.remove-action{transition:none!important;animation:none!important;transform:none!important}}
        @media (max-width:900px){.app-nav{overflow-x:auto}.app-nav button{padding-left:9px;padding-right:9px}.app-nav button:first-child{padding-left:0}.app-content{padding-left:20px;padding-right:20px}.settings-grid{grid-template-columns:1fr}}
      `}</style>
      <header className="flex h-[68px] items-center justify-between border-b border-[#ded7d0] px-8">
        <div className="flex h-full min-w-0 items-center gap-8">
          <button type="button" onClick={() => undefined} className="shrink-0 text-[18px] font-bold tracking-[-.06em]">ARCANUM<span className="text-[#ff3c00]">.</span></button>
          <nav className="app-nav flex h-full items-center">
            {links.map((link) => <button type="button" key={link} onClick={() => undefined} className="relative h-full whitespace-nowrap px-3 text-[12px] font-medium text-[#655d56] transition-colors duration-[220ms] hover:text-[#292522]">{link}</button>)}
          </nav>
        </div>
        <div className="hidden shrink-0 items-center gap-5 md:flex">
          <span className="font-mono text-[9px] uppercase tracking-[.16em] text-[#9b9289]">ARC TESTNET</span>
          <button type="button" onClick={() => undefined} className="flex items-center gap-2 rounded-full border border-[#ded7d0] px-3 py-1.5 transition-colors duration-[220ms] hover:border-[#292522]"><span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#292522] font-mono text-[9px] text-[#faf6f1]">HD</span><span className="text-[12px] font-medium">HELIX-DAO</span></button>
        </div>
      </header>
      {children}
    </main>
  );
}

type Member = { initials: string; name: string; email: string; role: "ADMIN" | "APPROVER" | "VIEWER"; active: string };

export function Settings() {
  const [activeTab, setActiveTab] = useState("TEAM");
  const [members, setMembers] = useState<Member[]>([
    { initials: "HD", name: "Hana Dae", email: "hana@helix.dao", role: "ADMIN", active: "active now" },
    { initials: "MK", name: "Mira Kwon", email: "mira@helix.dao", role: "APPROVER", active: "2h ago" },
    { initials: "OS", name: "Owen Shah", email: "owen@helix.dao", role: "APPROVER", active: "2h ago" },
    { initials: "RA", name: "Rhea Anand", email: "rhea@helix.dao", role: "VIEWER", active: "yesterday" },
  ]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [notice, setNotice] = useState("");
  const tabs = ["TEAM", "ORGANIZATION", "INTEGRATIONS", "WEBHOOKS"];
  const roleClass = (role: Member["role"]) => role === "ADMIN" ? "bg-[#292522] text-[#faf6f1]" : role === "APPROVER" ? "border border-[#ff3c00] text-[#ff3c00]" : "border border-[#ded7d0] text-[#655d56]";
  const removeMember = (name: string) => {
    setMembers((current) => current.filter((member) => member.name !== name));
    setNotice(`${name} removed from the workspace`);
    window.setTimeout(() => setNotice(""), 2800);
  };
  const invite = () => {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setMembers((current) => [...current, { initials: inviteName.trim().split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(), name: inviteName.trim(), email: inviteEmail.trim(), role: "VIEWER", active: "invited" }]);
    setInviteName(""); setInviteEmail(""); setInviteOpen(false); setNotice("Invitation staged for review");
    window.setTimeout(() => setNotice(""), 2800);
  };
  return (
    <AppShell>
      <div className="app-content mx-auto max-w-[1400px] px-8 py-10">
        <div className="flex items-end justify-between gap-8 max-md:flex-col max-md:items-start">
          <div className="warm-reveal">
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#ff3c00]">WORKSPACE / GOVERNANCE</p>
            <h1 className="mt-5 text-[clamp(3rem,6vw,5.8rem)] font-semibold leading-[.85] tracking-[-.085em]">Settings</h1>
            <p className="mt-6 max-w-[500px] text-[14px] leading-[1.5] text-[#776f68]">Keep the people, permissions, and integrations around governed spend legible.</p>
          </div>
          <button type="button" onClick={() => setInviteOpen(true)} className="warm-pill group rounded-full bg-[#ff3c00] px-5 py-3 text-[12px] font-semibold text-[#fff]">Invite member <span className="ml-1.5 inline-block transition-transform duration-[220ms] group-hover:translate-x-1">↗</span></button>
        </div>

        <div className="settings-grid mt-16 grid grid-cols-[210px_1fr] gap-12">
          <aside className="border-t border-[#ded7d0]">
            {tabs.map((tab) => <button type="button" key={tab} onClick={() => setActiveTab(tab)} className={`settings-tab relative flex w-full items-center border-b border-[#ded7d0] px-4 py-4 text-left font-mono text-[10px] tracking-[.16em] ${activeTab === tab ? "bg-[#f5f0ea] text-[#292522]" : "text-[#837a72]"}`}>{activeTab === tab && <span className="absolute bottom-0 left-0 top-0 w-[2px] bg-[#ff3c00]" />}{tab}</button>)}
            <p className="mt-7 px-4 font-mono text-[9px] uppercase leading-[1.6] tracking-[.12em] text-[#9b9289]">Changes are reviewed by the workspace owner before they affect a wallet.</p>
          </aside>
          <div className="min-w-0">
            {activeTab === "TEAM" ? (
              <>
                <section className="grid border-y border-[#ded7d0] md:grid-cols-3">
                  {[["ORGANIZATION", "Helix DAO"], ["DEPLOYMENT", "ARC TESTNET"], ["GOVERNANCE MODE", "owner-managed"]].map(([label, value], index) => <div key={label} className="warm-reveal border-r border-[#ded7d0] px-6 py-6 first:pl-0 last:border-r-0 max-md:border-b max-md:border-r-0 max-md:px-0" style={{ "--i": index + 1 } as CSSProperties}><p className="font-mono text-[9px] uppercase tracking-[.16em] text-[#9b9289]">{label}</p><p className="mt-5 text-[15px] font-medium tracking-[-.02em]">{value}</p></div>)}
                </section>
                <section className="mt-16">
                  <div className="flex items-end justify-between border-b border-[#ded7d0] pb-4"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#ff3c00]">ACCESS / TEAM MEMBERS</p><h2 className="mt-4 text-[26px] font-semibold tracking-[-.05em]">The people with a say.</h2></div><span className="font-mono text-[10px] text-[#9b9289]">{members.length.toString().padStart(2, "0")} MEMBERS</span></div>
                  <div className="grid grid-cols-[1.8fr_.8fr_.8fr_auto] gap-4 border-b border-[#ded7d0] px-4 py-3 font-mono text-[9px] uppercase tracking-[.14em] text-[#9b9289] max-md:grid-cols-[1fr_.7fr_auto] max-md:gap-2"><span>MEMBER</span><span>ROLE</span><span className="max-md:hidden">LAST ACTIVE</span><span /></div>
                  <div>
                    {members.map((member, index) => <div key={member.email} className="member-row warm-reveal grid grid-cols-[1.8fr_.8fr_.8fr_auto] items-center gap-4 border-b border-[#e3dcd5] px-4 py-4 max-md:grid-cols-[1fr_.7fr_auto] max-md:gap-2" style={{ "--i": index + 2 } as CSSProperties}>
                      <div className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#292522] font-mono text-[9px] text-[#faf6f1]">{member.initials}</span><span className="min-w-0"><strong className="block truncate text-[13px] font-medium">{member.name}</strong><span className="mt-0.5 block truncate text-[11px] text-[#837a72]">{member.email}</span></span></div>
                      <span className={`w-fit rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${roleClass(member.role)}`}>{member.role}</span>
                      <span className={`font-mono text-[10px] tabular-nums ${member.active === "active now" ? "text-[#292522]" : "text-[#837a72]"} max-md:hidden`}>{member.active}</span>
                      <button type="button" onClick={() => removeMember(member.name)} className="remove-action whitespace-nowrap font-mono text-[9px] uppercase tracking-[.12em] text-[#ff3c00]">Remove</button>
                    </div>)}
                  </div>
                </section>
              </>
            ) : (
              <section className="warm-reveal border border-[#ded7d0] bg-[#f5f0ea] p-8 md:p-10">
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#ff3c00]">WORKSPACE / {activeTab}</p>
                <h2 className="mt-7 text-[34px] font-semibold tracking-[-.06em]">{activeTab[0] + activeTab.slice(1).toLowerCase()}</h2>
                <p className="mt-5 max-w-[560px] text-[15px] leading-[1.5] text-[#776f68]">This workspace surface is owner-managed. Review and approval controls for {activeTab.toLowerCase()} will appear here when configured for Helix DAO.</p>
                <button type="button" onClick={() => setActiveTab("TEAM")} className="warm-pill warm-pill-ghost mt-8 rounded-full border border-[#ded7d0] px-5 py-3 text-[12px] font-semibold">Back to team</button>
              </section>
            )}
          </div>
        </div>
      </div>
      {notice && <div className="fixed bottom-6 right-6 border border-[#ded7d0] bg-[#f5f0ea] px-5 py-4 text-[12px] text-[#292522] shadow-[0_10px_30px_-20px_rgba(41,37,34,.7)]">{notice}</div>}
      {inviteOpen && <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(41,37,34,.18)] p-5" role="dialog" aria-modal="true" aria-label="Invite team member"><div className="w-full max-w-[450px] border border-[#ded7d0] bg-[#faf6f1] p-7 shadow-[0_24px_50px_-28px_rgba(41,37,34,.6)]"><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#ff3c00]">TEAM / INVITATION</p><h2 className="mt-4 text-[28px] font-semibold tracking-[-.06em]">Invite a member.</h2></div><button type="button" onClick={() => setInviteOpen(false)} className="font-mono text-[11px] text-[#837a72] transition-colors hover:text-[#292522]">CLOSE</button></div><label className="mt-8 block"><span className="font-mono text-[9px] uppercase tracking-[.14em] text-[#837a72]">NAME</span><input value={inviteName} onChange={(event) => setInviteName(event.target.value)} className="mt-2 w-full border-b border-[#ded7d0] bg-transparent py-3 text-[14px] outline-none transition-colors focus:border-[#ff3c00]" placeholder="New approver" /></label><label className="mt-5 block"><span className="font-mono text-[9px] uppercase tracking-[.14em] text-[#837a72]">EMAIL</span><input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} type="email" className="mt-2 w-full border-b border-[#ded7d0] bg-transparent py-3 text-[14px] outline-none transition-colors focus:border-[#ff3c00]" placeholder="name@helix.dao" /></label><div className="mt-8 flex justify-end gap-3"><button type="button" onClick={() => setInviteOpen(false)} className="warm-pill warm-pill-ghost rounded-full border border-[#ded7d0] px-5 py-3 text-[12px] font-semibold">Cancel</button><button type="button" onClick={invite} className="warm-pill rounded-full bg-[#ff3c00] px-5 py-3 text-[12px] font-semibold text-[#fff]">Stage invite ↗</button></div></div></div>}
    </AppShell>
  );
}