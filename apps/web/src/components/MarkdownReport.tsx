/**
 * @file apps/web/src/components/MarkdownReport.tsx
 * Renders agent report markdown as readable HTML.
 */

"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./MarkdownReport.module.css";

interface MarkdownReportProps {
  content: string;
  className?: string;
}

export default function MarkdownReport({
  content,
  className,
}: MarkdownReportProps) {
  const rootClassName = [styles.prose, className].filter(Boolean).join(" ");

  return (
    <div className={rootClassName}>
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </div>
  );
}
