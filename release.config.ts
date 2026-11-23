import { execFileSync } from "node:child_process";
import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateNotes as generateDefaultNotes } from "@semantic-release/release-notes-generator";

/** Paths a consumer of `uses: awalsh128/cache-apt-pkgs-action@<ref>` needs at runtime (all gitignored except action.yml). */
const DIST_PATHS = ["dist/action", "dist/scripts"];

type ReleaseContext = {
  nextRelease: { version: string; gitHead: string };
  logger: { log: (message: string) => void };
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

type SuccessContext = {
  nextRelease: { gitTag: string; version: string };
  branch: { prerelease?: string | boolean };
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
 * semantic-release resets `nextRelease.gitHead` to the checkout's `HEAD` after every prepare step, so
 * setting `gitHead` alone is overwritten and the tag lands on the source commit without `dist/`. Moving
 * `HEAD` onto the dist commit (detached, working tree untouched) makes the reset agree with it.
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
    git(["update-ref", "--no-deref", "HEAD", commit]);
    nextRelease.gitHead = commit;
  } finally {
    rmSync(indexDir, { recursive: true, force: true });
  }
}

/** Looks up the GitHub login of a pull request's author, or `undefined` when `number` is not a pull request. */
export type PullRequestAuthorLookup = (number: number) => Promise<string | undefined>;

/**
 * Appends ` by [@login](https://github.com/login)` to every release note bullet that links a pull request.
 *
 * Pull requests are squash-merged with the number in the subject, which the notes link as `[#123](...)`.
 * Bullets without a pull request link, and numbers the lookup does not resolve, are left as they are.
 *
 * @param notes Markdown release notes from the default generator.
 * @param lookup Resolves a pull request number to its author's login.
 * @returns The notes with the author credited on each pull request bullet.
 */
export async function creditPullRequestAuthors(
  notes: string,
  lookup: PullRequestAuthorLookup,
): Promise<string> {
  const lines = await Promise.all(
    notes.split("\n").map(async (line) => {
      const match = /^\* .*?\[#(\d+)\]\([^)]*\/issues\/\d+\)/.exec(line);
      if (!match) {
        return line;
      }
      const login = await lookup(Number(match[1]));
      return login ? `${line} by [@${login}](https://github.com/${login})` : line;
    }),
  );
  return lines.join("\n");
}

/**
 * Inline semantic-release plugin that generates the release notes with the default generator, then
 * credits each pull request's author.
 *
 * The commit author is not used because it is an email address, not a GitHub login. The login comes from
 * the pull request itself. A failed lookup is logged and that bullet is left uncredited, so a credit
 * problem never blocks a release.
 *
 * @param _pluginConfig Unused plugin options.
 * @param context semantic-release context for the pending release.
 * @returns The release notes.
 */
async function generateNotes(
  _pluginConfig: unknown,
  context: Parameters<typeof generateDefaultNotes>[1] & {
    logger: { warn: (message: string) => void };
    env?: NodeJS.ProcessEnv;
  },
): Promise<string> {
  const notes = await generateDefaultNotes({}, context);
  const env = context.env ?? process.env;
  const repository = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(context.options.repositoryUrl)?.[1];
  if (!repository || !env.GITHUB_TOKEN) {
    context.logger.warn("Skipping PR author credit: no GitHub repository or GITHUB_TOKEN");
    return notes;
  }
  return creditPullRequestAuthors(notes, async (number) => {
    const response = await fetch(`https://api.github.com/repos/${repository}/pulls/${number}`, {
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
    });
    if (response.status === 404) {
      return undefined; // An issue reference, not a pull request.
    }
    if (!response.ok) {
      context.logger.warn(`Could not read the author of #${number}: HTTP ${response.status}`);
      return undefined;
    }
    return ((await response.json()) as { user?: { login?: string } }).user?.login;
  });
}

/**
 * Inline semantic-release plugin hook that exposes the release to later workflow steps.
 *
 * Writes `tag`, `version` and `official` (`true` for a stable release, `false` for a release candidate)
 * to `$GITHUB_OUTPUT`. Runs only after a real release, so dry runs and runs with nothing to release leave
 * the outputs empty. Does nothing outside GitHub Actions.
 *
 * @param _pluginConfig Unused plugin options.
 * @param context semantic-release context with the finished release.
 */
function success(_pluginConfig: unknown, context: SuccessContext): void {
  const outputFile = (context.env ?? process.env).GITHUB_OUTPUT;
  if (!outputFile) {
    return;
  }
  const { gitTag, version } = context.nextRelease;
  const official = !context.branch.prerelease;
  appendFileSync(outputFile, `tag=${gitTag}\nversion=${version}\nofficial=${official}\n`);
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
    //   'staging-2' releases a candidate when release-candidate.yml starts one after CI passes.
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

    // Generates the release notes from the commit history (the default generator) and credits each PR author.
    { generateNotes },

    // Tags a detached commit that contains the built dist/ (see above), then exposes the release to the workflow.
    { prepare, success },

    // Creates a GitHub Release with the generated notes. Default behavior posts automatic comments on
    // resolved issues/PRs.
    "@semantic-release/github",
  ],
};
