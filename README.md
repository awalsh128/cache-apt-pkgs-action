<p align="center">
  <img src="logo.png" alt="Cache APT Packages logo" width="128" height="128">
</p>

<h1 align="center">Cache APT Packages</h1>

<p align="center">
  Cache APT packages between GitHub Actions runs, so a run restores them instead of installing them again.
</p>

<p align="center">
  <a href="https://github.com/awalsh128/cache-apt-pkgs-action/actions/workflows/ci.yml?query=branch%3Amain-2"><img src="https://img.shields.io/github/actions/workflow/status/awalsh128/cache-apt-pkgs-action/ci.yml?label=CI%20main-2&branch=main-2" alt="CI main-2"></a>
  <a href="https://codecov.io/gh/awalsh128/cache-apt-pkgs-action/tree/main-2"><img src="https://codecov.io/gh/awalsh128/cache-apt-pkgs-action/branch/main-2/graph/badge.svg" alt="Codecov main-2"></a>
  <a href="https://github.com/awalsh128/cache-apt-pkgs-action/actions/workflows/ci.yml?query=branch%3Astaging-2"><img src="https://img.shields.io/github/actions/workflow/status/awalsh128/cache-apt-pkgs-action/ci.yml?label=CI%20staging-2&branch=staging-2" alt="CI staging-2"></a>
  <a href="https://codecov.io/gh/awalsh128/cache-apt-pkgs-action/tree/staging-2"><img src="https://codecov.io/gh/awalsh128/cache-apt-pkgs-action/branch/staging-2/graph/badge.svg" alt="Codecov staging-2"></a>
</p>

