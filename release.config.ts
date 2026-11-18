import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** Paths a consumer of `uses: awalsh128/cache-apt-pkgs-action@<ref>` needs at runtime (all gitignored except action.yml). */
const DIST_PATHS = ["dist/action", "dist/scripts"];

type ReleaseContext = {
  nextRelease: { version: string; gitHead: string };
  logger: { log: (message: string) => void };
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

/**
 * Inline semantic-release plugin that makes the released tag carry the built `dist/`.
 *
 * `dist/` is gitignored, but a GitHub Action is run from the tagged commit, so the tag has to point at a
 * commit that contains it. This builds a commit on top of the released commit (source + `dist/`) with a
 * throwaway index, so the working tree, the checked-out branch and the branch history are untouched,
 * then points `nextRelease.gitHead` at it. semantic-release tags `gitHead` and pushes only tags, so the
 * dist commit lives on the tag alone and the release branches stay fast-forward only.
 *
 * Expects `npm run build` to have run first (the release workflow does).
 *
 * @param _pluginConfig Unused plugin options.
 * @param context semantic-release context with the pending release.
 * @throws If `dist/` was not built or a git command fails.
 */
function prepare(_pluginConfig: unknown, context: ReleaseContext): void {
  const { nextRelease, logger } = context;
  const cwd = context.cwd ?? process.cwd();
  const env = { ...(context.env ?? process.env) };
  const git = (args: string[], extraEnv: NodeJS.ProcessEnv = {}): string =>
    execFileSync("git", args, { cwd, env: { ...env, ...extraEnv }, encoding: "utf8" }).trim();

  const indexDir = mkdtempSync(path.join(tmpdir(), "release-index-"));
  try {
    const indexEnv = { GIT_INDEX_FILE: path.join(indexDir, "index") };
    git(["read-tree", nextRelease.gitHead], indexEnv);
    // -f because dist/ is gitignored.
    git(["add", "-f", "--", ...DIST_PATHS], indexEnv);
    const tree = git(["write-tree"], indexEnv);
    const commit = git(
      [
        "commit-tree",
        tree,
        "-p",
        nextRelease.gitHead,
        "-m",
        `chore(release): ${nextRelease.version} [skip ci]`,
      ],
      {
        GIT_AUTHOR_NAME: "github-actions[bot]",
        GIT_AUTHOR_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com",
        GIT_COMMITTER_NAME: "github-actions[bot]",
        GIT_COMMITTER_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com",
      },
    );
    logger.log(`Created detached dist commit ${commit} for ${nextRelease.version}`);
    nextRelease.gitHead = commit;
  } finally {
    rmSync(indexDir, { recursive: true, force: true });
  }
}

/**
 * @type {import('semantic-release').GlobalConfig}
 */
export default {
  // The 'branches' array defines the release workflow and versioning strategy.
  // Order matters: list branches from least stable to most stable.
  branches: [
    // Pre-release candidate, feature complete, but may contain known bugs.
    //
    //   'staging-2' is for release candidates.
    //   'channel: "next"' publishes the GitHub prerelease on the 'next' channel.
    //   'prerelease: "rc"' adds the '-rc.x' suffix (e.g., v2.1.0-rc.1).
    { name: "staging-2", channel: "next", prerelease: "rc" },

    // Final and stable release, with no prerelease tag.
    "main-2",
  ],

  // Actions to perform during a release. Releases never commit to a branch: tags and GitHub Releases
  // are the history, so there is no changelog, version bump or release commit on staging-2 or main-2.
  plugins: [
    // Analyzes commit messages (Conventional Commits) to determine if the next version should be a major,
    // minor, or patch bump.
    "@semantic-release/commit-analyzer",

    // Generates the release notes based on the commit history.
    "@semantic-release/release-notes-generator",

    // Tags a detached commit that contains the built dist/ (see above).
    { prepare },

    // Creates a GitHub Release with the generated notes. Default behavior posts automatic comments on
    // resolved issues/PRs.
    "@semantic-release/github",
  ],
};
