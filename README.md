# Cache APT Packages Action

[![CI](https://github.com/awalsh128/cache-apt-pkgs-action/actions/workflows/ci.yml/badge.svg?branch=dev-v2.0)](https://github.com/awalsh128/cache-apt-pkgs-action/actions/workflows/ci.yml?query=branch%3Adev-v2.0)
[![Go Report Card](https://goreportcard.com/badge/github.com/awalsh128/cache-apt-pkgs-action)](https://goreportcard.com/report/github.com/awalsh128/cache-apt-pkgs-action)
[![Go Reference](https://pkg.go.dev/badge/github.com/awalsh128/cache-apt-pkgs-action.svg)](https://pkg.go.dev/github.com/awalsh128/cache-apt-pkgs-action)
[![License](https://img.shields.io/github/license/awalsh128/cache-apt-pkgs-action)](https://github.com/awalsh128/cache-apt-pkgs-action/blob/dev-v2.0/LICENSE)
[![Release](https://img.shields.io/github/v/release/awalsh128/cache-apt-pkgs-action)](https://github.com/awalsh128/cache-apt-pkgs-action/releases)

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [🚀 Quick Start](#-quick-start)
- [✨ Features](#-features)
- [📋 Requirements](#-requirements)
- [🔧 Configuration](#-configuration)
  - [Inputs](#inputs)
  - [Outputs](#outputs)
- [📝 Usage Guide](#-usage-guide)
  - [Version Selection](#version-selection)
  - [Example Workflows](#example-workflows)
- [🔍 Cache Details](#-cache-details)
  - [Cache Scoping](#cache-scoping)
  - [Cache Keys](#cache-keys)
  - [Cache Invalidation](#cache-invalidation)
- [🚨 Common Issues](#-common-issues)
  - [Permission Issues](#permission-issues)
  - [Missing Dependencies](#missing-dependencies)
  - [Cache Misses](#cache-misses)
- [🤝 Contributing](#-contributing)
- [📜 License](#-license)
- [Caveats](#caveats)
  - [Edge Cases](#edge-cases)
  - [Non-file Dependencies](#non-file-dependencies)
  - [Cache Limits](#cache-limits)
- [🌟 Acknowledgements](#-acknowledgements)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

Speed up your GitHub Actions workflows by caching APT package dependencies. This
action integrates with [actions/cache](https://github.com/actions/cache/) to
provide efficient package caching, significantly reducing workflow execution
time by avoiding repeated package installations.

> **Important:** We're looking for co-maintainers to help review changes and
> investigate issues. If you're interested in contributing to this project,
> please reach out.

## 🚀 Quick Start

```yaml
steps:
  - name: Cache APT Packages
    uses: awalsh128/cache-apt-pkgs-action@v2
    with:
      packages: python3-dev cmake
      version: 1.0
```

## ✨ Features

- 📦 Efficient APT package caching
- 🔄 Automatic dependency resolution
- 🔍 Smart cache invalidation
- 📊 Detailed cache statistics
- 🛠️ Pre/post install script support

## 📋 Requirements

- GitHub Actions runner with APT support (Ubuntu/Debian)
- Workflow permissions to read/write caches
- Sufficient storage space for package caching

## 🔧 Configuration

### Inputs

| Name                      | Description                      | Required | Default  |
| ------------------------- | -------------------------------- | -------- | -------- |
| `packages`                | Space-delimited list of packages | Yes      | -        |
| `version`                 | Cache version identifier         | No       | `latest` |
| `execute_install_scripts` | Run package install scripts      | No       | `false`  |

### Outputs

| Name                       | Description                              |
| -------------------------- | ---------------------------------------- |
| `cache-hit`                | Whether cache was found (`true`/`false`) |
| `package-version-list`     | Main packages and versions installed     |
| `all-package-version-list` | All packages including dependencies      |

## 📝 Usage Guide

### Version Selection

> ⚠️ The action enforces immutable references. Workflows must pin
> `awalsh128/cache-apt-pkgs-action` to a release tag or commit SHA. Referencing
> a branch (for example `@main`) will now fail during the `setup` step. For more
> information on blocking and SHA pinning actions, see the
> [announcement on the GitHub changelog](https://github.blog/changelog/2025-08-15-github-actions-policy-now-supports-blocking-and-sha-pinning-actions).

Recommended options:

- `@v2` or any other published release tag.
- A full commit SHA such as `@4f5c863ba5ce9f1784c8ad7d8f63a9cfd3f1ab2c`.

Avoid floating references such as `@latest`, `@master`, or `@dev`. The action
will refuse to run when a branch reference is detected to protect consumers from
involuntary updates.

### Example Workflows

Install a set of packages and build your code.

```yaml
name: Build
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Cache APT Packages
        uses: awalsh128/cache-apt-pkgs-action@v2
        with:
          packages: python3-dev cmake
          version: 1.0

      - name: Build Project
        run: |
          cmake .
          make
```

Install `Doxygen` dependencies for building and deploying documentation.

```yaml
name: Create Documentation
on: push
jobs:
  build_and_deploy_docs:
    runs-on: ubuntu-latest
    name: Build Doxygen documentation and deploy
    steps:
      - uses: actions/checkout@v4
      - uses: awalsh128/cache-apt-pkgs-action@latest
        with:
          packages: dia doxygen doxygen-doc doxygen-gui doxygen-latex graphviz mscgen
          version: 1.0

      - name: Build
        run: |
          cmake -B ${{github.workspace}}/build -DCMAKE_BUILD_TYPE=${{env.BUILD_TYPE}}
          cmake --build ${{github.workspace}}/build --config ${{env.BUILD_TYPE}}

      - name: Deploy
        uses: JamesIves/github-pages-deploy-action@4.1.5
        with:
          branch: gh-pages
          folder: ${{github.workspace}}/build/website
```

## 🔍 Cache Details

### Cache Scoping

Caches are scoped by:

- Package list
- Version string
- Branch (default branch cache available to other branches)

### Cache Keys

The action generates cache keys based on:

- Package names and versions
- System architecture
- Custom version string

### Cache Invalidation

Caches are invalidated when:

- Package versions change
- Custom version string changes
- Branch cache is cleared

## 🚨 Common Issues

### Permission Issues

```yaml
permissions:
  actions: read|write # Required for cache operations
```

### Missing Dependencies

- Ensure all required packages are listed
- Check package names are correct
- Verify package availability in repositories

### Cache Misses

- Check version string consistency
- Verify branch cache settings
- Ensure sufficient cache storage

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md)
for details.

## 📜 License

This project is licensed under the Apache License 2.0 - see the
[LICENSE](LICENSE) file for details.

## Caveats

### Edge Cases

This action is able to speed up installs by skipping the number of steps that
`apt` uses.

- This means there will be certain cases that it may not be able to handle like
  state management of other file configurations outside the package scope.
- In cases that can't be immediately addressed or run counter to the approach of
  this action, the packages affected should go into their own action `step` and
  using the normal `apt` utility.

### Non-file Dependencies

This action is based on the principle that most packages can be cached as a set
of files. There are situations though where this is not enough.

- Pre and post installation scripts need to be run from
  `/var/lib/dpkg/info/{package name}.[preinst, postinst]`.
- The Debian package database needs to be queried for scripts above (i.e.
  `dpkg-query`).

The `execute_install_scripts` argument can be used to attempt to execute the
install scripts but they are no guaranteed to resolve the issue.

```yaml
- uses: awalsh128/cache-apt-pkgs-action@latest
  with:
    packages: mypackage
    version: 1.0
    execute_install_scripts: true
```

If this does not solve your issue, you will need to run `apt-get install` as a
separate step for that particular package unfortunately.

```yaml
run: apt-get install mypackage
shell: bash
```

Please reach out if you have found a workaround for your scenario and it can be
generalized. There is only so much this action can do and can't get into the
area of reverse engineering Debian package manager. It would be beyond the scope
of this action and may result in a lot of extended support and brittleness.
Also, it would be better to contribute to Debian packager instead at that point.

For more context and information see
[issue #57](https://github.com/awalsh128/cache-apt-pkgs-action/issues/57#issuecomment-1321024283)
which contains the investigation and conclusion.

### Cache Limits

A repository can have up to 5GB of caches. Once the 5GB limit is reached, older
caches will be evicted based on when the cache was last accessed. Caches that
are not accessed within the last week will also be evicted. To get more
information on how to access and manage your actions's caches, see
[GitHub Actions / Using workflows / Cache dependencies](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#viewing-cache-entries).

## 🌟 Acknowledgements

- [actions/cache](https://github.com/actions/cache/) team
- All our
  [contributors](https://github.com/awalsh128/cache-apt-pkgs-action/graphs/contributors)
