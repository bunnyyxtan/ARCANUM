/**
 * Deterministic governance-posture score (0-100).
 *
 * Posture is derived from the wallet's live doctrine — the controls that
 * actually restrain the agent — instead of a number invented at creation
 * time. Same doctrine, same score, on every surface (registry, agent
 * detail, public explorer, badge). A stricter doctrine scores higher; a
 * frozen wallet is docked because it is under emergency restraint.
 */
export interface PostureInputs {
  requireVendorAllowlist: boolean;
  quorum: number;
  councilSize: number;
  perTxCapUsd: number;
  dailyCapUsd: number;
  monthlyCapUsd: number;
  escalateAboveUsd: number;
  doctrineVersion: number;
  frozen: boolean;
}

export function computePostureScore(inputs: PostureInputs): number {
  // Every governed wallet starts from the floor of simply being governed.
  let score = 30;

  // Vendor discipline: an enforced allowlist is the strongest single control.
  if (inputs.requireVendorAllowlist) {
    score += 12;
  }

  // Human quorum on escalations: one reviewer helps, two remove a single
  // point of failure.
  if (inputs.quorum >= 2) {
    score += 10;
  } else if (inputs.quorum === 1) {
    score += 4;
  }

  // Escalation council depth mirrors the quorum logic.
  if (inputs.councilSize >= 2) {
    score += 8;
  } else if (inputs.councilSize === 1) {
    score += 4;
  }

  // Hard spend caps.
  if (inputs.perTxCapUsd > 0) {
    score += 6;
  }
  if (inputs.dailyCapUsd > 0) {
    score += 6;
  }
  if (inputs.monthlyCapUsd > 0) {
    score += 4;
  }

  // An escalation threshold at or below the per-tx cap pulls risky payments
  // to humans before the hard cap is ever tested.
  if (
    inputs.escalateAboveUsd > 0 &&
    (inputs.perTxCapUsd === 0 || inputs.escalateAboveUsd <= inputs.perTxCapUsd)
  ) {
    score += 4;
  }

  // Tight per-tx sizing relative to the daily budget limits blast radius:
  // no single payment can consume more than a quarter of the day.
  if (
    inputs.perTxCapUsd > 0 &&
    inputs.dailyCapUsd > 0 &&
    inputs.perTxCapUsd <= inputs.dailyCapUsd * 0.25
  ) {
    score += 5;
  }

  // Doctrine maturity: revised policies are evidence of active governance.
  score += Math.min(Math.max(inputs.doctrineVersion - 1, 0), 5);

  // A frozen wallet is under emergency restraint right now.
  if (inputs.frozen) {
    score -= 15;
  }

  // Never 0 (it is still governed) and never a perfect 100.
  return Math.min(95, Math.max(5, Math.round(score)));
}
