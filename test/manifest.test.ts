import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { readManifestAsCsv, writeManifest } from "../src/manifest.js";

describe("manifest", () => {
  it("writes sorted entries and reads csv output", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-test-"));
    const filePath = path.join(tempDir, "manifest.log");

    writeManifest(filePath, ["z=2", "a=1", "m=9"]);

    expect(fs.readFileSync(filePath, "utf8")).toBe("a=1\nm=9\nz=2");
    expect(readManifestAsCsv(filePath)).toBe("a=1,m=9,z=2");
  });

  it("returns empty csv for missing files", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-missing-"));
    expect(readManifestAsCsv(path.join(tempDir, "none.log"))).toBe("");
  });
});
