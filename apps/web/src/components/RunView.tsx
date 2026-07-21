/**
 * @file apps/web/src/components/RunView.tsx
 * Live streaming analysis view with agent progress, feed, reports, and stats.
 */

"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type {
  AgentStatusEvent,
  AgentStatusValue,
  AnalystType,
  CreditWarningEvent,
  ReportSectionKey,
  RunErrorEvent,
  RunHeartbeatEvent,
  Session,
  StreamMessageEvent,
  StreamReportSectionEvent,
  StreamStatsEvent,
  StreamToolCallEvent,
  TradeCheckReport,
} from "@tradingagents/api-types";
import {
  AGENT_TEAMS,
  ANALYST_REPORT_SECTIONS,
  isLiveSessionStatus,
  REPORT_SECTION_TITLES,
  REPORT_TEAM_GROUPS,
} from "@tradingagents/api-types";
import {
  formatElapsed,
  formatTokens,
  formatToolArgs,
  getReportSignalTone,
  extractReportSignal,
  truncateText,
} from "@tradingagents/utils";
import {
  fetchSession,
  fetchSessionEvents,
  fetchSessionReport,
  fetchSessionTradeCheck,
  subscribeToSessionStream,
  ApiClientError,
} from "@/lib/api-client";
import RunSettingsPanel from "@/components/RunSettingsPanel";
import AgentProgressCard from "@/components/AgentProgressCard";
import ReportModal from "@/components/ReportModal";
import RunExportBar from "@/components/RunExportBar";
import FeedbackPrompt from "@/components/FeedbackPrompt";
import TradeCheckChart from "@/components/TradeCheckChart";
import { TRADE_CHECK_SHARE_ROOT_ID } from "@/lib/trade-check-share";
import styles from "./RunView.module.css";

type ResultsPhase = "running" | "transitioning" | "complete";

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
  computeCredits: number | null;
  remainingComputeCredits: number | null;
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

const SECTION_BY_AGENT: Record<string, ReportSectionKey> = Object.fromEntries(
  Object.entries(SECTION_AGENT).map(([section, agent]) => [
    agent,
    section as ReportSectionKey,
  ]),
) as Record<string, ReportSectionKey>;

function truncatePreview(content: string, maxLength = 480): string {
  if (content.length <= maxLength) {
    return content;
  }
  return `${content.slice(0, maxLength).trim()}…`;
}

