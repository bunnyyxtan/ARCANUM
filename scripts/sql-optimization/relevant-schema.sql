-- CI fixture extracted from the production public-schema.sql captured on
-- 2026-09-23.  It intentionally contains the complete production definitions
-- (columns, defaults, checks, keys, FKs, and indexes) for the optimization
-- migrations' read/write set, but no application rows.

CREATE TYPE public.anomaly_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.anomaly_status AS ENUM ('open', 'reviewed', 'dismissed', 'resolved');
CREATE TYPE public.doctrine_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE public.ledger_event_status AS ENUM
  ('allowed', 'blocked', 'escalated', 'pending', 'reversed', 'approved', 'rejected', 'frozen');
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'approver', 'viewer', 'operator');
CREATE TYPE public.wallet_status AS ENUM
  ('pending_indexer', 'active', 'frozen', 'under_restraint', 'idle');

CREATE TABLE public.profiles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  wallet_address text NOT NULL,
  display_name text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  avatar_url text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT profiles_wallet_address_check CHECK (wallet_address = lower(wallet_address)),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_wallet_address_key UNIQUE (wallet_address)
);

CREATE TABLE public.organizations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  safe_address text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  plan text DEFAULT 'demo'::text NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT organizations_safe_address_check CHECK (safe_address = lower(safe_address)),
  CONSTRAINT organizations_pkey PRIMARY KEY (id),
  CONSTRAINT organizations_slug_key UNIQUE (slug),
  CONSTRAINT organizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.organization_members (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  role public.org_role DEFAULT 'viewer'::public.org_role NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT organization_members_pkey PRIMARY KEY (id),
  CONSTRAINT organization_members_organization_id_profile_id_key
    UNIQUE (organization_id, profile_id),
  CONSTRAINT organization_members_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT organization_members_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.governed_wallets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  wallet_address text NOT NULL,
  owner_address text,
  label text,
  status public.wallet_status DEFAULT 'pending_indexer'::public.wallet_status NOT NULL,
  deploy_tx_hash text,
  chain_id integer NOT NULL,
  indexer_status text,
  data_source text DEFAULT 'live'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  wallet_factory_address text,
  policy_engine_address text,
  escalation_manager_address text,
  anomaly_oracle_address text,
  vendor_registry_address text,
  created_by uuid,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  owner_sync_block bigint,
  owner_sync_log_index bigint,
  owner_sync_tx_hash text,
  CONSTRAINT governed_wallets_owner_address_check CHECK (owner_address = lower(owner_address)),
  CONSTRAINT governed_wallets_wallet_address_check CHECK (wallet_address = lower(wallet_address)),
  CONSTRAINT governed_wallets_pkey PRIMARY KEY (id),
  CONSTRAINT governed_wallets_wallet_address_chain_id_key UNIQUE (wallet_address, chain_id),
  CONSTRAINT governed_wallets_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE TABLE public.doctrines (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  governed_wallet_id uuid NOT NULL,
  name text NOT NULL,
  daily_cap_usdc numeric(28,6),
  per_tx_cap_usdc numeric(28,6),
  per_vendor_daily_cap_usdc numeric(28,6),
  monthly_cap_usdc numeric(28,6),
  escalate_above_usdc numeric(28,6),
  allowed_categories text[],
  require_vendor_allowlist boolean DEFAULT false NOT NULL,
  anomaly_threshold numeric(10,4),
  quorum integer,
  signers text[],
  escalation_council text[],
  status public.doctrine_status DEFAULT 'draft'::public.doctrine_status NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  organization_id uuid,
  version integer DEFAULT 1 NOT NULL,
  source text DEFAULT 'local'::text NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  freeze_on_blocked_vendor boolean DEFAULT false NOT NULL,
  CONSTRAINT doctrines_pkey PRIMARY KEY (id),
  CONSTRAINT doctrines_governed_wallet_id_fkey
    FOREIGN KEY (governed_wallet_id) REFERENCES public.governed_wallets(id) ON DELETE CASCADE
);

CREATE TABLE public.ledger_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  governed_wallet_id uuid,
  tx_hash text,
  event_time timestamp with time zone DEFAULT now() NOT NULL,
  agent_label text,
  category text,
  counterparty_name text,
  counterparty_address text,
  amount_usdc numeric(28,6),
  status public.ledger_event_status DEFAULT 'pending'::public.ledger_event_status NOT NULL,
  decision_reason text,
  block_number bigint,
  data_source text DEFAULT 'live'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  chain_id integer DEFAULT 5042002 NOT NULL,
  policy_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
  raw_calldata text,
  log_index integer NOT NULL,
  CONSTRAINT ledger_events_counterparty_address_check
    CHECK (counterparty_address = lower(counterparty_address)),
  CONSTRAINT ledger_events_pkey PRIMARY KEY (id),
  CONSTRAINT ledger_events_governed_wallet_id_fkey
    FOREIGN KEY (governed_wallet_id) REFERENCES public.governed_wallets(id) ON DELETE SET NULL,
  CONSTRAINT ledger_events_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE TABLE public.anomalies (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  governed_wallet_id uuid,
  severity public.anomaly_severity DEFAULT 'low'::public.anomaly_severity NOT NULL,
  score numeric(6,4),
  title text NOT NULL,
  description text,
  status public.anomaly_status DEFAULT 'open'::public.anomaly_status NOT NULL,
  metadata jsonb,
  data_source text DEFAULT 'live'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  detected_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  decided_by text,
  decided_at timestamp with time zone,
  decision_reason text,
  CONSTRAINT anomalies_pkey PRIMARY KEY (id),
  CONSTRAINT anomalies_governed_wallet_id_fkey
    FOREIGN KEY (governed_wallet_id) REFERENCES public.governed_wallets(id) ON DELETE SET NULL,
  CONSTRAINT anomalies_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE TABLE public.governance_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  governed_wallet_id uuid NOT NULL,
  event_type text NOT NULL,
  severity text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  block_number bigint NOT NULL,
  tx_hash text NOT NULL,
  chain_id bigint NOT NULL,
  event_time timestamp with time zone NOT NULL,
  data_source text DEFAULT 'live'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT governance_events_pkey PRIMARY KEY (id),
  CONSTRAINT governance_events_reindex_key UNIQUE (tx_hash, event_type, governed_wallet_id),
  CONSTRAINT governance_events_governed_wallet_id_fkey
    FOREIGN KEY (governed_wallet_id) REFERENCES public.governed_wallets(id) ON DELETE CASCADE,
  CONSTRAINT governance_events_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE INDEX anomalies_org_idx ON public.anomalies (organization_id);
CREATE INDEX anomalies_severity_idx ON public.anomalies (severity);
CREATE INDEX anomalies_status_idx ON public.anomalies (status);
CREATE INDEX anomalies_wallet_idx ON public.anomalies (governed_wallet_id);
CREATE INDEX idx_anom_created ON public.anomalies (created_at DESC);
CREATE INDEX idx_anom_org ON public.anomalies (organization_id);
CREATE INDEX idx_anom_severity ON public.anomalies (severity);
CREATE INDEX idx_anom_status ON public.anomalies (status);
CREATE INDEX idx_anom_wallet ON public.anomalies (governed_wallet_id);
CREATE UNIQUE INDEX doctrines_wallet_version_uidx ON public.doctrines (governed_wallet_id, version);
CREATE INDEX idx_doctrines_status ON public.doctrines (status);
CREATE INDEX idx_doctrines_wallet ON public.doctrines (governed_wallet_id);
CREATE INDEX governance_events_governed_wallet_id_idx ON public.governance_events (governed_wallet_id);
CREATE INDEX governance_events_org_time_idx ON public.governance_events (organization_id, event_time DESC);
CREATE UNIQUE INDEX governed_wallets_chain_wallet_lower_uidx
  ON public.governed_wallets (chain_id, lower(wallet_address));
CREATE INDEX governed_wallets_owner_sync_order_idx
  ON public.governed_wallets (chain_id, wallet_address, owner_sync_block, owner_sync_log_index);
CREATE INDEX idx_gw_chain ON public.governed_wallets (chain_id);
CREATE INDEX idx_gw_data_source ON public.governed_wallets (data_source);
CREATE INDEX idx_gw_org ON public.governed_wallets (organization_id);
CREATE INDEX idx_gw_status ON public.governed_wallets (status);
CREATE INDEX idx_gw_wallet ON public.governed_wallets (wallet_address);
CREATE INDEX idx_le_data_source ON public.ledger_events (data_source);
CREATE INDEX idx_le_event_time ON public.ledger_events (event_time DESC);
CREATE INDEX idx_le_org ON public.ledger_events (organization_id);
CREATE INDEX idx_le_org_time ON public.ledger_events (organization_id, event_time DESC);
CREATE INDEX idx_le_status ON public.ledger_events (status);
CREATE INDEX idx_le_tx_hash ON public.ledger_events (tx_hash);
CREATE INDEX idx_le_wallet ON public.ledger_events (governed_wallet_id);
CREATE INDEX ledger_events_org_idx ON public.ledger_events (organization_id);
CREATE INDEX ledger_events_status_idx ON public.ledger_events (status);
CREATE INDEX ledger_events_time_idx ON public.ledger_events (event_time DESC);
CREATE INDEX ledger_events_tx_hash_idx ON public.ledger_events (tx_hash);
CREATE INDEX ledger_events_wallet_idx ON public.ledger_events (governed_wallet_id);
CREATE UNIQUE INDEX ledger_events_chain_tx_log_unique
  ON public.ledger_events (chain_id, tx_hash, log_index);
CREATE INDEX idx_org_members_org ON public.organization_members (organization_id);
CREATE INDEX idx_org_members_profile ON public.organization_members (profile_id);
CREATE INDEX organization_members_org_idx ON public.organization_members (organization_id);
CREATE UNIQUE INDEX organization_members_org_profile_uidx
  ON public.organization_members (organization_id, profile_id);
CREATE INDEX organization_members_profile_idx ON public.organization_members (profile_id);
CREATE INDEX idx_orgs_safe_address ON public.organizations (safe_address);
CREATE INDEX idx_orgs_slug ON public.organizations (slug);
CREATE UNIQUE INDEX organizations_slug_uidx ON public.organizations (slug);
CREATE INDEX idx_profiles_wallet ON public.profiles (wallet_address);
CREATE UNIQUE INDEX profiles_wallet_address_lower_uidx ON public.profiles (lower(wallet_address));

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;