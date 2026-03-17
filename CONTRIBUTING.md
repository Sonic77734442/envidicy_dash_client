# Contributing

## Branching Model

- `main`: production-ready code only.
- `develop`: integration branch for tested changes.
- `feature/<ticket>-<slug>`: new functionality.
- `fix/<ticket>-<slug>`: bug fixes.
- `hotfix/<ticket>-<slug>`: urgent production fixes.
- `chore/<ticket>-<slug>`: infra, refactors, maintenance.

Examples:

- `feature/241-account-visual-filters`
- `fix/312-google-token-refresh`
- `hotfix/400-topup-502`

## Commit Convention

Use Conventional Commits:

- `feat: ...`
- `fix: ...`
- `chore: ...`
- `refactor: ...`
- `docs: ...`
- `test: ...`

Examples:

- `feat: add account filters to visualization panel`
- `fix: correct topup totals in KZT`

## Workflow

1. Start from `develop`.
2. Create task branch:
   - `git checkout develop`
   - `git pull`
   - `git checkout -b <feature|fix|hotfix|chore>/<ticket>-<slug>`
3. Implement, test, commit.
4. Push branch and open PR into `develop`.
5. After acceptance, merge into `develop`.
6. Release: merge `develop` into `main`, create release tag.

## Pull Request Checklist

- [ ] Branch name follows convention.
- [ ] Commit messages follow convention.
- [ ] No secrets or tokens in code, logs, or diffs.
- [ ] `.env.example` updated if new env vars were added.
- [ ] Relevant tests were run locally.
- [ ] Manual verification steps are described in PR.

## Release Tags

Use semantic tags on `main` only:

- `vMAJOR.MINOR.PATCH`
- Example: `v1.8.2`
