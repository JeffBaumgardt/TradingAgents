/**
 * @file packages/api-types/src/index.ts
 * TypeScript types aligned with packages/api-types/openapi.yaml.
 */

/** Placeholder returned for stored secret credential fields (never the real value). */
export const SECRET_CREDENTIAL_PLACEHOLDER = "********";

export type AnalystType = "market" | "social" | "news" | "fundamentals";

export type ResearchDepth = 1 | 3 | 5;

export type ModelMode = "quick" | "deep";

export type AgentStatusValue = "pending" | "in_progress" | "completed" | "error" | "cancelled";

export type MessageType = "System" | "User" | "Agent" | "Data" | "Control" | "Tool";

export type ReportSectionKey =
  | "market_report"
  | "sentiment_report"
  | "news_report"
  | "fundamentals_report"
  | "investment_plan"
  | "trader_investment_plan"
  | "final_trade_decision";

export type SessionStatus = "pending" | "running" | "completed" | "error" | "cancelled";

/** True when agents may still be running and the client should use live SSE. */
export function isLiveSessionStatus(status: SessionStatus): boolean {
  return status === "pending" || status === "running";
}

/** Restart SSE before Vercel Hobby's 5-minute function limit (4:30). */
export const SESSION_STREAM_ROTATE_MS = 270_000;

export type SseEventType =
  | "run.started"
  | "run.heartbeat"
  | "agent.status"
  | "message"
  | "tool.call"
  | "report.section"
  | "stats"
  | "trade.check"
  | "run.completed"
  | "run.error";

export interface ConfigOption {
  value: string;
  label: string;
}

export interface ResearchDepthOption {
  value: ResearchDepth;
  label: string;
}

export interface ProviderOption {
  id: string;
  label: string;
  backendUrl?: string | null;
}

export interface CredentialField {
  name: string;
  label: string;
  secret: boolean;
  required: boolean;
  placeholder?: string | null;
}

export interface ProviderCredentialDefinition {
  id: string;
  label: string;
  backendUrl?: string | null;
  requiresApiKey: boolean;
  credentialFields: CredentialField[];
  modelSource: "static" | "live" | "static_or_live";
  /** Official URL where users can sign up and create an API key. */
  apiKeyUrl: string | null;
}

export interface StoredCredentialsResponse {
  providerCredentials: ProviderCredentials;
}

/** Per-provider credential values supplied for the current browser session. */
export type ProviderCredentials = Partial<
  Record<string, Record<string, string>>
>;

export interface CredentialsSchemaResponse {
  providers: ProviderCredentialDefinition[];
  modelCatalogNote: string;
}

export interface ConfigOptions {
  analysts: ConfigOption[];
  researchDepths: ResearchDepthOption[];
  languages: ConfigOption[];
  providers: ProviderOption[];
  availableProviderIds?: string[];
}

export interface ResolvedConfigResponse extends ConfigOptions {
  credentialsSchema: CredentialsSchemaResponse;
  availableProviderIds: string[];
}

export interface ModelOption {
  id: string;
  label: string;
  capabilities?: {
    anthropicEffort?: boolean;
    openaiReasoningEffort?: boolean;
    googleThinkingLevel?: boolean;
  };
}

export interface ProviderModelsResponse {
  provider: string;
  mode: ModelMode;
  models: ModelOption[];
}

export interface CreateSessionRequest {
  ticker: string;
  userContext?: string;
  analysisDate: string;
  outputLanguage: string;
  analysts: AnalystType[];
  researchDepth: ResearchDepth;
  llmProvider: string;
  backendUrl?: string | null;
  quickThinkLlm: string;
  deepThinkLlm: string;
  googleThinkingLevel?: "high" | "minimal";
  openaiReasoningEffort?: "low" | "medium" | "high";
  anthropicEffort?: "low" | "medium" | "high";
  checkpointEnabled?: boolean;
  /** Loaded server-side from stored user credentials; not accepted from clients. */
  providerCredentials?: ProviderCredentials;
}