Cache APT packages between workflow runs, so a run restores them from the GitHub Actions cache instead of
installing them again. It is built on
[`@actions/cache`](https://github.com/actions/toolkit/tree/main/packages/cache) and
[ts-apt](https://github.com/awalsh128/ts-apt).

- ⚡ Skips the install on a cache hit and restores the packages from an archive.
- 📦 Caches the dependencies too, so the whole installed set comes back (e.g. `graphviz` and the libraries it
  pulls in).
- 🔑 Keeps one cache for each package list, `version` label and architecture.
- 🧾 Reports the exact installed versions as outputs, for audit logs.
- 🔍 Uploads the logs and manifests as an artifact when `debug` is on.

<!-- prettier-ignore -->
<p align="center">
  <a href="https://github.com/sponsors/awalsh128"><img src="https://img.shields.io/badge/Sponsor-%E2%9D%A4-db61a2?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="Sponsor awalsh128"></a>
</p>

<p align="center">
  Free and open source, and kept up by one person.<br />
  If it saves you time, <a href="https://github.com/sponsors/awalsh128">sponsor it monthly</a> or
  <a href="https://github.com/sponsors/awalsh128?frequency=one-time">leave a small one-time tip</a>. Every bit
  helps.
</p>

<!-- prettier-ignore -->
> [!IMPORTANT]
> v2 has a release candidate (`v2.0.0-rc.1`) and no stable release yet, so the examples use
> `v2.0.0`, the first stable one. Use `@v1` for the released version. The [Version 2 FAQ](V2_FAQ.MD) covers
> what changes.

<!-- prettier-ignore -->
> [!NOTE]
> I'm looking for co-maintainers to help review changes and investigate issues. I haven't had as much
> time for this action as I would like, and I want it to stay responsive for the community. Reach out if you
> are interested.

## Quick Start

```yaml
steps:
  - uses: awalsh128/cache-apt-pkgs-action@v2.0.0
    with:
      packages: graphviz doxygen
      version: 1.0
```

Change `version` to start a fresh cache (e.g. after a runner image change).

## Requirements

A Linux runner with APT (e.g. GitHub-hosted `ubuntu-latest`). The action runs on `node24`, so self-hosted
runners need a runner version that supports it. GitHub-hosted runners already do.

## Configuration

### Inputs

| Name                      | Description                                                                                                                       | Required | Default |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| `packages`                | Space delimited list of packages to install. Pin a version with APT syntax (e.g. `xdot=1.2-2`).                                   | Yes      |         |
| `version`                 | Cache version label. Each label has its own cache, so change it to start a fresh one. It can't contain spaces.                    | No       | `""`    |
| `execute_install_scripts` | Run each package's `preinst` and `postinst` script after a restore. See [Non-file dependencies](#non-file-dependencies).          | No       | `false` |
| `empty_packages_behavior` | What to do when `packages` is empty: `error` fails the action, `warn` logs a warning and skips, `ignore` skips quietly.           | No       | `error` |
| `debug`                   | Log more detail and upload the logs and manifests as a workflow artifact (a failed run uploads them anyway). Costs a little time. | No       | `false` |

### Outputs

| Name                       | Description                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cache-hit`                | `true` when a cache was found for the packages requested.                                                                                                                             |
| `package-version-list`     | The requested packages and the versions installed, as a sorted comma list (e.g. `curl=8.5.0,jq=1.7.1`). A package for a non-native architecture includes it (e.g. `libc6:i386=2.39`). |
| `all-package-version-list` | The same format for every package installed, dependencies included.                                                                                                                   |

## Versions

- `@v2` is the latest stable v2 release. It moves on each stable release, and it is the only tag that ever
  moves.
- `@v#.#.#` is an exact release (e.g. `v2.0.0`). It never changes once published. Release candidates, cut from
  `staging-2` after CI passes, are tagged `v#.#.#-rc.#` and may be unstable. `@v2` never points at one.
- A full commit SHA pins the exact code and is the safest choice.

A tag that moves lets a compromised release change what your workflow runs. If that matters to you, pin an
exact release or a commit SHA instead of `@v2`. `@latest` and `@v1` are moving tags too, and they only point
at v1.

Version 1 is maintained on the frozen `master` branch. Version 2 is released from tags only. The `main-2` and
`staging-2` branches hold source without the built `dist/`, so do not use them as `uses:` refs.

## Cache scopes

The cache is scoped to the packages given and the ref that saved it. A run can restore caches from its own
branch or tag and from the default branch. Tags do not share caches with each other, so a workflow that only
runs on tag pushes (e.g. releases) misses every time. To share a cache across tags, run the action with the
same `packages` and `version` on the default branch (e.g. on push or on a `schedule`).

GitHub evicts the oldest caches when a repository goes over its storage limit (10 GB by default), and any
cache that goes a week without being used. A large package set (e.g. `texlive-full`) can be evicted before the
next run. See
[Managing caches](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#viewing-cache-entries)
to inspect yours.

## Example workflow

This was the motivating use case for the action.

```yaml
name: Create Documentation
on: push
jobs:
  build_and_deploy_docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: awalsh128/cache-apt-pkgs-action@v2.0.0
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

For stricter setups (e.g. pinned package versions or minimal permissions), see [Hardening](docs/hardening.md).

## ⚠️ Caveats

### Non-file dependencies

The action caches a package as a set of files. Some packages need more than that after the files are back.

- A restore only extracts files. Two things that `apt install` does afterwards are handled for you:
  - The action registers again the `update-alternatives` entries each package created (e.g.
    `/usr/bin/identify`), see [#260](https://github.com/awalsh128/cache-apt-pkgs-action/issues/260).
  - It runs `ldconfig` once after extracting, so libraries in directories registered through
    `/etc/ld.so.conf.d` are found.
- The Debian package database is not updated, so `dpkg -s` reports a restored package as not installed. Other
  triggers do not run either. A command or library that depends on those can be missing. Issue
  [#259](https://github.com/awalsh128/cache-apt-pkgs-action/issues/259) tracks this.
- Pre and post install scripts live in `/var/lib/dpkg/info/<package>.preinst` and `.postinst`.

Set `execute_install_scripts` to run those scripts after each package is extracted. It covers the cases where
a maintainer script creates what is missing, but it can't promise a fix.

```yaml
- uses: awalsh128/cache-apt-pkgs-action@v2.0.0
  with:
    packages: mypackage
    version: 1.0
    execute_install_scripts: true
```

If that doesn't fix it, install that package in its own step:

```yaml
- run: sudo apt-get install -y mypackage
  shell: bash
```

This action can't reverse engineer the Debian package manager. That would be out of scope and brittle, and at
that point it is better to contribute to Debian packaging. If you find a workaround that generalizes, please
reach out. [Issue #57](https://github.com/awalsh128/cache-apt-pkgs-action/issues/57#issuecomment-1321024283)
has the original investigation.

### Runner image changes

The cache key doesn't include the runner image. Only the packages you request are archived, so a pre-installed
dependency of one of them (e.g. `libwayland-server0` for GTK and WebKit packages) is in neither the cache nor
the manifest. If a later image drops that dependency, a hit on the old cache restores files that need a
library the runner no longer has. The job then fails with an error like
`error while loading shared libraries: libwayland-server.so.0: cannot open shared object file`, and it can
look intermittent because it follows the image the job lands on. Issue
[#187](https://github.com/awalsh128/cache-apt-pkgs-action/issues/187) tracks this.

To avoid this, put the image into `version` so a new image is a cache miss. The variables come from the runner
environment, not the workflow `env` context, so `${{ env.ImageVersion }}` is empty unless you export it first:

```yaml
- name: Export runner image version
  run: |
    echo "ImageOS=${ImageOS}" >> "$GITHUB_ENV"
    echo "ImageVersion=${ImageVersion}" >> "$GITHUB_ENV"
  shell: bash
- uses: awalsh128/cache-apt-pkgs-action@v2.0.0
  with:
    packages: mypackage
    version: 1.0-${{ env.ImageOS }}-${{ env.ImageVersion }}
```

The trade-off is a cold cache on every image rotation. `ImageOS` alone isn't enough, because pre-installed
packages can change between image versions of the same OS. Only GitHub-hosted runners set these variables.

### Stalled mirrors

On a cache miss the action installs with `apt`, so it is as fast as the mirror `apt` uses. GitHub-hosted
Ubuntu runners try `azure.archive.ubuntu.com` first, and it sometimes stalls a package download for minutes
(we saw 2 to 4 minutes, and 15 or more in a few runs). It hits some jobs on some days, whatever the package or
the tool running `apt`. Plain `apt-get` runs and the v1 action's own CI showed the same stalls. A cache hit
doesn't download packages, so it is not affected.

In a run of 36 identical jobs, 4 of 12 stalled on the default mirror and none of 12 stalled on
`archive.ubuntu.com`. Retrying and shorter `apt` timeouts didn't help, because a stalled job stays stalled. If
your cache misses stall, point `apt` at `archive.ubuntu.com` in a step before this action:

```yaml
- name: Use archive.ubuntu.com
  run:
    sudo sed -i 's#mirror+file:/etc/apt/apt-mirrors.txt#http://archive.ubuntu.com/ubuntu/#'
    /etc/apt/sources.list.d/ubuntu.sources
  shell: bash
- uses: awalsh128/cache-apt-pkgs-action@v2.0.0
  with:
    packages: mypackage
    version: 1.0
```

This rewrites the runner's `apt` sources for the rest of the job, and it only matches the layout of the
current `ubuntu-24.04` image (check with `grep URIs /etc/apt/sources.list.d/ubuntu.sources` if yours differs).
The action never changes your sources itself.

See [CONTRIBUTING.md](CONTRIBUTING.md) if you want to help.
