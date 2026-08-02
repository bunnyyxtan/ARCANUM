# ARCANUM Frontend Direction — "Warm Ledger"

> Extracted Aug 2, 2026 from the user's design-exploration workspace (uploaded zip).
> This is the **authoritative visual direction** for the frontend replacement.
> Source mockups live in `design/mockups/` (8 app pages + 2 landing variants).
> Research foundation: `design/DESIGN-RESEARCH.md` (anti-slop doctrine, state inventory, trust patterns).
> Functional contract to preserve: `FRONTEND_UIUX_CONTEXT.md` §3 (tRPC hooks, SIWE/wallet flow, route surface).

---

## 1. The concept

**"Warm Ledger"** — a paper ledger for autonomous money. Warm cream paper, dark warm ink,
one signal color used as a contract. It reads like a private bank's account book, not a crypto
dashboard. Calm, editorial, accountable. Replaces the previous dark "industrial foundry" theme
entirely (light-first; the dark ink surface appears only as an inversion moment, e.g. landing §03).

Emotional target (from DESIGN-RESEARCH.md): *"every dollar an agent moves is visibly governed"* —
credibility for the landing, calm authority for the product.

---

## 2. Design tokens

### 2.1 Color (exact values used across all mockups)

| Token | Value | Role |
|---|---|---|
| `paper` | `#faf6f1` | Page background |
| `paper-raised` | `#fbf8f4` | Table/card surfaces on paper |
| `paper-inset` | `#f5f0ea` | Sidebars, selected rows, quiet panels, hover fill |
| `ink` | `#292522` | Primary text, FROZEN/ADMIN pills, dark inversion surface |
| `ink-soft` | `#655d56` | Secondary text |
| `ink-muted` | `#776f68` / `#837a72` | Tertiary text, labels |
| `ink-faint` | `#9b9289` | Quietest text, table headers, metadata |
| `line` | `#ded7d0` | Default hairline borders/dividers |
| `line-soft` | `#e3dcd5` / `#e7e0d9` | Row dividers |
| `line-strong` | `#bdb4aa` / `#cfc5bc` | Emphasized borders (cards, inputs) |
| `signal` | `#ff3c00` | THE accent. Orange-red. Semantic only (see contract below) |
| `signal-press` | `#d63200` | Pill hover-fill color |
| `positive` | `#3f653e` on `#e7f0e5` | APPROVED/ALLOWED pill; `#4d7b49`/`#72946f` for accents |
| Dark surface set | bg `#292522`/`#322e2b`, line `#554d47`/`#4b4540`, text `#f3ede7`, muted `#a69d94`/`#8f857c` | Inverted sections |

**Signal-color contract (accent budget):** `#ff3c00` means *"requires or records human attention"* —
eyebrow labels, active-nav underline, pending/escalated/rejected states, critical scores, primary CTA,
the logo period. Never decorative. Positive/neutral facts stay ink or green.

### 2.2 Status pill vocabulary (consistent across every page)

`rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em]`

| State | Style |
|---|---|
| APPROVED / ALLOWED / ACTIVE | `bg-#e7f0e5 text-#3f653e` (green fill) |
| REJECTED / BLOCKED (tx) | `bg-#ff3c00 text-#faf6f1` (signal fill) |
| ESCALATED / PENDING / WATCH / APPROVER | `border-#ff3c00 text-#ff3c00` (signal outline) — ESCALATED gets a "HUMAN" chip |
| FROZEN / BLOCKED (vendor) / ADMIN | `bg-#292522 text-#faf6f1` (ink fill) |
| IDLE / VIEWER / neutral | `border-#ded7d0 text-#837a72` (quiet outline) |

### 2.3 Typography

