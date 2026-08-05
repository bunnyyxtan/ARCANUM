import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";

import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Schibsted_Grotesk } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";

import { configuredPublicOrigin } from "@/lib/public-url";

import { Providers } from "./providers";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
  variable: "--font-fraunces",
});

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-schibsted",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

const publicOrigin = configuredPublicOrigin();
const publicDescription =
  "Open, non-custodial governance for autonomous agent wallets on Arc. Spending limits, vendor rules, signer control, approval flows, and risk checks before funds move.";

export const metadata: Metadata = {
  metadataBase: new URL("https://thearcanum.in"),
  title: {
    default: "ARCANUM | Money with a policy layer",
    template: "%s | ARCANUM",
  },
  description: "Money with a policy layer.",
  alternates: {
    canonical: "https://thearcanum.in",
  },
  openGraph: {
    title: "ARCANUM | Money with a policy layer",
    description: "Money with a policy layer.",
    url: "https://thearcanum.in",
    siteName: "ARCANUM",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "ARCANUM. Money with a policy layer.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ARCANUM | Money with a policy layer",
    description: "Money with a policy layer.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=6" },
      { url: "/icon.svg?v=6", type: "image/svg+xml" },
      { url: "/favicon-16x16.png?v=6", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png?v=6", sizes: "32x32", type: "image/png" },
      { url: "/android-chrome-192x192.png?v=6", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png?v=6", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png?v=6" }],
  },
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body
        className={`${fraunces.variable} ${schibsted.variable} ${plexMono.variable} antialiased`}
      >
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
