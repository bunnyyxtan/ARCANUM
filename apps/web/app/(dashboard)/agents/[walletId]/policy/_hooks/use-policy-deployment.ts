"use client";

import { useState } from "react";
import type { Address } from "viem";

export type PolicyReadStatus = "idle" | "checking" | "ready" | "error";

export function usePolicyDeployment() {
  const [policyWalletOwner, setPolicyWalletOwner] = useState<Address | null>(null);
  const [policyReadStatus, setPolicyReadStatus] = useState<PolicyReadStatus>("idle");

  return {
    policyReadStatus,
    policyWalletOwner,
    setPolicyReadStatus,
    setPolicyWalletOwner,
  };
}
