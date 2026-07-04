/**
 * @file apps/web/src/lib/license-content.ts
 * Open-source license and attribution copy for the public marketing site.
 */

/** Upstream project this fork derives from (Apache 2.0). */
export const UPSTREAM_PROJECT = {
  name: "TradingAgents",
  organization: "Tauric Research",
  repositoryUrl: "https://github.com/TauricResearch/TradingAgents",
  licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
  licenseName: "Apache License, Version 2.0",
} as const;

export const LICENSE_PAGE_LAST_UPDATED = "July 3, 2026";

export interface LicenseSection {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

export const LICENSE_SECTIONS: LicenseSection[] = [
  {
    id: "overview",
    title: "Overview",
    paragraphs: [
      "TradingAgents is distributed under the Apache License, Version 2.0. You may use, modify, and distribute this software in accordance with that license.",
      "This deployment is a fork that extends the upstream TradingAgents framework with a web application, API gateway, and related services. The upstream core remains licensed under Apache 2.0.",
    ],
  },
  {
    id: "upstream",
    title: "Upstream project",
    paragraphs: [
      "The multi-agent trading framework originates from TradingAgents by Tauric Research. We retain upstream copyright and attribution notices as required by the Apache License.",
    ],
    bullets: [
      "Upstream repository: https://github.com/TauricResearch/TradingAgents",
      "License: Apache License, Version 2.0",
      "Full license text: https://www.apache.org/licenses/LICENSE-2.0",
    ],
  },
  {
    id: "your-rights",
    title: "Your rights under Apache 2.0",
    paragraphs: ["Subject to the license terms, Apache 2.0 generally allows you to:"],
    bullets: [
      "Use the software for personal, research, or commercial purposes.",
      "Modify the source code and create derivative works.",
      "Distribute original or modified versions when you include a copy of the license and retain required notices.",
      "Grant patent rights from contributors under the license’s patent grant (with litigation termination provisions).",
    ],
  },
  {
    id: "conditions",
    title: "Conditions when you redistribute",
    paragraphs: ["If you distribute this software or derivative works, you must:"],
    bullets: [
      "Include a copy of the Apache License 2.0.",
      "State significant changes made to upstream files.",
      "Retain copyright, patent, trademark, and attribution notices from the upstream work.",
      "Include the NOTICE file (if provided) in distributions, or reproduce its attribution in documentation or UI where third-party notices normally appear.",
    ],
  },
  {
    id: "disclaimer",
    title: "Disclaimer",
    paragraphs: [
      "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT.",
      "TradingAgents is designed for research purposes and is not financial, investment, or trading advice. See the upstream disclaimer for additional context.",
    ],
  },
  {
    id: "repository",
    title: "License text in this repository",
    paragraphs: [
      "The full Apache License 2.0 text is in the LICENSE file at the repository root. A NOTICE file summarizes upstream attribution.",
    ],
  },
];
