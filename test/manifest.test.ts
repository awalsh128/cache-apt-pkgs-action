import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { Manifest, ManifestEntry } from "../src/manifest.js";

describe("manifest", () => {
  it("serializes and deserializes manifest entries", () => {
    const manifest = new Manifest(
      [
        new ManifestEntry("z", "2", undefined, ["/b", "/a"]),
        new ManifestEntry("a", "1", undefined, []),
      ],
      "input",
      "cache-key",
      "4",
      "x86_64",
    );

    const parsed = Manifest.deserialize(manifest.serialize());
    expect(parsed.entries[0]?.name).toBe("z");
    expect(parsed.cacheKey).toBe("cache-key");
  });

  it("writes and reads manifest files", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-test-"));
    const filePath = path.join(tempDir, "manifest.json");
    const manifest = new Manifest(
      [new ManifestEntry("curl", "8.1", undefined, ["usr/bin/curl"])],
      "input",
      "cache-key",
      "4",
      "x86_64",
    );

    manifest.writeToFile(filePath);
    const parsed = Manifest.readFromFile(filePath);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0]?.name).toBe("curl");
  });

  it("throws for missing files", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-missing-"));
    expect(() =>
      Manifest.readFromFile(path.join(tempDir, "none.json")),
    ).toThrow(/Manifest file not found/);
  });
});
