# cache-apt-pkgs-action

[![License: Apache2](https://shields.io/badge/license-apache2-blue.svg)](https://github.com/awalsh128/fluentcpp/blob/master/LICENSE)
[![GitHub Tests status](https://github.com/awalsh128/cache-apt-pkgs-action-ci/actions/workflows/tests.yml/badge.svg)](https://github.com/awalsh128/cache-apt-pkgs-action-ci/actions/workflows/tests.yml)

This action allows caching of Advanced Package Tool (APT) package dependencies to improve workflow execution time instead of installing the packages on every run.

## Documentation

This action is a composition of [actions/cache](https://github.com/actions/cache/README.md) and the `apt` utility. Some actions require additional APT based packages to be installed in order for other steps to be executed. Packages can be installed when ran but can consume much of the execution workflow time.

## Usage

### Pre-requisites

Create a workflow `.yml` file in your repositories `.github/workflows` directory. An [example workflow](#example-workflow) is available below. For more information, reference the GitHub Help Documentation for [Creating a workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

### Inputs

* `packages` - Space delimited list of packages to install.
* `version` - Version of cache to load. Each version will have its own cache. Note, all characters except spaces are allowed.
* `refresh` - Refresh / upgrade the packages in the same cache.

### Outputs

* `cache-hit` - A boolean value to indicate a cache was found for the packages requested.
* `package_version_list` - The packages and versions that are installed as a comma delimited list with colon delimit on the package version (i.e. \<package1>:<version1\>,\<package2>:\<version2>,...).
  

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
      - uses: awalsh128/cache-apt-pkgs-action@v1
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
      - uses: awalsh128/cache-apt-pkgs-action@v1
        with:
          packages: dia doxygen doxygen-doc doxygen-gui doxygen-latex graphviz mscgen
          version: 1.0
          refresh: true # Force refresh / upgrade v1.0 cache.
```

## Cache Limits

A repository can have up to 5GB of caches. Once the 5GB limit is reached, older caches will be evicted based on when the cache was last accessed.  Caches that are not accessed within the last week will also be evicted.
