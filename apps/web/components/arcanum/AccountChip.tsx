"use client";

import { arcTestnet } from "@arcanum/shared";
import { useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit";
import { ChevronDown, Copy, ExternalLink, LogOut, RefreshCw, Settings } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatUnits } from "viem";
import { useAccount, useBalance, useDisconnect } from "wagmi";

import { AnimatedNumber } from "@/components/arcanum/AnimatedNumber";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getArcscanAddressUrl } from "@/lib/arcscan";
import { shortAddress } from "@/lib/format/address";
import { motionCssEasings, motionDurations } from "@/lib/motion";

function toBalanceNumber(value: bigint, decimals: number) {
  const numeric = Number(formatUnits(value, decimals));

  return Number.isFinite(numeric) ? numeric : undefined;
}

function LoadingDots() {
  return <span className="font-mono-arcanum text-ash-muted tracking-[0.18em]">...</span>;
}

function BalanceValue({ value }: Readonly<{ value: number | undefined }>) {
  if (value === undefined) {
    return "$--";
  }

  return <AnimatedNumber value={value} duration="short" decimals={2} prefix="$" />;
}

export function AccountChip() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openAccountModal } = useAccountModal();
  const { openConnectModal } = useConnectModal();
  const balance = useBalance({
    address,
    chainId: arcTestnet.id,
    query: {
      enabled: address !== undefined,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      staleTime: 300_000,
    },
  });

  if (!isConnected || address === undefined) {
    return (
      <Button
        size="sm"
        variant="gradient"
        className="h-9 cursor-pointer font-mono-arcanum text-[11px] uppercase"
        onClick={() => openConnectModal?.()}
      >
        Connect Wallet
      </Button>
    );
  }

  const connectedAddress = address;
  const isBalanceLoading = balance.isLoading || balance.isFetching;
  const balanceValue =
    balance.data === undefined
      ? undefined
      : toBalanceNumber(balance.data.value, balance.data.decimals);
  const arcscanUrl = getArcscanAddressUrl(connectedAddress);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(connectedAddress);
      toast("Address copied");
    } catch {
      toast("Unable to copy address");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 cursor-pointer items-center gap-2 border border-line-subtle bg-foundry-panel px-3 text-ash transition-colors hover:border-line-active hover:bg-panel-hover"
          style={{
            transitionDuration: `${motionDurations.micro}ms`,
            transitionTimingFunction: motionCssEasings.standard,
          }}
        >
          <span className="size-2 animate-pulse rounded-full bg-hazard" />
          <span className="font-mono-arcanum text-[12px] text-ash-bright">
            {shortAddress(connectedAddress)}
          </span>
          <span className="border border-line-subtle bg-panel-raised px-2 py-0.5 font-mono-arcanum text-[11px] text-ash-soft tabular-nums">
            {isBalanceLoading ? <LoadingDots /> : <BalanceValue value={balanceValue} />}
          </span>
          <ChevronDown aria-hidden="true" className="size-3.5 text-ash-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[320px] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono-arcanum text-[10px] text-ash-muted tracking-[0.14em]">
              CONNECTED WALLET
            </div>
            <div className="mt-1 truncate font-mono-arcanum text-ash-bright text-xs">
              {connectedAddress}
            </div>
          </div>
          <button
            type="button"
            className="grid size-8 shrink-0 cursor-pointer place-items-center border border-line-subtle bg-panel-raised text-ash-soft transition-colors hover:border-line-active hover:text-ash-bright"
            style={{
              transitionDuration: `${motionDurations.micro}ms`,
              transitionTimingFunction: motionCssEasings.standard,
            }}
            onClick={copyAddress}
            aria-label="Copy address"
          >
            <Copy aria-hidden="true" className="size-4" />
          </button>
        </div>

        <div className="mt-4 border border-line-subtle bg-panel-raised p-3">
          <div className="font-display text-[34px] text-ash-bright leading-none">
            {isBalanceLoading ? <LoadingDots /> : <BalanceValue value={balanceValue} />}
          </div>
          <div className="mt-2 font-mono-arcanum text-[10px] text-ash-muted tracking-[0.14em]">
            USDC / ARC TESTNET
          </div>
        </div>

        <DropdownMenuSeparator className="my-3 h-px bg-line-subtle" />

        <DropdownMenuItem asChild className="cursor-pointer gap-2 text-ash-soft">
          <a href={arcscanUrl ?? "#"} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" className="size-4" />
            View on Arcscan
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-ash-soft"
          onSelect={() => openAccountModal?.()}
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Switch wallet
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer gap-2 text-ash-soft">
          <Link href="/settings">
            <Settings aria-hidden="true" className="size-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer gap-2 text-rust" onSelect={() => disconnect()}>
          <LogOut aria-hidden="true" className="size-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
