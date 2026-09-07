import { z } from "zod";

import { uuidSchema } from "./common";

export const anomalyDecisionInputSchema = z.object({
  anomalyId: uuidSchema,
  decisionReason: z.string().trim().min(3).max(500).optional(),
});

export const anomalyDecideInputSchema = anomalyDecisionInputSchema.extend({
  decision: z.enum(["acknowledged", "dismissed"]),
  decisionReason: z.string().trim().min(3).max(500),
});
