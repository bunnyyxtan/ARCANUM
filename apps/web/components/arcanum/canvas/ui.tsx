"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

import { ThemeToggle } from "@/components/arcanum/ThemeToggle";
import {
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  CircleCheck,
  Copy,
  ExternalLink,
  LogOut,
  RefreshCw,
  Rows2,
  Rows3,
  Search,
  Settings,
  ShieldHalf,
  Snowflake,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { isValidElement, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { toast } from "sonner";
import { useBalance, useBlockNumber, useDisconnect } from "wagmi";

import {
  openCommandPalette,
  useArcanumDensity,
  usePresentationMode,
} from "@/lib/arcanum-preferences";
import { getArcscanAddressUrl } from "@/lib/arcscan";
import { publishAuthSession, useWorkspaceMode } from "@/lib/auth-session";
import { shortAddress } from "@/lib/format/address";
import { MotionButton, MotionDiv, MotionSpan } from "@/lib/motion-elements";
import {
  countUp,
  enterFade,
  enterRise,
  hoverLift,
  tickPulse,
  useReducedMotion,
} from "@/lib/motion/motion-config";
import { cn } from "@/lib/utils";
import {
  getWorkspaceFooterLabel,
  getWorkspaceHeaderLabel,
  getWorkspaceNotificationItems,
  getWorkspaceStatusColor,
  getWorkspaceSwitcherMessage,
} from "@/lib/workspace-labels";

export type NavKey = "overview" | "agents" | "vendors" | "ledger" | "escalations" | "anomalies";

const navItems: Array<{ key: NavKey; label: string; href: string; badge?: boolean }> = [
  { key: "overview", label: "OVERVIEW", href: "/dashboard" },
  { key: "agents", label: "AGENTS", href: "/agents" },
  { key: "vendors", label: "VENDORS", href: "/vendors" },
  { key: "ledger", label: "LEDGER", href: "/ledger" },
  { key: "escalations", label: "ESCALATIONS", href: "/escalations", badge: true },
  { key: "anomalies", label: "ANOMALIES", href: "/anomalies", badge: true },
];

const iconStroke = 1.75;

export const categoryColors: Record<string, string> = {
  API: "var(--wl-cat-api)",
  CMPT: "var(--wl-cat-compute)",
  COMPUTE: "var(--wl-cat-compute)",
  DATA: "var(--wl-cat-data)",
  SUB: "var(--wl-cat-sub)",
  SUBCON: "var(--wl-cat-sub)",
  SUBCONTRACTING: "var(--wl-cat-sub)",
  OTHER: "var(--wl-cat-other)",
};

export function GovernanceFrame({
  active,
  file,
  children,
  bellCount = 0,
  escalationCount = 0,
  anomalyCount = 0,
  showRange = true,
  relative = false,
}: Readonly<{
  active?: NavKey;
  file: string;
  children: ReactNode;
  bellCount?: number;
  escalationCount?: number;
  anomalyCount?: number;
  showRange?: boolean;
  relative?: boolean;
}>) {
  const reduced = useReducedMotion();
  const { density, toggleDensity } = useArcanumDensity();
  const { presentationMode } = usePresentationMode();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const hoverProps = reduced ? {} : { initial: "rest", variants: hoverLift, whileHover: "hover" };
  const workspace = useWorkspaceMode();
  const showSeededBadges = false;
  const visibleBellCount = showSeededBadges ? bellCount : 0;
  const orgLabel = getWorkspaceHeaderLabel(workspace.dataMode);
  const displayFile = file.replace("DEMO-WORKSPACE", orgLabel);
  const notificationItems = getWorkspaceNotificationItems(workspace.dataMode);

  return (
    <MotionDiv
      className={cn(
        "arcanum-page-root flex min-h-screen w-screen max-w-[100vw] flex-col overflow-x-clip bg-foundry-grid font-mono text-[var(--wl-text-body)]",
        presentationMode && "arcanum-presenting",
        relative && "relative",
      )}
      variants={reduced ? undefined : enterRise}
      initial={reduced ? false : "hidden"}
      animate={reduced ? undefined : "show"}
    >
      <header className="arcanum-chrome grid min-h-[56px] w-screen max-w-[100vw] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--wl-hairline)] bg-[var(--wl-bg)] px-3 py-2 sm:flex sm:flex-wrap sm:justify-between xl:flex-nowrap xl:px-6 xl:py-2">
        <div className="flex min-w-0 shrink items-center gap-4">
          <Link
            href="/dashboard"
            aria-label="Open dashboard"
            className="flex min-w-0 items-center overflow-hidden font-body text-[18px] font-bold tracking-[-.05em] text-[var(--wl-ink)] transition-transform duration-[220ms] hover:-translate-y-0.5"
          >
            ARCANUM<span className="text-[var(--wl-signal)]">.</span>
          </Link>
          <MotionButton
            type="button"
            onClick={() => toast.info(getWorkspaceSwitcherMessage(workspace.dataMode))}
            {...hoverProps}
            className="hidden min-w-0 max-w-[220px] items-center gap-2 font-body text-[12px] font-medium tracking-[-.01em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)] md:flex"
          >
            <span className="truncate">{orgLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0" strokeWidth={iconStroke} />
          </MotionButton>
        </div>

        <div className="relative flex min-w-0 flex-none flex-wrap items-center justify-end gap-1 sm:flex-1 sm:gap-2">
          <button
            type="button"
            aria-label="Open command search"
            onClick={openCommandPalette}
            className="hidden h-8 min-w-0 cursor-pointer items-center gap-2 rounded-full border border-[var(--wl-line)] bg-transparent px-3.5 text-left text-[var(--wl-mute)] transition-colors hover:border-[var(--wl-ink)] hover:text-[var(--wl-secondary)] md:flex md:w-[clamp(10rem,22vw,18rem)] 2xl:w-72"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={iconStroke} />
            <span className="min-w-0 flex-1 truncate whitespace-nowrap font-body text-[12px] tracking-[-.01em]">
              Search agents, vendors, tx...
            </span>
            <span className="ml-auto rounded-full border border-[var(--wl-line)] px-1.5 text-[10px] text-[var(--wl-mute)]">
              CTRL K
            </span>
          </button>
          <NetworkStatusPill />
          <Link
            href="/docs"
            className="hidden h-8 items-center gap-2 px-2 font-body text-[12px] font-medium tracking-[-.01em] text-[var(--wl-body)] transition-colors hover:text-[var(--wl-signal)] sm:flex"
          >
            <BookOpen className="h-3.5 w-3.5" strokeWidth={iconStroke} />
            Guide
          </Link>
          <Link
            href="/settings"
            aria-label="Open settings"
            title="SETTINGS"
            className="hidden h-8 w-8 items-center justify-center text-[var(--wl-body)] transition-transform duration-[220ms] hover:-translate-y-0.5 hover:text-[var(--wl-signal)] sm:flex"
          >
            <Settings className="h-4 w-4" strokeWidth={iconStroke} />
          </Link>
          <ThemeToggle className="hidden h-8 w-8 items-center justify-center text-[var(--wl-body)] transition-transform duration-[220ms] hover:-translate-y-0.5 hover:text-[var(--wl-signal)] sm:flex" />
          <MotionButton
            type="button"
            aria-label="Toggle density"
            title={`DENSITY ${density.toUpperCase()}`}
            onClick={toggleDensity}
            {...hoverProps}
            className="hidden h-8 w-8 items-center justify-center text-[var(--wl-body)] hover:text-[var(--wl-signal)] sm:flex"
          >
            {density === "compact" ? (
              <Rows3 className="h-4 w-4" strokeWidth={iconStroke} />
            ) : (
              <Rows2 className="h-4 w-4" strokeWidth={iconStroke} />
            )}
          </MotionButton>
          <MotionButton
            type="button"
            aria-expanded={notificationsOpen}
            aria-label="Open notifications"
            onClick={() => setNotificationsOpen((open) => !open)}
            {...hoverProps}
            className="relative hidden h-8 w-8 items-center justify-center text-[var(--wl-body)] hover:text-[var(--wl-signal)] sm:flex"
          >
            <Bell className="h-4 w-4" strokeWidth={iconStroke} />
            {visibleBellCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--wl-signal)] text-[9px] font-bold text-white">
                {visibleBellCount}
              </span>
            ) : null}
          </MotionButton>
          {notificationsOpen ? (
            <>
              <button
                type="button"
                aria-label="Close notifications"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setNotificationsOpen(false)}
              />
              <div className="absolute right-0 top-10 z-50 w-[min(20rem,calc(100vw-1.5rem))] border border-[var(--wl-hairline)] bg-[var(--wl-panel)] shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
                <div className="flex h-10 items-center justify-between border-b border-[var(--wl-hairline)] px-4 text-[11px] tracking-[0.16em]">
                  <span className="text-[var(--wl-text-body)]">NOTIFICATIONS</span>
                  <button
                    type="button"
                    aria-label="Close notifications"
                    onClick={() => setNotificationsOpen(false)}
                    className="text-[var(--wl-text-secondary)] hover:text-[var(--wl-text-body)]"
                  >
                    <X className="h-4 w-4" strokeWidth={iconStroke} />
                  </button>
                </div>
                <div className="divide-y divide-[var(--wl-hairline)] text-[12px]">
                  {notificationItems.map(([label, body]) => (
                    <div key={label} className="px-4 py-3">
                      <div className="text-[10px] tracking-[0.14em] text-[var(--wl-signal)]">{label}</div>
                      <div className="mt-1 text-[var(--wl-text-secondary)]">{body}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
          <WalletPill />
        </div>
      </header>

      <div className="arcanum-chrome flex min-h-10 w-screen max-w-[100vw] flex-wrap items-center justify-between gap-2 overflow-hidden border-b border-[var(--wl-hairline)] bg-[var(--wl-bg)] px-3 lg:flex-nowrap lg:px-6">
        <nav className="flex h-full min-w-0 flex-wrap items-center gap-4 font-body text-[12px] font-medium tracking-[-.01em]">
          {navItems.map((item) => {
            const selected = item.key === active;
            const badge = showSeededBadges
              ? item.key === "escalations"
                ? escalationCount
                : item.key === "anomalies"
                  ? anomalyCount
                  : undefined
              : undefined;
            const showBadge = item.badge && typeof badge === "number" && badge > 0;

            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "relative flex h-10 shrink-0 items-center px-1 transition-colors duration-[220ms] hover:text-[var(--wl-ink)]",
                  showBadge && "gap-1.5",
                  selected ? "text-[var(--wl-ink)]" : "text-[var(--wl-body)]",
                )}
              >
                {item.label}
                {showBadge ? (
                  <span className="rounded-full bg-[var(--wl-signal)] px-1.5 text-[10px] font-bold text-white">
                    {badge}
                  </span>
                ) : null}
                {selected ? (
                  <span className="absolute inset-x-0 bottom-[-1px] h-[2px] bg-[var(--wl-signal)]" />
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="hidden min-w-0 items-center gap-3 text-[11px] tracking-[0.1em] text-[var(--wl-text-muted)] lg:flex">
          <span className="truncate">{displayFile}</span>
          <span className="text-[var(--wl-line-strong)]">|</span>
          <span className="text-[var(--wl-text-secondary)]">REV 02:51:04Z</span>
          {showRange ? (
            <MotionButton
              type="button"
              onClick={() => toast.info("TIME RANGE / Live read model window")}
              {...hoverProps}
              className="flex items-center gap-1.5 border border-[var(--wl-hairline)] px-2 py-1 text-[var(--wl-text-secondary)] hover:text-[var(--wl-text-body)]"
            >
              24H <ChevronDown className="h-3 w-3" strokeWidth={iconStroke} />
            </MotionButton>
          ) : null}
          <MotionButton
            type="button"
            aria-label="Refresh local data"
            onClick={() =>
              toast.info("REFRESH / no polling started; use page retry controls for failed queries")
            }
            {...hoverProps}
            className="flex h-[26px] w-[26px] items-center justify-center border border-[var(--wl-hairline)] text-[var(--wl-text-secondary)] hover:text-[var(--wl-text-body)]"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={iconStroke} />
          </MotionButton>
        </div>
      </div>

      <div className="min-h-0 min-w-0 max-w-[100vw] flex-1 overflow-x-clip">{children}</div>

      <GovernanceFooter />
    </MotionDiv>
  );
}

function NetworkStatusPill() {
  const reduced = useReducedMotion();
  const { data } = useBlockNumber({
    query: {
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      staleTime: 300_000,
    },
    watch: false,
  });
  const blockNumber = data ? Number(data).toLocaleString("en-US") : "5,042,118";

  return (
    <Link
      href="/status"
      aria-label="Open Arc Testnet status"
      className="hidden h-8 items-center gap-2 rounded-full border border-[var(--wl-line)] px-3.5 font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)] transition-colors hover:border-[var(--wl-ink)] hover:text-[var(--wl-ink)] lg:flex"
    >
      <MotionSpan
        className="h-1.5 w-1.5 rounded-full bg-[var(--wl-green)]"
        variants={reduced ? undefined : tickPulse}
        initial={reduced ? undefined : "idle"}
        animate={reduced ? undefined : "pulse"}
      />
      <span className="text-[var(--wl-text-body)]">ARC-TESTNET</span>
      <span className="text-[var(--wl-line-strong)]">|</span>
      <span>BLK {blockNumber}</span>
      <span className="text-[var(--wl-line-strong)]">|</span>
      <span className="text-[var(--wl-green)]">0.48s</span>
    </Link>
  );
}

function WalletPill() {
  const reduced = useReducedMotion();
  const hoverProps = reduced ? {} : { initial: "rest", variants: hoverLift, whileHover: "hover" };

  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openConnectModal }) => {
        if (!mounted) {
          return (
            <div className="flex h-8 max-w-[46vw] items-center gap-2 truncate rounded-full bg-[var(--wl-signal)] px-3 font-body text-[11px] font-semibold tracking-[-.01em] text-white sm:px-4">
              <span className="sm:hidden">Connect</span>
              <span className="hidden sm:inline">Connect Wallet</span>
            </div>
          );
        }

        if (!account || !chain) {
          return (
            <MotionButton
              type="button"
              onClick={openConnectModal}
              {...hoverProps}
              className="flex h-8 max-w-[46vw] items-center gap-2 truncate rounded-full bg-[var(--wl-signal)] px-3 font-body text-[11px] font-semibold tracking-[-.01em] text-white transition-all hover:bg-[var(--wl-signal-deep)] sm:px-4"
            >
              <span className="sm:hidden">Connect</span>
              <span className="hidden sm:inline">Connect Wallet</span>
            </MotionButton>
          );
        }

        return <ConnectedWalletPill address={account.address} label={account.displayName} />;
      }}
    </ConnectButton.Custom>
  );
}

function ConnectedWalletPill({ address, label }: Readonly<{ address: string; label: string }>) {
  const reduced = useReducedMotion();
  const hoverProps = reduced ? {} : { initial: "rest", variants: hoverLift, whileHover: "hover" };
  const { disconnect } = useDisconnect();
  const [menuOpen, setMenuOpen] = useState(false);
  const workspace = useWorkspaceMode();
  const authStatus =
    workspace.sessionStatus === "checking"
      ? "checking"
      : workspace.isAuthenticated
        ? "authenticated"
        : "unauthenticated";
  const usdcAddress = process.env.NEXT_PUBLIC_USDC as `0x${string}` | undefined;
  const arcscanUrl = getArcscanAddressUrl(address);
  const { data: balance } = useBalance({
    address: address as `0x${string}`,
    query: {
      enabled: Boolean(address && usdcAddress),
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      staleTime: 300_000,
    },
    token: usdcAddress,
  });

  const short = label || shortAddress(address);
  const usdc = balance
    ? `${Number(balance.formatted).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${balance.symbol}`
    : null;
  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success("WALLET ADDRESS COPIED");
    } catch {
      toast.error("ADDRESS COPY FAILED");
    }
  };

  const disconnectWallet = async () => {
    await fetch("/api/auth/logout", { credentials: "include", method: "POST" });
    publishAuthSession(null);
    setMenuOpen(false);
    disconnect();
  };

  const retrySignature = () => {
    window.dispatchEvent(new CustomEvent("arcanum:wallet-auth-retry"));
  };

  return (
    <div className="relative min-w-0">
      <MotionButton
        type="button"
        aria-expanded={menuOpen}
        aria-label="Open wallet menu"
        onClick={() => setMenuOpen((open) => !open)}
        {...hoverProps}
        className="group flex h-8 max-w-[48vw] items-center gap-2 rounded-full border border-[var(--wl-line)] pl-1.5 pr-2.5 font-body text-[11px] font-medium tracking-[-.01em] text-[var(--wl-body)] transition-all duration-[220ms] hover:-translate-y-0.5 hover:border-[var(--wl-ink)] hover:text-[var(--wl-ink)] sm:max-w-[18rem]"
      >
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--wl-ink)] font-mono text-[9px] text-[var(--wl-bg)]">
          {short.slice(2, 4).toUpperCase()}
        </span>
        <span className="truncate">{authStatus === "authenticated" ? short : "SIGN IN"}</span>
        {usdc ? <span className="hidden text-[var(--wl-green)] sm:inline">{usdc}</span> : null}
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", menuOpen && "rotate-180")}
          strokeWidth={iconStroke}
        />
      </MotionButton>
      {menuOpen ? (
        <>
          <button
            type="button"
            aria-label="Close wallet menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 top-10 z-50 w-[min(21.25rem,calc(100vw-1.5rem))] border border-[var(--wl-hairline)] bg-[var(--wl-panel)] shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
            <div className="border-b border-[var(--wl-hairline)] p-4">
              <div className="text-[10px] tracking-[0.16em] text-[var(--wl-text-muted)]">CONNECTED WALLET</div>
              <div className="mt-1 min-w-0 truncate font-mono text-[12px] text-[var(--wl-text-body)]">
                {address}
              </div>
              <div
                className={cn(
                  "mt-2 flex items-center gap-2 text-[10px] tracking-[0.14em]",
                  authStatus === "authenticated" ? "text-[var(--wl-green)]" : "text-[var(--wl-amber)]",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5",
                    authStatus === "authenticated" ? "bg-[var(--wl-green)]" : "bg-[var(--wl-amber)]",
                  )}
                />
                {authStatus === "checking"
                  ? "CHECKING SIGNED SESSION"
                  : authStatus === "authenticated"
                    ? "SIGNED SESSION ACTIVE"
                    : "SIGNATURE REQUIRED"}
              </div>
              <div className="mt-3 border border-[var(--wl-hairline)] bg-[var(--wl-inset)] p-3">
                <div className="font-cond text-[28px] font-semibold leading-none text-[var(--wl-text-primary)]">
                  {usdc ?? "BALANCE PENDING"}
                </div>
                <div className="mt-1 text-[10px] tracking-[0.14em] text-[var(--wl-text-muted)]">
                  ARC TESTNET USDC
                </div>
              </div>
            </div>
            <div className="divide-y divide-[var(--wl-hairline)] text-[12px]">
              <button
                type="button"
                onClick={() => void copyAddress()}
                className="flex h-10 w-full items-center gap-2 px-4 text-left text-[var(--wl-text-secondary)] hover:bg-[var(--wl-panel-hover)] hover:text-[var(--wl-text-body)]"
              >
                <Copy className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                COPY ADDRESS
              </button>
              <a
                href={arcscanUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="flex h-10 items-center gap-2 px-4 text-[var(--wl-text-secondary)] hover:bg-[var(--wl-panel-hover)] hover:text-[var(--wl-text-body)]"
              >
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                VIEW ON ARCSCAN
              </a>
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex h-10 items-center gap-2 px-4 text-[var(--wl-text-secondary)] hover:bg-[var(--wl-panel-hover)] hover:text-[var(--wl-text-body)]"
              >
                <Settings className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                SETTINGS
              </Link>
              {authStatus !== "authenticated" ? (
                <button
                  type="button"
                  onClick={retrySignature}
                  className="flex h-10 w-full cursor-pointer items-center gap-2 px-4 text-left text-[var(--wl-amber)] hover:bg-[var(--wl-amber-tint)]"
                >
                  <CircleCheck className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                  RETRY SIGNATURE
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void disconnectWallet()}
                className="flex h-10 w-full cursor-pointer items-center gap-2 px-4 text-left text-[var(--wl-signal)] hover:bg-[var(--wl-amber-tint)]"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                DISCONNECT
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function GovernanceFooter() {
  const reduced = useReducedMotion();
  const workspace = useWorkspaceMode();
  const statusLabel = getWorkspaceFooterLabel(workspace.dataMode);
  const statusColor = getWorkspaceStatusColor(workspace.dataMode);
  const signerLabel = workspace.signedAddress
    ? `SIGNER ${shortAddress(workspace.signedAddress)}`
    : workspace.address
      ? `WALLET ${shortAddress(workspace.address)}`
      : "NO SIGNER";

  return (
    <footer className="arcanum-footer sticky bottom-0 z-30 flex min-h-8 w-screen max-w-[100vw] shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 overflow-x-clip border-t border-[var(--wl-hairline)] bg-[var(--wl-panel2)] px-3 py-1 text-[10px] tracking-[0.12em] text-[var(--wl-text-muted)] lg:flex-nowrap lg:px-5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5" style={{ color: statusColor }}>
          <MotionSpan
            className="h-1.5 w-1.5"
            style={{ background: statusColor }}
            variants={reduced ? undefined : tickPulse}
            initial={reduced ? undefined : "idle"}
            animate={reduced ? undefined : "pulse"}
          />
          {statusLabel}
        </span>
        <span>{signerLabel}</span>
        <span className="text-[var(--wl-line-strong)]">|</span>
        <span>
          DOCTRINE ENGINE:{" "}
          <span style={{ color: workspace.isAuthenticated ? "var(--wl-green)" : "var(--wl-amber)" }}>
            {workspace.isAuthenticated ? "ACTIVE" : "WAITING"}
          </span>
        </span>
      </div>
      <div className="hidden min-w-0 items-center gap-4 sm:flex">
        <span>RPC 47ms</span>
        <span className="text-[var(--wl-line-strong)]">|</span>
        <span>ARCANUM v0.9.2</span>
      </div>
    </footer>
  );
}

export function PanelHeader({
  title,
  meta,
  children,
}: Readonly<{ title: string; meta?: ReactNode; children?: ReactNode }>) {
  return (
    <div className="flex h-9 items-center justify-between border-b border-[var(--wl-hairline)] px-4">
      <span className="text-[11px] tracking-[0.22em] text-[var(--wl-text-secondary)]">{title}</span>
      {children ?? <span className="text-[10px] tracking-[0.14em] text-[var(--wl-text-muted)]">{meta}</span>}
    </div>
  );
}

export function HazardStripe({ className }: Readonly<{ className?: string }>) {
  return (
    <div
      className={cn("w-2", className)}
      style={{
        background: "repeating-linear-gradient(45deg,var(--wl-signal) 0 8px,var(--wl-hazard-tint) 8px 16px)",
      }}
    />
  );
}

export function CornerMarks() {
  return (
    <>
      <span className="absolute left-1.5 top-1.5 h-3 w-3 border-l-2 border-t-2 border-[var(--wl-signal)]" />
      <span className="absolute right-1.5 top-1.5 h-3 w-3 border-r-2 border-t-2 border-[var(--wl-signal)]" />
      <span className="absolute bottom-1.5 left-1.5 h-3 w-3 border-b-2 border-l-2 border-[var(--wl-signal)]" />
      <span className="absolute bottom-1.5 right-1.5 h-3 w-3 border-b-2 border-r-2 border-[var(--wl-signal)]" />
    </>
  );
}

export function Gauge({
  value,
  marker,
  markerLabel,
  label = "POSTURE GAUGE",
  min = "00",
  max = "100",
  hazard = false,
}: Readonly<{
  value: number;
  marker?: number;
  markerLabel?: string;
  label?: string;
  min?: string;
  max?: string;
  hazard?: boolean;
}>) {
  const markerStyle =
    marker !== undefined ? ({ left: `${marker}%` } satisfies CSSProperties) : undefined;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between text-[9px] tracking-[0.2em] text-[var(--wl-text-muted)]">
        <span>{min}</span>
        <span>{label}</span>
        <span>{max}</span>
      </div>
      <div className="relative mt-2 h-6 w-full">
        <div
          className="absolute inset-x-0 top-1/2 h-6 -translate-y-1/2"
          style={{
            background: "repeating-linear-gradient(90deg,var(--wl-line-muted) 0 1px,transparent 1px 13px)",
          }}
        />
        <div
          className={cn(
            "absolute top-1/2 h-[3px] -translate-y-1/2",
            hazard ? "bg-[var(--wl-signal)]" : "bg-[var(--wl-line-active)]",
          )}
          style={{ left: 0, width: `${value}%` }}
        />
        {markerStyle ? (
          <>
            <div
              className="absolute bottom-0 top-0 w-[2px] bg-[var(--wl-signal)] opacity-40"
              style={markerStyle}
            />
            {markerLabel ? (
              <div
                className="absolute -bottom-4 -translate-x-1/2 text-[8px] tracking-[0.08em] text-[var(--wl-text-muted)]"
                style={markerStyle}
              >
                {markerLabel}
              </div>
            ) : null}
          </>
        ) : null}
        <div
          className="absolute bottom-0 top-0 w-[2px] bg-[var(--wl-signal)]"
          style={{ left: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function CategoryTick({ category, label }: Readonly<{ category: string; label?: string }>) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-[var(--wl-text-secondary)]">
      <span className="h-3 w-1" style={{ background: categoryColors[category] ?? "var(--wl-cat-other)" }} />
      {label ?? category}
    </span>
  );
}

export function CategoryBars({ categories }: Readonly<{ categories: readonly string[] }>) {
  if (categories.length === 0) {
    return <div className="text-[12px] text-[var(--wl-text-muted)]">-</div>;
  }

  return (
    <div className="flex items-center gap-1">
      {categories.map((category) => (
        <span
          key={category}
          className="h-3.5 w-1"
          style={{ background: categoryColors[category] ?? "var(--wl-cat-other)" }}
        />
      ))}
    </div>
  );
}

export function StatusLabel({
  status,
  align = "left",
}: Readonly<{ status: string; align?: "left" | "right" }>) {
  const normalized = status.toUpperCase();
  const color =
    normalized === "APPROVED" || normalized === "ACTIVE"
      ? "var(--wl-green)"
      : normalized === "ESCALATED"
        ? "var(--wl-amber)"
        : "var(--wl-signal)";
  const Icon =
    normalized === "APPROVED"
      ? Check
      : normalized === "ACTIVE"
        ? CircleCheck
        : normalized === "ESCALATED"
          ? TriangleAlert
          : normalized === "FROZEN"
            ? Snowflake
            : X;

  return (
    <span
      className={cn("flex items-center gap-1 text-[10px]", align === "right" && "justify-end")}
      style={{ color }}
    >
      <Icon className="h-3 w-3" strokeWidth={iconStroke} />
      {normalized}
    </span>
  );
}

export function CopyIcon() {
  return <Copy className="h-3 w-3 cursor-pointer hover:text-[var(--wl-text-secondary)]" strokeWidth={iconStroke} />;
}

export function ProgressLine({
  width,
  color = "var(--wl-line-active)",
  threshold = true,
  className,
}: Readonly<{ width: number; color?: string; threshold?: boolean; className?: string }>) {
  return (
    <div className={cn("relative mt-1 h-1 w-24 bg-[var(--wl-panel-muted)]", className)}>
      <div className="h-full" style={{ width: `${width}%`, background: color }} />
      {threshold ? (
        <div className="absolute bottom-0 top-0 w-px bg-[var(--wl-text-muted)]" style={{ left: "75%" }} />
      ) : null}
    </div>
  );
}

export function StatTile({
  label,
  value,
  valueClassName,
  caption,
  children,
  accent = false,
  motionIndex = 0,
}: Readonly<{
  label: string;
  value: ReactNode;
  valueClassName?: string;
  caption?: ReactNode;
  children?: ReactNode;
  accent?: boolean;
  motionIndex?: number;
}>) {
  const reduced = useReducedMotion();

  return (
    <MotionDiv
      className="panel-py relative p-5"
      custom={motionIndex}
      variants={reduced ? undefined : enterFade}
      initial={reduced ? false : "hidden"}
      animate={reduced ? undefined : "show"}
    >
      {accent ? <div className="absolute inset-y-0 left-0 w-[3px] bg-[var(--wl-signal)]" /> : null}
      <div className="text-[10px] tracking-[0.2em] text-[var(--wl-text-muted)]">{label}</div>
      <div
        className={cn(
          "mt-2 font-cond text-[34px] font-semibold leading-none text-[var(--wl-text-primary)]",
          valueClassName,
        )}
      >
        <AnimatedStatValue value={value} />
      </div>
      {children}
      {caption ? (
        <div className="mt-1 text-[10px] tracking-[0.08em] text-[var(--wl-text-muted)]">{caption}</div>
      ) : null}
    </MotionDiv>
  );
}

export function RowShell({
  children,
  danger,
  className,
}: Readonly<{ children: ReactNode; danger?: boolean; className?: string }>) {
  const reduced = useReducedMotion();

  return (
    <MotionDiv
      className={cn("arcanum-row hover:bg-[var(--wl-panel-hover)]", danger && "bg-[var(--wl-amber-tint)]", className)}
      variants={reduced ? undefined : hoverLift}
      initial={reduced ? false : "rest"}
      whileHover={reduced ? undefined : "hover"}
    >
      {children}
    </MotionDiv>
  );
}

function AnimatedStatValue({ value }: Readonly<{ value: ReactNode }>) {
  const reduced = useReducedMotion();
  const parsed = useMemo(() => parseStatValue(value), [value]);
  const [current, setCurrent] = useState(parsed?.to ?? 0);

  useEffect(() => {
    if (!parsed) {
      return undefined;
    }

    if (reduced) {
      setCurrent(parsed.to);
      return undefined;
    }

    setCurrent(parsed.from);
    return countUp(parsed.from, parsed.to, 640, setCurrent);
  }, [parsed, reduced]);

  if (!parsed) {
    return value;
  }

  const formatted = formatAnimatedNumber(current, parsed);
  const [whole, decimal] = formatted.split(".");

  return (
    <>
      {parsed.prefix}
      {whole}
      {decimal ? <span className="text-[var(--wl-text-secondary)]">.{decimal}</span> : null}
      {parsed.suffix}
    </>
  );
}

type ParsedStat = {
  from: number;
  to: number;
  prefix: string;
  suffix: string;
  decimals: number;
  leading: number;
  grouped: boolean;
};

function parseStatValue(value: ReactNode): ParsedStat | null {
  const text = textFromNode(value).trim();
  const match = /^([^0-9-]*)(-?[0-9][0-9,]*(?:\.[0-9]+)?)(.*)$/.exec(text);

  if (!match) {
    return null;
  }

  const [, prefix = "", rawNumber = "", suffix = ""] = match;
  const normalized = rawNumber.replaceAll(",", "");
  const to = Number(normalized);

  if (!Number.isFinite(to)) {
    return null;
  }

  const decimal = normalized.split(".")[1];
  const integer = normalized.split(".")[0] ?? "";

  return {
    decimals: decimal?.length ?? 0,
    from: 0,
    grouped: rawNumber.includes(","),
    leading: integer.startsWith("0") ? integer.length : 0,
    prefix,
    suffix,
    to,
  };
}

function formatAnimatedNumber(value: number, parsed: ParsedStat) {
  const fixed = Math.max(0, value).toLocaleString("en-US", {
    maximumFractionDigits: parsed.decimals,
    minimumFractionDigits: parsed.decimals,
    useGrouping: parsed.grouped,
  });

  if (parsed.leading > 0 && parsed.decimals === 0) {
    return String(Math.round(value)).padStart(parsed.leading, "0");
  }

  return fixed;
}

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(textFromNode).join("");
  }

  if (isValidElement(node)) {
    return textFromNode((node as ReactElement<{ children?: ReactNode }>).props.children);
  }

  return "";
}
