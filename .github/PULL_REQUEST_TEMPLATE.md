## Summary

<!-- What changed and why? -->

## Scope

- [ ] This PR is intentionally scoped to a single feature/bug.
- [ ] Out-of-scope improvements discovered during review should be routed to follow-up issues.
- [ ] Plain-English (non-bot) change requests can be treated as in-scope fix-loop input unless marked out-of-scope.

## Testing

<!-- List tests/checks run and outcomes -->

### Agent loop / CI failure automation

- `pull_request` orchestrator jobs (`kickoff-review-cycle`, `route-loop-events`) run from this PR branch.
- The **CI failure auto-prompt** (`ci-failure-loop-prompt`) uses a `workflow_run` trigger. GitHub evaluates `workflow_run` from the workflow on the **default branch** (`main`), not the PR head.
- Until `.github/workflows/agent-review-loop.yml` is merged to `main`, a failing `CI` run on this PR will **not** post the automatic fix-loop prompt—only normal `pull_request` orchestrator behavior applies.
- After merge to `main`, validate once with an intentional CI failure on a throwaway PR and confirm the **CI failure detected (auto)** comment appears.

## Documentation

- [ ] Code comments and/or docs were updated where behavior changed.

## Reviewer command guide (agent loop)

Use these commands in review comments to trigger automation:

- `/agent-review <optional focus>`
  - Trigger a dedicated reviewer-agent cycle.
- `/agent-fix <optional guidance>`
  - Use for in-scope changes that should be handled in this PR loop.
- `/agent-followup <one-line suggested follow-up prompt>`
  - Use for useful but out-of-scope changes that should spawn a new loop/issue.
- `/agent-ready`
  - Ask the orchestrator to approve if checks are green and review threads are resolved.

Automation note:
- If the `CI` workflow fails on this PR **and** the orchestrator workflow (including `workflow_run`) is already on `main`, the orchestrator auto-posts a fix-loop prompt with failed job links.
- While this PR is still open and the orchestrator change is not yet on `main`, rely on manual `/agent-fix` or reviewer comments for CI failures.
