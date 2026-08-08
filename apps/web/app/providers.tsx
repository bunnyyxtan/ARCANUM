"use client";

import { arcChain } from "@arcanum/shared";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { Toaster } from "sonner";
import { WagmiProvider } from "wagmi";

import { WalletAuthBridge } from "@/components/arcanum/WalletAuthBridge";
import { TestWalletBridge } from "@/components/dev/TestWalletBridge";
import { TelemetryProvider } from "@/lib/telemetry";
import { createTrpcClient, trpc } from "@/lib/trpc";
import { wagmiConfig } from "@/lib/wagmi";

// Automated browser tests need a wallet that can sign without an extension.
// Never enabled in a production build.
const testWalletEnabled =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ARCANUM_TEST_WALLET === "1";

type ProvidersProps = Readonly<{
  children: ReactNode;
}>;

export function Providers({ children }: ProvidersProps) {
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

  return (
    <WagmiProvider config={wagmiConfig}>
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
              <WalletAuthBridge />
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
    </WagmiProvider>
  );
}
