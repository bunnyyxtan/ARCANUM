import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAddress } from "viem";
import { BadgePublicPage } from "./BadgePublicPage";

type BadgePageProps = Readonly<{
  params: Promise<{ wallet: string }>;
}>;

export async function generateMetadata({ params }: BadgePageProps): Promise<Metadata> {
  const { wallet } = await params;
  const decoded = safeDecode(wallet);
  return {
    title: `Governance badge ${decoded.slice(0, 10)}… | Arcanum`,
    description: "Public Arcanum governance badge and embeddable trust mark.",
  };
}

export default async function BadgePage({ params }: BadgePageProps) {
  const { wallet } = await params;
  const decoded = safeDecode(wallet);
  if (!isAddress(decoded)) {
    notFound();
  }
  return <BadgePublicPage wallet={decoded} />;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
