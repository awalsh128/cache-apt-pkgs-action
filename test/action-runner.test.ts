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

const NATIVE_ARCH = "amd64";

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
      logger,
    };
  }

  it("returns cache-hit outputs when manifest is restored", async () => {
    const { runner, cache } = createRunner();
    const packageNames = ActionPackageNames.fromInput("curl git");
    const cacheKey = new CacheKey("v1", "0", process.arch, packageNames);
    const restored = new Manifest(new Date(), [], cacheKey);
    cache.loadAndRestore.mockResolvedValue(restored);
    vi.mocked(createPackageManager).mockResolvedValue({
      getNativeArchitecture: vi.fn().mockResolvedValue(NATIVE_ARCH),
    } as never);

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

  it("runAction cache hit creates package manager without apt-fast", async () => {
    const { runner, cache } = createRunner();
    const packageNames = ActionPackageNames.fromInput("curl");
    const cacheKey = new CacheKey("v1", "0", process.arch, packageNames);
    cache.loadAndRestore.mockResolvedValue(new Manifest(new Date(), [], cacheKey));
    vi.mocked(createPackageManager).mockResolvedValue({
      getNativeArchitecture: vi.fn().mockResolvedValue(NATIVE_ARCH),
    } as never);

    await runner.runAction({
      packages: "curl",
      version: "v1",
      executeInstallScripts: false,
      emptyPackagesBehavior: "error",
      debug: false,
    });

    expect(vi.mocked(createPackageManager).mock.calls[0]?.[0]).toBe(false);
  });

  it("runAction cache miss archives installed packages with their files", async () => {
    // Unlikely to have dpkg install scripts on the test host.
    const installedPackage = createPackageName("test-pkg-not-real", "1.0.0");
    // buildFileList keeps only files that exist, so use this test file.
    const installedFile = import.meta.filename;
    const { runner, cache } = createRunner();
    cache.loadAndRestore.mockResolvedValue(undefined);
    vi.mocked(createPackageManager).mockResolvedValue({
      update: vi.fn().mockResolvedValue(0),
      install: vi.fn().mockResolvedValue([{ name: installedPackage }]),
      listInstalledFiles: vi.fn().mockResolvedValue([installedFile]),
      getNativeArchitecture: vi.fn().mockResolvedValue(NATIVE_ARCH),
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
    expect(manifest.entries).toEqual([new ManifestEntry(installedPackage, [installedFile.slice(1)])]);
  });

  it("runAction cache miss refreshes the apt index before installing", async () => {
    const { runner, cache } = createRunner();
    cache.loadAndRestore.mockResolvedValue(undefined);
    const update = vi.fn().mockResolvedValue(0);
    const install = vi.fn().mockResolvedValue([]);
    vi.mocked(createPackageManager).mockResolvedValue({
      update,
      install,
      getNativeArchitecture: vi.fn().mockResolvedValue(NATIVE_ARCH),
    } as never);

    await runner.runAction({
      packages: "curl",
      version: "v1",
      executeInstallScripts: false,
      emptyPackagesBehavior: "error",
      debug: false,
    });

    expect(update.mock.invocationCallOrder[0]).toBeLessThan(install.mock.invocationCallOrder[0]!);
  });

  it("runAction cache miss logs how long each install step took", async () => {
    const { runner, cache, logger } = createRunner();
    cache.loadAndRestore.mockResolvedValue(undefined);
    const infoSpy = vi.spyOn(logger, "info");
    vi.mocked(createPackageManager).mockResolvedValue({
      update: vi.fn().mockResolvedValue(0),
      install: vi.fn().mockResolvedValue([]),
      getNativeArchitecture: vi.fn().mockResolvedValue(NATIVE_ARCH),
    } as never);

    await runner.runAction({
      packages: "curl",
      version: "v1",
      executeInstallScripts: false,
      emptyPackagesBehavior: "error",
      debug: false,
    });

    const messages = infoSpy.mock.calls.map(([message]) => String(message));
    expect(
      ["Cache restore", "apt update", "apt install", "Listing installed files", "Archive and cache save"].map(
        (step) => messages.some((message) => new RegExp(`^${step} took \\d+\\.\\ds$`).test(message)),
      ),
    ).toEqual([true, true, true, true, true]);
  });

  it("runAction cache hit does not refresh the apt index", async () => {
    const { runner, cache } = createRunner();
    const cacheKey = new CacheKey("v1", "0", process.arch, ActionPackageNames.fromInput("curl"));
    cache.loadAndRestore.mockResolvedValue(new Manifest(new Date(), [], cacheKey));
    const update = vi.fn();
    vi.mocked(createPackageManager).mockResolvedValue({
      update,
      getNativeArchitecture: vi.fn().mockResolvedValue(NATIVE_ARCH),
    } as never);

    await runner.runAction({
      packages: "curl",
      version: "v1",
      executeInstallScripts: false,
      emptyPackagesBehavior: "error",
      debug: false,
    });

    expect(update).not.toHaveBeenCalled();
  });
});
