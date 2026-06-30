/**
 * @file apps/web/src/components/RecentSessionsPanel.tsx
 * Server-rendered recent sessions list.
 */

import { fetchSessionsServer } from "@/lib/api-server";
import RecentSessionItem from "@/components/RecentSessionItem";
import styles from "./RecentSessions.module.css";

export default async function RecentSessionsPanel() {
  let sessions;
  try {
    const response = await fetchSessionsServer(15, 0);
    sessions = response.items;
  } catch {
    return (
      <p className={styles.error} role="alert">
        Failed to load recent sessions.
      </p>
    );
  }

  if (sessions.length === 0) {
    return (
      <p className="muted">No previous analyses yet. Start your first run below.</p>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.panel}>
        <ul className={styles.list}>
          {sessions.map((session) => (
            <RecentSessionItem key={session.id} session={session} />
          ))}
        </ul>
      </div>
    </div>
  );
}
