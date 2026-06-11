import { appRouter } from "./router";

console.info(
  `Arcanum tRPC router loaded with procedures: ${Object.keys(appRouter._def.procedures).join(", ")}`,
);