export interface Session {
  id: string;
  userId?: string | null;
  status: SessionStatus;
  ticker: string;
  analysisDate: string;
  config: CreateSessionRequest;
  runId?: string | null;
  error?: string | null;
  /** Final portfolio rating when the run completed successfully. */
  decision?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionListResponse {
  items: Session[];
  total: number;
  limit: number;
  offset: number;
}

export interface SessionReport {
  sessionId: string;
  markdown: string;
  sections: Record<string, string | null>;
  decision: string | null;
  tradeCheck?: TradeCheckReport | null;
}

export type VerdictBadgeTone = "neutral" | "bullish" | "bearish" | "warning";

export interface TradeCheckSource {
  id: string;
  title: string;
  url?: string | null;
  provider?: string | null;
  kind?: string;
  publishedAt?: string | null;
  excerpt?: string | null;
}

export interface TradeCheckPriceLevel {
  label: string;
  kind: string;
  price?: number | null;
  low?: number | null;
  high?: number | null;
  note?: string | null;
  isKey?: boolean;
}

export interface TradeCheckQuickMetric {
  label: string;
  value: string;
  tone?: VerdictBadgeTone;
  note?: string | null;
}

export interface TradeCheckScenario {
  id: string;
  direction: "long" | "short";
  title: string;
  trigger: string;
  stop?: number | null;
  stopLabel?: string | null;
  riskPerShare?: string | null;
  targets: string[];
  note?: string | null;
  sourceIds?: string[];
}

export interface TradeCheckCatalystRow {
  metric: string;
  value: string;
  note?: string | null;
  sourceIds?: string[];
}

export interface TradeCheckVerdictBadge {
  id: string;
  label: string;
  tone: VerdictBadgeTone;
  headline: string;
  detail?: string | null;
}

export interface TradeCheckAgentSection {
  agentKey: string;
  agentName: string;
  headline: string;
  confidence?: "low" | "medium" | "high" | null;
  score?: number | null;
  topSources: TradeCheckSource[];
  keyPoints: string[];
  dataBucket: Record<string, string | number | null>;
}

export interface TradeCheckOhlcvBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

export interface TradeCheckChartLevel {
  label: string;
  price: number;
  color: string;
  style?: "solid" | "dashed" | "dotted";
}

export interface TradeCheckProjectionPoint {
  time: string;
  p50: number;
  p90High?: number | null;
  p90Low?: number | null;
}

export interface TradeCheckChart {
  bars: TradeCheckOhlcvBar[];
  levels: TradeCheckChartLevel[];
  projection: TradeCheckProjectionPoint[];
  legend: string[];
}

export interface TradeCheckReport {
  schemaVersion: string;
  header: {
    ticker: string;
    companyName?: string | null;
    tags: string[];
    exchange?: string | null;
    analysisDate: string;
    strategy?: string | null;
  };
  priceSummary: {
    currentPrice?: number | null;
    changePct?: number | null;
    changeAmount?: number | null;
    afterHoursNote?: string | null;
    fiftyTwoWeekRange?: string | null;
    beta?: number | null;
    earningsDate?: string | null;
  };
  quickMetrics: TradeCheckQuickMetric[];
  actionableLevels: TradeCheckPriceLevel[];
  scenarios: TradeCheckScenario[];
  catalysts: TradeCheckCatalystRow[];
  verdict: TradeCheckVerdictBadge[];
  bottomLine?: string | null;
  agentSections: TradeCheckAgentSection[];
  sources: TradeCheckSource[];
  chart: TradeCheckChart;
  decision?: string | null;
  distillationNotes?: string | null;
}

export interface SessionTradeCheckResponse {
  sessionId: string;
  tradeCheck: TradeCheckReport;
}

/** Persisted session event returned for historical replay. */
export interface SessionEvent {
  id: number;
  type: SseEventType | string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface SessionEventsResponse {
  items: SessionEvent[];
}

export interface ErrorResponse {
  error: string;
  details?: Record<string, unknown>;
}

export interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserRequest {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
}

export type FeedbackSource = "post_run" | "footer";

export type FeedbackCategory = "bug" | "idea" | "praise" | "other";

export interface FeedbackRequest {
  message: string;
  category?: FeedbackCategory;
  rating?: 1 | 2 | 3 | 4 | 5;
  sessionId?: string;
  pageUrl?: string;
  source: FeedbackSource;
}

export interface FeedbackResponse {
  ok: true;
}

export type BillingPlanId = "byok" | "hosted";

export type BillingInterval = "monthly" | "annual";

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  monthlyPriceCents: number;
  priceProvisional: boolean;
  annualDiscountPercent: number;
}

export interface BillingPlansResponse {
  plans: BillingPlan[];
}

export interface CheckoutRequest {
  planId: BillingPlanId;
  interval: BillingInterval;
  successUrl?: string;
  cancelUrl?: string;
}

/** Returned while the payment provider is not wired (HTTP 501). */
export interface CheckoutResponse {
  status: "not_configured";
  planId: BillingPlanId;
  interval: BillingInterval;
  checkoutUrl: null;
  message: string;
}

export interface AgentStatusEvent {
  agent: string;
  status: AgentStatusValue;
}

export interface StreamMessageEvent {
  messageType: MessageType;
  content: string;
  timestamp: string;
}

export interface StreamToolCallEvent {
  toolName: string;
  args: Record<string, unknown>;
  timestamp: string;
}

export interface StreamReportSectionEvent {
  section: ReportSectionKey;
  content: string;
}

export interface StreamStatsEvent {
  llm_calls: number;
  tool_calls: number;
  tokens_in: number;
  tokens_out: number;
}

export interface RunStartedEvent {
  runId: string;
  sessionId: string;
}

export interface RunHeartbeatEvent {
  activeAgent: string | null;
  elapsedSeconds: number;
  llmCalls: number;
  toolCalls: number;
}

export interface RunCompletedEvent {
  sessionId: string;
  decision: string | null;
}

export interface TradeCheckEvent {
  tradeCheck: TradeCheckReport;
}

export interface RunErrorEvent {
  message: string;
  failedAgent?: string | null;
  stage?: string | null;
  hint?: string | null;
  stoppedAgents?: number;
}

export interface SseEventMap {
  "run.started": RunStartedEvent;
  "run.heartbeat": RunHeartbeatEvent;
  "agent.status": AgentStatusEvent;
  message: StreamMessageEvent;
  "tool.call": StreamToolCallEvent;
  "report.section": StreamReportSectionEvent;
  stats: StreamStatsEvent;
  "trade.check": TradeCheckEvent;
  "run.completed": RunCompletedEvent;
  "run.error": RunErrorEvent;
}

/** Human-readable titles for report sections (mirrors CLI). */
export const REPORT_SECTION_TITLES: Record<ReportSectionKey, string> = {
  market_report: "Market Analysis",
  sentiment_report: "Social Sentiment",
  news_report: "News Analysis",
  fundamentals_report: "Fundamentals Analysis",
  investment_plan: "Research Team Decision",
  trader_investment_plan: "Trading Team Plan",
  final_trade_decision: "Portfolio Management Decision",
};

/** Agent teams for progress display (mirrors CLI layout). */
export const AGENT_TEAMS: Record<string, string[]> = {
  "Analyst Team": [
    "Market Analyst",
    "Social Analyst",
    "News Analyst",
    "Fundamentals Analyst",
  ],
  "Research Team": ["Bull Researcher", "Bear Researcher", "Research Manager"],
  "Trading Team": ["Trader"],
  "Risk Management": [
    "Aggressive Analyst",
    "Neutral Analyst",
    "Conservative Analyst",
  ],
  "Portfolio Management": ["Portfolio Manager"],
};

/** Maps analyst keys to display names. */
export const ANALYST_AGENT_NAMES: Record<AnalystType, string> = {
  market: "Market Analyst",
  social: "Social Analyst",
  news: "News Analyst",
  fundamentals: "Fundamentals Analyst",
};

/** Maps analyst keys to their report section state keys. */
export const ANALYST_REPORT_SECTIONS: Record<AnalystType, ReportSectionKey> = {
  market: "market_report",
  social: "sentiment_report",
  news: "news_report",
  fundamentals: "fundamentals_report",
};

/** Report sections grouped by team for the run UI. */
export const REPORT_TEAM_GROUPS: {
  title: string;
  sections: ReportSectionKey[];
  analystOnly?: boolean;
}[] = [
  {
    title: "Analyst Team",
    sections: [
      "market_report",
      "sentiment_report",
      "news_report",
      "fundamentals_report",
    ],
    analystOnly: true,
  },
  { title: "Research Team", sections: ["investment_plan"] },
  { title: "Trading Team", sections: ["trader_investment_plan"] },
  { title: "Portfolio Management", sections: ["final_trade_decision"] },
];
