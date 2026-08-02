"use client";

import { arcTestnet } from "@arcanum/shared";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { Toaster } from "sonner";
import { WagmiProvider } from "wagmi";

import { useArcanumTheme } from "@/components/arcanum/ThemeToggle";
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
  const { dark } = useArcanumTheme();
  const rainbowThemeOptions = {
    accentColor: "var(--wl-signal)",
    accentColorForeground: dark ? "var(--wl-page)" : "#ffffff",
    borderRadius: "none",
    fontStack: "system",
  } as const;

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <RainbowKitProvider
            initialChain={arcTestnet}
            modalSize="compact"
            theme={dark ? darkTheme(rainbowThemeOptions) : lightTheme(rainbowThemeOptions)}
          >
            <TelemetryProvider>
              <TooltipProvider delayDuration={200}>
                <WalletAuthBridge />
                {children}
                <Toaster
                  theme={dark ? "dark" : "light"}
                  toastOptions={{
                    style: {
                      background: "var(--wl-panel-mid)",
                      border: "1px solid var(--wl-hairline)",
                      color: "var(--wl-text-body)",
                      fontFamily: "var(--font-mono)",
                    },
                    classNames: {
                      error: "text-[var(--wl-signal)]",
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
