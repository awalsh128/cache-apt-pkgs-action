#!/usr/bin/env bash

set -e

echo "🔍 Checking GitHub authentication status..."

# 1. Check if logged in; if not, log in via browser UI
if ! gh auth status >/dev/null 2>&1; then
  echo "⚠️  Not authenticated. Opening browser for login..."
  gh auth login --web
else
  echo "✅ Already authenticated."
fi

# 2. Configure Git to use gh credentials
echo "⚙️  Configuring Git credential helper..."
# Clear existing helpers to avoid "multiple values" error
git config --global --unset-all credential.helper 2>/dev/null || true
git config --global --add credential.helper '!gh auth git-credential'

# 3. Export GITHUB_TOKEN for Node.js scripts (current session)
echo "🔑 Exporting GITHUB_TOKEN for API access..."
GITHUB_TOKEN=$(gh auth token)
export GITHUB_TOKEN

echo "✅ Setup complete!"
echo "   - Git is configured to use gh."
echo "   - GITHUB_TOKEN is exported for this session."
echo ""
echo "🚀 You can now run your script:"
echo "   npm run check:latest-action-pins"