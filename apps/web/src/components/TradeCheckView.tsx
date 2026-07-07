/**
 * @file apps/web/src/components/TradeCheckView.tsx
 * Distilled Trade Check report: quick-view levels, scenarios, citations, printable layout.
 */

"use client";

import type {
  TradeCheckAgentSection,
  TradeCheckReport,
  TradeCheckSource,
  VerdictBadgeTone,
} from "@tradingagents/api-types";
import TradeCheckChart from "@/components/TradeCheckChart";
import { runWithPrintMode } from "@/lib/print-mode";
import styles from "./TradeCheckView.module.css";

interface TradeCheckViewProps {
  report: TradeCheckReport;
  onPrint?: () => void;
  showToolbar?: boolean;
}

function formatPrice(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toneClass(tone: VerdictBadgeTone | undefined): string {
  switch (tone) {
    case "bullish":
      return styles.toneBullish;
    case "bearish":
      return styles.toneBearish;
    case "warning":
      return styles.toneWarning;
    default:
      return styles.toneNeutral;
  }
}

function renderSources(sources: TradeCheckSource[]) {
  if (sources.length === 0) {
    return <span className={styles.muted}>No linked sources</span>;
  }

  return (
    <ul className={styles.sourceList}>
      {sources.map((source) => (
        <li key={source.id}>
          {source.url ? (
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title}
            </a>
          ) : (
            source.title
          )}
          {source.provider ? (
            <span className={styles.sourceProvider}> · {source.provider}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function renderAgentSection(section: TradeCheckAgentSection) {
  return (
    <article key={section.agentKey} className={styles.agentCard}>
      <header className={styles.agentHeader}>
        <h3>{section.agentName}</h3>
        {section.confidence ? (
          <span className={styles.agentConfidence}>{section.confidence} confidence</span>
        ) : null}
      </header>
      <p className={styles.agentHeadline}>{section.headline}</p>
      {section.keyPoints.length > 0 && (
        <ul className={styles.keyPoints}>
          {section.keyPoints.map((point, index) => (
            <li key={`${section.agentKey}-point-${index}`}>{point}</li>
          ))}
        </ul>
      )}
      <div className={styles.agentSources}>
        <strong>Top sources</strong>
        {renderSources(section.topSources)}
      </div>
    </article>
  );
}

export default function TradeCheckView({ report, onPrint, showToolbar = true }: TradeCheckViewProps) {
  const { header, priceSummary } = report;
  const title = header.companyName
    ? `${header.ticker} — ${header.companyName}`
    : header.ticker;

  function handlePrintClick() {
    if (onPrint) {
      onPrint();
      return;
    }
    runWithPrintMode(() => window.print(), {
      attributes: { "data-print-trade-check": "true" },
      removeAttributes: ["data-print-full-report"],
    });
  }

  return (
    <div className={styles.root} id="trade-check-print-root">
      {showToolbar ? (
      <div className={styles.toolbar} data-print-hide="true">
        <p className={styles.toolbarHint}>
          Distilled quick view — full agent reports remain available in the Reports tab.
        </p>
        <button
          type="button"
          className={styles.printButton}
          onClick={handlePrintClick}
          aria-label="Print or save Trade Check report as PDF"
        >
          Print / Save PDF
        </button>
      </div>
      ) : null}

      <div id="trade-check-share-root" className={styles.shareRoot}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.meta}>
            {header.exchange ? `${header.exchange} · ` : ""}
            {header.analysisDate}
            {header.strategy ? ` · ${header.strategy}` : ""}
          </p>
          {header.tags.length > 0 && (
            <div className={styles.tags}>
              {header.tags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className={styles.priceBlock}>
          <div className={`${styles.currentPrice} ${toneClass(
            (priceSummary.changePct ?? 0) >= 0 ? "bullish" : "bearish",
          )}`}
          >
            {formatPrice(priceSummary.currentPrice)}
          </div>
          {priceSummary.changePct != null && (
            <div className={priceSummary.changePct >= 0 ? styles.toneBullish : styles.toneBearish}>
              {priceSummary.changePct >= 0 ? "+" : ""}
              {priceSummary.changePct.toFixed(2)}%
              {priceSummary.changeAmount != null
                ? ` (${priceSummary.changeAmount >= 0 ? "+" : ""}${formatPrice(priceSummary.changeAmount)})`
                : ""}
            </div>
          )}
          <div className={styles.priceMeta}>
            {priceSummary.fiftyTwoWeekRange ? (
              <span>52w: {priceSummary.fiftyTwoWeekRange}</span>
            ) : null}
            {priceSummary.beta != null ? <span>Beta {priceSummary.beta.toFixed(2)}</span> : null}
            {priceSummary.earningsDate ? <span>Earnings {priceSummary.earningsDate}</span> : null}
          </div>
        </div>
      </header>

      {report.quickMetrics.length > 0 && (
        <section className={styles.metricsRow} aria-label="Quick metrics">
          {report.quickMetrics.map((metric) => (
            <div key={metric.label} className={styles.metricBox}>
              <span className={styles.metricLabel}>{metric.label}</span>
              <span className={`${styles.metricValue} ${toneClass(metric.tone)}`}>
                {metric.value}
              </span>
              {metric.note ? <span className={styles.metricNote}>{metric.note}</span> : null}
            </div>
          ))}
        </section>
      )}

      <section className={styles.chartSection}>
        <h3 className={styles.sectionTitle}>Price action &amp; levels</h3>
        <TradeCheckChart chart={report.chart} />
      </section>

      <section className={styles.levelsSection}>
        <h3 className={styles.sectionTitle}>Actionable levels — audited · proportional to current price</h3>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th scope="col">Level</th>
              <th scope="col">Price</th>
              <th scope="col">Context</th>
            </tr>
          </thead>
          <tbody>
            {report.actionableLevels.map((level) => {
              const priceText =
                level.low != null && level.high != null && level.low !== level.high
                  ? `${formatPrice(level.low)} – ${formatPrice(level.high)}`
                  : formatPrice(level.price ?? level.low ?? level.high);
              return (
                <tr key={`${level.label}-${priceText}`}>
                  <td>
                    {level.label}
                    {level.isKey ? <span className={styles.keyBadge}>KEY</span> : null}
                  </td>
                  <td className={toneClass(
                    level.kind.includes("support")
                      ? "bullish"
                      : level.kind.includes("resistance")
                        ? "bearish"
                        : "neutral",
                  )}
                  >
                    {priceText}
                  </td>
                  <td>{level.note ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {report.scenarios.length > 0 && (
        <section className={styles.scenarioGrid} aria-label="Scenario analysis">
          {report.scenarios.map((scenario) => (
            <article
              key={scenario.id}
              className={`${styles.scenarioCard} ${
                scenario.direction === "long" ? styles.scenarioLong : styles.scenarioShort
              }`}
            >
              <div className={styles.scenarioTag}>
                {scenario.direction === "long" ? "LONG" : "SHORT"}
              </div>
              <h3>{scenario.title}</h3>
              <dl className={styles.scenarioList}>
                <div>
                  <dt>Trigger</dt>
                  <dd>{scenario.trigger}</dd>
                </div>
                <div>
                  <dt>Stop</dt>
                  <dd>{scenario.stopLabel ?? formatPrice(scenario.stop)}</dd>
                </div>
                {scenario.riskPerShare ? (
                  <div>
                    <dt>Risk</dt>
                    <dd>{scenario.riskPerShare}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Targets</dt>
                  <dd>{scenario.targets.join(" · ") || "—"}</dd>
                </div>
              </dl>
              {scenario.note ? <p className={styles.scenarioNote}>{scenario.note}</p> : null}
            </article>
          ))}
        </section>
      )}

      <section className={styles.verdictSection}>
        <h3 className={styles.sectionTitle}>Trade Check verdict</h3>
        <div className={styles.verdictGrid}>
          {report.verdict.map((badge) => (
            <article key={badge.id} className={styles.verdictCard}>
              <span className={`${styles.verdictBadge} ${toneClass(badge.tone)}`}>
                {badge.label}
              </span>
              <h4>{badge.headline}</h4>
              {badge.detail ? <p>{badge.detail}</p> : null}
            </article>
          ))}
        </div>
        {report.bottomLine ? (
          <p className={styles.bottomLine}>
            <strong>Bottom line:</strong> {report.bottomLine}
          </p>
        ) : null}
        {report.decision ? (
          <p className={styles.decisionLine}>
            Portfolio rating: <strong>{report.decision}</strong>
          </p>
        ) : null}
      </section>
      </div>

      {report.catalysts.length > 0 && (
        <section>
          <h3 className={styles.sectionTitle}>Today&apos;s catalyst + key context</h3>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">Value</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {report.catalysts.map((row) => (
                <tr key={`${row.metric}-${row.value}`}>
                  <td>{row.metric}</td>
                  <td>{row.value}</td>
                  <td>{row.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {report.agentSections.length > 0 && (
        <section>
          <h3 className={styles.sectionTitle}>Agent findings (distilled)</h3>
          <div className={styles.agentGrid}>
            {report.agentSections.map((section) => renderAgentSection(section))}
          </div>
        </section>
      )}
    </div>
  );
}
