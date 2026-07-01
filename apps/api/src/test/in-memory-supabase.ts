/**
 * In-memory Supabase client for unit tests.
 */

import type { AppSupabaseClient, EventRow, SessionRow, UserCredentialRow, UserRow } from "../db/database.js";

function credentialKey(userId: string, providerId: string, fieldName: string): string {
  return `${userId}:${providerId}:${fieldName}`;
}

function rowValue(row: Record<string, unknown>, column: string): unknown {
  return row[column];
}

export function createInMemorySupabase(): AppSupabaseClient {
  const users = new Map<string, UserRow>();
  const credentials = new Map<string, UserCredentialRow>();
  const sessions = new Map<string, SessionRow>();
  const events: EventRow[] = [];
  let nextEventId = 1;

  function ok<T>(data: T, count?: number) {
    return { data, error: null as null, count };
  }

  function buildQuery<T>(table: "users" | "user_credentials" | "sessions" | "events") {
    let filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let selectedColumns = "*";
    let orderBy: Array<{ column: string; ascending: boolean }> = [];
    let rangeStart = 0;
    let rangeEnd = Number.MAX_SAFE_INTEGER;
    let headOnly = false;
    let wantCount = false;
    let limitCount = Number.MAX_SAFE_INTEGER;
    let singleMode: "maybeSingle" | "single" | null = null;

    const getRows = (): Record<string, unknown>[] => {
      switch (table) {
        case "users":
          return [...users.values()] as unknown as Record<string, unknown>[];
        case "user_credentials":
          return [...credentials.values()] as unknown as Record<string, unknown>[];
        case "sessions":
          return [...sessions.values()] as unknown as Record<string, unknown>[];
        case "events":
          return [...events] as unknown as Record<string, unknown>[];
        default:
          return [];
      }
    };

    const applyFilters = (rows: Record<string, unknown>[]) =>
      rows.filter((row) => filters.every((filter) => filter(row)));

    const applyOrder = (rows: Record<string, unknown>[]) => {
      if (orderBy.length === 0) {
        return rows;
      }
      return [...rows].sort((left, right) => {
        for (const { column, ascending } of orderBy) {
          const leftValue = rowValue(left, column);
          const rightValue = rowValue(right, column);
          if (leftValue === rightValue) {
            continue;
          }
          if (leftValue == null) {
            return ascending ? -1 : 1;
          }
          if (rightValue == null) {
            return ascending ? 1 : -1;
          }
          if (leftValue < rightValue) {
            return ascending ? -1 : 1;
          }
          return ascending ? 1 : -1;
        }
        return 0;
      });
    };

    const projectRow = (row: Record<string, unknown>): T => {
      if (selectedColumns === "*") {
        return row as T;
      }
      const projected: Record<string, unknown> = {};
      for (const column of selectedColumns.split(",").map((part) => part.trim())) {
        projected[column] = rowValue(row, column);
      }
      return projected as T;
    };

    const executeSelect = () => {
      const filtered = applyOrder(applyFilters(getRows()));
      const count = filtered.length;

      if (headOnly) {
        return ok(null as T, count);
      }

      const sliced = filtered.slice(rangeStart, rangeEnd + 1).slice(0, limitCount);
      const projected = sliced.map((row) => projectRow(row));

      if (singleMode === "maybeSingle") {
        return ok((projected[0] ?? null) as T | null);
      }
      if (singleMode === "single") {
        return ok(projected[0] as T);
      }

      return ok(projected as T[], wantCount ? count : undefined);
    };

    const chain = {
      select(columns = "*", options?: { count?: "exact"; head?: boolean }) {
        selectedColumns = columns;
        wantCount = options?.count === "exact";
        headOnly = options?.head === true;
        return chain;
      },
      eq(column: string, value: unknown) {
        filters.push((row) => rowValue(row, column) === value);
        return chain;
      },
      order(column: string, options?: { ascending?: boolean }) {
        orderBy.push({ column, ascending: options?.ascending ?? true });
        return chain;
      },
      range(start: number, end: number) {
        rangeStart = start;
        rangeEnd = end;
        return chain;
      },
      limit(count: number) {
        limitCount = count;
        return chain;
      },
      maybeSingle() {
        singleMode = "maybeSingle";
        return Promise.resolve(executeSelect());
      },
      single() {
        singleMode = "single";
        return Promise.resolve(executeSelect());
      },
      then<TResult1 = ReturnType<typeof executeSelect>, TResult2 = never>(
        onfulfilled?:
          | ((value: ReturnType<typeof executeSelect>) => TResult1 | PromiseLike<TResult1>)
          | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) {
        return Promise.resolve(executeSelect()).then(onfulfilled, onrejected);
      },
    };

    return chain;
  }

  return {
    from(table: "users" | "user_credentials" | "sessions" | "events") {
      return {
        select(columns?: string, options?: { count?: "exact"; head?: boolean }) {
          return buildQuery(table).select(columns, options);
        },
        insert(values: Record<string, unknown> | Record<string, unknown>[]) {
          const rows = Array.isArray(values) ? values : [values];
          for (const row of rows) {
            if (table === "users") {
              users.set(String(row.id), row as unknown as UserRow);
            } else if (table === "sessions") {
              sessions.set(String(row.id), row as unknown as SessionRow);
            } else if (table === "events") {
              events.push({
                ...(row as Omit<EventRow, "id">),
                id: nextEventId++,
              });
            } else if (table === "user_credentials") {
              credentials.set(
                credentialKey(
                  String(row.user_id),
                  String(row.provider_id),
                  String(row.field_name),
                ),
                row as unknown as UserCredentialRow,
              );
            }
          }
          return Promise.resolve(ok(null));
        },
        upsert(values: Record<string, unknown>, _options?: { onConflict?: string }) {
          if (table !== "user_credentials") {
            return Promise.resolve(ok(null));
          }
          credentials.set(
            credentialKey(
              String(values.user_id),
              String(values.provider_id),
              String(values.field_name),
            ),
            values as unknown as UserCredentialRow,
          );
          return Promise.resolve(ok(null));
        },
        update(values: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              if (table === "users") {
                const existing = users.get(String(value));
                if (existing) {
                  users.set(String(value), { ...existing, ...values });
                }
              } else if (table === "sessions") {
                const existing = sessions.get(String(value));
                if (existing) {
                  sessions.set(String(value), { ...existing, ...values });
                }
              }
              return Promise.resolve(ok(null));
            },
          };
        },
        delete() {
          return {
            eq(column: string, value: unknown) {
              if (table === "users") {
                users.delete(String(value));
              } else if (table === "sessions") {
                sessions.delete(String(value));
              } else if (table === "events") {
                for (let index = events.length - 1; index >= 0; index -= 1) {
                  if (rowValue(events[index] as unknown as Record<string, unknown>, column) === value) {
                    events.splice(index, 1);
                  }
                }
              }
              return Promise.resolve(ok(null));
            },
          };
        },
      };
    },
  } as unknown as AppSupabaseClient;
}
