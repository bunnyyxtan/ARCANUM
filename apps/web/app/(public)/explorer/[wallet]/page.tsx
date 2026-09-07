import type { Metadata } from "next";
import { ExplorerPublicPage } from "./ExplorerPublicPage";

type ExplorerPageProps = Readonly<{
  params: Promise<{ wallet: string }>;
}>;

export async function generateMetadata({ params }: ExplorerPageProps): Promise<Metadata> {
  const { wallet } = await params;
  return {
    title: `Wallet ${decodeURIComponent(wallet).slice(0, 10)}… | Arcanum Explorer`,
    description: "Inspect a governed wallet's public Arcanum record.",
  };
}

export default async function Page({ params }: ExplorerPageProps) {
  const { wallet } = await params;
  return <ExplorerPublicPage wallet={decodeURIComponent(wallet)} />;
}
