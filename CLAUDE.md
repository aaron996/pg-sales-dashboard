# Git Workflow

## Branch policy
- **Never push directly to `main`.**
- For every task or set of changes, create a new feature branch off `main`:
  ```
  git checkout main && git pull origin main
  git checkout -b <descriptive-branch-name>
  ```
- Branch naming: `feat/`, `fix/`, `chore/` prefix + short kebab-case description.
  Examples: `feat/export-type-picker`, `fix/sticky-header-combined-pill`
- Push the branch to `origin` with `-u`, then open a PR to `main`.
- Do **not** merge to `main` unless the user explicitly asks.
