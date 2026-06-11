"use client";

import { type ArcanumWorkspaceMode, isDemoOwnerWallet } from "@arcanum/shared";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

export type AuthSessionUser = {
  walletAddress: string;
};

type AuthSessionResponse = {
  user: AuthSessionUser | null;
};

type AuthStatus = "checking" | "authenticated" | "unauthenticated";

let cachedUser: AuthSessionUser | null = null;
let cachedAt = 0;
let inFlight: Promise<AuthSessionUser | null> | null = null;

export async function fetchAuthSession(options?: { force?: boolean }) {
  if (!options?.force && Date.now() - cachedAt < 5_000) {
    return cachedUser;
  }

  inFlight ??= fetch("/api/auth/session", {
    cache: "no-store",
    credentials: "include",
  })
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }

      const body = (await response.json()) as AuthSessionResponse;
      return body.user ?? null;
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });

  cachedUser = await inFlight;
  cachedAt = Date.now();
  return cachedUser;
}

export function publishAuthSession(user: AuthSessionUser | null) {
  cachedUser = user;
  cachedAt = Date.now();
  window.dispatchEvent(new CustomEvent("arcanum:wallet-auth-updated", { detail: user }));
}

export function useAuthSession() {
  const [user, setUser] = useState<AuthSessionUser | null>(cachedUser);
  const [status, setStatus] = useState<AuthStatus>(cachedAt ? "authenticated" : "checking");

  useEffect(() => {
    let cancelled = false;

    fetchAuthSession().then((nextUser) => {
      if (cancelled) {
        return;
      }

      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "unauthenticated");
    });

    const onAuthUpdated = (event: Event) => {
      const detail = (event as CustomEvent<AuthSessionUser | null>).detail ?? null;
      setUser(detail);
      setStatus(detail ? "authenticated" : "unauthenticated");
    };

    window.addEventListener("arcanum:wallet-auth-updated", onAuthUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("arcanum:wallet-auth-updated", onAuthUpdated);
    };
  }, []);

  return { user, status };
}

export function useWorkspaceMode() {
  const { address, isConnected } = useAccount();
  const session = useAuthSession();
  const connectedAddress = address?.toLowerCase() ?? null;
  const signedAddress = session.user?.walletAddress.toLowerCase() ?? null;
  const signedForConnectedWallet = Boolean(
    connectedAddress && signedAddress && connectedAddress === signedAddress,
  );

  let dataMode: ArcanumWorkspaceMode = "disconnected";
  if (isConnected && !signedForConnectedWallet) {
    dataMode = "connected_unsigned";
  } else if (signedForConnectedWallet && isDemoOwnerWallet(signedAddress)) {
    dataMode = "demo";
  } else if (signedForConnectedWallet) {
    dataMode = "live_empty";
  }

  return {
    address: connectedAddress,
    dataMode,
    isAuthenticated: signedForConnectedWallet,
    isConnected,
    isDemo: dataMode === "demo",
    sessionStatus: session.status,
    signedAddress,
  };
}