const ANALYST_TYPE_ORDER: AnalystType[] = [
  "market",
  "social",
  "news",
  "fundamentals",
];
const DEEP_THINKING_THRESHOLD_SECONDS = 8;
const RESULTS_TRANSITION_MS = 700;
const SHARED_RUN_POLL_MS = 5000;

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
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function reportSignalToneClass(
  signal: ReturnType<typeof extractReportSignal>,
): string {
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
  // Content is the source of truth for completed sections (share views have no
  // agent.status events, so status alone would stay "pending").
  if (hasContent) {
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

function formatChartPrice(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function RunView({ sessionId, initialSession }: RunViewProps) {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const [agentStatus, setAgentStatus] = useState<
    Record<string, AgentStatusValue>
  >({});
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [reports, setReports] = useState<
    Partial<Record<ReportSectionKey, string>>
  >({});
  const [stats, setStats] = useState<RunStats>({
    llmCalls: 0,
    toolCalls: 0,
    tokensIn: 0,
    tokensOut: 0,
    computeCredits: null,
    remainingComputeCredits: null,
    elapsedSeconds: 0,
  });
  const [creditWarning, setCreditWarning] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  /** Owner-only sections (pipeline, messages, stats, feedback) after events load. */
  const [hasPrivateAccess, setHasPrivateAccess] = useState(false);
  const [usesLiveStream, setUsesLiveStream] = useState(
    initialSession ? isLiveSessionStatus(initialSession.status) : true,
  );
  const [completed, setCompleted] = useState(
    initialSession?.status === "completed",
  );
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
  const [sessionMeta, setSessionMeta] = useState<Session | null>(
    initialSession ?? null,
  );
  const [selectedAnalysts, setSelectedAnalysts] = useState<AnalystType[]>(
    initialSession?.config.analysts ?? [],
  );
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [resultsPhase, setResultsPhase] = useState<ResultsPhase>(
    initialSession?.status === "completed" ? "complete" : "running",
  );
  const [tradeCheckReport, setTradeCheckReport] =
    useState<TradeCheckReport | null>(null);
  const [openReportSection, setOpenReportSection] =
    useState<ReportSectionKey | null>(null);
  const [lastActivityAt, setLastActivityAt] = useState<number>(Date.now());
  const [tick, setTick] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const terminalRef = useRef(false);
  const timerFrozenRef = useRef(false);
  const resultsTransitionRef = useRef<number | null>(null);

  function freezeElapsed(seconds: number) {
    timerFrozenRef.current = true;
    setStats((prev) => ({ ...prev, elapsedSeconds: seconds }));
  }

  function hydrateTradeCheckFromApi() {
    if (tradeCheckReport) {
      return Promise.resolve();
    }
    return fetchSessionTradeCheck(sessionId)
      .then((response) => {
        setTradeCheckReport(response.tradeCheck);
      })
      .catch(() => {
        // Keep any SSE-delivered report; only clear when we never had one.
        setTradeCheckReport((current) => current ?? null);
      });
  }

  function scheduleResultsReveal() {
    if (resultsTransitionRef.current != null) {
      window.clearTimeout(resultsTransitionRef.current);
    }
    setResultsPhase("transitioning");
    resultsTransitionRef.current = window.setTimeout(() => {
      setResultsPhase("complete");
      resultsTransitionRef.current = null;
    }, RESULTS_TRANSITION_MS);
  }

  function markRunComplete() {
    if (terminalRef.current) {
      return;
    }
    terminalRef.current = true;
    setCompleted(true);
    setActiveAgent(null);
    if (!timerFrozenRef.current) {
      freezeElapsed((Date.now() - startTimeRef.current) / 1000);
    }
    scheduleResultsReveal();
    void hydrateReportFromApi();
    void hydrateTradeCheckFromApi();
  }

  function hydrateReportFromApi() {
    return fetchSessionReport(sessionId)
      .then((report) => {
        const sections = report.sections as Partial<
          Record<ReportSectionKey, string>
        >;
        setReports((prev) => {
          const merged = { ...prev };
          for (const [key, value] of Object.entries(sections)) {
            if (value) {
              merged[key as ReportSectionKey] = value;
            }
          }
          return merged;
        });
        if (report.tradeCheck) {
          setTradeCheckReport(report.tradeCheck);
        }
      })
      .catch(() => {
        // Reports already streamed live are sufficient.
      });
  }

  useEffect(() => {
    return () => {
      if (resultsTransitionRef.current != null) {
        window.clearTimeout(resultsTransitionRef.current);
      }
    };
  }, []);

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
          (new Date(session.updatedAt).getTime() -
            new Date(session.createdAt).getTime()) /
          1000;
        freezeElapsed(Math.max(0, elapsed));
      }
      if (session.status === "completed") {
        terminalRef.current = true;
        setCompleted(true);
        setResultsPhase("complete");
        await hydrateReportFromApi();
        await hydrateTradeCheckFromApi();
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
        void hydrateTradeCheckFromApi();
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
    if (!isAuthLoaded) {
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let feedCounter = 0;

    function pushFeed(timestamp: string, type: string, content: string) {
      feedCounter += 1;
      setFeed((prev) =>
        [{ id: `${feedCounter}`, timestamp, type, content }, ...prev].slice(
          0,
          100,
        ),
      );
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
        setAgentStatus((prev) => ({
          ...prev,
          [payload.agent]: payload.status,
        }));
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
      if (event === "trade.check") {
        const payload = data as { tradeCheck?: TradeCheckReport };
        if (payload.tradeCheck) {
          setTradeCheckReport(payload.tradeCheck);
        }
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
          computeCredits:
            typeof payload.compute_credits === "number"
              ? payload.compute_credits
              : prev.computeCredits,
          remainingComputeCredits:
            typeof payload.remaining_compute_credits === "number"
              ? payload.remaining_compute_credits
              : prev.remainingComputeCredits,
        }));
        return;
      }
      if (event === "credit.warning") {
        const payload = data as CreditWarningEvent;
        setCreditWarning(payload.message);
        return;
      }
      if (event === "credit.exhausted") {
        const payload = data as { message?: string; hint?: string };
        setCreditWarning(payload.message ?? "Compute credits exhausted.");
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

    async function loadSharedTerminalSession(status: string) {
      setUsesLiveStream(false);
      setHasPrivateAccess(false);
      try {
        if (status === "completed") {
          terminalRef.current = true;
          setCompleted(true);
          setResultsPhase("complete");
          await hydrateReportFromApi();
          await hydrateTradeCheckFromApi();
        } else if (status === "error") {
          terminalRef.current = true;
          setRunError((current) =>
            current ?? {
              message: sessionMeta?.error ?? "Run failed",
              hint: "This analysis ended with an error.",
            },
          );
        } else if (status === "cancelled") {
          terminalRef.current = true;
          setRunError((current) =>
            current ?? {
              message: "Run cancelled",
              hint: "This analysis was cancelled.",
            },
          );
        }
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

    async function loadOwnerTerminalSession(status: string) {
      setUsesLiveStream(false);
      try {
        const eventsResponse = await fetchSessionEvents(sessionId);
        if (cancelled) {
          return;
        }

        setHasPrivateAccess(true);
        for (const item of eventsResponse.items) {
          handleStreamEvent(item.type, item.payload);
        }

        await hydrateReportFromApi();
        await hydrateTradeCheckFromApi();
        if (!cancelled) {
          setConnected(true);
        }
      } catch (error) {
        const isNotFound =
          error instanceof ApiClientError && error.status === 404;
        if (isNotFound && !cancelled) {
          // Signed-in non-owners fall back to the public share view.
          await loadSharedTerminalSession(status);
          return;
        }
        if (!cancelled) {
          setRunError({
            message:
              error instanceof Error ? error.message : "Failed to load run data",
            hint: "Try refreshing this page.",
          });
        }
      }
    }

    function startLiveStream() {
      setUsesLiveStream(true);
      setHasPrivateAccess(true);
      unsubscribe = subscribeToSessionStream(sessionId, {
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
      });
    }

    async function pollSharedLiveSession() {
      setUsesLiveStream(false);
      setHasPrivateAccess(false);
      setConnected(true);

      let consecutiveFailures = 0;
      const maxConsecutiveFailures = 3;

      while (!cancelled) {
        try {
          const session = await fetchSession(sessionId);
          if (cancelled) {
            return;
          }
          consecutiveFailures = 0;
          setSessionMeta(session);
          setSelectedAnalysts(session.config.analysts);

          if (isLiveSessionStatus(session.status)) {
            await new Promise((resolve) => {
              window.setTimeout(resolve, SHARED_RUN_POLL_MS);
            });
            continue;
          }

          if (session.status === "completed") {
            await hydrateReportFromApi();
            await hydrateTradeCheckFromApi();
            markRunComplete();
            return;
          }

          if (session.status === "error") {
            terminalRef.current = true;
            setRunError({
              message: session.error ?? "Run failed",
              hint: "This analysis ended with an error.",
            });
            return;
          }

          if (session.status === "cancelled") {
            terminalRef.current = true;
            setRunError({
              message: "Run cancelled",
              hint: "This analysis was cancelled.",
            });
          }
          return;
        } catch (error) {
          if (error instanceof ApiClientError && error.status === 404) {
            if (!cancelled) {
              setRunError({
                message: "Session not found",
                hint: "This share link may be invalid or the run was deleted.",
              });
            }
            return;
          }
          consecutiveFailures += 1;
          if (consecutiveFailures >= maxConsecutiveFailures) {
            if (!cancelled) {
              setRunError({
                message: "Failed to load session",
                hint: "Try refreshing this page.",
              });
            }
            return;
          }
          await new Promise((resolve) => {
            window.setTimeout(resolve, SHARED_RUN_POLL_MS * consecutiveFailures);
          });
        }
      }
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

      const preferOwnerAccess = Boolean(isSignedIn);

      if (!isLiveSessionStatus(status)) {
        if (preferOwnerAccess) {
          await loadOwnerTerminalSession(status);
        } else {
          await loadSharedTerminalSession(status);
        }
        return;
      }

      if (preferOwnerAccess) {
        try {
          // Ownership probe: events stay owner-scoped; non-owners fall back to public poll.
          await fetchSessionEvents(sessionId);
          if (cancelled) {
            return;
          }
          startLiveStream();
        } catch (error) {
          const isNotFound =
            error instanceof ApiClientError && error.status === 404;
          if (isNotFound && !cancelled) {
            await pollSharedLiveSession();
            return;
          }
          if (!cancelled) {
            setRunError({
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to load live run",
              hint: "Try refreshing this page.",
            });
          }
        }
        return;
      }

      await pollSharedLiveSession();
    }

    void initRunData();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [sessionId, isAuthLoaded, isSignedIn]);

  const isRunning = connected && !completed && !runError;

  const secondsSinceActivity = (Date.now() - lastActivityAt) / 1000;
  const isDeepThinking =
    isRunning && secondsSinceActivity >= DEEP_THINKING_THRESHOLD_SECONDS;

  const progressSummary = useMemo(() => {
    const statuses = Object.values(agentStatus);
    const total = statuses.length;
    const completedCount = statuses.filter((s) => s === "completed").length;
    return {
      total,
      completed: completedCount,
      inProgress: statuses.filter((s) => s === "in_progress").length,
      errors: statuses.filter((s) => s === "error").length,
      percent: total > 0 ? Math.round((completedCount / total) * 100) : 0,
    };
  }, [agentStatus]);

  const agentGroups = useMemo(() => {
    return Object.entries(AGENT_TEAMS)
      .map(([team, agents]) => ({
        team,
        agents: agents
          .filter((agent) => agent in agentStatus)
          .map((agent) => ({
            agent,
            status: agentStatus[agent] ?? "pending",
            preview: reports[SECTION_BY_AGENT[agent]]
              ? truncatePreview(reports[SECTION_BY_AGENT[agent]] as string)
              : null,
          })),
      }))
      .filter((group) => group.agents.length > 0);
  }, [agentStatus, reports]);

  const analystSections = useMemo(() => {
    if (selectedAnalysts.length > 0) {
      return selectedAnalysts.map(
        (analyst) => ANALYST_REPORT_SECTIONS[analyst],
      );
    }
    return ANALYST_TYPE_ORDER.map(
      (analyst) => ANALYST_REPORT_SECTIONS[analyst],
    ).filter(
      (section) =>
        section in reports ||
        (SECTION_AGENT[section] !== undefined &&
          SECTION_AGENT[section]! in agentStatus),
    );
  }, [selectedAnalysts, reports, agentStatus]);

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

    const agentsSettled = agentStatuses.every(
      (status) =>
        status === "completed" || status === "error" || status === "cancelled",
    );
    const reportsReady = expectedReportSections.every((section) =>
      Boolean(reports[section]),
    );

    if (agentsSettled && reportsReady) {
      freezeElapsed((Date.now() - startTimeRef.current) / 1000);
    }
  }, [agentStatus, reports, expectedReportSections, runError]);

  function handleOpenReport(section: ReportSectionKey) {
    if (!reports[section]) {
      return;
    }
    setOpenReportSection(section);
  }

  function handleCloseReport() {
    setOpenReportSection(null);
  }

  function handleReportRowKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    section: ReportSectionKey,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpenReport(section);
    }
  }

  function renderReportRow(section: ReportSectionKey) {
    const agent = SECTION_AGENT[section];
    const status = agent ? agentStatus[agent] : undefined;
    const content = reports[section];
    const title = REPORT_SECTION_TITLES[section];
    const label = reportStatusLabel(status, Boolean(content), isRunning);
    const isWorking = label === "working";
    const signal = content ? extractReportSignal(section, content) : null;
    const canOpen = Boolean(content);
    // Finished sections: only show View — no ready/pending badge.
    const showStatusBadge = !canOpen || isWorking || label === "error";

    return (
      <button
        key={section}
        type="button"
        className={`${styles.reportRow} ${canOpen ? styles.reportRowOpenable : ""}`}
        onClick={() => handleOpenReport(section)}
        onKeyDown={(event) => handleReportRowKeyDown(event, section)}
        disabled={!canOpen}
        aria-label={
          canOpen ? `Open ${title} report` : `${title} report unavailable`
        }
      >
        <span className={styles.reportRowMain}>
          <span className={styles.reportRowTitle}>{title}</span>
          {signal ? (
            <span
              className={`${styles.reportSignal} ${reportSignalToneClass(signal)}`}
              aria-label={`Signal: ${signal}`}
            >
              {signal}
            </span>
          ) : null}
        </span>
        <span className={styles.reportRowMeta}>
          {showStatusBadge ? (
            <span
              className={`${styles.reportBadge} ${statusClass(
                canOpen ? "completed" : (status ?? "pending"),
              )}`}
            >
              {isWorking ? (
                <>
                  {label}
                  <ThinkingDots />
                </>
              ) : (
                label
              )}
            </span>
          ) : null}
          {canOpen ? (
            <span className={styles.reportRowAction} aria-hidden>
              View
            </span>
          ) : null}
        </span>
      </button>
    );
  }

  function renderAgentPipeline(compact: boolean) {
    return (
      <section
        className={`${styles.agentPipeline} ${compact ? styles.agentPipelineCompact : ""}`}
        aria-label="Agent pipeline"
      >
        <div className={styles.pipelineHeader}>
          <div>
            <h2 className={styles.pipelineTitle}>
              {compact ? "Agent pipeline" : "Specialist agents"}
            </h2>
            {!compact ? (
              <p className={styles.pipelineSubtitle}>
                Each card represents one agent team member working through your
                thesis.
              </p>
            ) : null}
          </div>
          {progressSummary.total > 0 ? (
            <div className={styles.progressMeta}>
              <span className={styles.progressChip}>
                {progressSummary.completed}/{progressSummary.total} complete
              </span>
              {!compact && progressSummary.inProgress > 0 ? (
                <span className={styles.progressChipActive}>
                  {progressSummary.inProgress} active
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {!compact ? (
          <div
            className={styles.progressTrack}
            aria-hidden={progressSummary.total === 0}
          >
            <div
              className={styles.progressFill}
              style={{ width: `${progressSummary.percent}%` }}
            />
          </div>
        ) : null}

        {agentGroups.length === 0 ? (
          <p className="muted">Waiting for agent status…</p>
        ) : (
          agentGroups.map((group) => (
            <div key={group.team} className={styles.agentTeamGroup}>
              {!compact ? (
                <h3 className={styles.agentTeamTitle}>{group.team}</h3>
              ) : null}
              <div
                className={`${styles.agentGrid} ${compact ? styles.agentGridCompact : ""}`}
              >
                {group.agents.map(({ agent, status, preview }) => (
                  <AgentProgressCard
                    key={agent}
                    agent={agent}
                    team={group.team}
                    status={status}
                    isActive={activeAgent === agent}
                    compact={compact}
                    previewContent={preview}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    );
  }

  // tick drives deep-thinking banner re-render every second
  void tick;

  const showResults = resultsPhase !== "running";
  const layoutClassName = [
    styles.runLayout,
    showResults ? styles.runLayoutComplete : "",
    resultsPhase === "transitioning" ? styles.runLayoutTransitioning : "",
  ]
    .filter(Boolean)
    .join(" ");

  const runTitle = sessionMeta
    ? `${sessionMeta.config.ticker} analysis`
    : "Analysis run";
  const runSubtitle = sessionMeta
    ? `Report date ${sessionMeta.config.analysisDate}`
    : null;
  const isTerminalSession =
    completed ||
    runError != null ||
    sessionMeta?.status === "completed" ||
    sessionMeta?.status === "cancelled" ||
    sessionMeta?.status === "error";

  const showTimingNotice =
    usesLiveStream && !isTerminalSession && (isRunning || !connected);

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

  const openReportContent = openReportSection
    ? reports[openReportSection]
    : undefined;
  const openReportSignal =
    openReportSection && openReportContent
      ? extractReportSignal(openReportSection, openReportContent)
      : null;

  return (
    <div className={layoutClassName}>
      {isSignedIn ? (
        <div className={styles.runHeader}>
          <Link
            href="/dashboard"
            className={styles.backLink}
            aria-label="Return to dashboard"
          >
            ← Back to dashboard
          </Link>
        </div>
      ) : null}
      <div className={styles.runTitleBlock}>
        <h1>{runTitle}</h1>
        {runSubtitle ? (
          <p className={styles.runSubtitle}>{runSubtitle}</p>
        ) : null}
      </div>

      {showTimingNotice && (
        <div className={styles.bannerInfo} role="status" aria-live="polite">
          <strong>Analysis in progress</strong>
          <p>
            Multiple specialist agents are working through market data, news,
            and debate rounds. A full run typically takes about{" "}
            <strong>10 minutes - 20 minutes</strong>, depending on research
            depth and provider speed.
          </p>
          <p className={styles.bannerInfoFootnote}>
            Cards update live — full agent reports appear when the run finishes.
          </p>
        </div>
      )}

      <RunSettingsPanel
        session={sessionMeta}
        expanded={settingsExpanded}
        onToggle={() => setSettingsExpanded((prev) => !prev)}
      />

      {creditWarning && !runError ? (
        <div className={styles.bannerInfo} role="status" aria-live="polite">
          <strong>Compute credits</strong>
          <p>{creditWarning}</p>
        </div>
      ) : null}

      {runError && (
        <div className={styles.bannerError} role="alert">
          <strong>Analysis stopped</strong>
          <p className={styles.errorMessage}>{runError.message}</p>
          {runError.hint && <p className={styles.errorHint}>{runError.hint}</p>}
          {runError.failedAgent && (
            <p className={styles.errorMeta}>
              Failed at: {runError.failedAgent}
            </p>
          )}
          {typeof runError.stoppedAgents === "number" &&
            runError.stoppedAgents > 0 && (
              <p className={styles.errorMeta}>
                {runError.stoppedAgents} remaining agent
                {runError.stoppedAgents === 1 ? "" : "s"} skipped to save
                tokens.
              </p>
            )}
        </div>
      )}

      {completed && !runError && showResults ? (
        <RunExportBar
          sessionId={sessionId}
          ticker={sessionMeta?.config.ticker ?? "Analysis"}
          canShareDigest={Boolean(tradeCheckReport)}
        />
      ) : null}

      {completed && !runError && showResults && resultsPhase === "complete" && hasPrivateAccess ? (
        <FeedbackPrompt sessionId={sessionId} />
      ) : null}

      {!connected && !runError && !showTimingNotice && (
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
          {activeAgent ? (
            <span className={styles.workingAgent}>Active: {activeAgent}</span>
          ) : null}
        </div>
      )}

      {showResults && tradeCheckReport ? (
        <section
          className={styles.chartHero}
          aria-label="Price chart"
        >
          <div id={TRADE_CHECK_SHARE_ROOT_ID} className={styles.chartShareRoot}>
            <header className={styles.chartHeader}>
              <div>
                <h2 className={styles.chartTitle}>
                  {tradeCheckReport.header.companyName
                    ? `${tradeCheckReport.header.ticker} — ${tradeCheckReport.header.companyName}`
                    : tradeCheckReport.header.ticker}
                </h2>
                <p className={styles.chartMeta}>
                  {tradeCheckReport.header.exchange
                    ? `${tradeCheckReport.header.exchange} · `
                    : ""}
                  {tradeCheckReport.header.analysisDate}
                  {tradeCheckReport.header.strategy
                    ? ` · ${tradeCheckReport.header.strategy}`
                    : ""}
                </p>
              </div>
              <div className={styles.chartPriceBlock}>
                <div
                  className={`${styles.chartPrice} ${
                    (tradeCheckReport.priceSummary.changePct ?? 0) >= 0
                      ? styles.chartPriceUp
                      : styles.chartPriceDown
                  }`}
                >
                  {formatChartPrice(tradeCheckReport.priceSummary.currentPrice)}
                </div>
                {tradeCheckReport.priceSummary.changePct != null ? (
                  <div
                    className={
                      tradeCheckReport.priceSummary.changePct >= 0
                        ? styles.chartPriceUp
                        : styles.chartPriceDown
                    }
                  >
                    {tradeCheckReport.priceSummary.changePct >= 0 ? "+" : ""}
                    {tradeCheckReport.priceSummary.changePct.toFixed(2)}%
                  </div>
                ) : null}
              </div>
            </header>
            <TradeCheckChart chart={tradeCheckReport.chart} />
          </div>
        </section>
      ) : null}

      {showResults ? (
        <section
          className={`${styles.resultsHero} ${styles.resultsHeroVisible}`}
          aria-label="Full agent reports"
          aria-live={resultsPhase === "complete" ? "polite" : undefined}
        >
          <header className={styles.appendixHeader}>
            <h2 className={styles.appendixTitle}>Full agent reports</h2>
            <p className={styles.appendixHint}>
              Click any report to open the full write-up in a readable view.
            </p>
          </header>

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
                  {sections.map((section) => renderReportRow(section))}
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {hasPrivateAccess ? renderAgentPipeline(showResults) : null}

      {openReportSection && openReportContent ? (
        <ReportModal
          title={REPORT_SECTION_TITLES[openReportSection]}
          content={openReportContent}
          signal={openReportSignal}
          signalClassName={reportSignalToneClass(openReportSignal)}
          onClose={handleCloseReport}
        />
      ) : null}

      {hasPrivateAccess ? (
        <section className={styles.activityPanel} data-print-hide="true">
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
      ) : null}

      {hasPrivateAccess ? (
        <footer className={styles.footer} data-print-hide="true">
          <span>LLM calls: {stats.llmCalls}</span>
          <span>Tool calls: {stats.toolCalls}</span>
          <span>Tokens in: {formatTokens(stats.tokensIn)}</span>
          <span>Tokens out: {formatTokens(stats.tokensOut)}</span>
          {stats.computeCredits != null ? (
            <span>Credits used: {formatTokens(stats.computeCredits)}</span>
          ) : null}
          {stats.remainingComputeCredits != null ? (
            <span>Credits left: {formatTokens(stats.remainingComputeCredits)}</span>
          ) : null}
          <span>Elapsed: {formatElapsed(stats.elapsedSeconds)}</span>
        </footer>
      ) : null}
    </div>
  );
}
