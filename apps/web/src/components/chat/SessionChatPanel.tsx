/**
 * @file apps/web/src/components/chat/SessionChatPanel.tsx
 * Portfolio Manager follow-up chat on a completed analysis session.
 */

"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type {
  ChatMessagePart,
  SessionChatMessage,
  SessionChatResponse,
  StreamStatsEvent,
} from "@tradingagents/api-types";
import {
  ApiClientError,
  fetchSessionChat,
  postSessionChatMessage,
  subscribeToChatStream,
} from "@/lib/api-client";
import { formatComputeCredits } from "@/lib/billing-display";
import ChatMessageParts from "@/components/chat/ChatMessageParts";
import styles from "./SessionChatPanel.module.css";

interface SessionChatPanelProps {
  sessionId: string;
  /** Session reached completed status (chat only then). */
  sessionCompleted: boolean;
  isOwner: boolean;
}

function blockedCopy(
  reason: SessionChatResponse["chatBlockedReason"],
): string {
  switch (reason) {
    case "subscription_required":
      return "An active subscription is required to continue chatting. You can still read this run and any prior follow-ups.";
    case "credits_blocked":
      return "Hosted compute credits are too low to continue chatting this period.";
    case "session_not_completed":
      return "Follow-up chat unlocks when the analysis finishes.";
    case "not_owner":
      return "Only the run owner can chat with the Portfolio Manager. You can still read the transcript.";
    default:
      return "Chat is unavailable.";
  }
}

function ThinkingDots() {
  return (
    <span className={styles.thinkingDots} aria-hidden>
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </span>
  );
}

