# ARCANUM Frontend Redesign — Design Research & Principles

> Synthesis of: The Design Mastery Document, the Design Quality Codex, the UX series & frontend performance notes (all user-provided), plus NN/g research, WCAG 2.2, platform guidance (Material 3 / Apple HIG / Fluent 2), Baymard-grade evidence, and study of premium design systems (IBM Carbon, Primer, Radix). Inspiration galleries (Awwwards, Mobbin, Godly, etc.) are used for mood only — never for conclusions.

---

## 1. What we are designing

ARCANUM is a **non-custodial governance layer for AI-agent USDC wallets** (Arc chain). Two very different surfaces share one brand:

| Surface | Genre | Job | Emotional target |
|---|---|---|---|
| Landing page (`/`) | Marketing | Convince a technical/finance buyer that agents can spend safely | Credibility, control, inevitability |
| Product (`/dashboard`, `/agents`, `/ledger`, `/anomalies`, `/escalations`, `/vendors`, `/policy`, `/explorer`, `/approve`) | Operational + analytical dashboard | Monitor money movement, approve/deny, tune policy — fast, under stress | Calm authority; "nothing here can surprise me" |

The one-sentence brief (Codex 0.5, to be finalized with the user):

> *"ARCANUM makes finance/infra operators feel in absolute control while supervising autonomous spending, and the one thing they remember is that every dollar an agent moves is visibly governed."*

This is **money software**. The dominant research conclusion across every source: for financial/operational tools, trust is the product. Every design decision below is auditable against "does this increase perceived and actual trustworthiness?"

---

## 2. The anti-slop doctrine (non-negotiables)

From the Mastery Document + Codex — slop is *undecided pixels*, not a style. The five detectable failures we must never ship:

1. **Undecided defaults** — every token (type scale, palette roles, spacing unit, radius, shadows, easing, durations) chosen and written down before screens are drawn. Chosen-default ≠ unexamined-default.
2. **Uniform weighting** — one dominant element per screen; squint test must survive. Three identical card grids in a row = failure regardless of polish.
3. **Incomplete states** — the 12-state inventory (ideal / 3 kinds of empty / 3 kinds of loading / partial / 3 tiers of error / offline / stale / success / disabled-with-why / overflow / interacted / dirty) designed for every dynamic surface. For ARCANUM this is *most of the product* — tables, charts, live feeds.
4. **Silent or incoherent feedback** — 100% of interactive elements get the full state ladder (default→hover→focus-visible→active→loading→success/error→disabled). One motion DNA: 2–3 named easing curves, one duration scale, exits ~25% faster than entrances.
5. **Decorative copy** — no "seamless", "powerful", "secure by design" filler. Real numbers, verbs, specific claims ("Blocked 3 out-of-policy transfers this week" beats "Enterprise-grade security").

Plus: **one signature moment per key surface** — something a user could describe to a friend. Products with zero memorable moments are forgotten by definition.

---

## 3. Research canon applied to ARCANUM specifically

### 3.1 Dashboard science (NN/g)
- **Operational vs analytical split matters here.** `/dashboard`, `/anomalies`, `/escalations` are *operational* (time-sensitive, glanceable, act-fast). `/ledger`, analytics views are *analytical* (comparison, drill-down). They should not share the same layout density or chart vocabulary.
- **Preattentive processing:** encode quantitative data in *length and 2D position* (bars, lines, dots on a scale), never area/angle (donuts, gauges) for anything that must be read fast. Color/shape only for *categories* (vendor class, anomaly severity), and never color alone (WCAG 1.4.1 — pair with icon/label: "● Blocked", not just red).
- **A dashboard's goal is answers without interaction.** The `/dashboard` home should answer, in one glance: *Is anything wrong? How much moved? What needs me?* — before a single click.

### 3.2 Complex application guidelines (NN/g, 8 rules)
Directly relevant: progressive learning by doing (not tutorial walls), keyboard accelerators for power users, flexible pathways (the same escalation reachable from feed, table, and notification), visible action history (audit trail is literally our product — expose it in the UI as a first-class object), and **reduce clutter without reducing capability** (progressive disclosure, not amputation).

### 3.3 Laws we will be graded on
- **Response thresholds (Nielsen):** <100ms acknowledge, <1s no spinner, 1–10s skeleton/inline indicator, >10s determinate progress. Flash-of-spinner is banned.
- **Jakob's Law:** navigation, tables, forms, wallet-connect flows stay boringly conventional (web3 users have strong learned patterns from Etherscan, Safe, Rainbow). Novelty budget goes to the signature moments and the landing.
- **Fitts + thumb zone:** approve/deny actions large and near the locus of attention; destructive actions deliberately out of easy reach; 44–48px touch targets, ≥8px gaps.
- **Hick's Law:** one primary CTA per view; opinionated policy defaults for the 80% case.
- **Peak–End:** invest in the approval-success moment, the anomaly-resolved moment, empty states, and the 404. Cheap surfaces, outsized memory returns.
- **Aesthetic–usability effect** cuts both ways: craft buys forgiveness, but mandates the hostile verification pass at 390/768/1440 before anything is "done".

