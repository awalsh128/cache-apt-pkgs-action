# cache-apt-pkgs-action

[![License: Apache2](https://shields.io/badge/license-apache2-blue.svg)](https://github.com/awalsh128/fluentcpp/blob/master/LICENSE)
[![Master Test status](https://github.com/awalsh128/cache-apt-pkgs-action-ci/actions/workflows/master_test.yml/badge.svg)](https://github.com/awalsh128/cache-apt-pkgs-action-ci/actions/workflows/master_test.yml)
[![Staging Test status](https://github.com/awalsh128/cache-apt-pkgs-action-ci/actions/workflows/staging_test.yml/badge.svg)](https://github.com/awalsh128/cache-apt-pkgs-action-ci/actions/workflows/staging_test.yml)

This action allows caching of Advanced Package Tool (APT) package dependencies to improve workflow execution time instead of installing the packages on every run.

## Documentation

This action is a composition of [actions/cache](https://github.com/actions/cache/README.md) and the `apt` utility. Some actions require additional APT based packages to be installed in order for other steps to be executed. Packages can be installed when ran but can consume much of the execution workflow time.

## Usage

### Pre-requisites

Create a workflow `.yml` file in your repositories `.github/workflows` directory. An [example workflow](#example-workflow) is available below. For more information, reference the GitHub Help Documentation for [Creating a workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

### Versions

There are three kinds of version labels you can use.

* `@latest` - This will give you the latest release.
* `@v#` - Major only will give you the latest release for that major version only (e.g. `v1`).
* Branch
  * `@master` - Most recent manual and automated tested code. Possibly unstable since it is pre-release.
  * `@staging` - Most recent automated tested code and can sometimes contain experimental features. Is pulled from dev stable code.
  * `@dev` - Very unstable and contains experimental features. Automated testing may not show breaks since CI is also updated based on code in dev.

### Inputs

* `packages` - Space delimited list of packages to install.
* `version` - Version of cache to load. Each version will have its own cache. Note, all characters except spaces are allowed.
* `execute_install_scripts` - Execute Debian package pre and post install script upon restore. See [Caveats / Non-file Dependencies](#non-file-dependencies) for more information.

### Outputs

* `cache-hit` - A boolean value to indicate a cache was found for the packages requested.
* `package-version-list` - The main requested packages and versions that are installed. Represented as a comma delimited list with colon delimit on the package version (i.e. \<package1>:<version1\>,\<package2>:\<version2>,...).
* `all-package-version-list` - All the pulled in packages and versions, including dependencies, that are installed. Represented as a comma delimited list with colon delimit on the package version (i.e. \<package1>:<version1\>,\<package2>:\<version2>,...).

### Cache scopes

The cache is scoped to the packages given and the branch. The default branch cache is available to other branches.

### Example workflow

This was a motivating use case for creating this action.

```yaml
name: Create Documentation
on: push
jobs:
  
  build_and_deploy_docs:
    runs-on: ubuntu-latest
    name: Build Doxygen documentation and deploy
    steps:
      - uses: actions/checkout@v2
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

```yaml
...
  install_doxygen_deps:
    runs-on: ubuntu-latest    
    steps:
      - uses: actions/checkout@v2
      - uses: awalsh128/cache-apt-pkgs-action@latest
        with:
          packages: dia doxygen doxygen-doc doxygen-gui doxygen-latex graphviz mscgen
          version: 1.0
```

## Caveats

### Non-file Dependencies

This action is based on the principle that most packages can be cached as a fileset. There are situations though where this is not enough.

* Pre and post installation scripts needs to be ran from `/var/lib/dpkg/info/{package name}.[preinst, postinst]`.
* The Debian package database needs to be queried for scripts above (i.e. `dpkg-query`).

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

A repository can have up to 5GB of caches. Once the 5GB limit is reached, older caches will be evicted based on when the cache was last accessed.  Caches that are not accessed within the last week will also be evicted.
