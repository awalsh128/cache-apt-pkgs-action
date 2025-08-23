---
name: Bug Report
about: Create a report to help us improve or fix the action
title: "[BUG] "
labels: bug
assignees: 'awalsh128'

---

> **Note**: Please read about the limitation of [non-file dependencies](https://github.com/awalsh128/cache-apt-pkgs-action/blob/master/README.md#non-file-dependencies) before filing an issue.

## Description

A clear and concise description of what the bug is.

## Steps to Reproduce

### 1. Workflow Configuration

```yaml
# Replace with your workflow
```

### 2. Package List

```plaintext
# List your packages here
```

### 3. Environment Details

- Runner OS: [e.g., Ubuntu 22.04]
- Action version: [e.g., v2.0.0]

## Expected Behavior

A clear and concise description of what you expected to happen.

## Actual Behavior

What actually happened? Please include:

- Error messages
- Action logs
- Cache status (hit/miss)

## Debug Information

If possible, please run the action with debug mode enabled:

```yaml
with:
  debug: true
```

And provide the debug output.

## Additional Context

- Are you using any specific package versions?
- Are there any special package configurations?
- Does the issue happen consistently or intermittently?
- Have you tried clearing the cache and retrying?
