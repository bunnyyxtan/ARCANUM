"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
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
  API: "#5E7FB5",
  CMPT: "#3FA89B",
  COMPUTE: "#3FA89B",
  DATA: "#8E7CC0",
  SUB: "#C77F45",
  SUBCON: "#C77F45",
  SUBCONTRACTING: "#C77F45",
  OTHER: "#6B7280",
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
        "arcanum-page-root flex min-h-screen w-screen max-w-[100vw] flex-col overflow-x-clip bg-foundry-grid font-mono text-[#D7DBE0]",
        presentationMode && "arcanum-presenting",
        relative && "relative",
      )}
      variants={reduced ? undefined : enterRise}
      initial={reduced ? false : "hidden"}
      animate={reduced ? undefined : "show"}
    >
      <header className="arcanum-chrome grid min-h-[52px] w-screen max-w-[100vw] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-[#282C34] bg-[#16181D] px-3 py-2 sm:flex sm:flex-wrap sm:justify-between xl:flex-nowrap xl:px-5 xl:py-2">
        <div className="flex min-w-0 shrink items-center gap-3">
          <Link
            href="/dashboard"
            aria-label="Open dashboard"
            className="flex min-w-0 items-center gap-2.5 overflow-hidden"
          >
            <img
              src="/brand/arcanum-logo.png"
              alt="Arcanum"
              className="h-8 w-auto object-contain"
            />
            <span className="truncate font-cond text-[17px] font-bold tracking-[0.16em] text-[#EDF0F3]">
              ARCANUM
            </span>
            <span className="hidden text-[11px] tracking-[0.2em] text-[#5B626C] sm:inline">
              / GOVERNANCE
            </span>
          </Link>
          <div className="hidden h-5 w-px bg-[#282C34] sm:block" />
          <MotionButton
            type="button"
            onClick={() => toast.info(getWorkspaceSwitcherMessage(workspace.dataMode))}
            {...hoverProps}
            className="hidden min-w-0 max-w-[220px] items-center gap-2 text-[12px] tracking-[0.08em] text-[#8A909B] hover:text-[#D7DBE0] md:flex"
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
            className="hidden h-8 min-w-0 cursor-pointer items-center gap-2 border border-[#282C34] bg-[#101216] px-3 text-left text-[#5B626C] hover:border-[#3A4250] hover:text-[#8A909B] md:flex md:w-[clamp(10rem,22vw,18rem)] 2xl:w-72"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={iconStroke} />
            <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[12px]">
              Search agents, vendors, tx...
            </span>
            <span className="ml-auto border border-[#282C34] px-1.5 text-[10px] text-[#5B626C]">
              CTRL K
            </span>
          </button>
          <NetworkStatusPill />
          <Link
            href="/docs"
            className="hidden h-8 items-center gap-2 border border-[#282C34] bg-[#101216] px-3 text-[11px] tracking-[0.1em] text-[#8A909B] hover:text-[#D7DBE0] sm:flex"
          >
            <BookOpen className="h-3.5 w-3.5" strokeWidth={iconStroke} />
            GUIDE
          </Link>
          <Link
            href="/settings"
            aria-label="Open settings"
            title="SETTINGS"
            className="hidden h-8 w-8 items-center justify-center border border-[#282C34] bg-[#101216] text-[#8A909B] hover:text-[#D7DBE0] sm:flex"
          >
            <Settings className="h-4 w-4" strokeWidth={iconStroke} />
          </Link>
          <MotionButton
            type="button"
            aria-label="Toggle density"
            title={`DENSITY ${density.toUpperCase()}`}
            onClick={toggleDensity}
            {...hoverProps}
            className="hidden h-8 w-8 items-center justify-center border border-[#282C34] bg-[#101216] text-[#8A909B] hover:text-[#D7DBE0] sm:flex"
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
            className="relative hidden h-8 w-8 items-center justify-center border border-[#282C34] bg-[#101216] text-[#8A909B] hover:text-[#D7DBE0] sm:flex"
          >
            <Bell className="h-4 w-4" strokeWidth={iconStroke} />
            {visibleBellCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center bg-[#FF5A1F] text-[9px] font-bold text-[#121419]">
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
              <div className="absolute right-0 top-10 z-50 w-[min(20rem,calc(100vw-1.5rem))] border border-[#282C34] bg-[#181B21] shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
                <div className="flex h-10 items-center justify-between border-b border-[#282C34] px-4 text-[11px] tracking-[0.16em]">
                  <span className="text-[#D7DBE0]">NOTIFICATIONS</span>
                  <button
                    type="button"
                    aria-label="Close notifications"
                    onClick={() => setNotificationsOpen(false)}
                    className="text-[#8A909B] hover:text-[#D7DBE0]"
                  >
                    <X className="h-4 w-4" strokeWidth={iconStroke} />
                  </button>
                </div>
                <div className="divide-y divide-[#282C34] text-[12px]">
                  {notificationItems.map(([label, body]) => (
                    <div key={label} className="px-4 py-3">
                      <div className="text-[10px] tracking-[0.14em] text-[#FF5A1F]">{label}</div>
                      <div className="mt-1 text-[#8A909B]">{body}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
          <WalletPill />
        </div>
      </header>

      <div className="arcanum-chrome flex min-h-10 w-screen max-w-[100vw] flex-wrap items-center justify-between gap-2 overflow-hidden border-b border-[#282C34] bg-[#14161A] px-3 lg:flex-nowrap lg:px-5">
        <nav className="flex h-full min-w-0 flex-wrap items-center gap-1 text-[12px] tracking-[0.12em]">
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
                  "relative flex h-10 shrink-0 items-center px-3 hover:text-[#8A909B]",
                  showBadge && "gap-1.5",
                  selected ? "text-[#EDF0F3]" : "text-[#5B626C]",
                )}
              >
                {item.label}
                {showBadge ? (
                  <span className="bg-[#FF5A1F] px-1 text-[10px] font-bold text-[#121419]">
                    {badge}
                  </span>
                ) : null}
                {selected ? (
                  <span className="absolute inset-x-2 bottom-0 h-[2px] bg-[#FF5A1F]" />
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="hidden min-w-0 items-center gap-3 text-[11px] tracking-[0.1em] text-[#5B626C] lg:flex">
          <span className="truncate">{displayFile}</span>
          <span className="text-[#343A44]">|</span>
          <span className="text-[#8A909B]">REV 02:51:04Z</span>
          {showRange ? (
            <MotionButton
              type="button"
              onClick={() => toast.info("TIME RANGE / Live read model window")}
              {...hoverProps}
              className="flex items-center gap-1.5 border border-[#282C34] px-2 py-1 text-[#8A909B] hover:text-[#D7DBE0]"
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
            className="flex h-[26px] w-[26px] items-center justify-center border border-[#282C34] text-[#8A909B] hover:text-[#D7DBE0]"
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
      className="hidden h-8 items-center gap-2 border border-[#282C34] bg-[#101216] px-3 text-[11px] tracking-[0.06em] text-[#8A909B] hover:text-[#D7DBE0] lg:flex"
    >
      <MotionSpan
        className="h-2 w-2 bg-[#6E9E7C]"
        variants={reduced ? undefined : tickPulse}
        initial={reduced ? undefined : "idle"}
        animate={reduced ? undefined : "pulse"}
      />
      <span className="text-[#D7DBE0]">ARC-TESTNET</span>
      <span className="text-[#343A44]">|</span>
      <span>BLK {blockNumber}</span>
      <span className="text-[#343A44]">|</span>
      <span className="text-[#6E9E7C]">0.48s</span>
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
            <div className="flex h-8 max-w-[46vw] items-center gap-2 truncate border border-[#FF5A1F]/60 bg-[#1a1207] px-1.5 text-[11px] tracking-[0.1em] text-[#FF5A1F] sm:px-3">
              <span className="sm:hidden">CONNECT</span>
              <span className="hidden sm:inline">CONNECT WALLET</span>
            </div>
          );
        }

        if (!account || !chain) {
          return (
            <MotionButton
              type="button"
              onClick={openConnectModal}
              {...hoverProps}
              className="flex h-8 max-w-[46vw] items-center gap-2 truncate border border-[#FF5A1F]/60 bg-[#1a1207] px-1.5 text-[11px] tracking-[0.1em] text-[#FF5A1F] sm:px-3"
            >
              <span className="sm:hidden">CONNECT</span>
              <span className="hidden sm:inline">CONNECT WALLET</span>
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
        className="flex h-8 max-w-[48vw] items-center gap-2 border border-[#282C34] bg-[#101216] pl-1.5 pr-2.5 text-[11px] text-[#8A909B] hover:text-[#D7DBE0] sm:max-w-[18rem]"
      >
        <span className="flex h-5 w-5 items-center justify-center bg-[#2A2E35] text-[10px] font-bold text-[#D7DBE0]">
          {short.slice(2, 4).toUpperCase()}
        </span>
        <span className="truncate">{authStatus === "authenticated" ? short : "SIGN IN"}</span>
        {usdc ? <span className="hidden text-[#6E9E7C] sm:inline">{usdc}</span> : null}
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
          <div className="absolute right-0 top-10 z-50 w-[min(21.25rem,calc(100vw-1.5rem))] border border-[#282C34] bg-[#181B21] shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
            <div className="border-b border-[#282C34] p-4">
              <div className="text-[10px] tracking-[0.16em] text-[#5B626C]">CONNECTED WALLET</div>
              <div className="mt-1 min-w-0 truncate font-mono text-[12px] text-[#D7DBE0]">
                {address}
              </div>
              <div
                className={cn(
                  "mt-2 flex items-center gap-2 text-[10px] tracking-[0.14em]",
                  authStatus === "authenticated" ? "text-[#6E9E7C]" : "text-[#E0A04A]",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5",
                    authStatus === "authenticated" ? "bg-[#6E9E7C]" : "bg-[#E0A04A]",
                  )}
                />
                {authStatus === "checking"
                  ? "CHECKING SIGNED SESSION"
                  : authStatus === "authenticated"
                    ? "SIGNED SESSION ACTIVE"
                    : "SIGNATURE REQUIRED"}
              </div>
              <div className="mt-3 border border-[#282C34] bg-[#101216] p-3">
                <div className="font-cond text-[28px] font-semibold leading-none text-[#EDF0F3]">
                  {usdc ?? "BALANCE PENDING"}
                </div>
                <div className="mt-1 text-[10px] tracking-[0.14em] text-[#5B626C]">
                  ARC TESTNET USDC
                </div>
              </div>
            </div>
            <div className="divide-y divide-[#282C34] text-[12px]">
              <button
                type="button"
                onClick={() => void copyAddress()}
                className="flex h-10 w-full items-center gap-2 px-4 text-left text-[#8A909B] hover:bg-[#1B1F26] hover:text-[#D7DBE0]"
              >
                <Copy className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                COPY ADDRESS
              </button>
              <a
                href={arcscanUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="flex h-10 items-center gap-2 px-4 text-[#8A909B] hover:bg-[#1B1F26] hover:text-[#D7DBE0]"
              >
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                VIEW ON ARCSCAN
              </a>
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex h-10 items-center gap-2 px-4 text-[#8A909B] hover:bg-[#1B1F26] hover:text-[#D7DBE0]"
              >
                <Settings className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                SETTINGS
              </Link>
              {authStatus !== "authenticated" ? (
                <button
                  type="button"
                  onClick={retrySignature}
                  className="flex h-10 w-full cursor-pointer items-center gap-2 px-4 text-left text-[#E0A04A] hover:bg-[#1a1607]"
                >
                  <CircleCheck className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                  RETRY SIGNATURE
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void disconnectWallet()}
                className="flex h-10 w-full cursor-pointer items-center gap-2 px-4 text-left text-[#FF5A1F] hover:bg-[#1c1107]"
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
    <footer className="arcanum-footer sticky bottom-0 z-30 flex min-h-8 w-screen max-w-[100vw] shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 overflow-x-clip border-t border-[#282C34] bg-[#16181D] px-3 py-1 text-[10px] tracking-[0.12em] text-[#5B626C] lg:flex-nowrap lg:px-5">
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
        <span className="text-[#343A44]">|</span>
        <span>
          DOCTRINE ENGINE:{" "}
          <span style={{ color: workspace.isAuthenticated ? "#6E9E7C" : "#E0A04A" }}>
            {workspace.isAuthenticated ? "ACTIVE" : "WAITING"}
          </span>
        </span>
      </div>
      <div className="hidden min-w-0 items-center gap-4 sm:flex">
        <span>RPC 47ms</span>
        <span className="text-[#343A44]">|</span>
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
    <div className="flex h-9 items-center justify-between border-b border-[#282C34] px-4">
      <span className="text-[11px] tracking-[0.22em] text-[#8A909B]">{title}</span>
      {children ?? <span className="text-[10px] tracking-[0.14em] text-[#5B626C]">{meta}</span>}
    </div>
  );
}

export function HazardStripe({ className }: Readonly<{ className?: string }>) {
  return (
    <div
      className={cn("w-2", className)}
      style={{
        background: "repeating-linear-gradient(45deg,#FF5A1F 0 8px,#120a05 8px 16px)",
      }}
    />
  );
}

export function CornerMarks() {
  return (
    <>
      <span className="absolute left-1.5 top-1.5 h-3 w-3 border-l-2 border-t-2 border-[#FF5A1F]" />
      <span className="absolute right-1.5 top-1.5 h-3 w-3 border-r-2 border-t-2 border-[#FF5A1F]" />
      <span className="absolute bottom-1.5 left-1.5 h-3 w-3 border-b-2 border-l-2 border-[#FF5A1F]" />
      <span className="absolute bottom-1.5 right-1.5 h-3 w-3 border-b-2 border-r-2 border-[#FF5A1F]" />
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
      <div className="flex items-center justify-between text-[9px] tracking-[0.2em] text-[#5B626C]">
        <span>{min}</span>
        <span>{label}</span>
        <span>{max}</span>
      </div>
      <div className="relative mt-2 h-6 w-full">
        <div
          className="absolute inset-x-0 top-1/2 h-6 -translate-y-1/2"
          style={{
            background: "repeating-linear-gradient(90deg,#2A2E35 0 1px,transparent 1px 13px)",
          }}
        />
        <div
          className={cn(
            "absolute top-1/2 h-[3px] -translate-y-1/2",
            hazard ? "bg-[#FF5A1F]" : "bg-[#3A4250]",
          )}
          style={{ left: 0, width: `${value}%` }}
        />
        {markerStyle ? (
          <>
            <div
              className="absolute bottom-0 top-0 w-[2px] bg-[#FF5A1F] opacity-40"
              style={markerStyle}
            />
            {markerLabel ? (
              <div
                className="absolute -bottom-4 -translate-x-1/2 text-[8px] tracking-[0.08em] text-[#5B626C]"
                style={markerStyle}
              >
                {markerLabel}
              </div>
            ) : null}
          </>
        ) : null}
        <div
          className="absolute bottom-0 top-0 w-[2px] bg-[#FF5A1F]"
          style={{ left: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function CategoryTick({ category, label }: Readonly<{ category: string; label?: string }>) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-[#8A909B]">
      <span className="h-3 w-1" style={{ background: categoryColors[category] ?? "#6B7280" }} />
      {label ?? category}
    </span>
  );
}

export function CategoryBars({ categories }: Readonly<{ categories: readonly string[] }>) {
  if (categories.length === 0) {
    return <div className="text-[12px] text-[#5B626C]">-</div>;
  }

  return (
    <div className="flex items-center gap-1">
      {categories.map((category) => (
        <span
          key={category}
          className="h-3.5 w-1"
          style={{ background: categoryColors[category] ?? "#6B7280" }}
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
      ? "#6E9E7C"
      : normalized === "ESCALATED"
        ? "#E0A04A"
        : "#FF5A1F";
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
  return <Copy className="h-3 w-3 cursor-pointer hover:text-[#8A909B]" strokeWidth={iconStroke} />;
}

export function ProgressLine({
  width,
  color = "#3A4250",
  threshold = true,
  className,
}: Readonly<{ width: number; color?: string; threshold?: boolean; className?: string }>) {
  return (
    <div className={cn("relative mt-1 h-1 w-24 bg-[#20242B]", className)}>
      <div className="h-full" style={{ width: `${width}%`, background: color }} />
      {threshold ? (
        <div className="absolute bottom-0 top-0 w-px bg-[#5B626C]" style={{ left: "75%" }} />
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
      {accent ? <div className="absolute inset-y-0 left-0 w-[3px] bg-[#FF5A1F]" /> : null}
      <div className="text-[10px] tracking-[0.2em] text-[#5B626C]">{label}</div>
      <div
        className={cn(
          "mt-2 font-cond text-[34px] font-semibold leading-none text-[#EDF0F3]",
          valueClassName,
        )}
      >
        <AnimatedStatValue value={value} />
      </div>
      {children}
      {caption ? (
        <div className="mt-1 text-[10px] tracking-[0.08em] text-[#5B626C]">{caption}</div>
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
      className={cn("arcanum-row hover:bg-[#1b1f26]", danger && "bg-[#1a1207]", className)}
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
      {decimal ? <span className="text-[#8A909B]">.{decimal}</span> : null}
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
