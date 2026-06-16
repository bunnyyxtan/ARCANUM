import type { ArcanumWorkspaceMode } from "@arcanum/shared";

// Copy helpers only. Auth, demo access, and data isolation stay owned by session/data loaders.
export type WorkspaceEmptyEntity = "agents" | "vendors" | "ledger" | "escalations" | "anomalies";

const indexedEmptyCopy: Record<WorkspaceEmptyEntity, { description: string; title: string }> = {
  agents: {
    title: "No agent signer authorized",
    description:
      "Authorize an agent signer address to connect an AI agent backend to this governed wallet.",
  },
  vendors: {
    title: "No vendors added",
    description: "Add approved payment destinations before allowing agent spend requests.",
  },
  ledger: {
    title: "No activity yet",
    description:
      "Policy updates, agent payment intents, transfers, and escalations will appear here once your governed wallet is active.",
  },
  escalations: {
    title: "No escalations pending",
    description: "Risky or review-required agent payments will appear here for human approval.",
  },
  anomalies: {
    title: "No anomalies detected",
    description:
      "Spend deviations and unusual agent behavior will be listed here after activity begins.",
  },
};

export function getWorkspaceHeaderLabel(mode: ArcanumWorkspaceMode) {
  if (mode === "disconnected") {
    return "NO WALLET";
  }
  if (mode === "connected_unsigned") {
    return "UNSIGNED WALLET";
  }
  return "LIVE WORKSPACE";
}

export function getWorkspaceFooterLabel(mode: ArcanumWorkspaceMode) {
  if (mode === "disconnected") {
    return "CONNECT WALLET";
  }
  if (mode === "connected_unsigned") {
    return "SIGNATURE REQUIRED";
  }
  return "LIVE WORKSPACE";
}

export function getWorkspaceStatusColor(mode: ArcanumWorkspaceMode) {
  return mode === "disconnected" || mode === "connected_unsigned" ? "#E0A04A" : "#6E9E7C";
}

export function getWorkspaceSwitcherMessage(mode: ArcanumWorkspaceMode) {
  if (mode === "disconnected") {
    return "ORG SWITCHER / Connect wallet to load workspace";
  }
  if (mode === "connected_unsigned") {
    return "ORG SWITCHER / Sign in to load workspace";
  }
  return "ORG SWITCHER / Live workspace";
}

export function getWorkspaceNotificationItems(mode: ArcanumWorkspaceMode) {
  if (mode === "disconnected") {
    return [["WORKSPACE", "Connect wallet to load your governed workspace."]] as const;
  }

  if (mode === "connected_unsigned") {
    return [["SIGNATURE", "Sign in to load your live workspace."]] as const;
  }

  return [["WORKSPACE", "No live notifications yet. Indexed events will appear here."]] as const;
}

export function getWorkspaceEmptyCopy(mode: ArcanumWorkspaceMode, entity: WorkspaceEmptyEntity) {
  if (mode === "disconnected") {
    return {
      title: "CONNECT WALLET",
      description: "Connect wallet to load your workspace.",
    };
  }

  if (mode === "connected_unsigned") {
    return {
      title: "SIGN IN REQUIRED",
      description: "Sign in to load your workspace.",
    };
  }

  return indexedEmptyCopy[entity];
}

export function getSettingsWorkspaceSummary(mode: ArcanumWorkspaceMode, isAuthenticated: boolean) {
  if (mode === "disconnected") {
    return { caption: "LOAD YOUR WORKSPACE", label: "CONNECT WALLET" };
  }

  if (isAuthenticated) {
    return { caption: "ON-CHAIN READ MODEL", label: "LIVE WORKSPACE" };
  }

  return { caption: "SIGNED SESSION NEEDED", label: "SIGN IN REQUIRED" };
}
