"use client";

import type { ArcanumWorkspaceMode } from "@arcanum/shared";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

export type AuthSessionUser = {
  walletAddress: string;
};

type AuthSessionResponse = {
  user: AuthSessionUser | null;
};

type AuthStatus = "checking" | "authenticated" | "unauthenticated" | "unavailable";

export type AuthSessionResult =
  | { status: "authenticated"; user: AuthSessionUser }
  | { status: "anonymous"; user: null }
  | { status: "unavailable"; user: null; error: Error };

let cachedUser: AuthSessionUser | null = null;
let cachedAt = 0;
let inFlight: Promise<AuthSessionResult> | null = null;

export async function fetchAuthSession(options?: { force?: boolean }) {
  if (!options?.force && Date.now() - cachedAt < 5_000) {
    return cachedUser
      ? { status: "authenticated" as const, user: cachedUser }
      : { status: "anonymous" as const, user: null };
  }

  inFlight ??= readAuthSession().finally(() => {
    inFlight = null;
  });

  const result = await inFlight;
  if (result.status !== "unavailable") {
    cachedUser = result.user;
    cachedAt = Date.now();
  }
  return result;
}

async function readAuthSession(): Promise<AuthSessionResult> {
  try {
    const response = await fetch("/api/auth/session", {
      cache: "no-store",
      credentials: "include",
    });
    if (!response.ok) {
      return {
        status: "unavailable",
        user: null,
        error: new Error(`Session request failed with status ${response.status}.`),
      };
    }

    const body = (await response.json()) as AuthSessionResponse;
    return body.user
      ? { status: "authenticated", user: body.user }
      : { status: "anonymous", user: null };
  } catch (error) {
    return {
      status: "unavailable",
      user: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export function publishAuthSession(user: AuthSessionUser | null) {
  cachedUser = user;
  cachedAt = Date.now();
  window.dispatchEvent(new CustomEvent("arcanum:wallet-auth-updated", { detail: user }));
}

export function useAuthSession() {
  const [user, setUser] = useState<AuthSessionUser | null>(cachedUser);
  const [status, setStatus] = useState<AuthStatus>(
    cachedAt ? (cachedUser ? "authenticated" : "unauthenticated") : "checking",
  );

  useEffect(() => {
    let cancelled = false;

    fetchAuthSession().then((result) => {
      if (cancelled) {
        return;
      }

      setUser(result.user);
      setStatus(
        result.status === "anonymous"
          ? "unauthenticated"
          : result.status === "unavailable"
            ? "unavailable"
            : "authenticated",
      );
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
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const session = useAuthSession();
  const connectedAddress = address?.toLowerCase() ?? null;
  const signedAddress = session.user?.walletAddress.toLowerCase() ?? null;
  const signedForConnectedWallet = Boolean(
    connectedAddress && signedAddress && connectedAddress === signedAddress,
  );

  let dataMode: ArcanumWorkspaceMode = "disconnected";
  if (isConnected && !signedForConnectedWallet) {
    dataMode = "connected_unsigned";
  } else if (signedForConnectedWallet) {
    dataMode = "live_empty";
  } else if (session.status === "unavailable") {
    // Existing read-model error states are safer than presenting an outage as a signed-out session.
    dataMode = "live_empty";
  }

  return {
    address: connectedAddress,
    dataMode,
    isAuthenticated: signedForConnectedWallet,
    isConnected,
    isDemo: false,
    // True while wagmi is still restoring a persisted connection. Read-only
    // UI should wait for this to settle before treating the visitor as
    // walletless, or connected users see a connect prompt flash on load.
    isResolving: isConnecting || isReconnecting,
    sessionStatus: session.status,
    signedAddress,
  };
}
