# AGENT PROFILE

You are an expert developer focused on TypeScript, Bash, DevOps, Git, and GitHub Actions.

## Read In Order

1. `Section 0` for always-on rules.
2. `Section 1` for code changes.
3. `Section 2` for tests.
4. `Section 3` for CI/CD and release work.
5. `Section 4` for repo-specific paths and commands.
6. `Section 5` before touching APT, dpkg, or package-name logic.
7. `Section 6` before a dependency bump, a breaking change, or a Node, `@actions/core` or `winston` upgrade.

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
- Treat `main-2` as the stable v2 release branch and `staging-2` as the v2 prerelease branch.
- NEVER change `master`; it is frozen for v1.
- Flow: PR to `staging-2` (squash, Conventional Commit title), `promote.yml` fast-forwards `main-2` and `release.yml` publishes once; merges to `staging-2` never release.
- NEVER commit to `main-2` or `staging-2` directly; releases never commit to a branch.
- Use `pr.yml` and `scripts/ops/pr_checks.mts` to enforce branch policy and workflow pinning.
- Use `release.yml` and semantic-release for publishing; the tag points at a detached commit that carries `dist/`.
- Keep release automation compatible with the Octo STS app bypass on the `main-2` and release tag rulesets (`.github/rulesets/`).

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
- `package.json` pins ts-apt to an exact npm version (e.g. `1.1.1`, never a range); local ts-apt changes are not visible to CI.
- MUST release the ts-apt change to npm first, then bump the ts-apt version pin in the same change that uses it.
- A full commit SHA pin (`git+https://...#<sha>`) is allowed only for a pushed but unreleased ts-apt change; replace it with the npm version once released.
- NEVER push action code that depends on an unpushed ts-apt change.
- `npm run check:deps-pin` enforces the pin; it runs in CI and in the husky `.husky/pre-push` hook installed by `npm install`.
- NEVER bypass the pre-push hook with `--no-verify`; unlink ts-apt instead.

## 6) Owned Dependency Chain

These `awalsh128` repos depend on each other. Check this chain before a breaking change, a major release, or a Node, `@actions/core` or `winston` upgrade.

| Repo                                                 | Ships                                                                                            | Depends on (owned)                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `winston-host-adapters`                              | npm: `@awalsh128/winston-host`, `@awalsh128/winston-github-actions`, `@awalsh128/winston-vscode` | `winston-host` (same workspace); the `npm-publish-strict` action to publish |
| `npm-publish-strict`                                 | GitHub Action                                                                                    | `@awalsh128/winston-github-actions` (caret range, bundled into `dist/`)     |
| `ts-apt`                                             | npm: `ts-apt`                                                                                    | the `npm-publish-strict` action to publish                                  |
| `cache-apt-pkgs-action` (v2 on `staging-2`/`main-2`) | GitHub Action                                                                                    | `ts-apt` (exact version, or a full commit SHA while unreleased)             |

- Code flows `winston-host` → `winston-github-actions` → `npm-publish-strict`, and `ts-apt` → `cache-apt-pkgs-action`.
- Planned: `cache-apt-pkgs-action` switches its logger to `@awalsh128/winston-github-actions` (3.x, exact pin).
- MUST release the upstream change first, then bump the downstream pin in the change that uses it.
- MUST open a follow-up PR in each downstream repo for an upstream major release, and list them in the release PR.
- MUST keep these aligned across the chain: ESM, `@actions/core` 3.x (`winston-github-actions` declares it as a `^3` peer), `winston` 3.x and `winston-transport` 4.x.
- Node: the GitHub Actions side (`npm-publish-strict`, `ts-apt`, `cache-apt-pkgs-action`, `winston-github-actions`) targets Node `>=24` (`node24`). `winston-vscode` runs on the Node that VS Code bundles, so keep `winston-host` free of Node 24-only APIs.
- `npm-publish-strict` and `winston-host-adapters` form a loop. `winston-host-adapters` is held on `npm-publish-strict` `cee67e7` (commented `v1.1.0`, no tag) on purpose: its `publish.yml` releases each workspace package with per-package inputs (`working-directory`, `tag-format`, `commit-paths`, `pin-dependencies`, `dry-run`, `git-credentials`) that later versions removed. A newer action ignores an undeclared input with only a warning, so `dry-run: true` would release for real. Dependabot ignores that action there.
- NEVER bump `winston-host-adapters` to a newer `npm-publish-strict` until that action supports workspace packages again; a change in `npm-publish-strict` must not assume it can upgrade.
- `ts-apt` pins `npm-publish-strict` to a full commit SHA; make it one a release tag points at, with a matching `# vX.Y.Z` comment (`git tag --points-at <sha>`). Its current pin `6b3ccbe` (commented `v1.0.0`) has no tag; `v1.0.0` is `b778d3a`.
- This repo is the end of the chain: before bumping `ts-apt`, check its release notes for changes to the `PackageManager` API and the Node, `@actions/core` and `winston` ranges above.

## Quick Commands

```bash
npx eslint src test scripts --ext .ts,.mts
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.scripts.json --noEmit
npx vitest run
npm run check:pr -- --base-ref staging-2 --head-ref feature/example
```
