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

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value, "https://example.invalid");
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isSafeImageSrc(value: string): boolean {
  if (value.startsWith("data:image/")) {
    return true;
  }
  return isSafeHttpUrl(value);
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
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
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
          a: ({ href, children }) => {
            if (!href || typeof href !== "string" || !isSafeHttpUrl(href)) {
              return <span>{children}</span>;
            }
            return (
              <a href={href} rel="noopener noreferrer" target="_blank">
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => {
            if (!src || typeof src !== "string" || !isSafeImageSrc(src)) {
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
