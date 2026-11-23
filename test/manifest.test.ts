import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { Manifest, ManifestEntry } from "../src/manifest.js";
import { CacheKey } from "../src/cache.js";
import { createPackageName } from "ts-apt";
import { ActionPackageNames } from "../src/packages.js";
import { MANIFEST_INPUTS, MANIFEST_OUTPUTS } from "./manifest-fixtures.js";

describe("manifest", () => {
  it("serializes and deserializes manifest entries", () => {
    const cacheKey = new CacheKey("v1", "4", "amd64", ActionPackageNames.fromInput("curl git"));
    const manifest = new Manifest(
      new Date("2026-01-01T00:00:00.000Z"),
      [new ManifestEntry(createPackageName("curl", "8.1.0", "amd64"), ["/b", "/a"])],
      cacheKey,
      MANIFEST_INPUTS,
      MANIFEST_OUTPUTS,
    );

    const parsed = Manifest.fromJSON(JSON.parse(JSON.stringify(manifest)));
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0]?.packageName.serialize()).toBe("curl:amd64=8.1.0");
    expect(parsed.entries[0]?.filepaths).toEqual(["/a", "/b"]);
    expect(parsed.inputs).toEqual(MANIFEST_INPUTS);
    expect(parsed.outputs).toEqual(MANIFEST_OUTPUTS);
  });

  it("writes and reads manifest files", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-test-"));
    const filePath = path.join(tempDir, "manifest.json");
    const cacheKey = new CacheKey("v1", "4", "amd64", ActionPackageNames.fromInput("curl"));
    const manifest = new Manifest(
      new Date("2026-01-01T00:00:00.000Z"),
      [new ManifestEntry(createPackageName("curl", "8.1.0", "amd64"), ["usr/bin/curl"])],
      cacheKey,
      MANIFEST_INPUTS,
      MANIFEST_OUTPUTS,
    );

    await manifest.writeToFile(filePath);
    const parsed = await Manifest.readFromFile(filePath);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0]?.packageName.serialize()).toBe("curl:amd64=8.1.0");
  });

  it("ManifestEntry fromJSON parsed entry returns package and sorted files", () => {
    const entry = new ManifestEntry(createPackageName("curl", "8.1.0", "amd64"), [
      "usr/bin/curl",
      "etc/curlrc",
    ]);

    const parsed = ManifestEntry.fromJSON(JSON.parse(JSON.stringify(entry)));

    expect(parsed).toEqual(entry);
  });

  it("ManifestEntry fromJSON entry with alternatives returns them", () => {
    const alternative = {
      name: "editor",
      link: "/usr/bin/editor",
      path: "/bin/nano",
      priority: 40,
      slaves: [
        {
          name: "editor.1.gz",
          link: "/usr/share/man/man1/editor.1.gz",
          path: "/usr/share/man/man1/nano.1.gz",
        },
      ],
    };
    const entry = new ManifestEntry(createPackageName("nano", "7.2", "amd64"), ["bin/nano"], [alternative]);

    const parsed = ManifestEntry.fromJSON(JSON.parse(JSON.stringify(entry)));

    expect(parsed.alternatives).toEqual([alternative]);
  });

  it("ManifestEntry fromJSON entry saved before alternatives were recorded returns none", () => {
    const parsed = ManifestEntry.fromJSON({
      packageName: JSON.parse(JSON.stringify(createPackageName("curl", "8.1.0", "amd64"))),
      filepaths: ["usr/bin/curl"],
    });

    expect(parsed.alternatives).toEqual([]);
  });
});
