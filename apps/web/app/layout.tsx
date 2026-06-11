import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import "./print.css";

import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Saira_Condensed } from "next/font/google";
import type { ReactNode } from "react";

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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "Arcanum",
  description: "On-chain spend governance for autonomous AI agents on Arc.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png" }],
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
