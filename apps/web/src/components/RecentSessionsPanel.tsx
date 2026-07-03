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
      <section style={sectionStyle} aria-labelledby="recent-sessions-heading">
        <h1 id="recent-sessions-heading" className="pageTitle">
          Your recent analyses
        </h1>
        <p className="muted pageIntro">
          Re-open a previous run to read finished reports. In-progress runs continue updating
          automatically on the run page.
        </p>
        <p className={styles.error} role="alert">
          We could not load your recent sessions. Try refreshing the page.
        </p>
      </section>
    );
  }

  if (sessions.length === 0) {
    return null;
  }

  return (
    <section style={sectionStyle} aria-labelledby="recent-sessions-heading">
      <h1 id="recent-sessions-heading" className="pageTitle">
        Your recent analyses
      </h1>
      <p className="muted pageIntro">
        Re-open a previous run to read finished reports. In-progress runs continue updating
        automatically on the run page.
      </p>
      <div className={styles.wrapper}>
        <div className={styles.panel}>
          <ul className={styles.list} aria-label="Recent analysis sessions">
            {sessions.map((session) => (
              <RecentSessionItem key={session.id} session={session} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
