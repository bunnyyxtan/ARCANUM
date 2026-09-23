import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { transferFactsFromRow, walletFromGovernedWalletRow } from "./mappers";

// Parent's disposable PG17 runner owns start/stop and runs SQL suites serially.
// No DATABASE_URL, service keys, live connection, schema teardown or table
// truncation. Every fixture lives in a rolled-back transaction.
const port = process.env.ARCANUM_OPTIMIZATION_SQL_TEST_PORT;
const dataDir = process.env.ARCANUM_OPTIMIZATION_SQL_TEST_DATA_DIR;
const enabled = Boolean(port && dataDir);
const owner = `0x${"11".repeat(20)}`;
const other = `0x${"22".repeat(20)}`;
const factory = `0x${"44".repeat(20)}`;
const ids = [1, 2, 3, 4].map((n) => `eeeeeeee-0000-4000-8000-${String(n).padStart(12, "0")}`);
const orgs = [1, 2].map((n) => `eeeeeeee-1111-4000-8000-${String(n).padStart(12, "0")}`);
const since = "2026-09-22T12:00:00.000Z";
const until = "2026-09-23T12:00:00.000Z";
const signature =
  "public.scoped_ledger_analytics(uuid[],text,uuid,text,timestamptz,timestamptz,boolean)";

