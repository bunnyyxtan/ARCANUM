import { useCallback, useState, type MouseEvent } from 'react';

import { WarmLedger } from './arcanum-landing/WarmLedger';
import Dashboard from './arcanum-app/Dashboard';
import Agents from './arcanum-app/Agents';
import { Vendors } from './arcanum-app/Vendors';
import { Ledger } from './arcanum-app/Ledger';
import { Escalations } from './arcanum-app/Escalations';
import { Anomalies } from './arcanum-app/Anomalies';
import { Settings } from './arcanum-app/Settings';
import { Status } from './arcanum-app/Status';

type PageKey =
  | 'LANDING'
  | 'DASHBOARD'
  | 'AGENTS'
  | 'VENDORS'
  | 'LEDGER'
  | 'ESCALATIONS'
  | 'ANOMALIES'
  | 'SETTINGS'
  | 'STATUS';

const PAGES: Record<PageKey, () => JSX.Element> = {
  LANDING: WarmLedger,
  DASHBOARD: Dashboard,
  AGENTS: Agents,
  VENDORS: Vendors,
  LEDGER: Ledger,
  ESCALATIONS: Escalations,
  ANOMALIES: Anomalies,
  SETTINGS: Settings,
  STATUS: Status,
};

const PAGE_KEYS = Object.keys(PAGES) as Array<PageKey>;

/** Labels that appear inside the mockups' own navs / CTAs, mapped to pages. */
const LABEL_TO_PAGE: Record<string, PageKey> = {
  LANDING: 'LANDING',
  DASHBOARD: 'DASHBOARD',
  AGENTS: 'AGENTS',
  VENDORS: 'VENDORS',
  LEDGER: 'LEDGER',
  ESCALATIONS: 'ESCALATIONS',
  ANOMALIES: 'ANOMALIES',
  SETTINGS: 'SETTINGS',
  STATUS: 'STATUS',
  'LAUNCH DASHBOARD': 'DASHBOARD',
  'LAUNCH DASHBOARD ↗': 'DASHBOARD',
  'ARCANUM.': 'LANDING',
};

/**
 * Single-frame preview of the entire Warm Ledger frontend.
 * Renders each page mockup full-bleed and makes their built-in nav links
 * actually switch pages, plus a small fixed switcher rail for pages that
 * are not in the in-app nav (Settings, Status, Landing).
 */
export function ArcanumFrontend() {
  const [page, setPage] = useState<PageKey>('LANDING');
  const Active = PAGES[page];

  const onClickCapture = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest('a, button');
    if (!el) return;
    const label = (el.textContent ?? '').trim().toUpperCase();
    const target =
      LABEL_TO_PAGE[label] ??
      (label.startsWith('LAUNCH DASHBOARD') ? 'DASHBOARD' : undefined);
    if (target) {
      e.preventDefault();
      e.stopPropagation();
      setPage(target);
      window.scrollTo({ top: 0 });
    }
  }, []);

  return (
    <div onClickCapture={onClickCapture}>
      <Active key={page} />

      {/* Fixed page switcher — preview chrome, not part of the design */}
      <div
        style={{
          position: 'fixed',
          bottom: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          gap: 2,
          padding: '5px 8px',
          background: '#292522',
          borderRadius: 999,
          boxShadow: '0 10px 30px rgba(41,37,34,.35)',
          fontFamily: "'DM Mono', monospace",
          fontSize: 9,
          letterSpacing: '.12em',
          maxWidth: 'calc(100vw - 24px)',
          overflowX: 'auto',
        }}
      >
        {PAGE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPage(key);
              window.scrollTo({ top: 0 });
            }}
            style={{
              padding: '5px 10px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: page === key ? '#ff3c00' : 'transparent',
              color: page === key ? '#faf6f1' : '#a69d94',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              letterSpacing: 'inherit',
            }}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ArcanumFrontend;
