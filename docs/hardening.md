# Hardening

How to run [Cache APT Packages](../README.md) in a workflow with stricter compliance or supply chain requirements.

## What the action is

It is a JavaScript action on the `node24` runtime, so your workflow does not run `npm install` to use it. The runtime packages it declares in `package.json` are `@actions/artifact`, `@actions/cache`, `@actions/core`, `ts-apt`, `winston` and `winston-transport`.

## Inputs that matter

- `packages` should be an allowlist in your workflow. Prefer explicit names and versions (e.g. `curl=8.5.0-2ubuntu10.6`) when reproducibility matters.
- `version` is a cache namespace. Change it to rotate the caches on purpose (e.g. after a package policy or runner image change).
- `empty_packages_behavior` stays at `error`. An empty `packages` fails the action.
- `execute_install_scripts` is off by default. Turn it on only when you need it, because a Debian maintainer script runs arbitrary shell from the package during a restore.
- `debug` is off by default. Turn it on to investigate, and review the logs before you share them outside your organization.

## What the action does with them

- It normalizes the package list before the cache lookup, so a different order, commas, backslashes or extra whitespace give the same cache.
- The cache key comes from the normalized package list, the `version` label and the runner architecture. That keeps caches apart across package changes and incompatible platforms. The key uses the names as you wrote them, so an unpinned name keeps its cache until you change `version`.
- It rejects an invalid value for a boolean input.
- It archives only the files and symlinks that exist for each installed package, plus the maintainer scripts when present, and it records a manifest of what it archived.
- The `package-version-list` and `all-package-version-list` outputs give you the exact installed versions. Capture them in a later step for audit logs, attestation inputs or compliance reports.

## Controls to put around it

- Pin the action to an exact release (e.g. `v2.0.0`) or, for stricter supply chain control, to a full commit SHA. The floating `v2` tag moves on each stable release, so don't use it here.
- Set the minimum `permissions` your job needs, instead of the broad defaults.
- Run on GitHub-hosted or otherwise trusted runners, with APT sources you control.
- Limit who can change workflow files and package lists, with branch protection and pull request review.
- Check that cached APT contents are acceptable under your cache retention and data handling rules.

## Example

```yaml
permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: awalsh128/cache-apt-pkgs-action@v2.0.0
        with:
          packages: curl=8.5.0-2ubuntu10.6 jq=1.7.1-3build1
          version: ubuntu-24.04-v1
          empty_packages_behavior: error
          execute_install_scripts: false
```
