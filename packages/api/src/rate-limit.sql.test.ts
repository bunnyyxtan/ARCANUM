import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in: starts ONLY a new isolated temporary cluster, never uses DATABASE_URL.
// ARCANUM_RUN_RATE_LIMIT_SQL_TESTS=true npx vitest run packages/api/src/rate-limit.sql.test.ts
const enabled = process.env.ARCANUM_RUN_RATE_LIMIT_SQL_TESTS === "true";
const exec = promisify(execFile);
describe.skipIf(!enabled)("rate limit PostgreSQL integration (isolated cluster)", () => {
  let dir: string;
  let args: string[];
  let started = false;
  const key = "a".repeat(64);
  function sql(text: string) {
    return execFileSync("psql", args, { input: text, encoding: "utf8" }).trim();
  }
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "arcanum-rate-limit-"));
    execFileSync("initdb", [
      "-D",
      join(dir, "data"),
      "-A",
      "trust",
      "-U",
      "postgres",
      "--no-locale",
    ]);
    // Unix socket only; no network listener and no inherited connection settings.
    execFileSync("pg_ctl", [
      "-D",
      join(dir, "data"),
      "-l",
      join(dir, "postgres.log"),
      "-o",
      `-F -k ${dir} -h '' -p 55439`,
      "-w",
      "start",
    ]);
    started = true;
    args = [
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-h",
      dir,
      "-p",
      "55439",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ];
    sql(`
      create role anon; create role authenticated; create role service_role;
      grant usage on schema public to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    `);
    const migration = readFileSync(
      new URL(
        "../../../supabase/migrations/20260918191000_distributed_rate_limits.sql",
        import.meta.url,
      ),
      "utf8",
    );
    sql(migration);
    sql(migration);
  }, 30_000);
  afterAll(() => {
    if (started) execFileSync("pg_ctl", ["-D", join(dir, "data"), "-m", "immediate", "-w", "stop"]);
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("overrides Supabase defaults, enforces RLS, and grants only service RPC execution", () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      expect(
        sql(
          `select has_table_privilege('${role}', 'public.rate_limit_buckets', 'SELECT,INSERT,UPDATE,DELETE');`,
        ),
      ).toBe("f");
      expect(
        sql(
          `select has_function_privilege('${role}', 'public.consume_rate_limit(text,integer,integer)', 'EXECUTE');`,
        ),
      ).toBe(role === "service_role" ? "t" : "f");
    }
    expect(
      sql("select relrowsecurity from pg_class where oid = 'public.rate_limit_buckets'::regclass;"),
    ).toBe("t");
    for (const role of ["anon", "authenticated"]) {
      expect(() =>
        sql(`set role ${role}; select * from public.consume_rate_limit('${key}', 10, 60000);`),
      ).toThrow();
      expect(() =>
        sql(`set role ${role}; insert into public.rate_limit_buckets values ('${key}', 1, now());`),
      ).toThrow();
    }
    expect(
      sql(
        `set role service_role; select allowed from public.consume_rate_limit('${key}', 10, 60000);`,
      ),
    ).toBe("t");
  });

  it("admits exactly the quota across independent concurrent database connections", async () => {
    sql("truncate public.rate_limit_buckets;");
    const results = await Promise.all(
      Array.from({ length: 40 }, () =>
        exec("psql", [
          ...args,
          "-c",
          `set role service_role; select allowed from public.consume_rate_limit('${key}', 13, 60000);`,
        ]).then((result) => result.stdout.trim()),
      ),
    );
    expect(results.filter((result) => result === "t")).toHaveLength(13);
    expect(results.filter((result) => result === "f")).toHaveLength(27);
    expect(
      sql(`select request_count from public.rate_limit_buckets where key_hash='${key}';`),
    ).toBe("14");
  }, 30_000);

  it("resets expired counters and limits cleanup to 32 rows per request", () => {
    sql(`truncate public.rate_limit_buckets;
      insert into public.rate_limit_buckets
      select lpad(to_hex(n),64,'0'), 1, now() - interval '1 minute' from generate_series(1,100) n;`);
    expect(sql(`select allowed from public.consume_rate_limit('${key}', 1, 60000);`)).toBe("t");
    expect(sql("select count(*) from public.rate_limit_buckets where expires_at < now();")).toBe(
      "68",
    );
    // Even a denied call progresses bounded cleanup.
    expect(sql(`select allowed from public.consume_rate_limit('${key}', 1, 60000);`)).toBe("f");
    expect(sql("select count(*) from public.rate_limit_buckets where expires_at < now();")).toBe(
      "36",
    );
    sql(
      `update public.rate_limit_buckets set expires_at = now() - interval '1 second' where key_hash='${key}';`,
    );
    expect(sql(`select allowed from public.consume_rate_limit('${key}', 1, 60000);`)).toBe("t");
  });

  it("serializes concurrent resets of an expired quota", async () => {
    sql(`truncate public.rate_limit_buckets;
      insert into public.rate_limit_buckets values ('${key}', 1000, now() - interval '1 minute');`);
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        exec("psql", [
          ...args,
          "-c",
          `set role service_role; select allowed from public.consume_rate_limit('${key}', 3, 60000);`,
        ]).then((result) => result.stdout.trim()),
      ),
    );
    expect(results.filter((result) => result === "t")).toHaveLength(3);
    expect(results.filter((result) => result === "f")).toHaveLength(17);
  }, 30_000);

  it("does not starve cleanup behind a locked oldest expired row", async () => {
    sql(`truncate public.rate_limit_buckets;
      insert into public.rate_limit_buckets
      select lpad(to_hex(n),64,'0'), 1, now() - interval '1 minute' from generate_series(1,100) n;`);
    const locker = exec("psql", [
      ...args,
      "-c",
      `begin; select 1 from public.rate_limit_buckets where key_hash=lpad('1',64,'0') for update;
       select pg_sleep(2); commit;`,
    ]);
    // Observe the actual lock-holding query rather than relying on a sleep to acquire it.
    for (let i = 0; i < 100; i++) {
      if (sql("select count(*) from pg_stat_activity where wait_event = 'PgSleep';") !== "0") break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(sql(`select allowed from public.consume_rate_limit('${key}', 1, 60000);`)).toBe("t");
    expect(sql("select count(*) from public.rate_limit_buckets where expires_at < now();")).toBe(
      "68",
    );
    expect(
      sql("select count(*) from public.rate_limit_buckets where key_hash=lpad('1',64,'0');"),
    ).toBe("1");
    await locker;
  }, 10_000);

  it("rejects null, malformed and nonfinite policy bounds", () => {
    for (const values of [
      "null, 1, 1000",
      "'x', 1, 1000",
      `'${key}', 0, 1000`,
      `'${key}', 1000001, 1000`,
      `'${key}', 1, 999`,
      `'${key}', 1, 3600001`,
      `'${key}', null, 1000`,
      `'${key}', 1, null`,
    ])
      expect(() => sql(`select * from public.consume_rate_limit(${values});`)).toThrow();
  });
});
