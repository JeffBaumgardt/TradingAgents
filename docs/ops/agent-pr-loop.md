# Agent Pull Request Loop (Cursor + GitHub)

This runbook defines a repeatable agent loop for feature and bug delivery when you are the only human developer and all other contributors are agents:

1. Implementation agent builds from your prompt.
2. Implementation agent documents changes and adds tests.
3. Implementation agent runs checks, fixes failures, opens/updates PR.
4. Reviewer agent(s) review and comment like skilled reviewers.
5. Loop agent processes feedback and updates branch.
6. Out-of-scope comments are routed into follow-up loops.
7. Agent marks PR ready (`/agent-ready`), orchestrator approves if gates pass.
8. You merge manually.

---

## 1) One-time repository setup

1. Keep CI required on pull requests (already present in `.github/workflows/ci.yml`).
2. Add the PR loop orchestrator workflow in this repo:
   - `.github/workflows/agent-review-loop.yml`
3. Add PR reviewer command guidance:
   - `.github/PULL_REQUEST_TEMPLATE.md`
4. Agent command protocol (in PR comments/reviews):
   - `/agent-review <optional focus>` ask reviewer agent(s) to run a review cycle.
   - `/agent-fix <optional guidance>` run an in-scope fix cycle on current PR branch.
   - `/agent-followup <one-line follow-up prompt>` create a new follow-up loop issue.
   - `/agent-ready` request approval gate check and auto-approval by orchestrator.
5. Plain-language shortcut:
   - Non-bot PR comments/reviews that look like work requests are auto-routed into fix prompts (for example, “switch provider from XYZ to ABC and update tests”).
6. Failing CI shortcut:
   - A failed `CI` run on a PR automatically posts a fix-loop prompt with failed job links.

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
9) Provide concise change summary and test evidence.

Rules:
- Prefer existing project patterns/components over introducing new abstractions.
- Use readable, descriptive naming and early returns.
- Keep changes scoped to the request.
- If blocked, explain blocker and best fallback.

Work request:
<PASTE FEATURE OR BUG REQUEST HERE>
```

---

## 3) Review-response loop prompt (generated per comment)

Use this prompt when an actionable review comment exists (or from workflow-generated prompt comments):

```text
You are the PR loop implementation agent.

Target PR: <PR_LINK_OR_NUMBER>
Target review comment: <COMMENT_URL>

Task:
1) Read the PR diff + the referenced review comment.
2) Plan fix in pseudocode before coding.
3) Implement only what is needed to resolve the comment (unless tightly coupled updates are required).
4) Update tests/docs if behavior changed.
5) Run relevant tests/checks; fix any failures.
6) Commit and push.
7) Reply on PR with what changed + test evidence.
8) If complete and no blockers remain, comment `/agent-ready`.

Stop condition:
- If the request is out of scope for this PR, do not force it in. Propose a follow-up loop prompt and link a new issue.
```

---

## 4) Out-of-scope follow-up loop prompt

Use this to start a new loop for review suggestions that should not expand the current PR:

```text
You are the follow-up loop agent.

Background:
- Origin PR: <PR_LINK_OR_NUMBER>
- Origin comment: <COMMENT_URL>
- Reason this is out of scope: <SHORT_REASON>

Task:
1) Convert the suggestion into a scoped implementation plan (pseudocode first).
2) Implement on a new branch.
3) Add/update tests and docs.
4) Run relevant checks and resolve failures.
5) Open a new PR that references the origin PR/comment.

Requested follow-up:
<PASTE SUGGESTION TEXT>
```

---

## 5) Day-to-day operation (owner + agents)

1. Start with the **Primary implementation prompt**.
2. Implementation agent opens/updates PR.
3. Orchestrator auto-posts a reviewer cycle prompt on every PR update.
4. Reviewer agent(s) leave comments/reviews with actionable findings.
5. Loop agent consumes feedback and updates the branch.
6. Plain-English feedback comments are converted into fix-loop prompts automatically.
7. Use `/agent-followup ...` for valuable but out-of-scope feedback.
8. If CI fails, orchestrator also posts an automatic fix prompt for the failure run.
9. After fixes are done, agent posts `/agent-ready`.
10. Orchestrator approves only when:
   - all checks are green, and
   - there are no unresolved review threads.
11. You merge manually.

---

## 6) Definition of done

A PR is loop-complete when all are true:

- No unresolved actionable review comments remain.
- CI checks are green.
- Requested scope is fully implemented and documented.
- Tests relevant to touched behavior exist and pass.
- Any out-of-scope review suggestions are captured as follow-up issue(s)/loop(s).
- PR is approved by the loop orchestrator after `/agent-ready`.
