import type { Metadata } from "next";
import { VerifyPage } from "./VerifyPage";

export const metadata: Metadata = {
  title: "Verify Receipt | Arcanum",
  description: "Verify an Arcanum payment decision receipt offline.",
  robots: { follow: false, index: false },
};

export default function Page() {
  return <VerifyPage />;
}