describe.skipIf(!enabled)("scoped analytics PostgreSQL parity (parent disposable PG17)", () => {
  function sql(text: string) {
    if (!port || !/^\d+$/.test(port) || !dataDir)
      throw new Error("Explicit isolated SQL target required.");
    return execFileSync(
      "psql",
      [
        "-X",
        "-qAt",
        "-v",
        "ON_ERROR_STOP=1",
        "-h",
        "127.0.0.1",
        "-p",
        port,
        "-U",
        "arcanum_drill",
        "-d",
        "optimization_sql",
      ],
      {
        input: text,
        encoding: "utf8",
        env: { PATH: process.env.PATH, HOME: "/nonexistent", PGPASSFILE: "/nonexistent" },
      },
    ).trim();
  }
  const scope = `ARRAY[${ids.map((id) => `'${id}'::uuid`).join(",")}], '${owner}', '${orgs[0]}', '${factory}'`;
  const call = (allTime = true) =>
    `public.scoped_ledger_analytics(${scope}, '${since}', '${until}', ${allTime})`;
  const fixture = `
    INSERT INTO public.organizations(id,name,slug) VALUES
      ('${orgs[0]}','analytics SQL test','analytics-sql-drill-one'),
      ('${orgs[1]}','analytics SQL other','analytics-sql-drill-two');
    INSERT INTO public.governed_wallets(id,organization_id,wallet_address,owner_address,chain_id,wallet_factory_address)
    VALUES ${ids
      .map(
        (id, i) => `('${id}', '${orgs[i === 2 ? 1 : 0]}',
      '0x${String(i + 1).repeat(40)}', '${i === 0 ? owner : other}', 5042002, '${i === 3 ? other : factory}')`,
      )
      .join(",")};
    INSERT INTO public.ledger_events(organization_id,governed_wallet_id,event_time,amount_usdc,status,log_index)
    VALUES
      ('${orgs[0]}','${ids[0]}','${since}',1.250000,'allowed',1),
      ('${orgs[0]}','${ids[0]}','${until}',2.5,'approved',2),
      ('${orgs[0]}','${ids[0]}','2026-09-22T11:59:59.999Z',7,'blocked',3),
      ('${orgs[0]}','${ids[0]}','2026-09-23T12:00:00.001Z',8,'rejected',4),
      ('${orgs[0]}','${ids[0]}','2026-09-23T11:00:00Z',null,'pending',5),
      ('${orgs[0]}','${ids[0]}','2026-09-23T11:00:00Z',9,'frozen',6),
      ('${orgs[0]}','${ids[0]}','2026-09-23T11:00:00Z',9,'escalated',7),
      ('${orgs[0]}','${ids[1]}','2025-01-01T00:00:00Z',3,'allowed',8),
      ('${orgs[1]}','${ids[2]}','${until}',100,'allowed',9),
      ('${orgs[0]}','${ids[3]}','${until}',100,'allowed',10),
      ('${orgs[0]}',null,'${until}',100,'allowed',11);
  `;
  function withFixture(query: string) {
    return sql(`BEGIN; ${fixture} ${query}; ROLLBACK;`);
  }

  beforeAll(() => {
    if (!dataDir) throw new Error("Explicit isolated SQL data directory required.");
    expect(realpathSync(sql("SHOW data_directory;"))).toBe(realpathSync(dataDir));
    expect(Number(sql("SHOW server_version_num;"))).toBeGreaterThanOrEqual(170000);
    expect(Number(sql("SHOW server_version_num;"))).toBeLessThan(180000);
    const migration = readFileSync(
      new URL(
        "../../../../supabase/migrations/20260923160000_scoped_analytics.sql",
        import.meta.url,
      ),
      "utf8",
    );
    sql(migration);
    sql(migration);
  });

  it.each([true, false])(
    "matches mapper aggregation with exact money and inclusive time, allTime=%s",
    (allTime) => {
      const result = JSON.parse(
        withFixture(`SELECT jsonb_build_object(
      'actual', ${call(allTime)},
      'rows', (SELECT jsonb_agg(to_jsonb(e))
        FROM public.ledger_events e WHERE governed_wallet_id IN ('${ids[0]}','${ids[1]}'))
    )`),
      );
      const wallets = ids.slice(0, 2).map((id, i) =>
        walletFromGovernedWalletRow({
          id,
          wallet_address: `0x${String(i + 1).repeat(40)}`,
          owner_address: owner,
        }),
      );
      const facts = result.rows
        .map((row: Record<string, unknown>) => transferFactsFromRow(row, wallets))
        .filter(
          (row: ReturnType<typeof transferFactsFromRow>) =>
            allTime || (row.timestamp >= new Date(since) && row.timestamp <= new Date(until)),
        );
      const daily = facts.filter(
        (row: ReturnType<typeof transferFactsFromRow>) =>
          row.timestamp >= new Date(since) && row.timestamp <= new Date(until),
      );
      const allowed = daily.filter(
        (row: ReturnType<typeof transferFactsFromRow>) => row.verdict === "ALLOW",
      );
      expect(result.actual.total).toBe(facts.length);
      expect(result.actual.denied).toBe(
        facts.filter((row: ReturnType<typeof transferFactsFromRow>) => row.verdict === "DENY")
          .length,
      );
      expect(result.actual.blocked24h).toBe(
        daily.filter((row: ReturnType<typeof transferFactsFromRow>) =>
          ["DENY", "FREEZE"].includes(row.verdict),
        ).length,
      );
      expect(result.actual.movementCount).toBe(allowed.length);
      expect(result.actual.valueBaseUnits).toBe(
        allowed
          .reduce(
            (sum: bigint, row: ReturnType<typeof transferFactsFromRow>) => sum + BigInt(row.amount),
            0n,
          )
          .toString(),
      );
      expect(result.actual.activity).toHaveLength(allTime ? 2 : 1);
      expect(new Date(result.actual.activity[0].lastActivityAt).toISOString()).toBe(
        allTime ? "2026-09-23T12:00:00.001Z" : until,
      );
      expect(result.actual.activity[0].spendBaseUnits).toBe(result.actual.valueBaseUnits);
    },
  );

  it("enforces service-only execution despite Supabase defaults", () => {
    for (const fn of [
      signature,
      "public.scoped_anomaly_counts(uuid[],text,uuid,text)",
      "public.scoped_current_doctrines(uuid[],text,uuid,text)",
    ]) {
      for (const role of ["anon", "authenticated", "service_role"]) {
        expect(sql(`SELECT has_function_privilege('${role}', '${fn}', 'EXECUTE');`)).toBe(
          role === "service_role" ? "t" : "f",
        );
      }
    }
    for (const role of ["anon", "authenticated"]) {
      expect(() => sql(`SET ROLE ${role}; SELECT ${call()};`)).toThrow();
    }
    expect(JSON.parse(withFixture(`SET LOCAL ROLE service_role; SELECT ${call()}`)).total).toBe(8);
  });

  it.each([
    ["-1", "250000", true],
    ["-2.5", "-1250000", true],
    ["10000000", "10000001250000", true],
    ["1e-6", "1250001", true],
    ["-1e-6", "1249999", true],
    ["0.0000001", "1250000", true],
    ["1.2345678", "2484568", false],
    ["-1.2345678", "15432", false],
    ["1.000001", "2250001", false],
    ["9007199254740993.123456", "9007199254740994373456", false],
    ["10000000000000000", "10000000000000001250000", false],
    ["1e16", "10000000000000001250000", false],
    ["-9007199254740993.123456", "-9007199254740991873456", false],
  ])(
    "preserves native numeric %s without a rounded JS oracle",
    (amount, expected, representable) => {
      const result = JSON.parse(
        withFixture(`
      UPDATE public.ledger_events SET amount_usdc = ${amount}
      WHERE governed_wallet_id = '${ids[0]}' AND log_index = 2;
      SELECT jsonb_build_object('actual',${call()},
        'wire', (SELECT to_jsonb(e) FROM public.ledger_events e
          WHERE governed_wallet_id = '${ids[0]}' AND log_index = 2))
    `),
      );
      // This is real PostgreSQL JSON numeric serialization, not amount::text.
      expect(typeof result.wire.amount_usdc).toBe("number");
      expect(result.actual.valueBaseUnits).toBe(expected);
      expect(result.actual.activity[0].spendBaseUnits).toBe(expected);
      const wallet = walletFromGovernedWalletRow({
        id: ids[0],
        wallet_address: owner,
        owner_address: owner,
      });
      if (representable) {
        const mapped = transferFactsFromRow(result.wire, [wallet]);
        expect((BigInt(mapped.amount) + 1250000n).toString()).toBe(expected);
      }
      // Nonrepresentable cases use independently specified decimal expectations,
      // including DB numeric(28,6) rounding, never the rounded wire number.
    },
  );

  it("intersects IDs, owner/org and current factory and denies empty owner", () => {
    for (const args of [
      `ARRAY[]::uuid[], '${owner}', '${orgs[0]}', '${factory}'`,
      `ARRAY['${ids[2]}'::uuid], '${owner}', '${orgs[0]}', '${factory}'`,
      `ARRAY['${ids[3]}'::uuid], '${owner}', '${orgs[0]}', '${factory}'`,
      `ARRAY['${ids[0]}'::uuid], NULL, '${orgs[0]}', '${factory}'`,
    ]) {
      const actual = JSON.parse(
        withFixture(`SELECT public.scoped_ledger_analytics(${args}, '${since}', '${until}', true)`),
      );
      expect(actual).toMatchObject({ total: 0, valueBaseUnits: "0", activity: [] });
    }
  });

  it("selects current doctrine by version and counts only scoped non-dismissed anomalies", () => {
    const result = JSON.parse(
      withFixture(`
      INSERT INTO public.doctrines(governed_wallet_id,name,version,signers,updated_at)
      VALUES ('${ids[0]}','old',1,ARRAY['${owner}'],'2026-09-24'),
             ('${ids[0]}','current',2,ARRAY['${owner}','${owner}'],'2026-09-01'),
             ('${ids[2]}','foreign',1,ARRAY['${owner}'],'2026-09-01');
      INSERT INTO public.anomalies(organization_id,governed_wallet_id,title,severity,status)
      VALUES ('${orgs[0]}','${ids[0]}','high','high','open'),
             ('${orgs[0]}','${ids[0]}','dismissed','high','dismissed'),
             ('${orgs[0]}','${ids[1]}','low','low','open'),
             ('${orgs[1]}','${ids[2]}','foreign','high','open');
      SELECT jsonb_build_object('doctrines',public.scoped_current_doctrines(${scope}),
        'anomalies',public.scoped_anomaly_counts(${scope}))
    `),
    );
    expect(result.anomalies).toEqual({ total: 2, danger: 1 });
    expect(result.doctrines).toHaveLength(1);
    expect(result.doctrines[0]).toMatchObject({ version: 2, signers: [owner, owner] });
  });

  it("aggregates beyond PostgREST page ceilings and rejects invalid windows", () => {
    expect(
      JSON.parse(
        withFixture(`
      INSERT INTO public.ledger_events(organization_id,governed_wallet_id,event_time,amount_usdc,status,log_index)
      SELECT '${orgs[0]}','${ids[0]}','${until}',1.000001,'allowed',100 + n FROM generate_series(1,1205) n;
      SELECT ${call()}
    `),
      ).total,
    ).toBe(1213);
    expect(() =>
      withFixture(`SELECT public.scoped_ledger_analytics(${scope}, '${until}', '${since}', true)`),
    ).toThrow();
  });

  it("preserves JS Date millisecond comparisons on all-time promoted reads", () => {
    const result = JSON.parse(
      withFixture(`
      INSERT INTO public.ledger_events(organization_id,governed_wallet_id,event_time,amount_usdc,status,log_index)
      VALUES ('${orgs[0]}','${ids[0]}','2026-09-23T12:00:00.000001Z',2.000001,'allowed',50);
      SELECT jsonb_build_object('allTime',${call()},'daily',${call(false)})
    `),
    );
    expect(BigInt(result.allTime.valueBaseUnits) - BigInt(result.daily.valueBaseUnits)).toBe(
      2000001n,
    );
    expect(result.allTime.movementCount - result.daily.movementCount).toBe(1);
  });
});
