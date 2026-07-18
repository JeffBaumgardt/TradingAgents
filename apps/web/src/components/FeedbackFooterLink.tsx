/**
 * @file apps/web/src/components/FeedbackFooterLink.tsx
 * Footer control that opens feedback when signed in.
 */

"use client";

import { SignedIn } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useState } from "react";
import FeedbackModal from "@/components/FeedbackModal";
import styles from "./SiteFooter.module.css";

function sessionIdFromPath(pathname: string | null): string | undefined {
  if (!pathname) {
    return undefined;
  }
  const match = pathname.match(/^\/run\/([^/]+)\/?$/);
  return match?.[1] || undefined;
}

export default function FeedbackFooterLink() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sessionId = sessionIdFromPath(pathname);

  function handleOpen() {
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  return (
    <SignedIn>
      <button
        type="button"
        className={styles.linkButton}
        onClick={handleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Feedback
      </button>
      <FeedbackModal
        open={open}
        onClose={handleClose}
        source="footer"
        sessionId={sessionId}
      />
    </SignedIn>
  );
}
