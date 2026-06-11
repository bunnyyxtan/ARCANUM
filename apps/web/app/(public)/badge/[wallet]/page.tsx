import { BadgePublicPage } from "./BadgePublicPage";

type BadgePageProps = Readonly<{
  params: Promise<{ wallet: string }>;
}>;

export default async function BadgePage({ params }: BadgePageProps) {
  const { wallet } = await params;

  return <BadgePublicPage wallet={decodeURIComponent(wallet)} />;
}
