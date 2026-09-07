import type { Metadata } from "next";
import { BadgePublicPage } from "./BadgePublicPage";

type BadgePageProps = Readonly<{
  params: Promise<{ wallet: string }>;
}>;

export async function generateMetadata({ params }: BadgePageProps): Promise<Metadata> {
  const { wallet } = await params;
  return {
    title: `Governance badge ${decodeURIComponent(wallet).slice(0, 10)}… | Arcanum`,
    description: "Public Arcanum governance badge and embeddable trust mark.",
  };
}

export default async function BadgePage({ params }: BadgePageProps) {
  const { wallet } = await params;
  return <BadgePublicPage wallet={decodeURIComponent(wallet)} />;
}
