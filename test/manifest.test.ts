import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { Manifest, ManifestEntry } from "../src/manifest.js";
import { CacheKey } from "../src/cache.js";
import { createPackageName } from "ts-apt";
import { ActionPackageNames } from "../src/packages.js";

describe("manifest", () => {
  it("serializes and deserializes manifest entries", () => {
    const cacheKey = new CacheKey(
      "v1",
      "4",
      "amd64",
      ActionPackageNames.fromInput("curl git"),
    );
    const manifest = new Manifest(
      new Date("2026-01-01T00:00:00.000Z"),
      [
        new ManifestEntry(createPackageName("curl", "8.1.0", "amd64"), [
          "/b",
          "/a",
        ]),
      ],
      cacheKey,
    );

    const parsed = Manifest.fromJSON(JSON.parse(JSON.stringify(manifest)));
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0]?.packageName.serialize()).toBe("curl:amd64=8.1.0");
    expect(parsed.entries[0]?.filepaths).toEqual(["/a", "/b"]);
  });

  it("writes and reads manifest files", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-test-"));
    const filePath = path.join(tempDir, "manifest.json");
    const cacheKey = new CacheKey(
      "v1",
      "4",
      "amd64",
      ActionPackageNames.fromInput("curl"),
    );
    const manifest = new Manifest(
      new Date("2026-01-01T00:00:00.000Z"),
      [
        new ManifestEntry(createPackageName("curl", "8.1.0", "amd64"), [
          "usr/bin/curl",
        ]),
      ],
      cacheKey,
    );

    await manifest.writeToFile(filePath);
    const parsed = await Manifest.readFromFile(filePath);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0]?.packageName.serialize()).toBe("curl:amd64=8.1.0");
  });
});
