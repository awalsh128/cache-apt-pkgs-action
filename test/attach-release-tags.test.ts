import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = path.resolve(import.meta.dirname, "../scripts/ops/attach_release_tags.sh");
const RELEASE_SUBJECT = "chore(release): 2.0.0-rc.1 [skip ci]";
const IDENTITY = {
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

describe("attach_release_tags.sh", () => {
  let repo: string;

  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: repo, env: { ...process.env, ...IDENTITY }, encoding: "utf8" }).trim();
  const attach = () => execFileSync("bash", [SCRIPT], { cwd: repo, env: process.env, encoding: "utf8" });
  const commit = (message: string) => git("commit", "--allow-empty", "-m", message);

  /** A release the way release.config.ts makes it: a child of the released commit, on no branch. */
  const detachedRelease = (tag: string, subject: string) => {
    const released = git("rev-parse", "HEAD");
    git("checkout", "-q", "--detach");
    commit(subject);
    git("tag", tag);
    git("checkout", "-q", "-");
    expect(git("rev-parse", "HEAD")).toBe(released);
  };

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), "attach-release-tags-"));
    git("init", "-q", "-b", "staging-2");
    commit("feat: first");
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it("attach with a release commit that is on no branch makes its tag reachable from the branch", () => {
    detachedRelease("v2.0.0-rc.1", RELEASE_SUBJECT);
    commit("fix: later");

    attach();

    expect(git("tag", "--merged", "staging-2", "--list", "v2.0.0-rc.1")).toBe("v2.0.0-rc.1");
  });

  it("attach keeps the branch's tree and parent and adds the release as another parent", () => {
    detachedRelease("v2.0.0-rc.1", RELEASE_SUBJECT);
    commit("fix: later");
    const before = git("rev-parse", "HEAD");
    const tree = git("rev-parse", "HEAD^{tree}");

    attach();

    expect(git("rev-parse", "HEAD^{tree}")).toBe(tree);
    expect(git("rev-list", "--parents", "-n", "1", "HEAD").split(" ").slice(1)).toEqual([
      before,
      git("rev-parse", "v2.0.0-rc.1^{commit}"),
    ]);
  });

  it("attach with a commit message that starts with chore so it does not trigger a release", () => {
    detachedRelease("v2.0.0-rc.1", RELEASE_SUBJECT);

    attach();

    expect(git("log", "-1", "--format=%s")).toBe("chore: attach earlier releases [skip ci]");
  });

  it("attach with no release missing from the branch leaves the branch unchanged", () => {
    const before = git("rev-parse", "HEAD");

    const output = attach();

    expect(git("rev-parse", "HEAD")).toBe(before);
    expect(output).toContain("No release tag is missing");
  });

  it("attach with an unreachable tag that is not a release commit leaves the branch unchanged", () => {
    detachedRelease("v1.0.0", "feat: something else on a side branch");
    const before = git("rev-parse", "HEAD");

    attach();

    expect(git("rev-parse", "HEAD")).toBe(before);
  });
});
