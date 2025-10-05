# Cache APT Packages Action

[![CI](https://github.com/awalsh128/cache-apt-pkgs-action/actions/workflows/ci.yml/badge.svg?branch=dev-v2.0)](https://github.com/awalsh128/cache-apt-pkgs-action/actions/workflows/ci.yml?query=branch%3Adev-v2.0)
[![Go Report Card](https://goreportcard.com/badge/github.com/awalsh128/cache-apt-pkgs-action)](https://goreportcard.com/report/github.com/awalsh128/cache-apt-pkgs-action)
[![Go Reference](https://pkg.go.dev/badge/github.com/awalsh128/cache-apt-pkgs-action.svg)](https://pkg.go.dev/github.com/awalsh128/cache-apt-pkgs-action)
[![License](https://img.shields.io/github/license/awalsh128/cache-apt-pkgs-action)](https://github.com/awalsh128/cache-apt-pkgs-action/blob/dev-v2.0/LICENSE)
[![Release](https://img.shields.io/github/v/release/awalsh128/cache-apt-pkgs-action)](https://github.com/awalsh128/cache-apt-pkgs-action/releases)

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Cache APT Packages Action](#cache-apt-packages-action)
  - [🚀 Quick Start](#-quick-start)
  - [✨ Features](#-features)
  - [📋 Requirements](#-requirements)
  - [🔧 Configuration](#-configuration)
    - [Inputs](#inputs)
    - [Outputs](#outputs)
  - [📝 Usage Guide](#-usage-guide)
    - [Version Selection](#version-selection)
    - [Basic Example](#basic-example)
    - [Advanced Example](#advanced-example)
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
  - [🌟 Acknowledgements](#-acknowledgements)
    - [Getting Started](#getting-started)
      - [Workflow Setup](#workflow-setup)
      - [Detailed Configuration](#detailed-configuration)
        - [Input Parameters](#input-parameters)
        - [Output Values](#output-values)
    - [Cache scopes](#cache-scopes)
    - [Example workflows](#example-workflows)
      - [Build and Deploy `Doxygen` Documentation](#build-and-deploy-doxygen-documentation)
      - [Simple Package Installation](#simple-package-installation)
  - [Caveats](#caveats)
    - [Edge Cases](#edge-cases)
    - [Non-file Dependencies](#non-file-dependencies)
    - [Cache Limits](#cache-limits)

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

> ⚠️ Starting with this release, the action enforces immutable references.
> Workflows must pin `awalsh128/cache-apt-pkgs-action` to a release tag or
> commit SHA. Referencing a branch (for example `@main`) will now fail during
> the `setup` step. For more information on blocking and SHA pinning actions,
> see the
> [announcement on the GitHub changelog](https://github.blog/changelog/2025-08-15-github-actions-policy-now-supports-blocking-and-sha-pinning-actions).

Recommended options:

- `@v2` or any other published release tag.
- A full commit SHA such as `@4f5c863ba5ce9f1784c8ad7d8f63a9cfd3f1ab2c`.

Avoid floating references such as `@latest`, `@master`, or `@dev`. The action
will refuse to run when a branch reference is detected to protect consumers from
involuntary updates.

### Basic Example

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

### Advanced Example

```yaml
name: Complex Build
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Cache APT Packages
        uses: awalsh128/cache-apt-pkgs-action@v2
        id: apt-cache
        with:
          packages: python3-dev cmake libboost-all-dev
          version: ${{ github.sha }}
          execute_install_scripts: true

      - name: Cache Info
        run: |
          echo "Cache hit: ${{ steps.apt-cache.outputs.cache-hit }}"
          echo "Installed packages: ${{ steps.apt-cache.outputs.package-version-list }}"
```

### Binary Integrity Verification

Every published release bundles precompiled binaries under
`distribute/<runner arch>/cache_apt_pkgs`. Starting with this release the action
verifies the binary against a co-located `.sha256` manifest before execution. If
the checksum does not match the expected value the `setup` step exits with an
error to prevent tampering or incomplete releases.

When preparing a new release:

1. Run `scripts/distribute.sh push` to build architecture-specific binaries.
2. The script now emits a matching `cache-apt-pkgs-linux-<arch>.sha256` file for
   each binary.
3. Copy the binaries and checksum files into `distribute/<arch>/` before
   creating the release artifact.

Workflows do not need to perform any additional setup—the checksum enforcement
is automatic as long as the bundled `.sha256` files accompany the binaries.

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

## 🌟 Acknowledgements

- [actions/cache](https://github.com/actions/cache/) team
- All our
  [contributors](https://github.com/awalsh128/cache-apt-pkgs-action/graphs/contributors)

### Getting Started

#### Workflow Setup

Create a workflow `.yml` file in your repositories `.github/workflows`
directory. [Example workflows](#example-workflows) are available below. For more
information, reference the GitHub Help Documentation for
[Creating a workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

#### Detailed Configuration

##### Input Parameters

- `packages` - Space delimited list of packages to install.
- `version` - Version of cache to load. Each version will have its own cache.
  Note, all characters except spaces are allowed.
- `execute_install_scripts` - Execute Debian package 'preinst' and 'postinst'
  install scripts upon restore. See
  [Caveats / Non-file Dependencies](#non-file-dependencies) for more
  information.

##### Output Values

- `cache-hit` - A `true` or `false` value to indicate a cache was found for the
  packages requested.
- `package-version-list` - The main requested packages and versions that are
  installed. Represented as a comma delimited list with equals delimit on the
  package version (i.e. \<package1>=<version1\>,\<package2>=\<version2>,...).
- `all-package-version-list` - All the pulled in packages and versions,
  including dependencies, that are installed. Represented as a comma delimited
  list with equals delimit on the package version (i.e.
  \<package1>=<version1\>,\<package2>=\<version2>,...).

### Cache scopes

The cache is scoped to:

- Package list and versions
- Branch settings
- Default branch cache (available to other branches)

### Example workflows

Below are some example workflows showing how to use this action.

#### Build and Deploy `Doxygen` Documentation

This example shows how to cache dependencies for building and deploying
`Doxygen` documentation:

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

#### Simple Package Installation

This example shows the minimal configuration needed to cache and install
packages:

```yaml
name: Install Dependencies
jobs:
  install_doxygen_deps:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: awalsh128/cache-apt-pkgs-action@latest
        with:
          packages: dia doxygen doxygen-doc doxygen-gui doxygen-latex graphviz mscgen
          version: 1.0
```

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
