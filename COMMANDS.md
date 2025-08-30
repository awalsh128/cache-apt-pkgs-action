# Command Line Usage Guide

This document provides information about using the `cache-apt-pkgs` command line tool.

## Basic Usage

The basic syntax for the command is:

```bash
cache-apt-pkgs <command> [flags] [packages]
```

## Available Commands

### 1. Install Command

Install and cache APT packages:

```bash
cache-apt-pkgs install [flags] [packages]
```

#### Flags for Install

- `--version`: Cache version identifier (optional)
- `--execute-scripts`: Execute package install scripts (optional, default: false)

#### Install Examples

```bash
# Install specific versions
cache-apt-pkgs install python3-dev=3.9.5-3 cmake=3.18.4-2

# Install latest versions
cache-apt-pkgs install python3-dev cmake

# Install with custom cache version
cache-apt-pkgs install --version=1.0 python3-dev cmake

# Install with script execution
cache-apt-pkgs install --execute-scripts=true python3-dev cmake
```

### 2. Create Key Command

Create a cache key for packages:

```bash
cache-apt-pkgs create-key [flags] [packages]
```

#### Flags for Create Key

- `--version`: Cache version identifier (optional)

#### Create Key Examples

```bash
# Create key with default version
cache-apt-pkgs create-key python3-dev cmake

# Create key with custom version
cache-apt-pkgs create-key --version=1.0 python3-dev cmake
```

### 3. Restore Command

Restore packages from cache:

```bash
cache-apt-pkgs restore [flags] [packages]
```

#### Flags for Restore

- `--version`: Cache version to restore from (optional)
- `--execute-scripts`: Execute package install scripts (optional, default: false)

#### Restore Examples

```bash
# Restore with specific version
cache-apt-pkgs restore --version=1.0 python3-dev cmake

# Restore with script execution
cache-apt-pkgs restore --execute-scripts=true python3-dev cmake
```

### 4. Validate Command

Validate package names and versions:

```bash
cache-apt-pkgs validate [packages]
```

#### Examples
```bash
# Validate package names and versions
cache-apt-pkgs validate python3-dev=3.9.5-3 cmake=3.18.4-2

# Validate package names only
cache-apt-pkgs validate python3-dev cmake
```

## Package Specification

Packages can be specified in two formats:

1. Name only: `package-name`
2. Name with version: `package-name=version`

Examples:

- `python3-dev`
- `python3-dev=3.9.5-3`
- `cmake=3.18.4-2`

## Environment Variables

The following environment variables can be used to configure the tool:

- `RUNNER_DEBUG`: Set to `1` to enable debug logging
- `RUNNER_TEMP`: Directory for temporary files (default: system temp dir)

## Common Tasks

### Installing Multiple Packages

```bash
cache-apt-pkgs install \
  python3-dev \
  cmake \
  build-essential \
  libssl-dev
```

### Creating Custom Cache Keys

```bash
cache-apt-pkgs create-key \
  --version="$(date +%Y%m%d)" \
  python3-dev \
  cmake
```

### Restoring Specific Versions

```bash
cache-apt-pkgs restore \
  --version=1.0 \
  python3-dev=3.9.5-3 \
  cmake=3.18.4-2
```

## Best Practices

1. Version Management
   - Use specific versions for reproducible builds
   - Use version-less package names for latest versions
   - Use timestamp-based cache versions for forced updates

2. Cache Optimization
   - Group related packages in the same cache
   - Use consistent version strings across workflows
   - Clean up old caches periodically

3. Error Handling
   - Validate packages before installation
   - Check for missing dependencies
   - Use debug logging for troubleshooting

## Troubleshooting

Common issues and solutions:

1. Package Not Found

   ```bash
   # Validate package name and availability
   cache-apt-pkgs validate package-name
   ```

2. Cache Miss

   ```bash
   # Check if package versions match exactly
   cache-apt-pkgs restore --version=1.0 package-name=exact-version
   ```

3. Installation Errors

   ```bash
   # Try with script execution
   cache-apt-pkgs install --execute-scripts=true package-name
   ```

## Advanced Usage

### Using with GitHub Actions

```yaml
steps:
  - name: Cache APT Packages
    uses: awalsh128/cache-apt-pkgs-action@v2
    with:
      packages: python3-dev cmake
      version: ${{ github.sha }}
      execute_install_scripts: true
```

For more information, refer to:

- [GitHub Action Documentation](README.md)
- [Source Code](cmd/cache_apt_pkgs/)
