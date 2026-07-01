## Summary

<!-- What changed and why? -->

## Scope

- [ ] This PR is intentionally scoped to a single feature/bug.
- [ ] Out-of-scope improvements discovered during review should be routed to follow-up issues.
- [ ] Agent follow-up work stayed in scope for this PR.

## Testing

<!-- List tests/checks run and outcomes -->

## Documentation

- [ ] Code comments and/or docs were updated where behavior changed.

## Agent loop kickoff guide

Loop automation behavior:

- On PR open, the orchestrator posts one kickoff review comment.
- On CI failure for this PR, the orchestrator posts one fix-loop follow-up comment with failed job links.
- The cloud automation should trigger from those comments and run the next agent cycle.
