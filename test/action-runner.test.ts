import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import winston from "winston";

import { ActionRunner } from "../src/action.js";

describe("ActionRunner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createRunner() {
    const commandRunner = {
      run: vi.fn(),
    };

    const logger = winston.createLogger({ silent: true });
    const tarModule = {
      create: vi.fn(),
      extract: vi.fn(),
    };

    return {
      runner: new ActionRunner(
        commandRunner as never,
        tarModule as never,
        logger,
      ),
      commandRunner,
    };
  }

  it("resolves package versions from package manager metadata", async () => {
    const { runner } = createRunner();
    const packageManager = {
      getPackageInfo: vi.fn().mockResolvedValue([{ version: "1.2.3" }]),
    };

    await expect(
      runner.resolvePackageVersion(packageManager as never, "git"),
    ).resolves.toBe("1.2.3");
  });

  it("fails when package metadata does not contain a version", async () => {
    const { runner } = createRunner();
    const packageManager = {
      getPackageInfo: vi.fn().mockResolvedValue([{}]),
    };

    await expect(
      runner.resolvePackageVersion(packageManager as never, "git"),
    ).rejects.toThrow(/Unable to resolve package version/);
  });

  it("normalizes packages and fills in missing versions", async () => {
    const { runner } = createRunner();
    vi.spyOn(runner, "resolvePackageVersion")
      .mockResolvedValueOnce("8.0")
      .mockResolvedValueOnce("2.39");

    await expect(
      runner.normalizePackagesWithVersions({} as never, "git curl=8.1"),
    ).resolves.toEqual(["curl=8.1", "git=8.0"]);
  });

  it("warns instead of throwing for empty packages when behavior is warn", () => {
    const { runner } = createRunner();
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    expect(() => runner.validateEmptyPackages("warn", [])).not.toThrow();
    expect(writeSpy).toHaveBeenCalledWith(
      "::warning::Packages argument is empty.\n",
    );
  });

  it("throws for empty packages when behavior is error", () => {
    const { runner } = createRunner();

    expect(() => runner.validateEmptyPackages("error", [])).toThrow(
      /Packages argument is empty/,
    );
  });

  it("returns the cache root under the current home directory", () => {
    const { runner } = createRunner();

    expect(runner.getCacheRoot()).toBe(
      path.join(os.homedir(), "cache-apt-pkgs"),
    );
  });

  it("hashes runner cache keys using the current architecture", async () => {
    const { runner, commandRunner } = createRunner();
    commandRunner.run.mockResolvedValue({ stdout: "arm64\n" });

    await expect(runner.getCacheKey(["curl=1", "git=2"], "v1")).resolves.toBe(
      "cache-apt-pkgs_36cfe31d08e34e7bd87b39c0e0145ece",
    );
  });

  it("removes versions from package specifiers", () => {
    const { runner } = createRunner();

    expect(runner.packageSpecifierToName("curl=8.1")).toBe("curl");
    expect(runner.packageSpecifierToName("git")).toBe("git");
  });

  it("strips leading slashes from tar paths", () => {
    const { runner } = createRunner();

    expect(runner.tarRelativePath("/var/cache/apt/pkg.tar")).toBe(
      "var/cache/apt/pkg.tar",
    );
    expect(runner.tarRelativePath("relative/file")).toBe("relative/file");
  });
});
