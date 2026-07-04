/**
 * @file apps/web/src/lib/privacy-policy-content.ts
 * Privacy and cookie policy copy for the public marketing site.
 */

export const PRIVACY_POLICY_LAST_UPDATED = "July 3, 2026";

const configuredContactEmail = process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim();

/** Public contact for privacy requests — set NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL in production. */
export const PRIVACY_CONTACT = configuredContactEmail
  ? { href: `mailto:${configuredContactEmail}`, label: configuredContactEmail }
  : {
      href: "https://github.com/JeffBaumgardt/TradingAgents/issues/new?labels=privacy",
      label: "GitHub privacy request",
    };

export interface PrivacyListItem {
  title: string;
  description: string;
}

export interface PrivacySection {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: PrivacyListItem[];
  bullets?: string[];
}

export const PRIVACY_POLICY_SECTIONS: PrivacySection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    paragraphs: [
      "TradingAgents is a multi-agent market research application. This policy explains how we collect, use, store, and share personal data when you visit our website, create an account, or run analyses.",
      `The data controller for the service is the operator of this TradingAgents deployment. For privacy requests, contact us using the details at the bottom of this page.`,
    ],
  },
  {
    id: "data-we-collect",
    title: "Personal data we collect",
    paragraphs: ["Depending on how you use TradingAgents, we may process:"],
    items: [
      {
        title: "Account and identity data",
        description:
          "When you sign up or sign in, our authentication provider (Clerk) processes your email address, name, profile image, and authentication identifiers. We sync a subset of this profile to our API database.",
      },
      {
        title: "Provider API keys",
        description:
          "If you choose to run analyses, you may store LLM provider API keys in your account. Keys are encrypted on the server, associated with your user ID, and are not displayed again in the browser after you save them.",
      },
      {
        title: "Analysis and session data",
        description:
          "When you configure or run an analysis, we store session metadata (such as ticker, analysis settings, agent selections, timestamps), generated reports, and related event data linked to your account.",
      },
      {
        title: "Optional analysis context",
        description:
          "You may provide optional personal context for a run (for example, investment horizon or constraints). Do not submit sensitive personal data you do not want processed by LLM providers.",
      },
      {
        title: "Technical and usage data",
        description:
          "We automatically collect technical information such as IP address, browser type, device information, and request logs for security, abuse prevention, and service operation.",
      },
    ],
  },
  {
    id: "legal-bases",
    title: "Legal bases for processing (EEA/UK)",
    paragraphs: ["Where GDPR applies, we rely on the following legal bases:"],
    bullets: [
      "Contract — to create and manage your account and provide the analysis service you request.",
      "Legitimate interests — to secure the service, prevent abuse, improve reliability, and operate essential site functionality.",
      "Consent — for non-essential cookies or similar technologies where required by law. You can withdraw consent at any time.",
      "Legal obligation — where we must retain or disclose data to comply with applicable law.",
    ],
  },
  {
    id: "how-we-use-data",
    title: "How we use personal data",
    bullets: [
      "Authenticate you and maintain your session.",
      "Store your profile and encrypted provider credentials.",
      "Run, persist, and display multi-agent analysis sessions and reports.",
      "Send your analysis requests to the LLM provider(s) you configure, using your supplied API keys.",
      "Protect the service, investigate incidents, and enforce acceptable use.",
      "Respond to support and privacy requests.",
    ],
  },
  {
    id: "cookies-storage",
    title: "Cookies and browser storage",
    paragraphs: [
      "We use cookies and similar technologies that are necessary to operate the site. We do not use advertising or cross-site tracking cookies on the marketing site.",
    ],
    items: [
      {
        title: "Clerk authentication cookies",
        description:
          "Essential cookies set by Clerk to keep you signed in and protect your account. Duration and exact names are managed by Clerk.",
      },
      {
        title: "tradingagents-cookie-ack (cookie)",
        description:
          "Remembers that you acknowledged cookie use on the landing page. Duration: 1 year. SameSite=Lax. Scope: site root.",
      },
      {
        title: "tradingagents-theme (local storage)",
        description:
          "Stores your in-app theme preference after you sign in. Not used to track you across sites.",
      },
      {
        title: "tradingagents:credentialsReady (session storage)",
        description:
          "Temporary client-side flag indicating whether your account has saved provider credentials during the current browser session.",
      },
    ],
  },
  {
    id: "processors",
    title: "Service providers and third parties",
    paragraphs: [
      "We use trusted processors to operate the service. They may process personal data only on our instructions and subject to appropriate safeguards:",
    ],
    bullets: [
      "Clerk — authentication and account management.",
      "Supabase — application database and encrypted credential storage.",
      "Your chosen LLM provider(s) — analysis requests are sent using API keys you supply (for example OpenAI, Google, Anthropic, or other configured providers).",
      "Hosting and infrastructure providers — to serve the web app, API, and agents service (for example Vercel, Railway, or equivalent in your deployment).",
    ],
  },
  {
    id: "retention",
    title: "How long we keep data",
    bullets: [
      "Account profile data is kept while your account is active and for a reasonable period afterward unless deletion is requested or required by law.",
      "Encrypted provider credentials are kept until you delete them or delete your account.",
      "Analysis sessions and reports are kept while your account is active unless you delete them or request account erasure.",
      "Server logs and security records are retained for a limited period appropriate for security and troubleshooting.",
      "Cookie acknowledgment is stored for up to one year unless you clear cookies earlier.",
    ],
  },
  {
    id: "security",
    title: "Security",
    paragraphs: [
      "We apply technical and organizational measures designed to protect personal data, including encryption of provider API keys at rest, authenticated API access, and access controls on backend services. No method of transmission or storage is completely secure; please use a strong, unique password and protect your provider API keys.",
    ],
  },
  {
    id: "transfers",
    title: "International transfers",
    paragraphs: [
      "Your data may be processed in countries other than your own, including the United States, where our service providers operate. Where required, we rely on appropriate safeguards such as Standard Contractual Clauses or equivalent mechanisms offered by our processors.",
    ],
  },
  {
    id: "your-rights",
    title: "Your privacy rights",
    paragraphs: [
      "Depending on your location, you may have the right to access, correct, delete, restrict, or object to certain processing of your personal data, and to data portability where applicable.",
      "If processing is based on consent, you may withdraw consent at any time without affecting the lawfulness of processing before withdrawal.",
      "To exercise your rights, email us at the contact address above. We may need to verify your identity before responding.",
      "If you are in the EEA or UK, you also have the right to lodge a complaint with your local data protection authority.",
    ],
  },
  {
    id: "children",
    title: "Children",
    paragraphs: [
      "TradingAgents is not directed at children under 16, and we do not knowingly collect personal data from children. If you believe a child has provided us personal data, contact us and we will take appropriate steps to delete it.",
    ],
  },
  {
    id: "research-notice",
    title: "Research-only product notice",
    paragraphs: [
      "TradingAgents generates AI-assisted market research for informational purposes only. Outputs are not financial, investment, tax, or legal advice. You are responsible for your own investment decisions.",
    ],
  },
  {
    id: "changes",
    title: "Changes to this policy",
    paragraphs: [
      "We may update this policy from time to time. We will post the revised version on this page and update the “Last updated” date. Material changes may also be communicated through the app or by email where appropriate.",
    ],
  },
];