export default function SessionChatPanel({
  sessionId,
  sessionCompleted,
  isOwner,
}: SessionChatPanelProps) {
  const [messages, setMessages] = useState<SessionChatMessage[]>([]);
  const [canChat, setCanChat] = useState(false);
  const [blockedReason, setBlockedReason] =
    useState<SessionChatResponse["chatBlockedReason"]>("not_owner");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creditWarning, setCreditWarning] = useState<string | null>(null);
  const [liveParts, setLiveParts] = useState<ChatMessagePart[]>([]);
  const [liveAssistantId, setLiveAssistantId] = useState<string | null>(null);
  const [liveStats, setLiveStats] = useState<StreamStatsEvent | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const hydrate = useCallback(async () => {
    try {
      const chat = await fetchSessionChat(sessionId);
      setMessages(chat.messages);
      setCanChat(chat.canChat);
      setBlockedReason(chat.chatBlockedReason ?? null);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 404) {
        setError("Chat unavailable for this session.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to load chat");
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void hydrate();
    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [hydrate]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) {
      return;
    }
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages, liveParts, liveAssistantId]);

  const showComposer = isOwner && sessionCompleted;

  function appendLivePart(part: ChatMessagePart) {
    setLiveParts((prev) => [...prev, part]);
  }

  function handleStreamTurn(turnId: string, assistantMessageId: string) {
    unsubscribeRef.current?.();
    setLiveAssistantId(assistantMessageId);
    setLiveParts([]);
    setLiveStats(null);

    unsubscribeRef.current = subscribeToChatStream(sessionId, turnId, {
      onEvent: (event, data) => {
        if (event === "thinking") {
          const thinking = data as { content: string };
          appendLivePart({ type: "thinking", content: thinking.content });
          return;
        }
        if (event === "tool.call") {
          const tool = data as { toolName: string; args: Record<string, unknown> };
          appendLivePart({
            type: "tool_call",
            toolName: tool.toolName,
            args: tool.args,
          });
          return;
        }
        if (event === "message") {
          const message = data as { content: string };
          appendLivePart({ type: "text", content: message.content });
          return;
        }
        if (event === "stats") {
          setLiveStats(data as StreamStatsEvent);
          return;
        }
        if (event === "credit.warning") {
          const warning = data as { message: string };
          setCreditWarning(warning.message);
          return;
        }
        if (event === "credit.exhausted") {
          const exhausted = data as { message: string };
          setCreditWarning(exhausted.message);
          setError(exhausted.message);
          return;
        }
        if (event === "chat.completed") {
          setLiveParts([]);
          setLiveAssistantId(null);
          void hydrate();
          return;
        }
        if (event === "chat.error") {
          const chatError = data as { message: string };
          setLiveParts([]);
          setLiveAssistantId(null);
          setError(chatError.message);
          void hydrate();
        }
      },
      // Reconnect replays turn history from agents-service — reset live parts
      // so thinking/tool frames are not duplicated after rotation.
      onReconnect: () => {
        setLiveParts([]);
      },
      onError: (err) => {
        setSending(false);
        setLiveParts([]);
        setLiveAssistantId(null);
        setError(err.message);
        void hydrate();
      },
      onStreamEnd: () => {
        setSending(false);
        setLiveAssistantId(null);
        void hydrate();
      },
    });
  }

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (!canChat || sending) {
      return;
    }
    const content = draft.trim();
    if (!content) {
      return;
    }

    setSending(true);
    setError(null);
    setCreditWarning(null);
    setDraft("");

    try {
      const result = await postSessionChatMessage(sessionId, { content });
      setMessages((prev) => [
        ...prev.filter((message) => message.id !== result.assistantMessage.id),
        result.userMessage,
        result.assistantMessage,
      ]);
      handleStreamTurn(result.turnId, result.assistantMessage.id);
    } catch (err) {
      setDraft(content);
      setSending(false);
      if (err instanceof ApiClientError) {
        setError(err.message);
        if (err.status === 402) {
          void hydrate();
        }
      } else {
        setError(err instanceof Error ? err.message : "Failed to send message");
      }
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  const streamingPlaceholder = useMemo(() => {
    if (!liveAssistantId) {
      return null;
    }
    const waitingForFirstToken = liveParts.length === 0;
    return (
      <article
        className={`${styles.bubble} ${styles.assistant}`}
        aria-live="polite"
        aria-label="Portfolio Manager is responding"
      >
        <header className={styles.bubbleMeta}>
          <span>Portfolio Manager</span>
          <span className={styles.streamingBadge}>
            Working
            <ThinkingDots />
          </span>
        </header>
        {waitingForFirstToken ? (
          <p className={styles.waitingRow}>
            <span className={styles.srOnly}>Thinking</span>
            <ThinkingDots />
          </p>
        ) : (
          <ChatMessageParts parts={liveParts} fallbackMarkdown="" />
        )}
        {liveStats ? (
          <p className={styles.statsLine}>
            Tokens {liveStats.tokens_in + liveStats.tokens_out}
            {liveStats.compute_credits != null
              ? ` · Credits ${formatComputeCredits(liveStats.compute_credits)}`
              : ""}
          </p>
        ) : null}
      </article>
    );
  }, [liveAssistantId, liveParts, liveStats]);

  return (
    <section className={styles.panel} aria-label="Follow-up chat">
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Talk with the Portfolio Manager</h2>
          <p className={styles.subtitle}>
            Continue the conversation using the completed research as context.
            The Trade Check chart stays as it was from the original run.
          </p>
        </div>
      </header>

      {creditWarning ? (
        <div className={styles.banner} role="status">
          {creditWarning}
        </div>
      ) : null}
      {error ? (
        <div className={styles.bannerError} role="alert">
          {error}
        </div>
      ) : null}

      <div className={styles.list} ref={listRef}>
        {loading ? (
          <p className={styles.muted}>Loading conversation…</p>
        ) : messages.length === 0 && !liveAssistantId ? (
          <p className={styles.muted}>
            {showComposer
              ? "Ask a follow-up — challenge the thesis, change the horizon, or request a revised decision."
              : "No follow-up messages yet."}
          </p>
        ) : (
          messages.map((message) => {
            if (message.id === liveAssistantId) {
              return null;
            }
            const isUser = message.role === "user";
            return (
              <article
                key={message.id}
                className={`${styles.bubble} ${isUser ? styles.user : styles.assistant}`}
              >
                <header className={styles.bubbleMeta}>
                  <span>{isUser ? "You" : "Portfolio Manager"}</span>
                  {message.status === "error" ? (
                    <span className={styles.errorBadge}>Error</span>
                  ) : null}
                  {message.decisionExcerpt ? (
                    <span className={styles.decisionBadge}>
                      {message.decisionExcerpt}
                    </span>
                  ) : null}
                </header>
                <ChatMessageParts
                  parts={message.parts}
                  fallbackMarkdown={message.contentMarkdown}
                />
                {message.error ? (
                  <p className={styles.messageError}>{message.error}</p>
                ) : null}
              </article>
            );
          })
        )}
        {streamingPlaceholder}
      </div>

      {showComposer ? (
        canChat ? (
          <form className={styles.composer} onSubmit={handleSubmit}>
            <label className={styles.srOnly} htmlFor="pm-chat-input">
              Message the Portfolio Manager
            </label>
            <textarea
              id="pm-chat-input"
              className={styles.input}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Add new details or ask for a revised decision…"
              rows={3}
              disabled={sending}
              aria-label="Message the Portfolio Manager"
            />
            <div className={styles.composerActions}>
              <span className={styles.hint}>Enter to send · Shift+Enter for newline</span>
              <button
                type="submit"
                className={styles.sendButton}
                disabled={sending || !draft.trim()}
                aria-busy={sending}
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        ) : (
          <div className={styles.locked}>
            <p>{blockedCopy(blockedReason)}</p>
            {blockedReason === "subscription_required" ? (
              <Link href="/pricing" className={styles.upgradeLink}>
                View plans
              </Link>
            ) : null}
          </div>
        )
      ) : null}

      {!isOwner && messages.length > 0 ? (
        <p className={styles.viewerNote}>Shared transcript · read only</p>
      ) : null}
    </section>
  );
}
