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
  transpilePackages: ["@arcanum/shared", "@arcanum/ui"],
  async headers() {
    const commonHeaders = [
      {
        key: "Content-Security-Policy",
        value:
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'self' https://rpc.testnet.arc.network https://*.posthog.com https://*.ingest.sentry.io wss://rpc.testnet.arc.network; frame-ancestors 'none';",
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
