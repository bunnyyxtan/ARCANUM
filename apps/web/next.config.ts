import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// This workspace can sit inside an outer checkout that carries its own
// lockfile, and Next then guesses which root to trace production output
// against. Pinning it to the repository root keeps standalone builds from
// silently tracing the wrong tree.
const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

type WebpackConfig = Parameters<NonNullable<NextConfig["webpack"]>>[0];

function aliasOptionalBrowserDependencies(config: WebpackConfig) {
  config.resolve = config.resolve ?? {};
  const alias = config.resolve.alias;

  config.resolve.alias = {
    ...(typeof alias === "object" && !Array.isArray(alias) ? alias : {}),
    "@react-native-async-storage/async-storage": false,
    "pino-pretty": false,
  };

  config.ignoreWarnings = [
    ...(Array.isArray(config.ignoreWarnings) ? config.ignoreWarnings : []),
    {
      message: /Critical dependency: the request of a dependency is an expression/,
      module: /node_modules[\\/]ox[\\/]_esm[\\/]tempo/,
    },
  ];

  return config;
}

const configureWebpack: NonNullable<NextConfig["webpack"]> = (config, context) => {
  const nextConfig = aliasOptionalBrowserDependencies(config);

  if (context.dev) {
    nextConfig.cache = { type: "memory" };
  }

  return nextConfig;
};

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingRoot: repositoryRoot,
  transpilePackages: ["@arcanum/shared"],
  async headers() {
    // The CSP must allow direct browser connections to the active Arc RPC.
    // The published testnet and mainnet origins stay listed always (harmless
    // on the other network); an operator's RPC override is added from env.
    // next.config runs in Node at build time, so plain env reads are fine here.
    const extraConnectOrigins = [
      "https://rpc.mainnet.arc.io",
      process.env.NEXT_PUBLIC_ARC_MAINNET_RPC_URL,
      process.env.NEXT_PUBLIC_ARC_MAINNET_WS_URL,
    ]
      .filter((url): url is string => Boolean(url))
      .map((url) => {
        try {
          return new URL(url).origin;
        } catch {
          return "";
        }
      })
      .filter(Boolean)
      .join(" ");

    const connectSrc = `'self' https://rpc.testnet.arc.network wss://rpc.testnet.arc.network https://*.posthog.com https://*.ingest.sentry.io${
      extraConnectOrigins ? ` ${extraConnectOrigins}` : ""
    }`;

    const commonHeaders = [
      {
        key: "Content-Security-Policy",
        value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:; connect-src ${connectSrc}; frame-ancestors 'none';`,
      },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    ];

    return [
      {
        source: "/badge/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-ancestors *;",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      { source: "/:path*", headers: commonHeaders },
    ];
  },
  webpack: configureWebpack,
};

export default nextConfig;
