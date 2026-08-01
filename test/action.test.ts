import { describe, expect, it } from "vitest";
import {
  runAction,
  type ActionInputs,
  type ActionOutputs,
} from "../src/action.js";
import { Manifest, ManifestEntry } from "../src/manifest.js";
import { CacheKey } from "../src/cache.js";
import { createPackageName } from "ts-apt";
import { ActionPackageNames } from "../src/packages.js";

describe("runAction", () => {
  const PKG_NAME = "curl";
  const PKG_VER = "1.2.3";
  const PKG2_NAME = "git";
  const PKG3_NAME = "jq";

  it("returns expected outputs for cache hit", async () => {
    const inputs: ActionInputs = {
      packages: `${PKG_NAME},${PKG2_NAME},${PKG3_NAME}`,
      version: PKG_VER,
      executeInstallScripts: false,
      emptyPackagesBehavior: "error",
      debug: false,
    };

    const packageNames = ActionPackageNames.fromInput(inputs.packages);
    const cacheKey = new CacheKey(
      inputs.version,
      "0",
      process.arch,
      packageNames,
    );
    const manifest = new Manifest(
      new Date(),
      [
        new ManifestEntry(createPackageName(PKG_NAME, PKG_VER, undefined), []),
        new ManifestEntry(createPackageName(PKG2_NAME, PKG_VER, undefined), []),
        new ManifestEntry(createPackageName(PKG3_NAME, PKG_VER, undefined), []),
      ],
      cacheKey,
    );

    const mockCache = {
      loadAndRestore: async () => manifest,
      archiveAndSave: async () => {},
    };

    const mockCommandRunner = {
      run: async () => {},
    };

    const mockLogger = {
      info: () => {},
      error: () => {},
      debug: () => {},
    };

    const outputs: ActionOutputs = await runAction(
      inputs,
      mockCommandRunner as never,
      mockCache as never,
      mockLogger as never,
    );

    expect(outputs.cacheHit).toBe(true);
    expect(outputs.packageVersionList).toBe(
      `${PKG_NAME}=${PKG_VER},${PKG2_NAME}=${PKG_VER},${PKG3_NAME}=${PKG_VER}`,
    );
    expect(outputs.allPackageVersionList).toBe(
      `${PKG_NAME}=${PKG_VER},${PKG2_NAME}=${PKG_VER},${PKG3_NAME}=${PKG_VER}`,
    );
  });
});
