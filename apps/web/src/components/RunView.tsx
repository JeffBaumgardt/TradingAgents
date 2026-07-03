/**
 * @file apps/web/src/components/RunView.tsx
 * Live streaming analysis view with agent progress, feed, reports, and stats.
 */

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type {
  AgentStatusEvent,
  AgentStatusValue,
  AnalystType,
  ReportSectionKey,
  RunErrorEvent,
  RunHeartbeatEvent,
  Session,
  StreamMessageEvent,
  StreamReportSectionEvent,
  StreamStatsEvent,
  StreamToolCallEvent,
} from "@tradingagents/api-types";
import {
  AGENT_TEAMS,
  ANALYST_REPORT_SECTIONS,
  isLiveSessionStatus,
  REPORT_SECTION_TITLES,
  REPORT_TEAM_GROUPS,
} from "@tradingagents/api-types";
import { formatElapsed, formatTokens, formatToolArgs, getReportSignalTone, extractReportSignal, truncateText } from "@tradingagents/utils";
import {
  fetchSession,
  fetchSessionEvents,
  fetchSessionReport,
  subscribeToSessionStream,
} from "@/lib/api-client";
import RunSettingsPanel from "@/components/RunSettingsPanel";
import styles from "./RunView.module.css";

interface FeedEntry {
  id: string;
  timestamp: string;
  type: string;
  content: string;
}

interface RunStats {
  llmCalls: number;
  toolCalls: number;
  tokensIn: number;
  tokensOut: number;
  elapsedSeconds: number;
}

interface RunErrorState {
  message: string;
  failedAgent?: string | null;
  hint?: string | null;
  stoppedAgents?: number;
}

interface RunViewProps {
  sessionId: string;
  /** Session metadata prefetched on the server for faster first paint. */
  initialSession?: Session;
}

/** Maps report sections to the agent whose status drives the UI. */
const SECTION_AGENT: Partial<Record<ReportSectionKey, string>> = {
  market_report: "Market Analyst",
  sentiment_report: "Social Analyst",
  news_report: "News Analyst",
  fundamentals_report: "Fundamentals Analyst",
  trader_investment_plan: "Trader",
  investment_plan: "Research Manager",
  final_trade_decision: "Portfolio Manager",
};

const ANALYST_TYPE_ORDER: AnalystType[] = ["market", "social", "news", "fundamentals"];
const DEEP_THINKING_THRESHOLD_SECONDS = 8;

function statusClass(status: AgentStatusValue): string {
  switch (status) {
    case "pending":
      return styles.statusPending;
    case "in_progress":
      return styles.statusInProgress;
    case "completed":
      return styles.statusCompleted;
    case "error":
      return styles.statusError;
    case "cancelled":
      return styles.statusCancelled;
    default:
      return "";
  }
}

function formatEventTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function reportSignalToneClass(signal: ReturnType<typeof extractReportSignal>): string {
  if (!signal) {
    return "";
  }
  const tone = getReportSignalTone(signal);
  switch (tone) {
    case "bullish":
      return styles.reportSignalBullish;
    case "bearish":
      return styles.reportSignalBearish;
    default:
      return styles.reportSignalNeutral;
  }
}

function reportStatusLabel(
  status: AgentStatusValue | undefined,
  hasContent: boolean,
  isRunning: boolean,
): string {
  if (hasContent && status === "completed") {
    return "ready";
  }
  if (status === "in_progress" && isRunning) {
    return "working";
  }
  if (status === "completed") {
    return "completed";
  }
  if (status === "error") {
    return "error";
  }
  if (status === "cancelled") {
    return "skipped";
  }
  return "pending";
}

function ThinkingDots() {
  return (
    <span className={styles.thinkingDots} aria-hidden>
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </span>
  );
}

