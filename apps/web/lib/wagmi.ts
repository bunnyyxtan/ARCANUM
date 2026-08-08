import { ARC_RPC_URL, arcChain } from "@arcanum/shared";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";

export const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
const fallbackProjectId = "arcanum-local-walletconnect-project-id";

// Browser chain READS go through our own server (/api/arc-rpc): the public
// Arc RPC endpoints refuse CORS and rate-limit browsers, which used to blank
// out pages for real users. Writes still go through the user's wallet. During
// SSR there is no CORS or browser rate limit, so the direct URL is fine.
const chainReadUrl =
  typeof window === "undefined" ? ARC_RPC_URL : `${window.location.origin}/api/arc-rpc`;

export const hasWalletConnectProjectId =
  walletConnectProjectId !== undefined && walletConnectProjectId.length > 0;

export const injectedWagmiConfig = createConfig({
  chains: [arcChain],
  connectors: [injected()],
  transports: {
    [arcChain.id]: http(chainReadUrl),
  },
  ssr: true,
});

export const wagmiConfig = hasWalletConnectProjectId
  ? getDefaultConfig({
      appName: "Arcanum",
      projectId: walletConnectProjectId ?? fallbackProjectId,
      chains: [arcChain],
      transports: {
        [arcChain.id]: http(chainReadUrl),
      },
      ssr: true,
    })
  : injectedWagmiConfig;
