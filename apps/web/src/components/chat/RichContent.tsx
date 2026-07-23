/**
 * @file apps/web/src/components/chat/RichContent.tsx
 * Safely render markdown, sanitized HTML, and images in chat / reports.
 */

"use client";

import DOMPurify from "isomorphic-dompurify";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./RichContent.module.css";

interface RichContentProps {
  content: string;
  /** Prefer markdown; set when the part is explicitly HTML. */
  asHtml?: boolean;
  className?: string;
}

function looksLikeHtml(content: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(content.trim());
}

export default function RichContent({
  content,
  asHtml = false,
  className,
}: RichContentProps) {
  const rootClassName = [styles.prose, className].filter(Boolean).join(" ");

  if (asHtml || (looksLikeHtml(content) && content.includes("<"))) {
    const sanitized = DOMPurify.sanitize(content, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
    });
    return (
      <div
        className={rootClassName}
        // Sanitized via DOMPurify above.
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }

  return (
    <div className={rootClassName}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ src, alt }) => {
            if (!src || typeof src !== "string") {
              return null;
            }
            const safe =
              src.startsWith("data:image/") ||
              src.startsWith("https://") ||
              src.startsWith("http://");
            if (!safe) {
              return null;
            }
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt || "Generated chart"}
                className={styles.image}
                loading="lazy"
              />
            );
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
