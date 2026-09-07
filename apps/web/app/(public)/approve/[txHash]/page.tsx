import type { Metadata } from "next";
import { ApprovePublicPage } from "./ApprovePublicPage";

type ApprovePageProps = Readonly<{
  params: Promise<{ txHash: string }>;
}>;

export async function generateMetadata({ params }: ApprovePageProps): Promise<Metadata> {
  const { txHash } = await params;
  return {
    title: `Review escalation ${decodeURIComponent(txHash).slice(0, 10)}… | Arcanum`,
    description: "Review an Arcanum governed-wallet escalation onchain.",
    robots: { follow: false, index: false },
  };
}

export default async function Page({ params }: ApprovePageProps) {
  const { txHash } = await params;
  return <ApprovePublicPage txHash={decodeURIComponent(txHash)} />;
}
