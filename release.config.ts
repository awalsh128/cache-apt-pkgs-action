/**
 * @type {import('semantic-release').GlobalConfig}
 */
export default {
  // The 'branches' array defines the release workflow and versioning strategy.
  // Order matters: list branches from least stable to most stable.
  branches: [
    // Development branch is assumed to be from local development and may contain breaking changes.

    // Pre-release candidate, feature complete, but may contain known bugs.
    //
    //   'staging' is for release candidates.
    //   'channel: "next"' publishes to the '@next' tag on npm.
    //   'prerelease: "rc"' adds the '-rc.x' suffix (e.g., v1.1.0-rc.1).
    { name: "staging", channel: "next", prerelease: "rc" },

    // Final and stable release.
    //
    // No prerelease tag and are published to the 'latest' dist-tag on npm.
    "main",
  ],

  // Actions to perform during a release.
  plugins: [
    // Analyzes commit messages (Conventional Commits) to determine if the next version should be a major,
    // minor, or patch bump.
    "@semantic-release/commit-analyzer",

    // Generates the release notes (changelog content) based on the commit history.
    "@semantic-release/release-notes-generator",

    // Updates the 'CHANGELOG.md' file with the new release notes.
    ["@semantic-release/changelog", { changelogFile: "CHANGELOG.md" }],

    // Updates 'package.json' with the new version and publishes the package to npm.
    // 'npmPublish: true' enables publishing; 'pkgRoot' sets the directory.
    ["@semantic-release/npm", { npmPublish: true, pkgRoot: "." }],

    // Commits the updated 'CHANGELOG.md', 'package.json', and 'package-lock.json' back to the repository with
    // a standardized commit message.
    [
      "@semantic-release/git",
      {
        assets: ["CHANGELOG.md", "package.json", "package-lock.json"],
        message:
          "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],

    // Creates a GitHub Release with the generated notes and uploads assets.
    // Default behavior posts automatic comments on resolved issues/PRs.
    "@semantic-release/github",
  ],
};
