# cache-apt-pkgs-action

[![CI](https://github.com/awalsh128/cache-apt-pkgs-action/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/awalsh128/cache-apt-pkgs-action/actions/workflows/ci.yml)
[![CI (dev-v2.0)](https://github.com/awalsh128/cache-apt-pkgs-action/actions/workflows/ci.yml/badge.svg?branch=dev-v2.0)](https://github.com/awalsh128/cache-apt-pkgs-action/actions/workflows/ci.yml?query=branch%3Adev-v2.0)
[![Go Report Card](https://goreportcard.com/badge/github.com/awalsh128/cache-apt-pkgs-action)](https://goreportcard.com/report/github.com/awalsh128/cache-apt-pkgs-action)
[![Go Reference](https://pkg.go.dev/badge/github.com/awalsh128/cache-apt-pkgs-action.svg)](https://pkg.go.dev/github.com/awalsh128/cache-apt-pkgs-action)
[![License](https://img.shields.io/github/license/awalsh128/cache-apt-pkgs-action)](https://github.com/awalsh128/cache-apt-pkgs-action/blob/master/LICENSE)
[![Release](https://img.shields.io/github/v/release/awalsh128/cache-apt-pkgs-action)](https://github.com/awalsh128/cache-apt-pkgs-action/releases)

This action allows caching of Advanced Package Tool (APT) package dependencies to improve workflow execution time instead of installing the packages on every run.

> [!IMPORTANT]
> Looking for co-maintainers to help review changes, and investigate issues. I haven't had as much time to stay on top of this action as I would like to and want to make sure it is still responsive and reliable for the community. If you are interested, please reach out.

## Documentation

This action is a composition of [actions/cache](https://github.com/actions/cache/) and the `apt` utility. Some actions require additional APT based packages to be installed in order for other steps to be executed. Packages can be installed when ran but can consume much of the execution workflow time.

## Usage

### Pre-requisites

Create a workflow `.yml` file in your repositories `.github/workflows` directory. [Example workflows](#example-workflows) are available below. For more information, reference the GitHub Help Documentation for [Creating a workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

### Versions

There are three kinds of version labels you can use.

- `@latest` - This will give you the latest release.
- `@v#` - Major only will give you the latest release for that major version only (e.g. `v1`).
- Branch
  - `@master` - Most recent manual and automated tested code. Possibly unstable since it is pre-release.
  - `@staging` - Most recent automated tested code and can sometimes contain experimental features. Is pulled from dev stable code.
  - `@dev` - Very unstable and contains experimental features. Automated testing may not show breaks since CI is also updated based on code in dev.

### Inputs

- `packages` - Space delimited list of packages to install.
- `version` - Version of cache to load. Each version will have its own cache. Note, all characters except spaces are allowed.
- `execute_install_scripts` - Execute Debian package pre and post install script upon restore. See [Caveats / Non-file Dependencies](#non-file-dependencies) for more information.

### Outputs

- `cache-hit` - A boolean value to indicate a cache was found for the packages requested.
- `package-version-list` - The main requested packages and versions that are installed. Represented as a comma delimited list with equals delimit on the package version (i.e. \<package1>=<version1\>,\<package2>=\<version2>,...).
- `all-package-version-list` - All the pulled in packages and versions, including dependencies, that are installed. Represented as a comma delimited list with equals delimit on the package version (i.e. \<package1>=<version1\>,\<package2>=\<version2>,...).

### Cache scopes

The cache is scoped to the packages given and the branch. The default branch cache is available to other branches.

### Example workflows

Below are some example workflows showing how to use this action.

#### Build and Deploy Doxygen Documentation

This example shows how to cache dependencies for building and deploying Doxygen documentation:

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

This example shows the minimal configuration needed to cache and install packages:

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

### Non-file Dependencies

This action is based on the principle that most packages can be cached as a fileset. There are situations though where this is not enough.

- Pre and post installation scripts needs to be ran from `/var/lib/dpkg/info/{package name}.[preinst, postinst]`.
- The Debian package database needs to be queried for scripts above (i.e. `dpkg-query`).

The `execute_install_scripts` argument can be used to attempt to execute the install scripts but they are no guaranteed to resolve the issue.

```yaml
- uses: awalsh128/cache-apt-pkgs-action@latest
  with:
    packages: mypackage
    version: 1.0
    execute_install_scripts: true
```

If this does not solve your issue, you will need to run `apt-get install` as a separate step for that particular package unfortunately.

```yaml
run: apt-get install mypackage
shell: bash
```

Please reach out if you have found a workaround for your scenario and it can be generalized. There is only so much this action can do and can't get into the area of reverse engineering Debian package manager. It would be beyond the scope of this action and may result in a lot of extended support and brittleness. Also, it would be better to contribute to Debian packager instead at that point.

For more context and information see [issue #57](https://github.com/awalsh128/cache-apt-pkgs-action/issues/57#issuecomment-1321024283) which contains the investigation and conclusion.

### Cache Limits

A repository can have up to 5GB of caches. Once the 5GB limit is reached, older caches will be evicted based on when the cache was last accessed. Caches that are not accessed within the last week will also be evicted. To get more information on how to access and manage your actions's caches, see [GitHub Actions / Using workflows / Cache dependencies](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#viewing-cache-entries).
