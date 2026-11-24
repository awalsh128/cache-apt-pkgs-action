import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

// Runs gh-sync.mts against a fake `gh` that answers from canned JSON and logs every call.
// The fake is a shell script, so these tests run on Linux and macOS only.
const script = path.join(import.meta.dirname, "gh-sync.mts");
const skip = process.platform === "win32";

const CANNED: Record<string, unknown> = {
  "api repos/o/r": { name: "r", description: "d", has_wiki: false, id: 99, stargazers_count: 5 },
  "api /repos/o/r/actions/variables": {
    variables: [
      { name: "B", value: "2" },
      { name: "A", value: "1" },
    ],
  },
  "api /repos/o/r/tags?per_page=100": [{ name: "v1", commit: { sha: "aaa" } }],
};

let work: string;

function run(args: string[], cwd = work) {
  const result = spawnSync("node", [script, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, PATH: `${path.join(work, "bin")}${path.delimiter}${process.env.PATH}` },
  });
  return { status: result.status, out: result.stdout + result.stderr };
}

const calls = () => readFileSync(path.join(work, "calls.log"), "utf8").trim().split("\n");

describe("gh-sync", { skip }, () => {
  before(() => {
    work = mkdtempSync(path.join(tmpdir(), "gh-sync-test-"));
    mkdirSync(path.join(work, "bin"));
    writeFileSync(path.join(work, "canned.json"), JSON.stringify(CANNED));
    const fake = path.join(work, "bin", "gh");
    writeFileSync(
      fake,
      `#!/usr/bin/env bash
echo "$*" >>"${work}/calls.log"
[[ "$1" == auth ]] && exit 0
jq -c --arg k "$*" '.[$k] // empty' "${work}/canned.json"
`,
    );
    chmodSync(fake, 0o755);
  });

  after(() => rmSync(work, { recursive: true, force: true }));

  it("downloads only the tracked settings keys", () => {
    const { status } = run(["download", "--owner", "o", "--repo", "r", "--target", "settings"]);
    const saved = JSON.parse(readFileSync(path.join(work, ".github/repo-settings.json"), "utf8"));
    assert.equal(status, 0);
    assert.deepEqual(saved.settings, { name: "r", description: "d", has_wiki: false });
    assert.equal(saved.owner, "o");
  });

  it("downloads variables sorted by name", () => {
    run(["download", "--owner", "o", "--repo", "r", "--target", "vars"]);
    const saved = JSON.parse(readFileSync(path.join(work, ".github/repo-vars.json"), "utf8"));
    assert.deepEqual(saved.variables, [
      { name: "A", value: "1" },
      { name: "B", value: "2" },
    ]);
  });

  it("dry-run upload makes no write calls", () => {
    run(["download", "--owner", "o", "--repo", "r", "--target", "vars"]);
    const { status, out } = run(["upload", "--owner", "o", "--repo", "r", "--target", "vars", "--dry-run"]);
    assert.equal(status, 0);
    assert.match(out, /Dry-run complete/);
    assert.ok(!calls().some((call) => /-X (POST|PATCH|PUT)/.test(call)));
  });

  it("refuses to retarget an existing tag", () => {
    writeFileSync(
      path.join(work, ".github/repo-tags.json"),
      JSON.stringify({ owner: "o", repo: "r", exportedAt: "", tags: [{ name: "v1", sha: "bbb" }] }),
    );
    const { status, out } = run(["upload", "--owner", "o", "--repo", "r", "--target", "tags"]);
    assert.equal(status, 1);
    assert.match(out, /will not retarget/);
  });

  it("rejects --file with --target all", () => {
    const { status, out } = run(["download", "--owner", "o", "--repo", "r", "--file", "x.json"]);
    assert.equal(status, 1);
    assert.match(out, /--file cannot be used with --target all/);
  });

  it("rejects an unknown target", () => {
    assert.equal(run(["download", "--target", "nope"]).status, 1);
  });
});
