import type { Metadata } from "next";
import { ReceiptDetail } from "./ReceiptDetail";

type PageProps = Readonly<{
  params: Promise<{ receiptId: string }>;
}>;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { receiptId } = await params;
  return {
    title: `Receipt ${receiptId.slice(0, 8)}… | Arcanum`,
    description: "View payment decision receipt details.",
  };
}

export default async function ReceiptDetailPage({ params }: PageProps) {
  const { receiptId } = await params;
  return <ReceiptDetail receiptId={receiptId} />;
}
