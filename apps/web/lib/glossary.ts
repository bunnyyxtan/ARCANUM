export type GlossaryTerm =
  | "AGENT"
  | "ANOMALY ORACLE"
  | "POSTURE INDEX"
  | "FORTIFIED"
  | "DEGRADED"
  | "POSTURE GAUGE"
  | "RESTRAINT"
  | "RESTRAINT QUEUE"
  | "APPROVE/RELEASE"
  | "REJECT/DENY"
  | "RESTRAIN"
  | "DOCTRINE"
  | "EVENT STREAM"
  | "DEVIATION"
  | "ANOMALY REGISTER"
  | "GOVERNED EVENT STREAM"
  | "QUORUM"
  | "ARCANEVM"
  | "COUNTERPARTY"
  | "VENDOR"
  | "ESCALATION"
  | "GOVERNANCE"
  | "GUARDED WALLET"
  | "POLICY";

export const glossary: Record<GlossaryTerm, string> = {
  AGENT:
    "A governed autonomous wallet or service identity that attempts spend and is evaluated by doctrine before settlement.",
  "ANOMALY ORACLE":
    "The signal source that scores unusual behavior and feeds deviation findings into governance.",
  "POSTURE INDEX":
    "A live 0-100 control score combining policy compliance, anomaly pressure, and restraint state.",
  FORTIFIED:
    "A wallet state where doctrine checks are passing and no active restraint is required.",
  DEGRADED:
    "A posture state where policy pressure, anomaly activity, or missed controls have reduced trust.",
  "POSTURE GAUGE": "The ruler that compares current wallet control posture against prior readings.",
  RESTRAINT:
    "A temporary hold that prevents settlement until doctrine or human quorum releases it.",
  "RESTRAINT QUEUE": "The operator surface for transactions waiting on human quorum.",
  "APPROVE/RELEASE":
    "The human or doctrine action that lets a held transaction proceed once quorum or policy conditions are met.",
  "REJECT/DENY": "The action that blocks a held or invalid transaction from settling.",
  RESTRAIN:
    "To place an agent or transaction under hold while doctrine, anomaly, or quorum checks are resolved.",
  DOCTRINE:
    "The active policy envelope that governs spend limits, categories, vendors, and escalation.",
  "EVENT STREAM":
    "The chronological feed of governed transaction attempts, policy decisions, and settlement outcomes.",
  DEVIATION: "A statistical distance between current agent behavior and its approved baseline.",
  "ANOMALY REGISTER":
    "The surveillance ledger for abnormal agent spend patterns and response actions.",
  "GOVERNED EVENT STREAM": "The live feed of transaction attempts and their doctrine verdicts.",
  QUORUM: "The number of authorized human signatures required to release a held transaction.",
  ARCANEVM: "Arc's confidential execution layer for protected agent spend and vendor interactions.",
  COUNTERPARTY: "The vendor, wallet, contract, or external system receiving an agent transaction.",
  VENDOR:
    "An approved counterparty on the allowlist, categorized for spend limits and confidential enforcement.",
  ESCALATION:
    "A transaction or condition routed to human review because doctrine alone cannot safely release it.",
  GOVERNANCE:
    "The combined policy, signer, oracle, and audit controls that mediate autonomous wallet activity.",
  "GUARDED WALLET":
    "A wallet whose outbound transactions are mediated by Arcanum doctrine and governance contracts.",
  POLICY:
    "A machine-enforced rule set for limits, allowlists, categories, quorum, and anomaly thresholds.",
};

export const glossaryEntries = (Object.entries(glossary) as Array<[GlossaryTerm, string]>).sort(
  ([a], [b]) => a.localeCompare(b),
);

export const glossaryCaption = "ARCANUM DOCTRINE GLOSSARY - SECTION 3.2";
