/**
 * apps/api/src/services/run-metering-service.ts
 *
 * Server-side metering consumer for hosted analysis runs and follow-up chat.
 * Independent of the browser SSE connection so closing the tab cannot leave
 * platform keys unmetered.
 */

import type { AppSupabaseClient } from "@tradingagents/supabase";
import {
  agentsServiceAuthHeaders,
  cancelChatTurn,
  cancelRun,
  getChatTurnStreamUrl,
  getRunStreamUrl,
} from "./agents-client.js";
import { meterSessionStats } from "./credit-service.js";
import * as sessionService from "./session-service.js";

export type MeterSubscription = {
  plan_id: string;
  current_period_start: string;
  current_period_end: string;
};

const activeMeters = new Map<string, AbortController>();

function meterKey(kind: "run" | "chat", id: string): string {
  return `${kind}:${id}`;
}

export function startBackgroundRunMetering(input: {
  client: AppSupabaseClient;
  sessionId: string;
  runId: string;
  userId: string;
  subscription: MeterSubscription | null;
  costSource: "hosted" | "self_pay";
}): void {
  const key = meterKey("run", input.sessionId);
  if (activeMeters.has(key)) {
    return;
  }

  const controller = new AbortController();
  activeMeters.set(key, controller);

  void (async () => {
    try {
      await consumeSseForMetering(
        {
          ...input,
          streamUrl: getRunStreamUrl(input.runId),
          terminalEvents: ["run.completed", "run.error"],
          onExhausted: async (meter) => {
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
          },
        },
        controller.signal,
      );
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
      activeMeters.delete(key);
    }
  })();
}

export function startBackgroundChatMetering(input: {
  client: AppSupabaseClient;
  sessionId: string;
  turnId: string;
  assistantMessageId: string;
  userId: string;
  subscription: MeterSubscription | null;
  costSource: "hosted" | "self_pay";
  onTerminal?: (event: {
    type: "chat.completed" | "chat.error";
    payload: Record<string, unknown>;
  }) => Promise<void>;
}): void {
  const key = meterKey("chat", input.turnId);
  if (activeMeters.has(key)) {
    return;
  }

  const controller = new AbortController();
  activeMeters.set(key, controller);

  void (async () => {
    let sawTerminal = false;
    const failTerminal = async (message: string, hint?: string) => {
      if (sawTerminal || !input.onTerminal) {
        return;
      }
      sawTerminal = true;
      await input.onTerminal({
        type: "chat.error",
        payload: {
          turnId: input.turnId,
          sessionId: input.sessionId,
          assistantMessageId: input.assistantMessageId,
          message,
          ...(hint ? { hint } : {}),
        },
      });
    };

    try {
      await consumeSseForMetering(
        {
          client: input.client,
          sessionId: input.sessionId,
          userId: input.userId,
          subscription: input.subscription,
          costSource: input.costSource,
          streamUrl: getChatTurnStreamUrl(input.turnId),
          terminalEvents: ["chat.completed", "chat.error"],
          onExhausted: async (meter) => {
            const exhaustedMessage =
              "Compute credits exhausted — this chat turn has been stopped.";
            const exhaustedHint = "Prior research and chat history remain available.";
            await cancelChatTurn(input.turnId, {
              message: exhaustedMessage,
              hint: exhaustedHint,
            });
            await sessionService.persistEvent(input.client, input.sessionId, "credit.exhausted", {
              remainingComputeCredits: meter.remaining ?? 0,
              message: exhaustedMessage,
              turnId: input.turnId,
              assistantMessageId: input.assistantMessageId,
            });
            sawTerminal = true;
            await input.onTerminal?.({
              type: "chat.error",
              payload: {
                turnId: input.turnId,
                sessionId: input.sessionId,
                assistantMessageId: input.assistantMessageId,
                message: exhaustedMessage,
                hint: exhaustedHint,
              },
            });
          },
          onTerminal: async (event) => {
            sawTerminal = true;
            await input.onTerminal?.(event);
          },
        },
        controller.signal,
      );
      if (!sawTerminal && !controller.signal.aborted) {
        await failTerminal(
          "Chat stream ended before the Portfolio Manager finished.",
          "Try sending your message again.",
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Credit metering failed";
      if (!controller.signal.aborted) {
        try {
          await cancelChatTurn(input.turnId, {
            message: "Chat stopped because the metering stream failed.",
            hint: message,
          });
        } catch {
          // Best-effort.
        }
        await failTerminal("Chat stopped because the metering stream failed.", message);
      }
    } finally {
      activeMeters.delete(key);
    }
  })();
}

export function stopBackgroundRunMetering(sessionId: string): void {
  const controller = activeMeters.get(meterKey("run", sessionId));
  if (!controller) {
    return;
  }
  controller.abort();
  activeMeters.delete(meterKey("run", sessionId));
}

export function stopBackgroundChatMetering(turnId: string): void {
  const controller = activeMeters.get(meterKey("chat", turnId));
  if (!controller) {
    return;
  }
  controller.abort();
  activeMeters.delete(meterKey("chat", turnId));
}

async function consumeSseForMetering(
  input: {
    client: AppSupabaseClient;
    sessionId: string;
    userId: string;
    subscription: MeterSubscription | null;
    costSource: "hosted" | "self_pay";
    streamUrl: string;
    terminalEvents: string[];
    onExhausted: (meter: {
      remaining: number | null;
    }) => Promise<void>;
    onTerminal?: (event: {
      type: "chat.completed" | "chat.error";
      payload: Record<string, unknown>;
    }) => Promise<void>;
  },
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(input.streamUrl, {
    signal,
    headers: agentsServiceAuthHeaders(),
  });
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
          await input.onExhausted(meter);
          try {
            await reader.cancel();
          } catch {
            // Ignore.
          }
          try {
            await input.client
              .from("session_usage_cursors")
              .delete()
              .eq("session_id", input.sessionId);
          } catch {
            // Best-effort.
          }
          return;
        }
      }

      if (input.terminalEvents.includes(eventType)) {
        if (
          input.onTerminal &&
          (eventType === "chat.completed" || eventType === "chat.error")
        ) {
          try {
            const payload = JSON.parse(dataLine) as Record<string, unknown>;
            await input.onTerminal({
              type: eventType,
              payload,
            });
          } catch {
            // Best-effort persist from stream.
          }
        }
        try {
          await reader.cancel();
        } catch {
          // Ignore.
        }
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
