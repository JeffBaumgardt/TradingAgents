/**
 * @file apps/web/src/components/HomePageSkeleton.tsx
 * Placeholder while client session credentials hydrate from sessionStorage.
 */

import skeleton from "./skeleton.module.css";

export default function HomePageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <section style={{ marginBottom: "2rem" }}>
        <div className={`${skeleton.line}`} style={{ width: "12rem", height: "1.5rem", marginBottom: "0.75rem" }} />
        <div className={`${skeleton.line}`} style={{ width: "min(100%, 22rem)", marginBottom: "1rem" }} />
        <div className={skeleton.panel}>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className={skeleton.row}>
              <span className={skeleton.rowPrimary}>
                <span className={skeleton.lineWide} />
                <span className={skeleton.lineShort} />
              </span>
              <span className={skeleton.lineMedium} />
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className={`${skeleton.line}`} style={{ width: "10rem", height: "1.25rem", marginBottom: "0.75rem" }} />
        <div className={`${skeleton.line}`} style={{ width: "min(100%, 26rem)", marginBottom: "1.5rem" }} />
        <div className={skeleton.panel} style={{ minHeight: "12rem" }} />
      </section>
    </div>
  );
}
