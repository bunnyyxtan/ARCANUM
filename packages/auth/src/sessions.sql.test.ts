import { execFile, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Opt-in: only the disposable loopback cluster created by security-sql-test.sh.
// Never accept a URL, host, password, or production database variable.
const testPort = process.env.ARCANUM_AUTH_SQL_TEST_PORT;
const testDataDir = process.env.ARCANUM_AUTH_SQL_TEST_DATA_DIR;
const psql = "psql";
const execute = promisify(execFile);
const migration = readFileSync(
  new URL("../../../supabase/migrations/20260918190000_revocable_sessions.sql", import.meta.url),
  "utf8",
);
const a = "a".repeat(64);
const b = "b".repeat(64);
const c = "c".repeat(64);
const wallet = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const otherWallet = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const pending: Promise<unknown>[] = [];
let verifiedCluster = false;

function args(sql: string) {
  if (
    !testPort ||
    !/^[0-9]{4,5}$/.test(testPort) ||
    Number(testPort) < 1024 ||
    Number(testPort) > 65535 ||
    Number(testPort) === 5547
  )
    throw new Error(
      "SQL session tests require a disposable local port, never the parent drill server",
    );
  return [
    "-X",
    "-q",
    "-A",
    "-t",
    "-v",
    "ON_ERROR_STOP=1",
    "-h",
    "127.0.0.1",
    "-p",
    testPort,
    "-U",
    "arcanum_drill",
    "-d",
    "hardening_sql",
    "-c",
    sql,
  ];
}
function query(sql: string, role = "arcanum_drill") {
  return execFileSync(psql, args(`set role ${role}; ${sql}`), {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15_000,
  }).trim();
}
function background(sql: string) {
  // Capture rejections immediately; failed competing requests are assertions,
  // not unhandled rejections while the lock holder is still running.
  const result = execute(psql, args(sql), { timeout: 15_000 })
    .then(({ stdout }) => ({ ok: true as const, output: stdout.trim() }))
    .catch((error: Error & { stderr?: string }) => ({
      ok: false as const,
      output: error.stderr ?? error.message,
    }));
  pending.push(result);
  return result;
}
async function waitFor(name: string, eventType: string, event?: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const found = query(`select count(*) from pg_stat_activity where application_name='${name}'
      and wait_event_type='${eventType}' ${event ? `and wait_event='${event}'` : ""};`);
    if (found === "1") return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`SQL fixture did not reach ${name}/${eventType}/${event ?? "*"}`);
}
function create(hash = a, tenant = "tenant-a", actor = wallet, role = "viewer") {
  return `select session_hash from public.create_auth_session('${hash}', '${actor}', '${tenant}', '${role}', now() + interval '12 hours');`;
}
function revokeAll(hash = a, tenant = "tenant-a", actor = wallet) {
  return `select count(*) from public.revoke_all_auth_sessions('${hash}', '${actor}', '${tenant}');`;
}
function countLive(tenant = "tenant-a") {
  return query(
    `select count(*) from public.auth_sessions where tenant_id='${tenant}'
    and revoked_at is null and expires_at > clock_timestamp();`,
    "service_role",
  );
}

