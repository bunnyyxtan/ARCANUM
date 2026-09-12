"use client";

import { arcChain } from "@arcanum/shared";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { Toaster } from "sonner";
import { WagmiProvider, useAccount } from "wagmi";

import { TestWalletBridge } from "@/components/dev/TestWalletBridge";
import { useAuthSession, workspaceIdentityKey } from "@/lib/auth-session";
import { TelemetryProvider } from "@/lib/telemetry";
import { createTrpcClient, trpc } from "@/lib/trpc";
import { wagmiConfig } from "@/lib/wagmi";
import { consumeWalletLaunch } from "@/lib/wallet-launch-intent";

// Automated browser tests need a wallet that can sign without an extension.
// Never enabled in a production build.
const testWalletEnabled =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ARCANUM_TEST_WALLET === "1";

type ProvidersProps = Readonly<{
  children: ReactNode;
}>;

export function Providers({ children }: ProvidersProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <WalletLaunchBridge />
      <IdentityScopedProviders>{children}</IdentityScopedProviders>
    </WagmiProvider>
  );
}

/**
 * This bridge stays above the identity-keyed QueryClient. Connecting a wallet
 * remounts the tree below it, so navigation cannot depend on the landing
 * modal's local `connecting` state surviving that transition.
 */
function WalletLaunchBridge() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const completeLaunch = useCallback(() => {
    if (consumeWalletLaunch(isConnected)) {
      router.push("/dashboard");
    }
  }, [isConnected, router]);

  useEffect(() => {
    const onLaunchRequested = () => completeLaunch();
    window.addEventListener("arcanum:wallet-launch-requested", onLaunchRequested);
    completeLaunch();
    return () => window.removeEventListener("arcanum:wallet-launch-requested", onLaunchRequested);
  }, [completeLaunch]);

  return null;
}

/**
 * React Query keys in the dashboard intentionally stay close to their API
 * names, so an identity transition cannot rely on every caller remembering to
 * add a wallet parameter. Instead, give each connected wallet/session its own
 * QueryClient. Switching accounts unmounts the old scope, cancels its active
 * requests, and starts with an empty cache for the new identity.
 */
function IdentityScopedProviders({ children }: ProvidersProps) {
  const { address, isConnected } = useAccount();
  const session = useAuthSession();
  const identityKey = workspaceIdentityKey({
    address,
    isConnected,
    signedAddress: session.user?.walletAddress,
    tenantId: session.user?.tenantId,
  });

  return <ScopedProviders key={identityKey}>{children}</ScopedProviders>;
}

function ScopedProviders({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTrpcClient());

  // Keyed remounts already isolate data. Cancel before clearing as an
  // additional guard for query functions that ignore AbortSignal; a late
  // response must not repopulate the previous identity's cache.
  useEffect(() => {
    return () => {
      void queryClient.cancelQueries();
      queryClient.clear();
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <RainbowKitProvider
          initialChain={arcChain}
          modalSize="compact"
          theme={darkTheme({
            accentColor: "var(--color-hazard)",
            accentColorForeground: "var(--color-coal-grid)",
            borderRadius: "none",
            fontStack: "system",
          })}
        >
          <TelemetryProvider>
            {testWalletEnabled ? <TestWalletBridge /> : null}
            {children}
            <Toaster
              theme="dark"
              toastOptions={{
                style: {
                  background: "#15171B",
                  border: "1px solid #282C34",
                  color: "#D7DBE0",
                  fontFamily: 'var(--font-plex-mono), "IBM Plex Mono", ui-monospace, monospace',
                },
                classNames: {
                  error: "text-[#FF5A1F]",
                },
              }}
            />
          </TelemetryProvider>
        </RainbowKitProvider>
      </trpc.Provider>
    </QueryClientProvider>
  );
}
