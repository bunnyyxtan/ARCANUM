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
import { AgentDetail } from './arcanum-app/AgentDetail';
import { PolicyEditor } from './arcanum-app/PolicyEditor';
import { Approve } from './arcanum-app/Approve';
import { Explorer } from './arcanum-app/Explorer';
import { Badge } from './arcanum-app/Badge';
import { Docs } from './arcanum-app/Docs';
import { Glossary } from './arcanum-app/Glossary';

type PageKey =
  | 'LANDING'
  | 'DASHBOARD'
  | 'AGENTS'
  | 'VENDORS'
  | 'LEDGER'
  | 'ESCALATIONS'
  | 'ANOMALIES'
  | 'SETTINGS'
  | 'STATUS'
  | 'AGENT_DETAIL'
  | 'POLICY_EDITOR'
  | 'DOCS'
  | 'GLOSSARY'
  | 'EXPLORER'
  | 'BADGE'
  | 'APPROVE';

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
  AGENT_DETAIL: AgentDetail,
  POLICY_EDITOR: PolicyEditor,
  DOCS: Docs,
  GLOSSARY: Glossary,
  EXPLORER: Explorer,
  BADGE: Badge,
  APPROVE: Approve,
};

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
  DOCS: 'DOCS',
  GUIDE: 'DOCS',
  GLOSSARY: 'GLOSSARY',
  EXPLORER: 'EXPLORER',
  BADGE: 'BADGE',
  'LAUNCH DASHBOARD': 'DASHBOARD',
  'LAUNCH DASHBOARD ↗': 'DASHBOARD',
  'ARCANUM.': 'LANDING',
};

/**
 * Single-frame preview of the entire Warm Ledger frontend.
 * Renders each page mockup full-bleed and makes their built-in nav links
 * actually switch pages. Navigation resolves in two ways:
 * 1. an explicit `data-nav="PAGE_KEY"` attribute on the link/button, or
 * 2. the link/button's visible label matching a known page name.
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
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-nav], a, button');
    if (!el) return;
    const navKey = el.dataset.nav?.trim().toUpperCase();
    const label = (el.textContent ?? '').trim().toUpperCase();
    const target =
      (navKey && navKey in PAGES ? (navKey as PageKey) : undefined) ??
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
