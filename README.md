# cache-apt-pkgs-action

[![License: Apache2](https://shields.io/badge/license-apache2-blue.svg)](https://github.com/awalsh128/fluentcpp/blob/master/LICENSE)
[![GitHub Tests status](https://github.com/awalsh128/cache-apt-pkgs-action-ci/actions/workflows/tests.yml/badge.svg)](https://github.com/awalsh128/cache-apt-pkgs-action-ci/actions/workflows/tests.yml)

This action allows caching of Advanced Package Tool (APT) package dependencies to improve workflow execution time.

## Documentation

This action is a composition of [actions/cache](https://github.com/actions/cache/README.md) and the `apt` utility. Some actions require additional APT based packages to be installed in order for other steps to be executed. Packages can be installed when ran but can consume much of the execution workflow time.

## Usage

### Pre-requisites

Create a workflow `.yml` file in your repositories `.github/workflows` directory. An [example workflow](#example-workflow) is available below. For more information, reference the GitHub Help Documentation for [Creating a workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

### Inputs

* `key` - Unique key representing the cache being used.
* `packages` - Space delimited list of packages to install.

### Outputs

* `cache-hit` - A boolean value to indicate a cache was found for the packages requested.

### Cache scopes

The cache is scoped to the key and branch. The default branch cache is available to other branches.

See [Matching a cache key](https://help.github.com/en/actions/configuring-and-managing-workflows/caching-dependencies-to-speed-up-workflows#matching-a-cache-key) for more info.

### Example workflow

This was a motivating use case for creating this action.

```yaml
name: Documentation

on: push

jobs:
  
  build_and_deploy_docs:
    runs-on: ubuntu-latest
    name: Build Doxygen documentation and deploy
    steps:
      - uses: actions/checkout@v2
      - uses: awalsh128/cache-apt-pkgs-action-action@v1
        with:
          cache_key: doxygen_env
          packages: dia doxygen doxygen-doc doxygen-gui doxygen-latex graphviz mscgen

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

## Creating a cache key

A cache key can include any of the contexts, functions, literals, and operators supported by GitHub Actions.

For example, using the [`hashFiles`](https://help.github.com/en/actions/reference/context-and-expression-syntax-for-github-actions#hashfiles) function allows you to create a new cache when dependencies change.

```yaml
  - uses: awalsh128/cache-apt-pkgs-action@v1
    with:
      cache_key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
      packages: dot
```

Additionally, you can use arbitrary command output in a cache key, such as a date or software version:

```yaml
  # http://man7.org/linux/man-pages/man1/date.1.html
  - name: Get Epoch Seconds
    id: get-epoch-sec
    run: |
      echo "::set-output name=epoch_sec::$(/bin/date +%s)"
    shell: bash

  - uses: awalsh128/cache-apt-pkgs-action@v1
    with:
      cache_key: ${{ runner.os }}-${{ steps.get-epoch-sec.outputs.epoch_sec }}-${{ hashFiles('**/lockfiles') }}
      packages: dot
```

See [Using contexts to create cache keys](https://help.github.com/en/actions/configuring-and-managing-workflows/caching-dependencies-to-speed-up-workflows#using-contexts-to-create-cache-keys)

## Cache Limits

A repository can have up to 5GB of caches. Once the 5GB limit is reached, older caches will be evicted based on when the cache was last accessed.  Caches that are not accessed within the last week will also be evicted.
