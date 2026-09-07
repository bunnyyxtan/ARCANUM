import { spawnSync } from "node:child_process";

const databaseUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Set SUPABASE_DB_URL or DATABASE_URL before checking function grants.");
  process.exit(2);
}

const allowList = ["arcanum_global_stats"];
const sql = `
select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and has_function_privilege('anon', p.oid, 'EXECUTE')
  and p.proname <> all (array[${allowList.map((name) => `'${name}'`).join(",")}])
order by 1;
`;
const result = spawnSync("psql", [databaseUrl, "--no-psqlrc", "--tuples-only", "--command", sql], {
  encoding: "utf8",
});

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const offenders = result.stdout
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);
if (offenders.length > 0) {
  console.error(`anon can execute disallowed SECURITY DEFINER functions:\n${offenders.join("\n")}`);
  process.exit(1);
}

console.log("No disallowed anon SECURITY DEFINER grants found.");
