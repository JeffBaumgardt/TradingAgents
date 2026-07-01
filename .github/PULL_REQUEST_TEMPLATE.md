## Summary

<!-- What changed and why? -->

## Scope

- [ ] This PR is intentionally scoped to a single feature/bug.
- [ ] Out-of-scope improvements discovered during review should be routed to follow-up issues.
- [ ] Owner plain-English change requests can be treated as in-scope fix-loop input unless marked out-of-scope.

## Testing

<!-- List tests/checks run and outcomes -->

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
