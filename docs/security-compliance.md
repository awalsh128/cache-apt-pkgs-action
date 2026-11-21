# Security Compliance

This is a composite action. It runs Bash scripts and a small Go helper (`apt_query`), committed as prebuilt binaries for x86 and arm64, on the runner. It uses `sudo` to install packages. Consumers don't need to install anything else.

For workflows with stricter compliance requirements, the main security characteristics are:

- `packages` should be treated as an allowlisted input in your workflow. Prefer explicit package names and versions where reproducibility matters.
- `version` can be used as a cache namespace so you can intentionally rotate caches when package policy or runner baselines change.
- `empty_packages_behavior` can be left at the default `error` to fail closed when an expected package list is missing.
- `execute_install_scripts` is disabled by default. Enable it only when required, because Debian maintainer scripts run arbitrary package-provided shell logic during restore.
- `debug` is disabled by default. When enabled, logs are uploaded as a workflow artifact. Review them before sharing outside your organization.
- `add-repository` adds third-party APT sources to the runner. Only add repositories you trust.
- On a cache miss, if `apt-fast` isn't already on the runner, the action downloads and runs its install script from the [apt-fast](https://github.com/ilikenwf/apt-fast) repository.

## Features

Security-relevant action features:

- Package inputs are normalized and sorted before cache lookup, which reduces accidental cache divergence from ordering or duplicate whitespace in the package list.
- Unpinned package names are resolved to concrete package versions before the cache key is generated, which improves traceability of what was actually cached for a run.
- Cache keys are derived from the normalized package set, the user-provided `version`, the added repositories and the runner architecture, which helps isolate caches across package changes and incompatible platforms.
- The action rejects invalid boolean inputs, `version` values containing spaces and repository values with invalid characters.
- Actions that this action depends on (`actions/cache`, `actions/upload-artifact`) are pinned to full commit SHAs.
- The `package-version-list` and `all-package-version-list` outputs can be captured by downstream workflow steps for audit logs, attestation inputs, or compliance reporting.

## Usage Recommendations

For GitHub Actions workflow hardening, prefer the following controls around this action:

- Pin this action to a release tag you trust, or to a full commit SHA for stricter supply chain control.
- Use the minimum required workflow `permissions` instead of broad defaults.
- Run on GitHub-hosted or otherwise trusted runners with controlled APT sources.
- Limit who can modify workflow files and package lists through branch protection and pull request review.
- Review whether cached APT contents are acceptable for your repository's cache retention policy and data handling requirements.

Example hardened usage:

```yaml
permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
      - uses: awalsh128/cache-apt-pkgs-action@v1.6.3
        with:
          packages: curl=8.5.0-2ubuntu10.6 jq=1.7.1-3build1
          version: ubuntu-24.04-v1
          empty_packages_behavior: error
          execute_install_scripts: false
```