export default function RunView({ sessionId, initialSession }: RunViewProps) {
  const [agentStatus, setAgentStatus] = useState<Record<string, AgentStatusValue>>({});
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [reports, setReports] = useState<Partial<Record<ReportSectionKey, string>>>({});
  const [stats, setStats] = useState<RunStats>({
    llmCalls: 0,
    toolCalls: 0,
    tokensIn: 0,
    tokensOut: 0,
    elapsedSeconds: 0,
  });
  const [connected, setConnected] = useState(false);
  const [usesLiveStream, setUsesLiveStream] = useState(
    initialSession ? isLiveSessionStatus(initialSession.status) : true,
  );
  const [completed, setCompleted] = useState(initialSession?.status === "completed");
  const [runError, setRunError] = useState<RunErrorState | null>(
    initialSession?.status === "error"
      ? {
          message: initialSession.error ?? "Run failed",
          hint: "This analysis ended with an error.",
        }
      : null,
  );
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [sessionMeta, setSessionMeta] = useState<Session | null>(initialSession ?? null);
  const [selectedAnalysts, setSelectedAnalysts] = useState<AnalystType[]>(
    initialSession?.config.analysts ?? [],
  );
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [lastActivityAt, setLastActivityAt] = useState<number>(Date.now());
  const [tick, setTick] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const terminalRef = useRef(false);
  const timerFrozenRef = useRef(false);

  function freezeElapsed(seconds: number) {
    timerFrozenRef.current = true;
    setStats((prev) => ({ ...prev, elapsedSeconds: seconds }));
  }

  function hydrateReportFromApi() {
    return fetchSessionReport(sessionId)
      .then((report) => {
        const sections = report.sections as Partial<Record<ReportSectionKey, string>>;
        setReports((prev) => {
          const merged = { ...prev };
          for (const [key, value] of Object.entries(sections)) {
            if (value) {
              merged[key as ReportSectionKey] = value;
            }
          }
          return merged;
        });
      })
      .catch(() => {
        // Reports already streamed live are sufficient.
      });
  }

  function markRunComplete() {
    terminalRef.current = true;
    setCompleted(true);
    setActiveAgent(null);
    if (!timerFrozenRef.current) {
      freezeElapsed((Date.now() - startTimeRef.current) / 1000);
    }
    void hydrateReportFromApi();
  }

  function touchActivity() {
    setLastActivityAt(Date.now());
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSession(session: Session) {
      setSelectedAnalysts(session.config.analysts);
      setSessionMeta(session);
      if (
        session.status === "completed" ||
        session.status === "error" ||
        session.status === "cancelled"
      ) {
        const elapsed =
          (new Date(session.updatedAt).getTime() - new Date(session.createdAt).getTime()) / 1000;
        freezeElapsed(Math.max(0, elapsed));
      }
      if (session.status === "completed") {
        terminalRef.current = true;
        setCompleted(true);
        await hydrateReportFromApi();
      } else if (session.status === "error") {
        terminalRef.current = true;
        setRunError({
          message: session.error ?? "Run failed",
          hint: "This analysis ended with an error.",
        });
      }
    }

    if (initialSession) {
      if (
        initialSession.status === "completed" ||
        initialSession.status === "error" ||
        initialSession.status === "cancelled"
      ) {
        const elapsed =
          (new Date(initialSession.updatedAt).getTime() -
            new Date(initialSession.createdAt).getTime()) /
          1000;
        freezeElapsed(Math.max(0, elapsed));
      }
      if (initialSession.status === "completed") {
        terminalRef.current = true;
        void hydrateReportFromApi();
      } else if (initialSession.status === "error") {
        terminalRef.current = true;
      }
      return;
    }

    void fetchSession(sessionId)
      .then(async (session) => {
        if (cancelled) {
          return;
        }
        await bootstrapSession(session);
      })
      .catch(() => {
        // Stream still works; analyst slots inferred from events only
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, initialSession]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (timerFrozenRef.current) {
        return;
      }
      setStats((prev) => ({
        ...prev,
        elapsedSeconds: (Date.now() - startTimeRef.current) / 1000,
      }));
      setTick((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let feedCounter = 0;

    function pushFeed(timestamp: string, type: string, content: string) {
      feedCounter += 1;
      setFeed((prev) => [
        { id: `${feedCounter}`, timestamp, type, content },
        ...prev,
      ].slice(0, 100));
    }

    function handleStreamEvent(event: string, data: unknown) {
      touchActivity();

      if (event === "run.heartbeat") {
        const payload = data as RunHeartbeatEvent;
        setActiveAgent(payload.activeAgent);
        if (!timerFrozenRef.current && payload.elapsedSeconds >= 0) {
          setStats((prev) => ({
            ...prev,
            elapsedSeconds: payload.elapsedSeconds,
          }));
        }
        return;
      }
      if (event === "agent.status") {
        const payload = data as AgentStatusEvent;
        setAgentStatus((prev) => ({ ...prev, [payload.agent]: payload.status }));
        if (payload.status === "in_progress") {
          setActiveAgent(payload.agent);
        }
        return;
      }
      if (event === "message") {
        const payload = data as StreamMessageEvent;
        pushFeed(
          formatEventTime(payload.timestamp),
          payload.messageType,
          truncateText(payload.content),
        );
        return;
      }
      if (event === "tool.call") {
        const payload = data as StreamToolCallEvent;
        pushFeed(
          formatEventTime(payload.timestamp),
          "Tool",
          `${payload.toolName}: ${formatToolArgs(payload.args)}`,
        );
        return;
      }
      if (event === "report.section") {
        const payload = data as StreamReportSectionEvent;
        setReports((prev) => ({ ...prev, [payload.section]: payload.content }));
        return;
      }
      if (event === "stats") {
        const payload = data as StreamStatsEvent;
        setStats((prev) => ({
          ...prev,
          llmCalls: payload.llm_calls,
          toolCalls: payload.tool_calls,
          tokensIn: payload.tokens_in,
          tokensOut: payload.tokens_out,
        }));
        return;
      }
      if (event === "run.completed") {
        markRunComplete();
        return;
      }
      if (event === "run.error") {
        terminalRef.current = true;
        if (!timerFrozenRef.current) {
          freezeElapsed((Date.now() - startTimeRef.current) / 1000);
        }
        const payload = data as RunErrorEvent;
        setRunError({
          message: payload.message,
          failedAgent: payload.failedAgent,
          hint: payload.hint,
          stoppedAgents: payload.stoppedAgents,
        });
        setActiveAgent(null);
      }
    }

    async function loadTerminalSession() {
      setUsesLiveStream(false);
      try {
        const eventsResponse = await fetchSessionEvents(sessionId);
        if (cancelled) {
          return;
        }

        for (const item of eventsResponse.items) {
          handleStreamEvent(item.type, item.payload);
        }

        await hydrateReportFromApi();
        if (!cancelled) {
          setConnected(true);
        }
      } catch {
        if (!cancelled) {
          setRunError({
            message: "Failed to load run data",
            hint: "Try refreshing this page.",
          });
        }
      }
    }

    function startLiveStream() {
      setUsesLiveStream(true);
      unsubscribe = subscribeToSessionStream(
        sessionId,
        {
          onOpen: () => {
            setConnected(true);
            touchActivity();
          },
          onEvent: (event, data) => {
            handleStreamEvent(event, data);
          },
          onStreamEnd: () => {
            if (!terminalRef.current) {
              markRunComplete();
            }
          },
          onError: (err) => {
            if (terminalRef.current) {
              return;
            }
            setRunError({
              message: err.message,
              hint: "The live stream disconnected before the run finished. Try refreshing this page.",
            });
            setActiveAgent(null);
          },
        },
      );
    }

    async function initRunData() {
      let status = sessionMeta?.status ?? initialSession?.status;

      if (!status) {
        try {
          const session = await fetchSession(sessionId);
          if (cancelled) {
            return;
          }
          setSessionMeta(session);
          status = session.status;
        } catch {
          if (!cancelled) {
            setRunError({
              message: "Failed to load session",
              hint: "Try refreshing this page.",
            });
          }
          return;
        }
      }

      if (cancelled) {
        return;
      }

      if (!isLiveSessionStatus(status)) {
        await loadTerminalSession();
        return;
      }

      startLiveStream();
    }

    void initRunData();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [sessionId]);

  const isRunning = connected && !completed && !runError;

  const secondsSinceActivity = (Date.now() - lastActivityAt) / 1000;
  const isDeepThinking = isRunning && secondsSinceActivity >= DEEP_THINKING_THRESHOLD_SECONDS;

  const progressRows = useMemo(() => {
    const rows: { team: string; agent: string; status: AgentStatusValue }[] = [];
    for (const [team, agents] of Object.entries(AGENT_TEAMS)) {
      const activeAgents = agents.filter((agent) => agent in agentStatus);
      activeAgents.forEach((agent, index) => {
        rows.push({
          team: index === 0 ? team : "",
          agent,
          status: agentStatus[agent] ?? "pending",
        });
      });
    }
    return rows;
  }, [agentStatus]);

  const analystSections = useMemo(() => {
    if (selectedAnalysts.length > 0) {
      return selectedAnalysts.map((analyst) => ANALYST_REPORT_SECTIONS[analyst]);
    }
    return ANALYST_TYPE_ORDER.map((analyst) => ANALYST_REPORT_SECTIONS[analyst]).filter(
      (section) =>
        section in reports ||
        (SECTION_AGENT[section] !== undefined && SECTION_AGENT[section]! in agentStatus),
    );
  }, [selectedAnalysts, reports, agentStatus]);

  const progressSummary = useMemo(() => {
    const statuses = Object.values(agentStatus);
    return {
      total: statuses.length,
      completed: statuses.filter((s) => s === "completed").length,
      inProgress: statuses.filter((s) => s === "in_progress").length,
      errors: statuses.filter((s) => s === "error").length,
    };
  }, [agentStatus]);

  const expectedReportSections = useMemo(() => {
    return [
      ...analystSections,
      "investment_plan" as ReportSectionKey,
      "trader_investment_plan" as ReportSectionKey,
      "final_trade_decision" as ReportSectionKey,
    ];
  }, [analystSections]);

  useEffect(() => {
    if (timerFrozenRef.current || runError) {
      return;
    }

    const agentStatuses = Object.values(agentStatus);
    if (agentStatuses.length === 0) {
      return;
    }

    const agentsSettled = agentStatuses.every((status) =>
      status === "completed" || status === "error" || status === "cancelled",
    );
    const reportsReady = expectedReportSections.every((section) => Boolean(reports[section]));

    if (agentsSettled && reportsReady) {
      freezeElapsed((Date.now() - startTimeRef.current) / 1000);
    }
  }, [agentStatus, reports, expectedReportSections, runError]);

  function renderReportAccordion(section: ReportSectionKey) {
    const agent = SECTION_AGENT[section];
    const status = agent ? agentStatus[agent] : undefined;
    const content = reports[section];
    const title = REPORT_SECTION_TITLES[section];
    const label = reportStatusLabel(status, Boolean(content), isRunning);
    const isWorking = label === "working";
    const signal = content ? extractReportSignal(section, content) : null;

    return (
      <details key={section} className={styles.reportAccordion}>
        <summary className={styles.reportAccordionSummary}>
          <span className={styles.reportAccordionMain}>
            <span className={styles.chevron} aria-hidden>
              ›
            </span>
            <span className={styles.reportAccordionTitle}>{title}</span>
          </span>
          <span className={styles.reportAccordionMeta}>
            <span className={`${styles.reportBadge} ${statusClass(status ?? "pending")}`}>
              {isWorking ? (
                <>
                  {label}
                  <ThinkingDots />
                </>
              ) : (
                label
              )}
            </span>
          </span>
        </summary>
        <div className={styles.reportAccordionBody}>
          {content && signal ? (
            <div className={styles.reportBodySignal}>
              <span
                className={`${styles.reportSignal} ${reportSignalToneClass(signal)}`}
                aria-label={`Signal: ${signal}`}
              >
                {signal}
              </span>
            </div>
          ) : null}
          {content ? (
            <pre>{content}</pre>
          ) : isWorking ? (
            <p className="muted">
              {isDeepThinking ? "Deep thinking" : "Analyzing"}
              <ThinkingDots />
            </p>
          ) : (
            <p className="muted">Waiting for this agent to start…</p>
          )}
        </div>
      </details>
    );
  }

  function renderStatusCell(status: AgentStatusValue) {
    if (status === "in_progress") {
      return (
        <span className={styles.statusCell}>
          <span className={styles.pulseDot} aria-hidden />
          <span className={statusClass(status)}>{status}</span>
        </span>
      );
    }
    return <span className={statusClass(status)}>{status}</span>;
  }

  const activitySummary = useMemo(() => {
    let messages = 0;
    let tools = 0;
    for (const entry of feed) {
      if (entry.type === "Tool") {
        tools += 1;
      } else {
        messages += 1;
      }
    }
    return { messages, tools, total: feed.length };
  }, [feed]);

  function handleToggleActivity() {
    setActivityExpanded((prev) => !prev);
  }

  function handleActivityKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleToggleActivity();
    }
  }

  // tick drives deep-thinking banner re-render every second
  void tick;

  return (
    <div className={styles.runLayout}>
      <div className={styles.runHeader}>
        <Link href="/" className={styles.backLink}>
          ← Back to home
        </Link>
      </div>
      <h1>Analysis Run</h1>

      <RunSettingsPanel
        session={sessionMeta}
        expanded={settingsExpanded}
        onToggle={() => setSettingsExpanded((prev) => !prev)}
      />

      {runError && (
        <div className={styles.bannerError} role="alert">
          <strong>Analysis stopped</strong>
          <p className={styles.errorMessage}>{runError.message}</p>
          {runError.hint && <p className={styles.errorHint}>{runError.hint}</p>}
          {runError.failedAgent && (
            <p className={styles.errorMeta}>Failed at: {runError.failedAgent}</p>
          )}
          {typeof runError.stoppedAgents === "number" && runError.stoppedAgents > 0 && (
            <p className={styles.errorMeta}>
              {runError.stoppedAgents} remaining agent
              {runError.stoppedAgents === 1 ? "" : "s"} skipped to save tokens.
            </p>
          )}
        </div>
      )}

      {completed && !runError && (
        <div className={styles.bannerComplete}>
          Analysis complete — expand any report below to read the details.
        </div>
      )}

      {!connected && !runError && (
        <div className={styles.banner}>
          {usesLiveStream ? (
            <>
              Connecting to stream…
              <ThinkingDots />
            </>
          ) : (
            <>
              Loading run data…
              <ThinkingDots />
            </>
          )}
        </div>
      )}

      {isRunning && (
        <div
          className={`${styles.workingBanner} ${isDeepThinking ? styles.workingBannerDeep : ""}`}
          aria-live="polite"
        >
          <span className={styles.pulseDot} aria-hidden />
          <span>
            {isDeepThinking ? "Deep thinking in progress" : "Analysis running"}
            <ThinkingDots />
          </span>
          {activeAgent && (
            <span className={styles.workingAgent}>Active: {activeAgent}</span>
          )}
        </div>
      )}

      <div className={styles.upperRow}>
        <section className={styles.panel}>
          <div className={styles.progressHeader}>
            <h2 className={styles.panelTitleInline}>Progress</h2>
            {progressSummary.total > 0 && (
              <span className={styles.progressChip}>
                {progressSummary.completed}/{progressSummary.total} agents complete
                {progressSummary.inProgress > 0 && (
                  <> · {progressSummary.inProgress} active</>
                )}
              </span>
            )}
          </div>
          <div className={styles.panelBody}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Agent</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {progressRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      Waiting for agent status…
                    </td>
                  </tr>
                ) : (
                  progressRows.map((row) => (
                    <tr
                      key={row.agent}
                      className={row.status === "in_progress" ? styles.activeRow : undefined}
                    >
                      <td>{row.team}</td>
                      <td>{row.agent}</td>
                      <td>{renderStatusCell(row.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className={styles.reportsPanel}>
        <div className={styles.reportsPanelHeader}>
          <h2 className={styles.reportsPanelTitle}>Reports</h2>
          <p className={styles.reportsPanelHint}>
            Collapsed by default — expand a section when you want to read it.
          </p>
        </div>

        {REPORT_TEAM_GROUPS.map((group) => {
          const sections = group.analystOnly
            ? analystSections
            : group.sections;

          if (sections.length === 0) {
            return null;
          }

          return (
            <div key={group.title} className={styles.reportGroup}>
              <h3 className={styles.reportGroupTitle}>{group.title}</h3>
              <div className={styles.reportList}>
                {sections.map((section) => renderReportAccordion(section))}
              </div>
            </div>
          );
        })}
      </section>

      <section className={styles.activityPanel}>
        <button
          type="button"
          className={styles.activityToggle}
          aria-expanded={activityExpanded}
          aria-controls="activity-log"
          onClick={handleToggleActivity}
          onKeyDown={handleActivityKeyDown}
        >
          <span className={styles.activityToggleLabel}>
            <span
              className={`${styles.chevron} ${activityExpanded ? styles.chevronOpen : ""}`}
              aria-hidden
            >
              ›
            </span>
            Messages &amp; tools
          </span>
          <span className={styles.activitySummary}>
            {activitySummary.total === 0 ? (
              "No activity yet"
            ) : (
              <>
                {activitySummary.messages} message
                {activitySummary.messages === 1 ? "" : "s"}
                {activitySummary.tools > 0 && (
                  <>
                    {" · "}
                    {activitySummary.tools} tool
                    {activitySummary.tools === 1 ? "" : "s"}
                  </>
                )}
              </>
            )}
          </span>
        </button>

        {activityExpanded && (
          <div id="activity-log" className={styles.activityBody}>
            {feed.length === 0 ? (
              <p className="muted">No messages yet.</p>
            ) : (
              feed.map((entry) => (
                <details key={entry.id} className={styles.feedItem}>
                  <summary className={styles.feedSummary}>
                    <span className={styles.feedMeta}>
                      {entry.timestamp} · {entry.type}
                    </span>
                    <span className={styles.feedPreview}>{entry.content}</span>
                  </summary>
                  <div className={styles.feedContent}>{entry.content}</div>
                </details>
              ))
            )}
          </div>
        )}
      </section>

      <footer className={styles.footer}>
        <span>LLM calls: {stats.llmCalls}</span>
        <span>Tool calls: {stats.toolCalls}</span>
        <span>Tokens in: {formatTokens(stats.tokensIn)}</span>
        <span>Tokens out: {formatTokens(stats.tokensOut)}</span>
        <span>Elapsed: {formatElapsed(stats.elapsedSeconds)}</span>
      </footer>
    </div>
  );
}
