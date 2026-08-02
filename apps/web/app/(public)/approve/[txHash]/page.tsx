import { ApprovePublicPage } from "./ApprovePublicPage";

type ApprovePageProps = Readonly<{
  params: Promise<{ txHash: string }>;
}>;

export default async function Page({ params }: ApprovePageProps) {
  const { txHash } = await params;
  return <ApprovePublicPage txHash={decodeURIComponent(txHash)} />;
}
