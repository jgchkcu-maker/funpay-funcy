# Execution Runbook

## Per-task protocol

1. Checkout a clean branch.
2. Read `AGENT_CONTRACT.md`.
3. Give the agent one task only.
4. Require a pre-edit summary of current flow.
5. Let the agent implement.
6. Review diff for out-of-scope changes.
7. Run:
   - `node tests/t11_hardening.test.js`
   - task-specific tests
8. Manually inspect changed call-sites.
9. Commit only if acceptance criteria pass.

## Suggested branch naming

- `finance/t01-atomic-update`
- `finance/t02-update-contract`
- ...
- `finance/t14-final-audit`

## Reject a task if

- unrelated files are changed without justification;
- the agent “fixes” later tasks early;
- `lastUpdate` still advances on failure;
- old finance data can be lost on failed refresh;
- a new hardcoded FX rate is added;
- new status aliases are invented instead of using parser truth;
- UI success notification is emitted without checking real results;
- new export code duplicates existing Export Studio functionality;
- tests were not run.

## Commit discipline

Prefer one commit per task.  
Suggested format:

`finance(T03): fix refresh orchestration`

This makes regression bisection substantially easier.
