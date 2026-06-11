"use client";

import type { AppRouter } from "@arcanum/api";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

export function createTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        transformer: superjson,
        url: "/api/trpc",
      }),
    ],
  });
}
