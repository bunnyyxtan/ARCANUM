import { z } from "zod";

import { uuidSchema } from "./common";

export const anomalyDecisionInputSchema = z.object({
  anomalyId: uuidSchema,
});
