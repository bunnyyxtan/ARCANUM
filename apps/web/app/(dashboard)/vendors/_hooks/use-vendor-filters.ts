"use client";

import type { Vendor } from "@/lib/types";
import { useMemo, useState } from "react";
import { categoryLabel } from "../_lib/helpers";

export function useVendorFilters(vendors: readonly Vendor[]) {
  const [category, setCategory] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () =>
      vendors.filter(
        (vendor) =>
          (category === "ALL" || categoryLabel(vendor.category) === category) &&
          `${vendor.name} ${vendor.address}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [vendors, category, query],
  );
  return {
    approvedCount: vendors.filter(
      (vendor) => vendor.trust === "approved" || vendor.trust === "confidential",
    ).length,
    blockedCount: vendors.filter((vendor) => vendor.trust === "blocked").length,
    category,
    categoryCount: new Set(
      vendors.filter((vendor) => vendor.trust !== "removed").map((vendor) => vendor.category),
    ).size,
    query,
    setCategory,
    setQuery,
    visible,
  };
}
