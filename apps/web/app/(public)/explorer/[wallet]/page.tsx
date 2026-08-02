import { ExplorerPublicPage } from "./ExplorerPublicPage";

type ExplorerPageProps = Readonly<{
  params: Promise<{ wallet: string }>;
}>;

export default async function Page({ params }: ExplorerPageProps) {
  const { wallet } = await params;
  return <ExplorerPublicPage wallet={decodeURIComponent(wallet)} />;
}
