/**
 * In-memory Supabase client for unit tests.
 */

import type {
  AppSupabaseClient,
  EventRow,
  ModelCreditMultiplierRow,
  PlanCreditConfigRow,
  PlatformApiKeyRow,
  SessionChatMessageRow,
  SessionRow,
  SessionUsageCursorRow,
  UsageEventRow,
  UserCredentialRow,
  UserCreditPeriodRow,
  UserRow,
  UserSubscriptionRow,
} from "../database.js";

type TableName =
  | "users"
  | "user_credentials"
  | "sessions"
  | "events"
  | "user_subscriptions"
  | "usage_events"
  | "plan_credit_configs"
  | "model_credit_multipliers"
  | "platform_api_keys"
  | "user_credit_periods"
  | "session_usage_cursors"
  | "session_chat_messages";

function credentialKey(userId: string, providerId: string, fieldName: string): string {
  return `${userId}:${providerId}:${fieldName}`;
}

function multiplierKey(providerId: string, modelId: string): string {
  return `${providerId}:${modelId}`;
}

function rowValue(row: Record<string, unknown>, column: string): unknown {
  return row[column];
}

function defaultPlanConfigs(): Map<string, PlanCreditConfigRow> {
  const now = new Date().toISOString();
  return new Map([
    [
      "hosted",
      {
        plan_id: "hosted",
        monthly_credit_allowance: 10_000_000,
        low_balance_block_ratio: 0.03,
        low_balance_warn_ratio: 0.1,
        max_rollover_periods: 1,
        estimated_tokens_by_depth: { "1": 80_000, "3": 250_000, "5": 500_000 },
        reference_output_usd_per_1m: 0.266667,
        updated_at: now,
      },
    ],
    [
      "byok",
      {
        plan_id: "byok",
        monthly_credit_allowance: 0,
        low_balance_block_ratio: 0.03,
        low_balance_warn_ratio: 0.1,
        max_rollover_periods: 0,
        estimated_tokens_by_depth: { "1": 80_000, "3": 250_000, "5": 500_000 },
        reference_output_usd_per_1m: 0.266667,
        updated_at: now,
      },
    ],
  ]);
}

