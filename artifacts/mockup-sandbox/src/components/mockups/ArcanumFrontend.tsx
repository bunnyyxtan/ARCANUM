import { useCallback, useEffect, useState, type MouseEvent, type ReactElement } from 'react';

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

const PAGES: Record<PageKey, () => ReactElement> = {
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
 * actually switch pages through the product's own navigation.
 */
export function ArcanumFrontend() {
  const [page, setPage] = useState<PageKey>('LANDING');
  const Active = PAGES[page];

  useEffect(() => {
    const onConnected = () => {
      setPage('DASHBOARD');
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('arcanum-connected', onConnected);
    return () => window.removeEventListener('arcanum-connected', onConnected);
  }, []);

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
      if (page === 'LANDING' && target === 'DASHBOARD') {
        window.dispatchEvent(new CustomEvent('arcanum-connect'));
        return;
      }
      setPage(target);
      window.scrollTo({ top: 0 });
    }
  }, [page]);

  return (
    <div onClickCapture={onClickCapture}>
      <Active key={page} />
    </div>
  );
}

export default ArcanumFrontend;
