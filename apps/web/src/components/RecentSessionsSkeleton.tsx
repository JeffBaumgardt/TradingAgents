/**
 * @file apps/web/src/components/RecentSessionsSkeleton.tsx
 * Suspense fallback while recent sessions load on the server.
 */

import skeleton from "./skeleton.module.css";
import styles from "./RecentSessions.module.css";

const PLACEHOLDER_ROWS = 4;

export default function RecentSessionsSkeleton() {
  return (
    <div className={styles.wrapper} aria-busy="true" aria-label="Loading recent sessions">
      <div className={`${styles.panel} ${skeleton.panel}`}>
        <ul className={styles.list} role="list">
          {Array.from({ length: PLACEHOLDER_ROWS }, (_, index) => (
            <li key={index} className={styles.item}>
              <div className={`${skeleton.row} ${styles.rowLink}`}>
                <span className={skeleton.rowPrimary}>
                  <span className={`${skeleton.lineWide}`} />
                  <span className={`${skeleton.lineShort}`} />
                </span>
                <span className={`${skeleton.lineMedium}`} />
              </div>
              <span className={skeleton.circle} aria-hidden />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
