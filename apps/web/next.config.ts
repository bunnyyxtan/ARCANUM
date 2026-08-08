import type { NextConfig } from "next";

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
  transpilePackages: ["@arcanum/shared"],
  async headers() {
    // The CSP must allow direct browser connections to the active Arc RPC.
    // Testnet origins stay listed always (harmless); mainnet origins come
    // from env because Circle has not published them yet. next.config runs
    // in Node at build time, so plain env reads are fine here.
    const extraConnectOrigins = [
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
