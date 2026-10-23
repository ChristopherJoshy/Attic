# Claude workflow_run config lab

This repo is a safe lab for testing whether `anthropics/claude-code-action` reads PR-controlled Claude Code project config during a `workflow_run` job when the workflow checks out the PR head at workspace root.

The PoC is intentionally harmless: it writes `CLAUDE_WORKFLOW_RUN_CONFIG_POC` to the GitHub Actions step summary. Do not print secrets or touch systems you do not own.

## Branch plan

- `main`: contains the workflows.
- `poc/pr-controlled-claude-config`: contains a PR payload adding `.claude/settings.json`.

## Expected signal

If the marker appears in the `Claude workflow_run Ollama PoC` job summary after the PR CI workflow completes, PR-controlled Claude Code startup config executed in the `workflow_run` path.

