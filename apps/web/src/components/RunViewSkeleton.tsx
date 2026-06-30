/**
 * @file apps/web/src/components/RunViewSkeleton.tsx
 * Suspense fallback while run session metadata loads on the server.
 */

import skeleton from "./skeleton.module.css";
import styles from "./RunView.module.css";

export default function RunViewSkeleton() {
  return (
    <div className={styles.runLayout} aria-busy="true" aria-label="Loading analysis run">
      <div className={styles.runHeader}>
        <span className={`${skeleton.line}`} style={{ width: "7rem" }} />
      </div>
      <div className={`${skeleton.line}`} style={{ width: "10rem", height: "1.75rem", marginBottom: "1rem" }} />
      <div className={`${skeleton.panel} ${styles.panel}`} style={{ marginBottom: "1rem", minHeight: "3rem" }} />
      <div className={styles.upperRow}>
        <section className={`${styles.panel} ${skeleton.panel}`} style={{ minHeight: "12rem" }}>
          <div className={skeleton.row}>
            <span className={`${skeleton.line}`} style={{ width: "5rem" }} />
            <span className={`${skeleton.line}`} style={{ width: "8rem" }} />
          </div>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className={skeleton.row}>
              <span className={skeleton.lineShort} />
              <span className={skeleton.lineMedium} />
              <span className={skeleton.lineShort} />
            </div>
          ))}
        </section>
      </div>
      <section className={`${styles.reportsPanel} ${skeleton.panel}`} style={{ minHeight: "14rem", marginTop: "1rem" }} />
    </div>
  );
}
