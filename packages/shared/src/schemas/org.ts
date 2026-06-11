import { z } from "zod";

export const orgUpdateInputSchema = z.object({
  name: z.string().min(2).max(120),
  defaultPolicyTemplate: z.string().min(2).max(120).default("std-research-v3"),
  notifications: z
    .object({
      email: z.boolean().default(true),
      slack: z.boolean().default(false),
      discord: z.boolean().default(false),
    })
    .default({ email: true, slack: false, discord: false }),
});