describe.skipIf(!testPort)("revocable sessions on isolated PostgreSQL 17 (real SQL)", () => {
  beforeAll(() => {
    expect(testDataDir).toMatch(/^\/tmp\/arc-sql\.[A-Za-z0-9]+\/data$/);
    // Establish ownership of this exact new cluster before any fixture writes.
    expect(query("show data_directory;")).toBe(testDataDir);
    expect(query("select current_setting('server_version_num')::integer / 10000 = 17;")).toBe("t");
    verifiedCluster = true;
    // Realistic Supabase fixture: service_role is non-login and BYPASSRLS;
    // new public tables/functions initially inherit permissive default grants.
    query(`
      alter role service_role nologin bypassrls;
      grant usage on schema public to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant execute on functions to public, anon, authenticated, service_role;
      ${migration}
      ${migration}
    `);
  });
  beforeEach(() => query("truncate public.auth_sessions, public.auth_session_scopes;"));
  afterAll(async () => {
    await Promise.all(pending);
    // Remove only data created by this suite, not unrelated drill tables.
    if (verifiedCluster) query("truncate public.auth_sessions, public.auth_session_scopes;");
  });

  it("is idempotent and defeats Supabase default grants, retaining minimal service-role rights", () => {
    for (const role of ["anon", "authenticated"]) {
      expect(
        query(`select has_table_privilege('${role}', 'public.auth_sessions', 'SELECT')
        or has_table_privilege('${role}', 'public.auth_sessions', 'INSERT')
        or has_table_privilege('${role}', 'public.auth_sessions', 'UPDATE')
        or has_table_privilege('${role}', 'public.auth_sessions', 'DELETE')
        or has_table_privilege('${role}', 'public.auth_session_scopes', 'SELECT')
        or has_table_privilege('${role}', 'public.auth_session_scopes', 'UPDATE')
        or has_function_privilege('${role}', 'public.create_auth_session(text,text,text,text,timestamptz)', 'EXECUTE')
        or has_function_privilege('${role}', 'public.revoke_all_auth_sessions(text,text,text)', 'EXECUTE');`),
      ).toBe("f");
      expect(() => query("select * from public.auth_sessions;", role)).toThrow(/permission denied/);
      expect(() => query(create(), role)).toThrow(/permission denied/);
      expect(() => query(revokeAll(), role)).toThrow(/permission denied/);
    }
    expect(
      query(`select
      (select bool_and(has_table_privilege('service_role', 'public.auth_sessions', privilege))
        from unnest(array['SELECT','INSERT','UPDATE','DELETE']) privilege)
      and (select bool_and(has_table_privilege('service_role', 'public.auth_session_scopes', privilege))
        from unnest(array['SELECT','INSERT','UPDATE']) privilege)
      and not has_table_privilege('service_role', 'public.auth_sessions', 'TRUNCATE')
      and not has_table_privilege('service_role', 'public.auth_session_scopes', 'DELETE')
      and has_function_privilege('service_role', 'public.create_auth_session(text,text,text,text,timestamptz)', 'EXECUTE')
      and has_function_privilege('service_role', 'public.revoke_all_auth_sessions(text,text,text)', 'EXECUTE');`),
    ).toBe("t");
    expect(
      query(`select bool_and(not prosecdef) from pg_proc where oid in (
      'public.create_auth_session(text,text,text,text,timestamptz)'::regprocedure,
      'public.revoke_all_auth_sessions(text,text,text)'::regprocedure);`),
    ).toBe("t");
    expect(
      query(
        "select bool_and(relrowsecurity) from pg_class where oid in ('public.auth_sessions'::regclass, 'public.auth_session_scopes'::regclass);",
      ),
    ).toBe("t");
    expect(query(create(), "service_role")).toBe(a);
  });

  it("supports create, bound lookup, copied-credential revocation, and tenant-isolated logout-all", () => {
    query(create(a), "service_role");
    query(create(b), "service_role");
    query(create(c, "tenant-b"), "service_role");
    expect(
      query(
        `select wallet_address || '|' || tenant_id || '|' || role from public.auth_sessions
      where session_hash='${a}' and revoked_at is null and expires_at > clock_timestamp();`,
        "service_role",
      ),
    ).toBe(`${wallet}|tenant-a|viewer`);
    expect(
      query(
        `select count(*) from public.auth_sessions where session_hash='${"0".repeat(64)}';`,
        "service_role",
      ),
    ).toBe("0");
    expect(query(revokeAll(a, "tenant-b"), "service_role")).toBe("0");
    expect(query(revokeAll(a, "tenant-a", otherWallet), "service_role")).toBe("0");
    expect(countLive()).toBe("2");
    query(
      `update public.auth_sessions set revoked_at=clock_timestamp() where session_hash='${a}';`,
      "service_role",
    );
    expect(
      query(
        `select count(*) from public.auth_sessions where session_hash='${a}' and revoked_at is null;`,
        "service_role",
      ),
    ).toBe("0");
    expect(query(revokeAll(a), "service_role")).toBe("0");
    expect(query(revokeAll(b), "service_role")).toBe("2");
    expect(countLive()).toBe("0");
    expect(countLive("tenant-b")).toBe("1");
    expect(query(revokeAll(b), "service_role")).toBe("0");
    // A genuinely later login starts after the persisted watermark.
    expect(query(create("d".repeat(64)), "service_role")).toBe("d".repeat(64));
  });

  it("rejects invalid roles, inflated lifetime, and expired credentials", () => {
    expect(() => query(create(a, "tenant-a", wallet, "admin"), "service_role")).toThrow(
      /check constraint/,
    );
    expect(() =>
      query(
        `select * from public.create_auth_session('${a}', '${wallet}', 'tenant-a', 'viewer', now()+interval '13 hours');`,
        "service_role",
      ),
    ).toThrow(/check constraint/);
    query(create(a), "service_role");
    query(create(b), "service_role");
    query(
      `update public.auth_sessions set created_at=now()-interval '2 hours', expires_at=now()-interval '1 hour' where session_hash='${a}';`,
      "service_role",
    );
    expect(query(revokeAll(a), "service_role")).toBe("0");
    expect(countLive()).toBe("1");
    expect(
      query(
        `select count(*) from public.auth_sessions where session_hash='${a}' and expires_at > clock_timestamp();`,
        "service_role",
      ),
    ).toBe("0");
  });

  it("serializes a pending login behind logout-all and rejects its stale start time", async () => {
    query(create(a), "service_role");
    const holder = background(`set application_name='auth-sql-revoke-holder'; set role service_role;
      begin; select 1 from public.auth_session_scopes where tenant_id='tenant-a' and wallet_address='${wallet}' for update;
      select pg_sleep(1.5); ${revokeAll(a)} commit;`);
    await waitFor("auth-sql-revoke-holder", "Timeout", "PgSleep");
    const login = background(
      `set application_name='auth-sql-pending-login'; set role service_role; ${create(b)}`,
    );
    await waitFor("auth-sql-pending-login", "Lock");
    expect(await holder).toMatchObject({ ok: true });
    expect(await login).toMatchObject({
      ok: false,
      output: expect.stringContaining("Login preceded session revocation"),
    });
    expect(countLive()).toBe("0");
    expect(
      query(`select count(*) from public.auth_sessions where session_hash='${b}';`, "service_role"),
    ).toBe("0");
  });

  it("logout-all waits for a parallel insert, then revokes it; another tenant is not blocked", async () => {
    query(create(a), "service_role");
    const issuer = background(`set application_name='auth-sql-issuer'; set role service_role;
      begin; ${create(b)} select pg_sleep(1.5); commit;`);
    await waitFor("auth-sql-issuer", "Timeout", "PgSleep");
    // Same wallet, independent tenant: no shared scope lock.
    expect(query(`set statement_timeout='300ms'; ${create(c, "tenant-b")}`, "service_role")).toBe(
      c,
    );
    const logout = background(
      `set application_name='auth-sql-logout'; set role service_role; ${revokeAll(a)}`,
    );
    await waitFor("auth-sql-logout", "Lock");
    expect(await issuer).toMatchObject({ ok: true });
    expect(await logout).toMatchObject({ ok: true, output: "2" });
    expect(countLive()).toBe("0");
    expect(countLive("tenant-b")).toBe("1");
  });

  it("prunes only 100 expired rows per create, skips locked rows, and preserves live sessions", async () => {
    query(
      `insert into public.auth_sessions(session_hash,wallet_address,tenant_id,role,created_at,expires_at)
      select lpad(i::text,64,'0'), '${wallet}', 'cleanup', 'viewer', now()-interval '2 hours',
        now()-interval '1 hour' + i*interval '1 millisecond' from generate_series(1,151) i;`,
      "service_role",
    );
    const lockedHash = `${"0".repeat(63)}1`;
    const holder = background(`set application_name='auth-sql-prune-lock'; set role service_role;
      begin; select 1 from public.auth_sessions where session_hash='${lockedHash}' for update; select pg_sleep(1.5); commit;`);
    await waitFor("auth-sql-prune-lock", "Timeout", "PgSleep");
    expect(query(`set statement_timeout='300ms'; ${create(a)}`, "service_role")).toBe(a);
    expect(
      query(
        "select count(*) from public.auth_sessions where expires_at <= clock_timestamp();",
        "service_role",
      ),
    ).toBe("51");
    expect(
      query(
        `select count(*) from public.auth_sessions where session_hash='${lockedHash}';`,
        "service_role",
      ),
    ).toBe("1");
    expect(countLive()).toBe("1");
    expect(await holder).toMatchObject({ ok: true });
    query(create(b), "service_role");
    expect(
      query(
        "select count(*) from public.auth_sessions where expires_at <= clock_timestamp();",
        "service_role",
      ),
    ).toBe("0");
    expect(countLive()).toBe("2");
  });
});
