/**
 * apps/api/src/services/run-metering-service.ts
 *
 * Server-side metering consumer for hosted runs. Independent of the browser
 * SSE connection so closing the tab cannot leave platform keys unmetered.
 */

import type { AppSupabaseClient } from "@tradingagents/supabase";
import { cancelRun, getRunStreamUrl } from "./agents-client.js";
import { meterSessionStats } from "./credit-service.js";
import * as sessionService from "./session-service.js";

export type MeterSubscription = {
  plan_id: string;
  current_period_start: string;
  current_period_end: string;
};

const activeMeters = new Map<string, AbortController>();

export function startBackgroundRunMetering(input: {
  client: AppSupabaseClient;
  sessionId: string;
  runId: string;
  userId: string;
  subscription: MeterSubscription | null;
  costSource: "hosted" | "self_pay";
}): void {
  // Always meter so self_pay tokens are tracked; hosted also enforces exhaustion.
  if (activeMeters.has(input.sessionId)) {
    return;
  }

  const controller = new AbortController();
  activeMeters.set(input.sessionId, controller);

  void (async () => {
    try {
      await consumeRunStreamForMetering(input, controller.signal);
    } catch (error) {
      if (input.costSource === "hosted" && !controller.signal.aborted) {
        const message =
          error instanceof Error ? error.message : "Credit metering failed";
        try {
          await cancelRun(input.runId, {
            message: "Run stopped because credit metering failed.",
            hint: message,
          });
        } catch {
          // Best-effort.
        }
        try {
          await sessionService.markSessionError(
            input.client,
            input.sessionId,
            "Run stopped because credit metering failed.",
          );
          await sessionService.persistEvent(input.client, input.sessionId, "run.error", {
            message: "Run stopped because credit metering failed.",
            hint: message,
          });
        } catch {
          // Best-effort persistence.
        }
      }
    } finally {
      activeMeters.delete(input.sessionId);
    }
  })();
}

export function stopBackgroundRunMetering(sessionId: string): void {
  const controller = activeMeters.get(sessionId);
  if (!controller) {
    return;
  }
  controller.abort();
  activeMeters.delete(sessionId);
}

async function consumeRunStreamForMetering(
  input: {
    client: AppSupabaseClient;
    sessionId: string;
    runId: string;
    userId: string;
    subscription: MeterSubscription | null;
    costSource: "hosted" | "self_pay";
  },
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(getRunStreamUrl(input.runId), { signal });
  if (!response.ok || !response.body) {
    throw new Error(`Metering stream unavailable (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      if (!frame.trim()) {
        continue;
      }
      let eventType = "message";
      let dataLine = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLine = line.slice(5).trim();
        }
      }
      if (!dataLine) {
        continue;
      }

      if (eventType === "stats") {
        const payload = JSON.parse(dataLine) as Record<string, unknown>;
        const tokensIn = typeof payload.tokens_in === "number" ? payload.tokens_in : 0;
        const tokensOut = typeof payload.tokens_out === "number" ? payload.tokens_out : 0;
        const meter = await meterSessionStats(input.client, {
          sessionId: input.sessionId,
          userId: input.userId,
          tokensIn,
          tokensOut,
          subscription: input.subscription,
        });

        if (meter.exhausted && meter.costSource === "hosted") {
          await cancelRun(input.runId, {
            message: "Compute credits exhausted — this run has been stopped.",
            hint: "Partial results may still be available. Hosted runs resume when your allowance resets.",
          });
          await sessionService.markSessionError(
            input.client,
            input.sessionId,
            "Compute credits exhausted — this run has been stopped.",
          );
          await sessionService.persistEvent(input.client, input.sessionId, "credit.exhausted", {
            remainingComputeCredits: meter.remaining ?? 0,
            message: "Compute credits exhausted — this run has been stopped.",
          });
          try {
            await reader.cancel();
          } catch {
            // Ignore.
          }
          return;
        }
      }

      if (eventType === "run.completed" || eventType === "run.error") {
        try {
          await reader.cancel();
        } catch {
          // Ignore.
        }
        // Release any remaining in-flight reservation once the run is terminal
        // (especially after soft-delete, which keeps the cursor until here).
        try {
          await input.client
            .from("session_usage_cursors")
            .delete()
            .eq("session_id", input.sessionId);
        } catch {
          // Best-effort; metering already recorded usage_events.
        }
        return;
      }
    }
  }
}
