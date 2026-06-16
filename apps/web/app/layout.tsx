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
const publicDescription = "Arc Testnet prototype for non-custodial AI agent spend governance.";

export const metadata: Metadata = {
  metadataBase: new URL(publicOrigin),
  title: "ARCANUM",
  description: publicDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "ARCANUM",
    description: publicDescription,
    url: publicOrigin,
    siteName: "ARCANUM",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ARCANUM",
    description: publicDescription,
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
