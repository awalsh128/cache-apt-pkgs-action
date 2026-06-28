import { describe, expect, it } from "vitest";
import { normalizeInputPackages, parseBoolean } from "../src/action.js";

describe("action utils", () => {
  it("normalizes package list syntax", () => {
    const input = "  git, curl \\\n      jq   ";
    expect(normalizeInputPackages(input)).toEqual(["curl", "git", "jq"]);
  });

  it("parses true/false values", () => {
    expect(parseBoolean("true", "debug")).toBe(true);
    expect(parseBoolean("false", "debug")).toBe(false);
  });

  it("fails for invalid booleans", () => {
    expect(() => parseBoolean("TRUE", "debug")).toThrow();
  });
});