- **Body/UI:** `Inter Tight` (400/500/600/700)
- **Data/labels:** `DM Mono` (400/500) — all timestamps, amounts, hashes, eyebrows, table headers, metadata
- **Numerals:** `tabular-nums` everywhere numbers live
- Scale & voice:
  - Page hero: `clamp(2.7rem…5.8rem)`, weight 600, `leading .84–.9`, tight tracking `-.075em … -.09em`
  - Landing hero: up to `clamp(4.4rem,10.5vw,10.5rem)`, `leading .8`, `tracking -.1em`
  - Section titles: 22–26px, weight 500–600, `tracking -.045em`
  - Eyebrow: mono 10px uppercase `tracking .17–.22em`, in `signal` — format `"CONTEXT / QUALIFIER"` (e.g. `QUORUM / HUMAN CONTROL`)
  - Body: 13–16px, `leading 1.45–1.5`, `ink-soft`
  - Micro-labels: mono 9px uppercase `tracking .12–.16em`
  - Muted-second-line headline device: `<span class="text-[#8d837b]">` for the quieter half of big headlines

### 2.4 Shape & depth

- **Two radius values only:** `rounded-full` (pills, buttons, avatars, status) and **square** (everything else — cards, tables, modals, inputs have 0 radius).
- Hairline borders do the structural work; whole layouts are drawn with `border-b` dividers rather than boxes.
- Shadows are rare and warm: offset "paper stack" shadows for feature cards/modals (`shadow-[14px_18px_0_#eee7df]`, `12px_14px_0_#e7e0d9`), soft ambient for toasts. No blur-heavy elevation.
- Inputs: borderless with `border-b` underline; focus moves underline to `signal`.

### 2.5 Motion DNA

- **One easing:** `cubic-bezier(.16,1,.3,1)` (spring-out). Secondary `ease` for color-only transitions.
- **Durations:** 220ms (hover/transform), 320ms (pill fill), 420ms (reveals/rows), 560ms (headline/policy-doc).
- **Stagger:** rows 55–90ms, cards 110–120ms via `--i`/`--row-i` custom-property delay.
- Signature interactions:
  - `warm-pill`: CTA fill slides up from below (`::before translateY(102%) → 0`), hover lifts `-1/-2px` + warm glow shadow `rgba(255,60,0,.32–.45)`; ghost variant fills with ink.
  - Rows enter with `translateY(8–12px)+fade`; hover nudges `translateX(3px)` + `inset 2px 0 0 #ff3c00` left rule.
  - Landing: scroll-reveal via IntersectionObserver (with fallback timer — never strand content), headline `clip-path` wipe, magnetic anchors (±4px), count-up numerals (~850–900ms cubic ease-out), parallax background grid (72px, capped 28px), BLOCKED pill "slam" shake, ESCALATED "HUMAN" chip slide-in.
- **`prefers-reduced-motion`: full branch** — animations and hover transforms disabled, everything visible. Non-negotiable on every surface.

---

## 3. Layout system

