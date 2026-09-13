import type { ApiContext } from "../context";
import {
  type SupabaseRequestOptions,
  type SupabaseRow,
  type SupabaseRows,
  readModelUnavailable,
} from "./client";

export async function selectRows(ctx: ApiContext, table: string, options?: SupabaseRequestOptions) {
  const client = ctx.supabase;
  if (!client) {
    // A missing configuration must never look like "no rows": for a product
    // whose promise is showing what an agent spent, a calm empty dashboard on
    // top of a broken read model is worse than an error.
    throw readModelUnavailable(
      `${table}.read`,
      new Error(
        "Supabase read model is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
      ),
    );
  }

  try {
    return await client.selectRows(table, options);
  } catch (error) {
    throw readModelUnavailable(`${table}.read`, error);
  }
}

const READ_PAGE_SIZE = 1_000;
const MAX_READ_PAGES = 100_000;

export type ExhaustiveReadOptions = {
  cursorColumn: NonNullable<SupabaseRequestOptions["beforeColumn"]>;
  /** Stop after this many rows, while still traversing server-sized pages. */
  stopAfter?: number;
  label?: string;
};

function cursorForRow(
  row: SupabaseRow,
  cursorColumn: ExhaustiveReadOptions["cursorColumn"],
): { createdAt: string; id: string } {
  const createdAt = row[cursorColumn] ?? row.created_at ?? row.event_time;
  const id = row.id;
  if (
    (typeof createdAt !== "string" && typeof createdAt !== "number") ||
    (typeof id !== "string" && typeof id !== "number")
  ) {
    throw new Error(`Cannot advance ${cursorColumn} pagination without a timestamp and id.`);
  }
  return { createdAt: String(createdAt), id: String(id) };
}

function pageHasMore(page: SupabaseRows, requested: number) {
  const contentRange = page.contentRange;
  if (contentRange === undefined) {
    // Legacy adapters predate Content-Range and return a complete short array.
    // Production PostgREST responses carry the header.
    return page.length >= requested;
  }
  if (contentRange === null) {
    // The production transport observed no range header. It cannot prove that
    // a short page is the end, so probe again rather than inventing completion.
    return true;
  }
  const match = contentRange.match(/^(?:\*|(\d+)-(\d+))\/(\*|\d+)$/);
  if (!match) {
    throw new Error(`Supabase returned an invalid Content-Range: ${contentRange}`);
  }
  const end = match[2] ? Number(match[2]) : -1;
  const total = match[3] === "*" ? null : Number(match[3]);
  return total === null || end + 1 < total;
}

/**
 * Read every row in an already-scoped PostgREST query. PostgREST deployments
 * commonly enforce a lower row ceiling than the requested limit, so a short
 * page is not treated as end-of-data. Keyset traversal also avoids applying a
 * global cap before any caller-owned wallet filter.
 */
export async function selectRowsExhaustive(
  ctx: ApiContext,
  table: string,
  options: Omit<SupabaseRequestOptions, "limit">,
  readOptions: ExhaustiveReadOptions,
) {
  const rows: SupabaseRow[] = [];
  let cursor = options.before;
  const seenCursors = new Set<string>();
  let pageCount = 0;

  while (readOptions.stopAfter === undefined || rows.length < readOptions.stopAfter) {
    if (pageCount >= MAX_READ_PAGES) {
      throw readModelUnavailable(
        readOptions.label ?? `${table}.read`,
        new Error(`Read pagination exceeded ${MAX_READ_PAGES} pages without reaching the end.`),
      );
    }
    pageCount += 1;
    const remaining =
      readOptions.stopAfter === undefined
        ? READ_PAGE_SIZE
        : Math.max(1, Math.min(READ_PAGE_SIZE, readOptions.stopAfter - rows.length));
    const page = (await selectRows(ctx, table, {
      ...options,
      before: cursor,
      beforeColumn: readOptions.cursorColumn,
      limit: remaining,
    })) as SupabaseRows;
    if (page.length === 0) {
      break;
    }

    rows.push(...page);
    if (page.length < remaining) {
      try {
        if (!pageHasMore(page, remaining)) {
          break;
        }
      } catch (error) {
        throw readModelUnavailable(readOptions.label ?? `${table}.read`, error);
      }
    }

    const lastRow = page[page.length - 1];
    if (!lastRow) {
      throw readModelUnavailable(
        readOptions.label ?? `${table}.read`,
        new Error("Read pagination returned an empty page after a non-empty check."),
      );
    }
    let nextCursor: { createdAt: string; id: string };
    try {
      nextCursor = cursorForRow(lastRow, readOptions.cursorColumn);
    } catch (error) {
      throw readModelUnavailable(readOptions.label ?? `${table}.read`, error);
    }
    const cursorKey = `${nextCursor.createdAt}\u0000${nextCursor.id}`;
    if (seenCursors.has(cursorKey)) {
      throw readModelUnavailable(
        readOptions.label ?? `${table}.read`,
        new Error("Read pagination made no progress; refusing to loop over repeated rows."),
      );
    }
    seenCursors.add(cursorKey);
    cursor = nextCursor;
  }

  return readOptions.stopAfter === undefined ? rows : rows.slice(0, readOptions.stopAfter);
}
