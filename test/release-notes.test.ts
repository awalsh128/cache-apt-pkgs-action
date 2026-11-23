import { describe, expect, it } from "vitest";
import { creditPullRequestAuthors } from "../release.config.ts";

const SUBJECT_LINE =
  "* **cache:** fix a thing [#285](https://github.com/o/r/issues/285) ([abc1234](https://github.com/o/r/commit/abc1234))";

describe("creditPullRequestAuthors", () => {
  it("credits the PR author when the subject links a pull request", async () => {
    const notes = await creditPullRequestAuthors(SUBJECT_LINE, async () => "octocat");
    expect(notes).toBe(`${SUBJECT_LINE} by [@octocat](https://github.com/octocat)`);
  });

  it("leaves the bullet unchanged when the number is not a pull request", async () => {
    const notes = await creditPullRequestAuthors(SUBJECT_LINE, async () => undefined);
    expect(notes).toBe(SUBJECT_LINE);
  });

  it("leaves headings and bullets without a pull request link unchanged", async () => {
    const input = "### Bug Fixes\n\n* plain bullet (abc1234)\n";
    expect(await creditPullRequestAuthors(input, async () => "octocat")).toBe(input);
  });
});
