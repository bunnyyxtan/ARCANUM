# Supabase

Database migrations for the Supabase project that backs the production read
model at [thearcanum.in](https://thearcanum.in).

## Layout

| Path | Purpose |
| --- | --- |
| `migrations/` | Ordered SQL migrations, named `YYYYMMDDHHMMSS_description.sql` |

## Applying a migration

Migrations are applied to the Supabase database through the SQL editor or the
Supabase CLI, in filename order. Each file is written to be idempotent where
possible and includes the row-level security and function definitions it needs.

Never run untested SQL against the production database. Test against a
development database first.
