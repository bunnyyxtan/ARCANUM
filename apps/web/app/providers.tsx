"use client";

import { arcTestnet } from "@arcanum/shared";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { Toaster } from "sonner";
import { WagmiProvider } from "wagmi";

import { WalletAuthBridge } from "@/components/arcanum/WalletAuthBridge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TelemetryProvider } from "@/lib/telemetry";
import { createTrpcClient, trpc } from "@/lib/trpc";
import { wagmiConfig } from "@/lib/wagmi";

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
            initialChain={arcTestnet}
            modalSize="compact"
            theme={darkTheme({
              accentColor: "var(--color-hazard)",
              accentColorForeground: "var(--color-coal-grid)",
              borderRadius: "none",
              fontStack: "system",
            })}
          >
            <TelemetryProvider>
              <TooltipProvider delayDuration={200}>
                <WalletAuthBridge />
                {children}
                <Toaster
                  theme="dark"
                  toastOptions={{
                    style: {
                      background: "#15171B",
                      border: "1px solid #282C34",
                      color: "#D7DBE0",
                      fontFamily: "var(--font-mono)",
                    },
                    classNames: {
                      error: "text-[#FF5A1F]",
                    },
                  }}
                />
              </TooltipProvider>
            </TelemetryProvider>
          </RainbowKitProvider>
        </trpc.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
