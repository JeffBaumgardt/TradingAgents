# Agent Pull Request Loop (Cursor + GitHub)

This runbook defines a repeatable agent loop for feature and bug delivery when you are the only human developer and all other contributors are agents.

High-level loop:

1. Implementation agent builds from your prompt.
2. Implementation agent adds/updates docs and tests, then opens/updates PR.
3. Orchestrator posts one kickoff review comment when PR opens.
4. Cloud automation triggers from that comment and runs reviewer/fix agent cycles.
5. If CI fails, orchestrator posts one CI-failure follow-up comment.
6. Cloud automation triggers again, fixes issues, pushes updates, and comments back.
7. Repeat until no actionable feedback remains and CI is green.
8. You merge manually.

---

## 1) One-time repository setup

1. Keep CI required on pull requests (already present in `.github/workflows/ci.yml`).
2. Add the PR loop orchestrator workflow:
   - `.github/workflows/agent-review-loop.yml`
3. Add reviewer guidance template:
   - `.github/PULL_REQUEST_TEMPLATE.md`
4. Wire your cloud automation to trigger on PR comments:
   - Kickoff comment: `### Agent review kickoff (auto)`
   - CI follow-up comment: `### CI failure follow-up (auto)`
5. Important behavior:
   - The orchestrator does **not** respond to comments with more comments.
   - It only posts seed comments on PR open and CI failure.

---

## 2) Primary implementation prompt (copy/paste into Cursor agent)

```text
You are the implementation loop agent for this repository.

Goal: Implement the requested feature/bug end-to-end on a new branch and open/update a PR.

Required execution contract:
1) Read request + relevant code.
2) Plan first in detailed pseudocode.
3) Implement fully (no placeholders/TODOs unless explicitly requested).
4) Add or update tests where appropriate.
5) Run relevant tests/lint checks.
6) Fix failures raised by tests/checks.
7) Update docs/comments where needed for maintainability.
8) Commit with clear message(s), push branch, create/update PR.
9) Sync with latest base before handoff: `git fetch origin main`, merge/rebase `origin/main` into the PR branch, resolve conflicts, re-run checks, push again.
10) Verify GitHub mergeability: `gh pr view <n> --json mergeable,mergeStateStatus` must be `MERGEABLE` / `CLEAN` (not `CONFLICTING`).
11) Provide concise change summary and test evidence.
12) Watch PR CI **and merge status** to finish; if base moves or conflicts appear, repeat step 9 before continuing.
13) Spin up a review agent for a full code review; address valid feedback and push fixes.
14) Do not mark the PR done until CI is green, mergeability is clean, and review feedback is addressed.

Branch freshness (required):
- Branch from latest `origin/main` (`git fetch origin main` first).
- Before final handoff, merge/rebase `origin/main` again and resolve conflicts locally.
- Never declare complete while GitHub reports `mergeable: CONFLICTING`.

Rules:
- Prefer existing project patterns/components over introducing new abstractions.
- Use readable, descriptive naming and early returns.
- Keep changes scoped to the request.
- If blocked, explain blocker and best fallback.

Work request:

```

---

## 3) Review/fix loop prompt (use from orchestrator comments)

```text
You are the PR loop implementation agent.

Target PR: <PR_LINK_OR_NUMBER>
Source comment: <COMMENT_URL>

Task:
1) Read the PR diff and source comment carefully.
2) Plan fix in pseudocode before coding.
3) Implement only what is needed for the requested outcome.
4) Update tests/docs if behavior changed.
5) Run relevant tests/checks and fix any failures.
6) Commit and push to the same PR branch.
7) Reply on PR with what changed + test evidence.
8) If additional work is out-of-scope, create/link a follow-up issue.
```

---

## 4) Day-to-day operation (owner + agents)

1. Start with the **Primary implementation prompt**.
2. Implementation agent opens/updates PR.
3. Orchestrator posts one kickoff review comment.
4. Cloud automation triggers and runs reviewer/fix cycles.
5. Agent pushes fixes and comments results.
6. If CI fails, orchestrator posts one CI failure follow-up comment.
7. Cloud automation triggers again from that comment and applies fixes.
8. Repeat until no actionable feedback remains and CI is green.
9. You merge manually.

---

## 5) Definition of done

A PR is loop-complete when all are true:

- No unresolved actionable review comments remain.
- CI checks are green.
- GitHub reports `mergeable: MERGEABLE` and no merge conflicts with base.
- Branch includes latest `origin/main` (or documents why not).
- Requested scope is fully implemented and documented.
- Tests relevant to touched behavior exist and pass.
- Out-of-scope suggestions are captured as follow-up issues/loops.
