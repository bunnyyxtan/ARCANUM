"use client";

import { useCallback, useEffect, useRef } from "react";
import { SiweMessage } from "siwe";
import { toast } from "sonner";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";

import { fetchAuthSession, publishAuthSession } from "@/lib/auth-session";
import { trpc } from "@/lib/trpc";

type AuthErrorResponse = {
  message?: string;
};

export function WalletAuthBridge() {
  const { address, chainId, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const utils = trpc.useUtils();
  const signingRef = useRef(false);
  const authedAddressRef = useRef<string | null>(null);
  const failedAddressRef = useRef<string | null>(null);

  const signIn = useCallback(
    async (force = false) => {
      if (!isConnected || !address) {
        return;
      }

      if (
        signingRef.current ||
        authedAddressRef.current === address ||
        (!force && failedAddressRef.current === address)
      ) {
        return;
      }

      signingRef.current = true;
      if (force) {
        failedAddressRef.current = null;
      }

      try {
        if (!force) {
          const existingUser = await fetchAuthSession();
          if (existingUser?.walletAddress.toLowerCase() === address.toLowerCase()) {
            authedAddressRef.current = address;
            failedAddressRef.current = null;
            return;
          }
        }

        const nonceResponse = await fetch("/api/auth/nonce", {
          cache: "no-store",
          credentials: "include",
        });
        if (!nonceResponse.ok) {
          throw new Error("SIWE nonce request failed");
        }
        const { nonce } = (await nonceResponse.json()) as { nonce?: string };
        if (!nonce) {
          throw new Error("SIWE nonce missing");
        }

        const message = new SiweMessage({
          address,
          chainId: chainId ?? Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID ?? 5042002),
          domain: window.location.host,
          nonce,
          statement: "Sign in to Arcanum Foundry Console.",
          uri: window.location.origin,
          version: "1",
        }).prepareMessage();
        const signature = await signMessageAsync({ message });
        const verifyResponse = await fetch("/api/auth/verify", {
          body: JSON.stringify({ message, signature }),
          credentials: "include",
          headers: { "content-type": "application/json" },
          method: "POST",
        });

        if (!verifyResponse.ok) {
          const body = (await verifyResponse.json().catch(() => null)) as AuthErrorResponse | null;
          throw new Error(body?.message ?? "SIWE verification failed");
        }

        const sessionUser = await fetchAuthSession({ force: true });
        if (sessionUser?.walletAddress.toLowerCase() !== address.toLowerCase()) {
          throw new Error(
            "Signature verified, but session could not be established. Retry sign-in.",
          );
        }

        authedAddressRef.current = address;
        failedAddressRef.current = null;
        publishAuthSession(sessionUser);
        await utils.org.getCurrent.invalidate();
        toast.success("WALLET AUTHORIZED");
      } catch (error) {
        failedAddressRef.current = address;
        const description =
          error instanceof Error
            ? error.message
            : "Wallet is connected, but the signed session was not established.";
        toast.error("Authentication failed. Please retry signature.", {
          action: {
            label: "Retry",
            onClick: () => {
              void signIn(true);
            },
          },
          cancel: {
            label: "Disconnect",
            onClick: () => {
              authedAddressRef.current = null;
              failedAddressRef.current = null;
              publishAuthSession(null);
              void fetch("/api/auth/logout", { credentials: "include", method: "POST" });
              disconnect();
            },
          },
          description,
        });
      } finally {
        signingRef.current = false;
      }
    },
    [address, chainId, disconnect, isConnected, signMessageAsync, utils.org.getCurrent],
  );

  useEffect(() => {
    if (!isConnected || !address) {
      if (authedAddressRef.current || failedAddressRef.current) {
        authedAddressRef.current = null;
        failedAddressRef.current = null;
        publishAuthSession(null);
        void fetch("/api/auth/logout", { credentials: "include", method: "POST" });
      }
      return;
    }

    void signIn();
  }, [address, isConnected, signIn]);

  useEffect(() => {
    const onRetry = () => {
      void signIn(true);
    };

    window.addEventListener("arcanum:wallet-auth-retry", onRetry);
    return () => window.removeEventListener("arcanum:wallet-auth-retry", onRetry);
  }, [signIn]);

  return null;
}
