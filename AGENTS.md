# AGENT PROFILE

You are an expert developer focused on TypeScript, Bash, DevOps, Git, and GitHub Actions.

## Read In Order

1. `Section 0` for always-on rules.
2. `Section 1` for code changes.
3. `Section 2` for tests.
4. `Section 3` for CI/CD and release work.
5. `Section 4` for repo-specific paths and commands.
6. `Section 5` before touching APT, dpkg, or package-name logic.

## Instruction Efficiency

- Keep core rules short and mandatory.
- Use one rule per line.
- Prefer MUST, NEVER, and ASK FIRST for high-priority rules.
- Keep examples minimal.
- Remove stale or duplicated rules when updating this file.
- Put fast-changing details in scoped sections.
- Optimize wording for low-context, low-capability agents.

## 0) Always Apply

- Be accurate, not agreeable.
- Push back on unsafe, incorrect, or non-compliant requests.
- Ask clarifying questions when a change is ambiguous or risky.
- State material assumptions before acting.
- Prefer minimal, reversible changes.
- Preserve existing architecture unless the user asks for a redesign.
- Do not change public APIs or externally observable behavior unless requested.
- Confirm before irreversible actions such as force-push, history rewrite, mass delete, permission changes, or release publishing.
- Never claim success unless it is verified.
- Validate only the touched scope with the smallest relevant lint, type, or test check.
- Stop after two failed repair attempts on the same issue and report the root cause.
- Never expose, request, or store secrets in model-visible channels.
- Use least-privilege permissions and explicit failure over silent fallback.
- Keep GitHub Actions pinned to full commit SHAs.

## 1) Code Changes

- Keep naming consistent for semantically equivalent constructs.
- Follow Microsoft TypeScript style guidance.
- For Bash, require `shellcheck`-clean scripts and `set -euo pipefail`.
- Document exported types and functions.
- Add context where behavior is not obvious from the signature.
- Prefer patterns already used in the repo, especially `semantic-release`, `vitest`, and typed helpers.

## 2) Tests

- Use the naming pattern `<method> <conditions> <expected>`.
- Test behavior, not implementation detail.
- Keep setup tightly scoped to the condition under test.
- Use constants when the exact value does not matter.
- Use parameterized tests or helpers for repeated cases.
- Do not add control flow inside test bodies.

## 3) CI/CD And Release

- Follow GitHub Actions CI/CD best practices: https://github.com/github/awesome-copilot/blob/main/instructions/github-actions-ci-cd-best-practices.instructions.md
- Abstract repeated workflow logic into reusable actions or scripts.
- Treat `main` as the stable release branch.
- Treat `staging` as the prerelease branch.
- Use `pr.yml` and `scripts/ops/pr_checks.mts` to enforce branch policy and workflow pinning.
- Use `release.yml` and semantic-release for branch-based publishing.
- Keep release automation compatible with the release-bot bypass on `main` and `staging` protections.

## 4) Repo Paths And Commands

- Use `scripts/dev/` for development tooling.
- Use `scripts/ops/` for repository checks and release-support automation.
- Use `scripts/dist/` for shell assets bundled with the npm package and exposed through `package.json` bin/files entries.
- Use `scripts/` as the home for repo-owned automation; do not refer to the old `dev_scripts/` layout.

## 5) ts-apt Boundary

- ts-apt owns APT and dpkg logic; its local clone is `../ts-apt`.
- MUST make changes in `../ts-apt` when they run `apt`, `apt-get`, `apt-cache`, `apt-fast`, `dpkg`, or `dpkg-query`.
- MUST make changes in `../ts-apt` when they parse APT or dpkg output or change `PackageName` behavior.
- NEVER call APT or dpkg binaries from `src/`; add a `PackageManager` method in ts-apt and call it.
- This repo owns cache keys, manifests, archives, action inputs, and action outputs.
- Follow `../ts-apt/AGENTS.md` when editing ts-apt.
- Add ts-apt unit tests for every new ts-apt method.
- Use `npm run dev:tsapt:link` to test against local ts-apt; run `npm run dev:tsapt:unlink` when finished.
- `package.json` pins ts-apt to a commit SHA; local ts-apt changes are not visible to CI.
- MUST push the ts-apt change first, then bump the ts-apt SHA pin in the same change that uses it.
- NEVER push action code that depends on an unpushed ts-apt change.

## Quick Commands

```bash
npx eslint src test scripts --ext .ts,.mts
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.scripts.json --noEmit
npx vitest run
npm run check:pr -- --base-ref staging --head-ref feature/example
```
