/**
 * @file apps/web/src/components/chat/ChatMessageParts.tsx
 * Cursor-like collapsed thinking / tool rows + rich text parts.
 */

"use client";

import type { ChatMessagePart } from "@tradingagents/api-types";
import { formatToolArgs } from "@tradingagents/utils";
import RichContent from "@/components/chat/RichContent";
import styles from "./ChatMessageParts.module.css";

interface ChatMessagePartsProps {
  parts: ChatMessagePart[];
  fallbackMarkdown?: string;
}

export default function ChatMessageParts({
  parts,
  fallbackMarkdown,
}: ChatMessagePartsProps) {
  const effective =
    parts.length > 0
      ? parts
      : fallbackMarkdown
        ? [{ type: "text" as const, content: fallbackMarkdown }]
        : [];

  if (effective.length === 0) {
    return <p className={styles.empty}>…</p>;
  }

  return (
    <div className={styles.parts}>
      {effective.map((part, index) => {
        const key = `${part.type}-${index}`;

        if (part.type === "thinking") {
          return (
            <details key={key} className={styles.collapsed}>
              <summary className={styles.collapsedSummary}>Thinking</summary>
              <div className={styles.collapsedBody}>
                <RichContent content={part.content ?? ""} />
              </div>
            </details>
          );
        }

        if (part.type === "tool_call") {
          const argsText = part.args ? formatToolArgs(part.args) : "";
          return (
            <details key={key} className={styles.collapsed}>
              <summary className={styles.collapsedSummary}>
                Tool · {part.toolName ?? "call"}
              </summary>
              <pre className={styles.toolArgs}>{argsText || "{}"}</pre>
            </details>
          );
        }

        if (part.type === "tool_result") {
          return (
            <details key={key} className={styles.collapsed}>
              <summary className={styles.collapsedSummary}>
                Result · {part.toolName ?? "tool"}
              </summary>
              <pre className={styles.toolArgs}>{part.content ?? ""}</pre>
            </details>
          );
        }

        if (part.type === "image" && part.src) {
          const safe =
            part.src.startsWith("data:image/") ||
            part.src.startsWith("https://") ||
            part.src.startsWith("http://");
          if (!safe) {
            return null;
          }
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={key}
              src={part.src}
              alt={part.alt || "Chart"}
              className={styles.image}
              loading="lazy"
            />
          );
        }

        if (part.type === "html") {
          return (
            <RichContent
              key={key}
              content={part.content ?? ""}
              asHtml
            />
          );
        }

        return <RichContent key={key} content={part.content ?? ""} />;
      })}
    </div>
  );
}
