# 🤝 Contributing to cache-apt-pkgs-action

Thank you for your interest in contributing to cache-apt-pkgs-action! This document provides guidelines and instructions for contributing to the project.

[![CI](https://github.com/awalsh128/cache-apt-pkgs-action/actions/workflows/ci.yml/badge.svg?branch=dev-v2.0)](https://github.com/awalsh128/cache-apt-pkgs-action/actions/workflows/ci.yml?query=branch%3Adev-v2.0)
[![Go Report Card](https://goreportcard.com/badge/github.com/awalsh128/cache-apt-pkgs-action)](https://goreportcard.com/report/github.com/awalsh128/cache-apt-pkgs-action)
[![Go Reference](https://pkg.go.dev/badge/github.com/awalsh128/cache-apt-pkgs-action.svg)](https://pkg.go.dev/github.com/awalsh128/cache-apt-pkgs-action)
[![License](https://img.shields.io/github/license/awalsh128/cache-apt-pkgs-action)](https://github.com/awalsh128/cache-apt-pkgs-action/blob/dev-v2.0/LICENSE)
[![Release](https://img.shields.io/github/v/release/awalsh128/cache-apt-pkgs-action)](https://github.com/awalsh128/cache-apt-pkgs-action/releases)

⚠️ **IMPORTANT**: This is a very unstable branch and will be introduced as version 2.0 once in beta.

## 🔗 Useful Links

- 📖 [GitHub Action Documentation](https://github.com/awalsh128/cache-apt-pkgs-action#readme)
- 📦 [Go Package Documentation](https://pkg.go.dev/github.com/awalsh128/cache-apt-pkgs-action)
- 🔄 [GitHub Actions Workflow Status](https://github.com/awalsh128/cache-apt-pkgs-action/actions)
- 🐛 [Issues](https://github.com/awalsh128/cache-apt-pkgs-action/issues)
- 🛠️ [Pull Requests](https://github.com/awalsh128/cache-apt-pkgs-action/pulls)

## 🚀 Development Setup

### 📋 Prerequisites

1. 🔵 [Go 1.23 or later](https://golang.org/dl/)
2. 💻 [Visual Studio Code](https://code.visualstudio.com/) (recommended)
3. 📂 [Git](https://git-scm.com/downloads)

### 🛠️ Setting Up Your Development Environment

1. 📥 Clone the repository:

   ```bash
   git clone https://github.com/awalsh128/cache-apt-pkgs-action.git
   cd cache-apt-pkgs-action
   ```

2. 🔧 Use the provided development scripts:

   ```bash
   # Interactive menu for all development tasks
   ./scripts/menu.sh
   
   # Or use individual scripts directly:
   ./scripts/setup_dev.sh       # Set up development environment
   ./scripts/update_md_tocs.sh  # Update table of contents in markdown files
   ```

### 📜 Available Development Scripts

The project includes several utility scripts to help with development:

- 🎯 `menu.sh`: Interactive menu system for all development tasks
  - Environment setup
  - Testing and coverage
  - Documentation updates
  - Code formatting
  - Build and release tasks

- 🛠️ Individual Scripts:
  - `setup_dev.sh`: Sets up the development environment
  - `update_md_tocs.sh`: Updates table of contents in markdown files
  - `check_utf8.sh`: Validates file encodings
  - `distribute_test.sh`: Runs distribution tests

To access the menu system, run:

   ```bash
   ./scripts/menu.sh
   ```

This will present an interactive menu with all available development tasks.

## 🧪 Testing

### 🏃 Running Tests Locally

1. 🔬 Run unit tests:

   ```bash
   go test ./...
   ```

2. 📊 Run tests with coverage:

   ```bash
   go test -v -race -coverprofile=coverage.txt -covermode=atomic ./...
   ```

### 🔄 Testing GitHub Action Workflows

There are two ways to test the GitHub Action workflows:

1. ☁️ **Using GitHub Actions**:
   - Push your changes to a branch
   - Create a PR to trigger the [test workflow](https://github.com/awalsh128/cache-apt-pkgs-action/blob/dev-v2.0/.github/workflows/test-action.yml)
   - Or manually trigger the workflow from the [Actions tab](https://github.com/awalsh128/cache-apt-pkgs-action/actions/workflows/test-action.yml)

2. 🐳 **Running Tests Locally** (requires Docker):
   - Install Docker
     - 🪟 WSL users install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
     - 🐧 Non-WSL users (native Linux)

       ```bash
       curl -fsSL https://get.docker.com -o get-docker.sh && 
       sudo sh get-docker.sh && 
       sudo usermod -aG docker $USER && 
       sudo systemctl start docker
       ```

   - 🎭 Install [`act`](https://github.com/nektos/act) for local GitHub Actions testing:
   - ▶️ Run `act` on any action test in the following ways:

     ```bash
     act -j list_versions   # Get all the available tests
     act push               # Run push event workflows
     act pull_request       # Run PR workflows
     act workflow_dispatch -i ref=dev-v2.0 -i debug=true  # Manual trigger workflow
     ```  

## 📝 Making Changes

1. 🌿 Create a new branch for your changes:

   ```bash
   git checkout -b feature/your-feature-name
   ```

## Testing

### Running Tests Locally

1. Run unit tests:

   ```bash
   go test ./...
   ```

2. Run tests with coverage:

   ```bash
   go test -v -race -coverprofile=coverage.txt -covermode=atomic ./...
   ```

### Testing GitHub Action Workflows

There are two ways to test the GitHub Action workflows:

1. **Using GitHub Actions**:
   - Push your changes to a branch
   - Create a PR to trigger the [test workflow](https://github.com/awalsh128/cache-apt-pkgs-action/blob/dev-v2.0/.github/workflows/test-action.yml)
   - Or manually trigger the workflow from the [Actions tab](https://github.com/awalsh128/cache-apt-pkgs-action/actions/workflows/test-action.yml)

2. **Running Tests Locally** (requires Docker):
   - Install Docker
     - WSL users install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
     - Non-WSL users (native Linux)

       ```bash
       curl -fsSL https://get.docker.com -o get-docker.sh && \
       sudo sh get-docker.sh && \
       sudo usermod -aG docker $USER && \
       sudo systemctl start docker
       ```

   - Install [`act`](https://github.com/nektos/act) for local GitHub Actions testing:
   - Run `act` on any action test in the following ways:

     ```bash
     act -j list_versions   # Get all the available tests
     act push               # Run push event workflows
     act pull_request       # Run PR workflows
     act workflow_dispatch -i ref=dev-v2.0 -i debug=true  # Manual trigger workflow
     ```  

## Making Changes

1. Create a new branch for your changes:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. ✏️ Make your changes, following these guidelines:
   - 📚 Follow Go coding [standards and conventions](https://go.dev/doc/effective_go)
   - ✅ Add tests for new features
     - 🎯 Test behaviors on the public interface not implementation
     - 🔍 Keep tests for each behavior separate
     - 🏭 Use constants and factory functions to keep testing arrangement and asserts clear. Not a lot of boilerplate not directly relevant to the test.
   - 📖 Update documentation as needed
   - 🎯 Keep commits focused and atomic
   - 📝 Write clear commit messages

3. 🧪 Test your changes locally before submitting

## 🔄 Pull Request Process

1. 📚 Update the README.md with details of significant changes if applicable

2. ✅ Verify that all tests pass:
   - 🧪 Unit tests
   - 🔄 Integration tests
   - 🚀 GitHub Action workflow tests

3. 📥 Create a Pull Request:
   - 🎯 Target the `dev-v2.0` branch
   - 📝 Provide a clear description of the changes
   - 🔗 Reference any related issues
   - 📊 Include test results and any relevant screenshots

4. 👀 Address review feedback and make requested changes

## 💻 Code Style Guidelines

- 📏 Follow [standard Go formatting](https://golang.org/doc/effective_go#formatting) (use `gofmt`)
- 📖 Follow [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)
- 🔍 Write clear, self-documenting code
- 📚 Add [godoc](https://blog.golang.org/godoc) comments for complex logic
- 🏷️ Use meaningful variable and function names
- ✨ Keep functions focused and manageable in size
  - 🔒 Prefer immutability vs state changing
  - 📏 Aim for lines less than 50
  - 🎯 Observe [single responsibility principle](https://en.wikipedia.org/wiki/Single-responsibility_principle)

📚 For more details on Go best practices, refer to:

- 📖 [Effective Go](https://golang.org/doc/effective_go)
- 🔍 [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)

## Documentation

- Update documentation for any changed functionality
- Include code examples where appropriate
- Update the README.md for significant changes
- Document any new environment variables or configuration options

## Release Process

1. Changes are merged into the `dev-v2.0` branch
2. Once tested and approved, changes are merged to `master`
3. New releases are tagged following semantic versioning

## Questions or Problems?

- Open an [issue](https://github.com/awalsh128/cache-apt-pkgs-action/issues/new) for bugs or feature requests
- Use [discussions](https://github.com/awalsh128/cache-apt-pkgs-action/discussions) for questions or ideas
- Reference the [GitHub Action documentation](https://github.com/awalsh128/cache-apt-pkgs-action#readme)
- Check existing [issues](https://github.com/awalsh128/cache-apt-pkgs-action/issues) and [pull requests](https://github.com/awalsh128/cache-apt-pkgs-action/pulls)
- Tag maintainers for urgent issues

## License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project.

## 📦 Publishing to pkg.go.dev

NOTE: This is done by the maintainers

To make the library available on [pkg.go.dev](https://pkg.go.dev):

1. 🏷️ Ensure your code is tagged with a version:

   ```bash
   git tag v2.0.0  # Use semantic versioning
   git push origin v2.0.0
   ```

2. 🔄 Trigger pkg.go.dev to fetch your module:

   - Visit [pkg.go.dev for this module](https://pkg.go.dev/github.com/awalsh128/cache-apt-pkgs-action@v2.0.0)
   - Or fetch via command line:

     ```bash
     GOPROXY=https://proxy.golang.org GO111MODULE=on go get github.com/awalsh128/cache-apt-pkgs-action@v2.0.0
     ```

3. 📝 Best practices for publishing:

   - Add comprehensive godoc comments
   - Include examples in your documentation
   - Use semantic versioning for tags
   - Keep the module path consistent
   - Update go.mod with the correct module path
   - [Go Best Practices](https://golang.org/doc/effective_go#names)