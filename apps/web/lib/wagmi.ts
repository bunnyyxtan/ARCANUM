import { ARC_TESTNET_RPC_URL, arcTestnet } from "@arcanum/shared";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";

export const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
const fallbackProjectId = "arcanum-local-walletconnect-project-id";

export const hasWalletConnectProjectId =
  walletConnectProjectId !== undefined && walletConnectProjectId.length > 0;

export const injectedWagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(ARC_TESTNET_RPC_URL),
  },
  ssr: true,
});

export const wagmiConfig = hasWalletConnectProjectId
  ? getDefaultConfig({
      appName: "Arcanum",
      projectId: walletConnectProjectId ?? fallbackProjectId,
      chains: [arcTestnet],
      transports: {
        [arcTestnet.id]: http(ARC_TESTNET_RPC_URL),
      },
      ssr: true,
    })
  : injectedWagmiConfig;
