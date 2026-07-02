/**
 * @file apps/web/src/components/RecentSessionsPanel.tsx
 * Server-rendered recent sessions list.
 */

import { fetchSessionsServer } from "@/lib/api-server";
import RecentSessionItem from "@/components/RecentSessionItem";
import styles from "./RecentSessions.module.css";

const sectionStyle = { marginBottom: "2rem" } as const;

export default async function RecentSessionsPanel() {
  let sessions;
  try {
    const response = await fetchSessionsServer(15, 0);
    sessions = response.items;
  } catch {
    return (
      <section style={sectionStyle}>
        <h1 style={{ marginBottom: "0.25rem" }}>Recent Sessions</h1>
        <p className="muted" style={{ marginTop: 0, marginBottom: "1rem" }}>
          Review previous analyses by ticker and report date.
        </p>
        <p className={styles.error} role="alert">
          Failed to load recent sessions.
        </p>
      </section>
    );
  }

  if (sessions.length === 0) {
    return null;
  }

  return (
    <section style={sectionStyle}>
      <h1 style={{ marginBottom: "0.25rem" }}>Recent Sessions</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: "1rem" }}>
        Review previous analyses by ticker and report date.
      </p>
      <div className={styles.wrapper}>
        <div className={styles.panel}>
          <ul className={styles.list}>
            {sessions.map((session) => (
              <RecentSessionItem key={session.id} session={session} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
