-- VendorRegistry stores USDC caps in six-decimal base units. Keep the mirror
-- textual: PostgREST serializes PostgreSQL numeric values as JSON numbers, and
-- JSON.parse cannot preserve a 78-digit uint256/base-unit value. Keep existing
-- rows NULL until a chain observation rewrites them. Do not backfill NULL to
-- zero: zero is an onchain unlimited cap, not "unknown".
begin;

alter table public.vendors
  add column if not exists per_vendor_cap_base_units text;

alter table public.vendors
  drop constraint if exists vendors_per_vendor_cap_base_units_nonnegative;

alter table public.vendors
  add constraint vendors_per_vendor_cap_base_units_nonnegative
  check (
    per_vendor_cap_base_units is null
    or (
      per_vendor_cap_base_units ~ '^(0|[1-9][0-9]*)$'
      and length(per_vendor_cap_base_units) <= 78
      and (
        length(per_vendor_cap_base_units) < 78
        or per_vendor_cap_base_units <=
          '115792089237316195423570985008687907853269984665640564039457584007913129639935'
      )
    )
  );

commit;