### 3.4 Trust-specific patterns (fintech evidence)
- **Tabular numerals everywhere numbers live** (`font-variant-numeric: tabular-nums`) — jiggling digits read as unreliable money.
- **Never optimistic UI for money movement.** Optimistic is fine for filters, toggles, renames; approvals, denials, policy changes get explicit pending → confirmed states with on-chain finality shown honestly.
- **Undo over confirmation** for routine actions; **meaningful friction** (type-the-name / hold-to-confirm ceremony) only for irreversible ones (revoke wallet, delete policy).
- **Middle-truncate hashes and addresses** (`0x3f…9a2c`), end-truncate prose; copy-on-click with feedback.
- **Stale-while-refreshing, never blank-then-reload** — an operator watching live spend must never see the screen flash empty.
- **Silence about status = assumed failure.** Sync indicators, "Updated 4s ago", offline banner with queued/disabled distinction.

### 3.5 Performance as design (user's performance notes + Codex Part 15)
Perceived speed > actual speed: instant local acknowledgment, CLS ≈ 0 (reserved space, metric-compatible font fallbacks), skeleton-the-content-never-the-chrome, virtualize the ledger before it janks, animate only `transform`/`opacity`, test at 4–6× CPU throttle. `prefers-reduced-motion` gets a full branch, not shorter animations.

---

## 4. What the current "Foundry" design gets right and wrong

**Right (keep the DNA):** it *has* a point of view — dark, industrial, monospace, zero-radius, hazard orange. It is not default-theme slop. The terminal/machinery metaphor genuinely fits "supervised autonomous machines moving money."

**Wrong / slop tells found in audit:**
- ~9,600-line `pages.tsx` means states, hierarchy, and consistency drift — screens share code but not decisions.
- Uniform weighting on data screens: many surfaces present equal-emphasis card/table grids; no single dominant answer per screen.
- Accent (orange) used decoratively as often as semantically — breaks the color-as-contract rule.
- State inventory largely absent (empties, three-tier errors, stale/refreshing, overflow rules undecided).
- Motion is incidental, not a system; no duration/easing DNA.
- Landing follows the split-hero + uniform-feature-grid template — the exact "five tells" pattern.

**Conclusion:** the redesign should be a *re-execution with a real system*, not necessarily a 180° aesthetic pivot — unless the user wants a new direction (open question below).

---

## 5. Design directions to discuss (moods, not yet decisions)

Three defensible concepts, all executable to premium standard:

**A. "Vault Terminal" — evolve Foundry.** Keep dark industrial/monospace identity but rebuild it decided: strict accent budget (orange = requires-human-action, nowhere else), confident type scale, engineered motion, dense-but-calm data surfaces (Bloomberg/Carbon lineage). Signature: a live "governed ledger" tape; approvals as physical toggle ceremonies.

**B. "Marble & Ink" — the private-bank pivot.** Light-first, warm neutrals, editorial serif display + workhorse sans + mono for data. Reads like a Swiss custodian, not a crypto tool. Signature: documents/certificates aesthetic — every approval renders like a signed instrument. Highest contrast with the crypto-dashboard crowd.

**C. "Control Room" — sober precision.** Near-black cool neutrals, one restrained signal color, Linear/Vercel-grade minimalism with hairline structure. Density and calm as independent axes. Signature: an always-visible system-status spine (the "heartbeat" of agent activity).

All three obey the same codex; they differ only in brand fiction. (Per the symmetry test: any of these can be premium or slop — execution decides.)

---

## 6. Open questions before planning

1. Which direction (A/B/C, hybrid, or something the user has in mind)?
2. Scope: `apps/web` only, or `apps/docs` restyle too?
3. Landing and dashboard: redesigned together under one system (recommended) or landing first?
4. Any products/sites the user considers reference-grade for *feel*?
5. Data during redesign: keep existing tRPC wiring intact (recommended — this is a frontend re-skin + re-architecture of components, not an API change)?

---

## 7. Execution guardrails for the build phase (summary contract)

- Foundational tokens written down first (`design/TOKENS.md`) before any screen.
- Break up `canvas/pages.tsx` — one route = one file tree; shared primitives in a real component library.
- Every dynamic surface ships with its state inventory; every interactive element ships its full state ladder.
- WCAG 2.2 AA: 4.5:1 body, 3:1 UI boundaries, focus-visible everywhere, keyboard-complete, reduced-motion branch.
- Verification ritual per surface: hostile critic pass at 390 / 768 / 1440, throttled CPU, 300-char names, 10,000-row ledger, empty account, offline.