export function createInMemorySupabase(): AppSupabaseClient {
  const users = new Map<string, UserRow>();
  const credentials = new Map<string, UserCredentialRow>();
  const sessions = new Map<string, SessionRow>();
  const subscriptions = new Map<string, UserSubscriptionRow>();
  const planConfigs = defaultPlanConfigs();
  const multipliers = new Map<string, ModelCreditMultiplierRow>();
  const platformKeys = new Map<string, PlatformApiKeyRow>();
  const creditPeriods = new Map<number, UserCreditPeriodRow>();
  const usageCursors = new Map<string, SessionUsageCursorRow>();
  const chatMessages = new Map<string, SessionChatMessageRow>();
  const usageEvents: UsageEventRow[] = [];
  const events: EventRow[] = [];
  let nextEventId = 1;
  let nextUsageEventId = 1;
  let nextCreditPeriodId = 1;

  function ok<T>(data: T, count?: number) {
    return { data, error: null as null, count };
  }

  function err(message: string) {
    return { data: null, error: { message }, count: undefined };
  }

  function getRows(table: TableName): Record<string, unknown>[] {
    switch (table) {
      case "users":
        return [...users.values()] as unknown as Record<string, unknown>[];
      case "user_credentials":
        return [...credentials.values()] as unknown as Record<string, unknown>[];
      case "sessions":
        return [...sessions.values()] as unknown as Record<string, unknown>[];
      case "user_subscriptions":
        return [...subscriptions.values()] as unknown as Record<string, unknown>[];
      case "events":
        return [...events] as unknown as Record<string, unknown>[];
      case "usage_events":
        return [...usageEvents] as unknown as Record<string, unknown>[];
      case "plan_credit_configs":
        return [...planConfigs.values()] as unknown as Record<string, unknown>[];
      case "model_credit_multipliers":
        return [...multipliers.values()] as unknown as Record<string, unknown>[];
      case "platform_api_keys":
        return [...platformKeys.values()] as unknown as Record<string, unknown>[];
      case "user_credit_periods":
        return [...creditPeriods.values()] as unknown as Record<string, unknown>[];
      case "session_usage_cursors":
        return [...usageCursors.values()] as unknown as Record<string, unknown>[];
      case "session_chat_messages":
        return [...chatMessages.values()] as unknown as Record<string, unknown>[];
      default:
        return [];
    }
  }

  function buildQuery(table: TableName) {
    let filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let selectedColumns = "*";
    let orderBy: Array<{ column: string; ascending: boolean }> = [];
    let rangeStart = 0;
    let rangeEnd = Number.MAX_SAFE_INTEGER;
    let headOnly = false;
    let wantCount = false;
    let limitCount = Number.MAX_SAFE_INTEGER;
    let singleMode: "maybeSingle" | "single" | null = null;

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

    const projectRow = <T>(row: Record<string, unknown>): T => {
      if (selectedColumns === "*") {
        return row as T;
      }
      const projected: Record<string, unknown> = {};
      for (const column of selectedColumns.split(",").map((part) => part.trim())) {
        projected[column] = rowValue(row, column);
      }
      return projected as T;
    };

    const executeSelect = <T>() => {
      const filtered = applyOrder(applyFilters(getRows(table)));
      const count = filtered.length;

      if (headOnly) {
        return ok(null as T, count);
      }

      const sliced = filtered.slice(rangeStart, rangeEnd + 1).slice(0, limitCount);
      const projected = sliced.map((row) => projectRow<T>(row));

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
      in(column: string, values: unknown[]) {
        const set = new Set(values);
        filters.push((row) => set.has(rowValue(row, column)));
        return chain;
      },
      is(column: string, value: null) {
        filters.push((row) => rowValue(row, column) == null);
        return chain;
      },
      neq(column: string, value: unknown) {
        filters.push((row) => rowValue(row, column) !== value);
        return chain;
      },
      lt(column: string, value: unknown) {
        filters.push((row) => {
          const current = rowValue(row, column);
          return current != null && value != null && current < value;
        });
        return chain;
      },
      gte(column: string, value: unknown) {
        filters.push((row) => {
          const current = rowValue(row, column);
          return current != null && value != null && current >= value;
        });
        return chain;
      },
      lte(column: string, value: unknown) {
        filters.push((row) => {
          const current = rowValue(row, column);
          return current != null && value != null && current <= value;
        });
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

  function insertRows(table: TableName, rows: Record<string, unknown>[]) {
    const inserted: Record<string, unknown>[] = [];
    for (const row of rows) {
      if (table === "users") {
        users.set(String(row.id), row as unknown as UserRow);
        inserted.push(row);
      } else if (table === "sessions") {
        sessions.set(String(row.id), row as unknown as SessionRow);
        inserted.push(row);
      } else if (table === "events") {
        const event = {
          ...(row as Omit<EventRow, "id">),
          id: nextEventId++,
        };
        events.push(event);
        inserted.push(event as unknown as Record<string, unknown>);
      } else if (table === "user_credentials") {
        credentials.set(
          credentialKey(
            String(row.user_id),
            String(row.provider_id),
            String(row.field_name),
          ),
          row as unknown as UserCredentialRow,
        );
        inserted.push(row);
      } else if (table === "user_subscriptions") {
        subscriptions.set(String(row.user_id), row as unknown as UserSubscriptionRow);
        inserted.push(row);
      } else if (table === "usage_events") {
        const event = {
          ...(row as Omit<UsageEventRow, "id">),
          id: nextUsageEventId++,
        };
        usageEvents.push(event);
        inserted.push(event as unknown as Record<string, unknown>);
      } else if (table === "plan_credit_configs") {
        planConfigs.set(String(row.plan_id), row as unknown as PlanCreditConfigRow);
        inserted.push(row);
      } else if (table === "model_credit_multipliers") {
        multipliers.set(
          multiplierKey(String(row.provider_id), String(row.model_id)),
          row as unknown as ModelCreditMultiplierRow,
        );
        inserted.push(row);
      } else if (table === "platform_api_keys") {
        platformKeys.set(String(row.provider_id), row as unknown as PlatformApiKeyRow);
        inserted.push(row);
      } else if (table === "user_credit_periods") {
        const id = typeof row.id === "number" ? row.id : nextCreditPeriodId++;
        const period = { ...row, id } as unknown as UserCreditPeriodRow;
        creditPeriods.set(id, period);
        inserted.push(period as unknown as Record<string, unknown>);
      } else if (table === "session_usage_cursors") {
        usageCursors.set(String(row.session_id), row as unknown as SessionUsageCursorRow);
        inserted.push(row);
      } else if (table === "session_chat_messages") {
        chatMessages.set(String(row.id), row as unknown as SessionChatMessageRow);
        inserted.push(row);
      }
    }
    return inserted;
  }

  function updateMatching(
    table: TableName,
    values: Record<string, unknown>,
    column: string,
    value: unknown,
  ) {
    if (table === "users") {
      const existing = users.get(String(value));
      if (existing && column === "id") {
        users.set(String(value), { ...existing, ...values });
      }
    } else if (table === "sessions") {
      const existing = sessions.get(String(value));
      if (existing && column === "id") {
        sessions.set(String(value), { ...existing, ...values });
      }
    } else if (table === "user_subscriptions" && column === "user_id") {
      const existing = subscriptions.get(String(value));
      if (existing) {
        subscriptions.set(String(value), { ...existing, ...values });
      }
    } else if (table === "user_credentials") {
      for (const [key, row] of credentials.entries()) {
        if (rowValue(row as unknown as Record<string, unknown>, column) === value) {
          const nextRow = { ...row, ...values } as UserCredentialRow;
          credentials.delete(key);
          credentials.set(
            credentialKey(nextRow.user_id, nextRow.provider_id, nextRow.field_name),
            nextRow,
          );
        }
      }
    } else if (table === "user_credit_periods" && column === "id") {
      const existing = creditPeriods.get(Number(value));
      if (existing) {
        creditPeriods.set(Number(value), { ...existing, ...values });
      }
    } else if (table === "session_usage_cursors" && column === "session_id") {
      const existing = usageCursors.get(String(value));
      if (existing) {
        usageCursors.set(String(value), { ...existing, ...values });
      }
    } else if (table === "session_chat_messages" && column === "id") {
      const existing = chatMessages.get(String(value));
      if (existing) {
        chatMessages.set(String(value), { ...existing, ...values });
      }
    } else if (table === "platform_api_keys" && column === "provider_id") {
      const existing = platformKeys.get(String(value));
      if (existing) {
        platformKeys.set(String(value), { ...existing, ...values });
      }
    } else if (table === "model_credit_multipliers") {
      for (const [key, row] of multipliers.entries()) {
        if (rowValue(row as unknown as Record<string, unknown>, column) === value) {
          multipliers.set(key, { ...row, ...values });
        }
      }
    }
  }

  return {
    from(table: TableName) {
      return {
        select(columns?: string, options?: { count?: "exact"; head?: boolean }) {
          return buildQuery(table).select(columns, options);
        },
        insert(values: Record<string, unknown> | Record<string, unknown>[]) {
          const rows = Array.isArray(values) ? values : [values];
          const inserted = insertRows(table, rows);
          const chain = {
            select(_columns = "*") {
              return {
                maybeSingle() {
                  return Promise.resolve(ok(inserted[0] ?? null));
                },
                single() {
                  return Promise.resolve(ok(inserted[0] ?? null));
                },
                then(
                  onfulfilled?: ((value: unknown) => unknown) | null,
                  onrejected?: ((reason: unknown) => unknown) | null,
                ) {
                  return Promise.resolve(ok(inserted)).then(onfulfilled, onrejected);
                },
              };
            },
            then(
              onfulfilled?: ((value: unknown) => unknown) | null,
              onrejected?: ((reason: unknown) => unknown) | null,
            ) {
              return Promise.resolve(ok(null)).then(onfulfilled, onrejected);
            },
          };
          return chain;
        },
        upsert(values: Record<string, unknown>, _options?: { onConflict?: string }) {
          if (table === "user_credentials") {
            credentials.set(
              credentialKey(
                String(values.user_id),
                String(values.provider_id),
                String(values.field_name),
              ),
              values as unknown as UserCredentialRow,
            );
            return Promise.resolve(ok(null));
          }
          if (table === "user_subscriptions") {
            const userId = String(values.user_id);
            const existing = subscriptions.get(userId);
            const now = new Date().toISOString();
            subscriptions.set(userId, {
              ...(existing ?? {
                created_at: now,
              }),
              ...(values as unknown as UserSubscriptionRow),
              user_id: userId,
              updated_at: now,
            });
            return Promise.resolve(ok(null));
          }
          if (table === "platform_api_keys") {
            const providerId = String(values.provider_id);
            const existing = platformKeys.get(providerId);
            const now = new Date().toISOString();
            platformKeys.set(providerId, {
              ...(existing ?? { created_at: now }),
              ...(values as unknown as PlatformApiKeyRow),
              provider_id: providerId,
              updated_at: now,
            });
            return Promise.resolve(ok(null));
          }
          if (table === "session_usage_cursors") {
            const sessionId = String(values.session_id);
            const existing = usageCursors.get(sessionId);
            const now = new Date().toISOString();
            usageCursors.set(sessionId, {
              ...(existing ?? { created_at: now }),
              ...(values as unknown as SessionUsageCursorRow),
              session_id: sessionId,
              updated_at: now,
            });
            return Promise.resolve(ok(null));
          }
          if (table === "model_credit_multipliers") {
            multipliers.set(
              multiplierKey(String(values.provider_id), String(values.model_id)),
              values as unknown as ModelCreditMultiplierRow,
            );
            return Promise.resolve(ok(null));
          }
          if (table === "user_credit_periods") {
            const userId = String(values.user_id);
            const periodStart = String(values.period_start);
            for (const [id, row] of creditPeriods.entries()) {
              if (row.user_id === userId && row.period_start === periodStart) {
                creditPeriods.set(id, { ...row, ...values, id });
                return Promise.resolve(ok(null));
              }
            }
            insertRows(table, [values]);
            return Promise.resolve(ok(null));
          }
          return Promise.resolve(ok(null));
        },
        update(values: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              updateMatching(table, values, column, value);
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
              } else if (table === "user_subscriptions" && column === "user_id") {
                subscriptions.delete(String(value));
              } else if (table === "events") {
                for (let index = events.length - 1; index >= 0; index -= 1) {
                  if (
                    rowValue(events[index] as unknown as Record<string, unknown>, column) ===
                    value
                  ) {
                    events.splice(index, 1);
                  }
                }
              } else if (table === "platform_api_keys" && column === "provider_id") {
                platformKeys.delete(String(value));
              } else if (table === "session_usage_cursors" && column === "session_id") {
                usageCursors.delete(String(value));
              } else if (table === "session_chat_messages" && column === "id") {
                chatMessages.delete(String(value));
              }
              return Promise.resolve(ok(null));
            },
          };
        },
      };
    },
    rpc(fn: string, args?: Record<string, unknown>) {
      if (fn === "charge_user_credits") {
        const periodId = Number(args?.p_period_id);
        const credits = Number(args?.p_credits ?? 0);
        const period = creditPeriods.get(periodId);
        if (!period) {
          return Promise.resolve(err("credit period not found"));
        }
        const total = period.base_allowance + period.rollover_credits;
        const nextUsed = period.used_credits + credits;
        if (credits > 0 && nextUsed > total) {
          return Promise.resolve(
            ok([
              {
                allowed: false,
                used_credits: period.used_credits,
                remaining_credits: Math.max(0, total - period.used_credits),
                total_allowance: total,
                blocked_low_balance: period.blocked_low_balance,
              },
            ]),
          );
        }
        const updated = {
          ...period,
          used_credits: nextUsed,
          updated_at: new Date().toISOString(),
        };
        creditPeriods.set(periodId, updated);
        return Promise.resolve(
          ok([
            {
              allowed: true,
              used_credits: updated.used_credits,
              remaining_credits: Math.max(0, total - updated.used_credits),
              total_allowance: total,
              blocked_low_balance: updated.blocked_low_balance,
            },
          ]),
        );
      }

      if (fn === "meter_session_usage") {
        const sessionId = String(args?.p_session_id ?? "");
        const userId = String(args?.p_user_id ?? "");
        const tokensIn = Math.max(0, Math.floor(Number(args?.p_tokens_in ?? 0)));
        const tokensOut = Math.max(0, Math.floor(Number(args?.p_tokens_out ?? 0)));
        const periodId =
          args?.p_period_id == null || args.p_period_id === ""
            ? null
            : Number(args.p_period_id);
        const multiplier = Math.max(0, Number(args?.p_credit_multiplier ?? 1));
        const warnRatio = Number(args?.p_warn_ratio ?? 0.1);
        const cursor = usageCursors.get(sessionId);
        if (!cursor) {
          return Promise.resolve(
            ok([
              {
                charged_credits: 0,
                session_credits: 0,
                remaining_credits: null,
                total_allowance: null,
                used_ratio: null,
                exhausted: false,
                should_warn: false,
                warn_message: null,
                cost_source: "self_pay",
                delta_tokens_in: 0,
                delta_tokens_out: 0,
              },
            ]),
          );
        }
        if (cursor.user_id !== userId) {
          return Promise.resolve(err("session_usage_cursors user mismatch"));
        }

        const deltaIn = Math.max(0, tokensIn - cursor.last_tokens_in);
        const deltaOut = Math.max(0, tokensOut - cursor.last_tokens_out);
        const modelId = cursor.deep_model_id || cursor.quick_model_id;

        if (deltaIn === 0 && deltaOut === 0) {
          let remaining: number | null = null;
          let total: number | null = null;
          let usedRatio: number | null = null;
          if (cursor.cost_source === "hosted" && periodId != null) {
            const period = creditPeriods.get(periodId);
            if (period) {
              total = period.base_allowance + period.rollover_credits;
              remaining = Math.max(0, total - period.used_credits);
              usedRatio = total > 0 ? Math.min(1, period.used_credits / total) : 1;
            }
          }
          return Promise.resolve(
            ok([
              {
                charged_credits: 0,
                session_credits: cursor.credits_charged,
                remaining_credits: remaining,
                total_allowance: total,
                used_ratio: usedRatio,
                exhausted: false,
                should_warn: false,
                warn_message: null,
                cost_source: cursor.cost_source,
                delta_tokens_in: 0,
                delta_tokens_out: 0,
              },
            ]),
          );
        }

        let charge = 0;
        let remaining: number | null = null;
        let total: number | null = null;
        let usedRatio: number | null = null;
        let exhausted = false;
        let shouldWarn = false;
        let warnMessage: string | null = null;

        if (cursor.cost_source === "hosted") {
          if (periodId == null) {
            return Promise.resolve(err("hosted metering requires p_period_id"));
          }
          const period = creditPeriods.get(periodId);
          if (!period) {
            return Promise.resolve(err("credit period not found"));
          }
          total = period.base_allowance + period.rollover_credits;
          const deltaCredits = Math.round((deltaIn + deltaOut) * multiplier);
          const nextUsed = period.used_credits + deltaCredits;
          if (deltaCredits > 0 && nextUsed > total) {
            charge = Math.max(0, total - period.used_credits);
            exhausted = true;
          } else {
            charge = deltaCredits;
            exhausted = total - (period.used_credits + charge) <= 0;
          }
          const updatedPeriod = {
            ...period,
            used_credits: period.used_credits + charge,
            blocked_low_balance: period.blocked_low_balance || exhausted,
            updated_at: new Date().toISOString(),
          };
          creditPeriods.set(periodId, updatedPeriod);
          total = updatedPeriod.base_allowance + updatedPeriod.rollover_credits;
          remaining = Math.max(0, total - updatedPeriod.used_credits);
          usedRatio = total > 0 ? Math.min(1, updatedPeriod.used_credits / total) : 1;
          if (
            !cursor.low_credit_warned &&
            !exhausted &&
            total > 0 &&
            remaining / total <= warnRatio
          ) {
            shouldWarn = true;
            warnMessage = `Compute credits are running low — ${remaining.toLocaleString()} of ${total.toLocaleString()} remaining this period.`;
          }
        }

        const event = {
          id: nextUsageEventId++,
          user_id: userId,
          session_id: sessionId,
          provider_id: cursor.provider_id,
          model_id: modelId,
          tokens_in: deltaIn,
          tokens_out: deltaOut,
          billable_units: cursor.cost_source === "hosted" ? charge : 0,
          cost_source: cursor.cost_source,
          credit_period_id: periodId,
          created_at: new Date().toISOString(),
        };
        usageEvents.push(event);

        const updatedCursor = {
          ...cursor,
          last_tokens_in: tokensIn,
          last_tokens_out: tokensOut,
          credits_charged: cursor.credits_charged + charge,
          low_credit_warned: cursor.low_credit_warned || shouldWarn,
          updated_at: new Date().toISOString(),
        };
        usageCursors.set(sessionId, updatedCursor);

        return Promise.resolve(
          ok([
            {
              charged_credits: charge,
              session_credits: updatedCursor.credits_charged,
              remaining_credits: remaining,
              total_allowance: total,
              used_ratio: usedRatio,
              exhausted,
              should_warn: shouldWarn,
              warn_message: warnMessage,
              cost_source: cursor.cost_source,
              delta_tokens_in: deltaIn,
              delta_tokens_out: deltaOut,
            },
          ]),
        );
      }

      return Promise.resolve(err(`unknown rpc ${fn}`));
    },
  } as unknown as AppSupabaseClient;
}
