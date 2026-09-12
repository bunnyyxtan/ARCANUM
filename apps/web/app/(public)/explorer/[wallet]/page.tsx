import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAddress } from "viem";
import { ExplorerPublicPage } from "./ExplorerPublicPage";

type ExplorerPageProps = Readonly<{
  params: Promise<{ wallet: string }>;
}>;

export async function generateMetadata({ params }: ExplorerPageProps): Promise<Metadata> {
  const { wallet } = await params;
  const decoded = safeDecode(wallet);
  return {
    title: `Wallet ${decoded.slice(0, 10)}… | Arcanum Explorer`,
    description: "Inspect a governed wallet's public Arcanum record.",
  };
}

export default async function Page({ params }: ExplorerPageProps) {
  const { wallet } = await params;
  const decoded = safeDecode(wallet);
  if (!isAddress(decoded)) {
    notFound();
  }
  return <ExplorerPublicPage wallet={decoded} />;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
