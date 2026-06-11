import { shortAddress } from "@/lib/format/address";
export {
  formatInteger,
  formatUSDCFromBaseUnits,
  formatUsd,
  formatUsdCompact,
  usdcNumber,
} from "@/lib/format/money";
import type { Category } from "@/lib/types";

export function truncateAddress(address: string, head = 6, tail = 4) {
  return shortAddress(address, { head, tail });
}

export function categoryLabel(category: Category) {
  const labels: Record<Category, string> = {
    api: "API",
    compute: "COMPUTE",
    data: "DATA",
    subcontracting: "SUBCONTRACT",
    other: "OTHER",
  };

  return labels[category];
}
