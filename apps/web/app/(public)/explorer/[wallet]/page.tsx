import { PublicExplorerCanvasPage } from "@/components/arcanum/canvas/pages";

type ExplorerPageProps = Readonly<{
  params: Promise<{ wallet: string }>;
}>;

export default async function Page({ params }: ExplorerPageProps) {
  const { wallet } = await params;
  return <PublicExplorerCanvasPage wallet={decodeURIComponent(wallet)} />;
}
