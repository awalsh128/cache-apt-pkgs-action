---
name: Bug Report
about: Create a report to help us improve or fix the action
title: "[BUG] "
labels: bug
assignees: awalsh128
---

## Bug Description

A clear and concise description of what the bug is.

## Reproduction Steps

### Workflow Configuration

```yaml
# Paste your workflow configuration here
steps:
  - name: Cache apt packages
    uses: awalsh128/cache-apt-pkgs-action@latest
    with:
      packages: # your packages
      version: 1.0
```

### Package List

```txt
# List the packages you're trying to cache
# Example: curl wget git
```

### Environment

- **Runner OS**: (e.g., ubuntu-22.04, ubuntu-20.04)
- **Action version**: (e.g., v1.4.2, latest)
- **Repository**: (if relevant)

## Expected vs Actual Behavior

**Expected**: What you expected to happen

**Actual**: What actually happened

## Logs and Error Messages

```txt
# Paste relevant logs, error messages, or debug output here
# Enable debug mode by adding: debug: true to your workflow step
```

## Cache Status

- [ ] Cache hit
- [ ] Cache miss
- [ ] Cache creation failed
- [ ] Other (please specify)

## Additional Information

- Does this happen consistently or intermittently?
- Have you tried clearing the cache?
- Are you using any specific package versions or configurations?
- Any relevant system dependencies?

## Checklist

- [ ] I have read the [non-file dependencies limitation](https://github.com/awalsh128/cache-apt-pkgs-action/blob/master/README.md#non-file-dependencies)
- [ ] I have searched existing issues for duplicates
- [ ] I have provided all requested information above
