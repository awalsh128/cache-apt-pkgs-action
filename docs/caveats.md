# ⚠️ Caveats

Things that can surprise you when a package comes back from the cache.

## Non-file dependencies

The action caches a package as a set of files. Some packages need more than that after the files are back.

- A restore only extracts files. Two things that `apt install` does afterwards are handled for you:
  - The action registers again the `update-alternatives` entries each package created (e.g.
    `/usr/bin/identify`), see [#260](https://github.com/awalsh128/cache-apt-pkgs-action/issues/260).
  - It runs `ldconfig` once after extracting, so libraries in directories registered through
    `/etc/ld.so.conf.d` are found.
- The Debian package database is not updated, so `dpkg -s` reports a restored package as not installed. Other
  triggers do not run either. A command or library that depends on those can be missing. I don't plan to
  change this unless it breaks something for someone. If it does for you, please comment on
  [#259](https://github.com/awalsh128/cache-apt-pkgs-action/issues/259) with the package and a link to the
  run.
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

## Runner image changes

The cache key doesn't include the runner image. Only the packages you request are archived, so a pre-installed
dependency of one of them (e.g. `libwayland-server0` for GTK and WebKit packages) is in neither the cache nor
the manifest. If a later image drops that dependency, a hit on the old cache restores files that need a
library the runner no longer has. The job then fails with an error like
`error while loading shared libraries: libwayland-server.so.0: cannot open shared object file`, and it can
look intermittent because it follows the image the job lands on. Issue
[#187](https://github.com/awalsh128/cache-apt-pkgs-action/issues/187) has the background, and why v2 doesn't
key the cache on the image.

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

## Stalled mirrors

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
