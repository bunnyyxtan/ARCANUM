import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import "./print.css";

import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Saira_Condensed } from "next/font/google";
import type { ReactNode } from "react";

import { configuredPublicOrigin } from "@/lib/public-url";

import { Providers } from "./providers";

const sairaCondensed = Saira_Condensed({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-cond",
  weight: ["500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

const publicOrigin = configuredPublicOrigin();
const publicDescription =
  "Open, non-custodial governance for autonomous agent wallets on Arc. Spending limits, vendor rules, signer control, approval flows, and risk checks before funds move.";

export const metadata: Metadata = {
  metadataBase: new URL("https://thearcanum.in"),
  title: "Arcanum — Governed Wallets for Autonomous AI Money",
  description: publicDescription,
  alternates: {
    canonical: "https://thearcanum.in",
  },
  openGraph: {
    title: "Arcanum — Governed Wallets for Autonomous AI Money",
    description: publicDescription,
    url: "https://thearcanum.in",
    siteName: "ARCANUM",
    type: "website",
    images: [
      {
        url: "https://thearcanum.in/og/arcanum-og.png",
        width: 1200,
        height: 630,
        alt: "Arcanum — Governed Wallets for Autonomous AI Money",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Arcanum — Governed Wallets for Autonomous AI Money",
    description: "Governance layer for autonomous agent wallets on Arc.",
    images: ["https://thearcanum.in/og/arcanum-og.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=2" },
      { url: "/favicon-16x16.png?v=2", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/android-chrome-192x192.png?v=2", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png?v=2", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png?v=2" }],
  },
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${sairaCondensed.variable} ${inter.variable} ${jetBrainsMono.variable} bg-foundry-page text-foundry-text-body antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