- **App shell:** top header `68px`, `border-b line`, logo `ARCANUM` + signal period (18px bold `tracking -.06em`), uppercase nav links (11–12px medium; active = ink text + 2px `signal` underline at header's bottom edge), right side: `ARC TESTNET` mono tag + org chip (rounded-full border, 22px ink avatar + org name). Nav scrolls horizontally on mobile.
- **Content container:** `max-w-[1400px]`, px 20/32, py 32–40.
- **Page header pattern (every page):** signal eyebrow → huge tight h1 → one-sentence description (max-w ~430–560px) → primary pill CTA on the right, all sitting on a `border-b` baseline.
- **KPI strip:** grid of 3–4 cells divided by `border-l` hairlines (no card boxes); mono 9px label on top, large tight number (32–36px), mono 9px note below; accent cell text in `signal`; count-up on load.
- **Master-detail:** table/list on the left + detail rail (`bg paper-inset`, border, ~360px) on the right (Ledger drawer, Agents dossier, Vendors detail band below).
- **Tables:** mono 9px uppercase header row; rows are buttons; selected row = `paper-inset` fill + inset left signal rule; per-row stagger entrance; footer meta row (`N visible records · policy/v4.18 · ARC / USDC`).
- **Filter bar:** rounded-full chip buttons (active = ink fill/white text), plus underline search input with `⌕`.
- **Modals:** centered, square, paper bg, offset paper-stack shadow, eyebrow + big title + underline inputs + pill actions. Backdrop `#292522` at ~10–18%.
- **Toasts/notices:** fixed bottom, square, ink bg with mono 10px paper text (or paper-inset variant); also inline "notice" text slots in section headers (mono, uppercase) for status narration.
- **Empty states:** dashed border box, mono uppercase message + plain-language hint (e.g. `REGISTER CLEAR · NO ACTIVE DEVIATIONS`).
- **Footer meta line:** mono 9px uppercase facts (`Policy/v4.18 · caps $500/tx · updated 10:43:02 UTC`).

---

## 4. Page blueprints (see mockups for full detail)

- **Landing (`WarmLedger.tsx`):** fixed left rail (86px: logo, vertical `ARC · GOVERNED`, numbered section nav 01–04 with active dot), utility top bar (Docs/GitHub/Launch), hero with parallax grid + giant headline ("Autonomous spend, accounted.") + **live governed ledger** signature module (streaming rows, verdict pills, "capital governed" count-up annotation), §01 control-loop 3-step strip, §02 executable policy document card (the rulebook as a signed instrument, paper-stack shadow, line-draw animation), §03 dark inversion "Nothing moves in the dark" with dark ledger, §04 closing CTA. `WarmLedgerClassic.tsx` is the simpler variant kept for reference.
- **Dashboard:** KPI strip (value governed, active agents, threats blocked, pending escalations) → governed event stream (left) + "Restraint queue" action rail on paper-inset (approve/reject with recorded-decision state, watchlist).
- **Agents:** registry list + selected-agent dossier rail (doctrine snapshot, caps grid, posture, recent decisions, Freeze/Edit-policy actions).
- **Ledger:** hero + export CTA, KPI strip, status filter chips + search, dense table, decision-record drawer (full mono dl of tx facts, Arcscan link, flag vendor).
- **Escalations:** queue as **document cards** — request amount → vendor, reason, quorum signature slots (signed vs awaiting-dashed), expiry countdown, Approve/Reject pills, rotated "RECORDED" stamp on resolved, copy approver-portal link.
- **Anomalies:** deviation-index gauge panel (giant signal number + tick scale), critical/elevated/resolved count strip, register table with sparklines + Restrain/Investigate/Dismiss, inline investigation trace.
- **Vendors:** allowlist stats, category chips + search, registry table, dashed "add vendor" row, selected-vendor band (cap-usage bar, Update cap / Block), add-vendor modal.
- **Settings:** left tab rail (signal left-rule active state), org facts strip, members table (hover-revealed Remove), invite modal.
- **Status:** 3 health cards (hover-extending top rule), plain-language read-model explainer panel, run-health-check action.

---

## 5. Implementation notes for the rebuild

- Mockups are self-contained files with inline `<style>` + hardcoded hex and Google-Fonts imports. **Productionize**: tokens → `packages/config/tailwind.preset.ts` + `globals.css` CSS variables; fonts via `next/font` (Inter Tight, DM Mono); shared primitives (StatusPill, Pill/Button, Shell, KPI strip, table, drawer, modal, toast) built once in `apps/web/components/ui` — not per page.
- Kill the 9,600-line `canvas/pages.tsx` pattern: one route = one file tree (execution guardrails, DESIGN-RESEARCH.md §7).
- Mockups use fixture data + local state. Wire to the real tRPC hooks (`lib/live-data.ts`), SIWE/wallet flow, and route surface documented in `FRONTEND_UIUX_CONTEXT.md` §3. The org chip replaces mock "HELIX-DAO" with the real org switcher; nav gains SETTINGS/STATUS access points (mockups show 6-item nav; full route surface still includes settings, status, policy editor, public approve/explorer/badge, docs, glossary — design them in this same language).
- Ship the full state inventory per surface (loading/empty/error/stale — DESIGN-RESEARCH.md §2.3): mockups show ideal + some empty states; the rest must be designed in-system (skeletons on paper, never blank-then-reload; "Updated Xs ago" staleness).
- Money rules: tabular numerals, no optimistic UI for approvals/denials/policy changes, middle-truncated hashes with copy-on-click, meaningful friction only for irreversible actions.
- Accessibility: WCAG 2.2 AA, focus-visible everywhere, keyboard-complete, reduced-motion branch on every animated surface. Verify at 390/768/1440.
