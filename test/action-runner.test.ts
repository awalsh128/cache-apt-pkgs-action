import { afterEach, describe, expect, it, vi } from "vitest";
import winston from "winston";
import { Manifest, ManifestEntry } from "../src/manifest.js";
import { CacheKey } from "../src/cache.js";
import { ActionPackageNames } from "../src/packages.js";
import { createPackageManager, createPackageName } from "ts-apt";

import { ActionRunner } from "../src/action.js";

vi.mock("ts-apt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ts-apt")>();
  return {
    ...actual,
    createPackageManager: vi.fn(),
  };
});

describe("ActionRunner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(createPackageManager).mockReset();
  });

  function createRunner() {
    const cache = {
      loadAndRestore: vi.fn(),
      archiveAndSave: vi.fn(),
    };

    const commandRunner = {
      run: vi.fn(),
    };

    const logger = winston.createLogger({ silent: true });
    return {
      runner: new ActionRunner(cache as never, commandRunner as never, logger),
      cache,
      commandRunner,
    };
  }

  it("returns cache-hit outputs when manifest is restored", async () => {
    const { runner, cache } = createRunner();
    const packageNames = ActionPackageNames.fromInput("curl git");
    const cacheKey = new CacheKey("v1", "0", process.arch, packageNames);
    const restored = new Manifest(new Date(), [], cacheKey);
    cache.loadAndRestore.mockResolvedValue(restored);

    const result = await runner.runAction({
      packages: "curl git",
      version: "v1",
      executeInstallScripts: false,
      emptyPackagesBehavior: "error",
      debug: false,
    });

    expect(result.cacheHit).toBe(true);
    expect(cache.archiveAndSave).not.toHaveBeenCalled();
  });

  it("runAction cache miss archives installed packages with their files", async () => {
    // Unlikely to have dpkg install scripts on the test host.
    const installedPackage = createPackageName("test-pkg-not-real", "1.0.0");
    // buildFileList keeps only files that exist, so use this test file.
    const installedFile = import.meta.filename;
    const { runner, cache } = createRunner();
    cache.loadAndRestore.mockResolvedValue(undefined);
    vi.mocked(createPackageManager).mockResolvedValue({
      install: vi.fn().mockResolvedValue([{ name: installedPackage }]),
      listInstalledFiles: vi.fn().mockResolvedValue([installedFile]),
    } as never);

    await runner.runAction({
      packages: installedPackage.serialize(),
      version: "v1",
      executeInstallScripts: false,
      emptyPackagesBehavior: "error",
      debug: false,
    });

    expect(cache.archiveAndSave).toHaveBeenCalledTimes(1);
    const [manifest] = cache.archiveAndSave.mock.calls[0]!;
    expect(manifest.entries).toEqual([
      new ManifestEntry(installedPackage, [installedFile.slice(1)]),
    ]);
  });
});
