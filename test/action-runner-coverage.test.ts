import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import winston from "winston";

vi.mock("@actions/cache", () => ({
  restoreCache: vi.fn(),
  saveCache: vi.fn(),
}));

vi.mock("ts-apt", () => ({
  createPackageManager: vi.fn(),
  DefaultCommandRunner: vi.fn().mockImplementation(() => ({
    run: vi.fn(),
  })),
}));

import * as cacheMod from "@actions/cache";
import { createPackageManager, DefaultCommandRunner } from "ts-apt";
import { Manifest } from "../src/manifest.js";
import { CacheKey } from "../src/cache.ts";
import {
  ActionPackageName,
  ActionRunner,
  runAction as runActionEntry,
} from "../src/action.js";

describe("ActionRunner coverage", () => {
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
      tarModule,
      logger,
    };
  }

  it("parseBoolean invalid value expected throw", () => {
    const { runner } = createRunner();

    expect(() => runner.parseBoolean("invalid", "debug")).toThrow(
      /must be either true or false/,
    );
  });

  it("normalizeInputPackages escaped separators expected sorted output", () => {
    const { runner } = createRunner();

    expect(runner.normalizeInputPackages(" z, a \\ b ")).toEqual([
      "a",
      "b",
      "z",
    ]);
  });

  it("validateEmptyPackages ignore empty expected no throw", () => {
    const { runner } = createRunner();

    expect(() => runner.validateEmptyPackages("ignore", [])).not.toThrow();
  });

  it("findInstallScript missing directory expected undefined", () => {
    const { runner } = createRunner();
    vi.spyOn(fs, "existsSync").mockReturnValue(false);

    expect(runner.findInstallScript("curl", "preinst", "/tmp")).toBeUndefined();
  });

  it("findInstallScript matching scripts expected first sorted path", () => {
    const { runner } = createRunner();
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readdirSync").mockReturnValue([
      "curl:amd64.preinst",
      "curl.preinst",
      "curl.postinst",
    ] as never);

    expect(runner.findInstallScript("curl", "preinst", "/tmp")).toBe(
      "/tmp/var/lib/dpkg/info/curl:amd64.preinst",
    );
  });

  it("buildFileListForPackage mixed files and scripts expected unique sorted tar paths", async () => {
    const { runner } = createRunner();
    const packageManager = {
      listInstalledFiles: vi
        .fn()
        .mockResolvedValue(["/a", "/b", "/missing", "/a"]),
    };

    vi.spyOn(fs, "existsSync").mockImplementation((p) => p !== "/missing");
    vi.spyOn(fs, "lstatSync").mockImplementation(
      (p) =>
        ({
          isFile: () => p === "/a",
          isSymbolicLink: () => p === "/b",
        }) as fs.Stats,
    );
    vi.spyOn(runner, "findInstallScript")
      .mockReturnValueOnce("/var/lib/dpkg/info/curl.preinst")
      .mockReturnValueOnce("/var/lib/dpkg/info/curl.postinst");

    await expect(
      runner.buildFileListForPackage(
        packageManager as never,
        new ActionPackageName("curl"),
      ),
    ).resolves.toEqual([
      "a",
      "b",
      "var/lib/dpkg/info/curl.postinst",
      "var/lib/dpkg/info/curl.preinst",
    ]);
  });

  it("installAndCachePackages new archives expected tar create and manifests", async () => {
    const { runner, tarModule } = createRunner();
    const packageManager = {
      install: vi.fn().mockResolvedValue([{ name: "curl", version: "1.0" }]),
      update: vi.fn().mockResolvedValue(undefined),
    };

    vi.spyOn(runner, "updateAptLists").mockResolvedValue(undefined);
    vi.spyOn(runner, "buildFileListForPackage").mockResolvedValue([
      "usr/bin/curl",
    ]);
    vi.spyOn(fs, "existsSync").mockReturnValue(false);

    await runner.installAndCachePackages(
      "/cache",
      [new ActionPackageName("curl")],
      packageManager as never,
      new CacheKey("", "4", "x86_64", ["curl"]),
    );

    expect(tarModule.create).toHaveBeenCalledOnce();
    expect(fs.existsSync("/cache/manifest_main.json")).toBe(true);
    expect(fs.existsSync("/cache/manifest_all.json")).toBe(true);
  });

  it("restorePackages install scripts enabled expected extract and script runs", async () => {
    const { runner, commandRunner, tarModule } = createRunner();

    vi.spyOn(fs, "readdirSync").mockReturnValue([
      "curl=1.0.tar",
      "notes.txt",
    ] as never);
    vi.spyOn(runner, "findInstallScript")
      .mockReturnValueOnce("/preinst")
      .mockReturnValueOnce("/postinst");

    await runner.restorePackages("/cache", true);

    expect(tarModule.extract).toHaveBeenCalledWith({
      cwd: "/",
      file: "/cache/curl=1.0.tar",
      preservePaths: true,
    });
    expect(commandRunner.run).toHaveBeenNthCalledWith(1, "sudo", [
      "sh",
      "-x",
      "/preinst",
      "install",
    ]);
    expect(commandRunner.run).toHaveBeenNthCalledWith(2, "sudo", [
      "sh",
      "-x",
      "/postinst",
      "configure",
    ]);
  });

  it("runAction version contains spaces expected throw", async () => {
    const { runner } = createRunner();

    await expect(
      runner.runAction({
        packages: "curl",
        version: "bad version",
        executeInstallScripts: false,
        emptyPackagesBehavior: "error",
        debug: false,
      }),
    ).rejects.toThrow(/cannot contain spaces/);
  });

  it("runAction empty normalized packages expected empty outputs and manifests", async () => {
    const { runner } = createRunner();
    const cacheDir = path.join(os.tmpdir(), "action-empty-cache");

    vi.mocked(createPackageManager).mockResolvedValue({} as never);
    vi.spyOn(runner, "normalizePackagesWithVersions").mockResolvedValue([]);
    vi.spyOn(runner, "getCacheRoot").mockReturnValue(cacheDir);

    await expect(
      runner.runAction({
        packages: "",
        version: "",
        executeInstallScripts: false,
        emptyPackagesBehavior: "ignore",
        debug: false,
      }),
    ).resolves.toEqual({
      cacheHit: false,
      packageVersionList: "",
      allPackageVersionList: "",
    });

    expect(fs.existsSync(path.join(cacheDir, "manifest_main.json"))).toBe(true);
    expect(fs.existsSync(path.join(cacheDir, "manifest_all.json"))).toBe(true);
  });

  it("runAction cache miss expected install and save cache", async () => {
    const { runner } = createRunner();
    const cacheDir = path.join(os.tmpdir(), "action-cache-miss");

    vi.mocked(createPackageManager)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({ install: vi.fn() } as never);
    vi.spyOn(runner, "normalizePackagesWithVersions").mockResolvedValue([
      new ActionPackageName("curl", "1.0"),
    ]);
    vi.spyOn(runner, "getCacheRoot").mockReturnValue(cacheDir);
    vi.spyOn(runner, "getCacheKey").mockResolvedValue("cache-apt-pkgs_key");
    vi.spyOn(runner, "installAndCachePackages").mockResolvedValue(undefined);
    vi.mocked(cacheMod.restoreCache).mockResolvedValue(undefined);
    vi.mocked(cacheMod.saveCache).mockResolvedValue(1);
    vi.spyOn(Manifest, "readFromFile")
      .mockReturnValueOnce(
        Manifest.deserialize(
          JSON.stringify({
            entries: [{ name: "curl", version: "1.0", filepaths: [] }],
            cacheKeyInput: "",
            cacheKey: "",
            forceUpdateIncrement: "4",
            arch: "x86_64",
          }),
        ),
      )
      .mockReturnValueOnce(
        Manifest.deserialize(
          JSON.stringify({
            entries: [
              { name: "curl", version: "1.0", filepaths: [] },
              { name: "dep", version: "1.0", filepaths: [] },
            ],
            cacheKeyInput: "",
            cacheKey: "",
            forceUpdateIncrement: "4",
            arch: "x86_64",
          }),
        ),
      );

    await expect(
      runner.runAction({
        packages: "curl",
        version: "v1",
        executeInstallScripts: false,
        emptyPackagesBehavior: "error",
        debug: false,
      }),
    ).resolves.toEqual({
      cacheHit: false,
      packageVersionList: "curl=1.0",
      allPackageVersionList: "curl=1.0,dep=1.0",
    });

    expect(runner.installAndCachePackages).toHaveBeenCalledOnce();
    expect(cacheMod.saveCache).toHaveBeenCalledWith(
      [cacheDir],
      "cache-apt-pkgs_key",
    );
  });

  it("runAction cache hit expected restore packages", async () => {
    const { runner } = createRunner();
    const cacheDir = path.join(os.tmpdir(), "action-cache-hit");

    vi.mocked(createPackageManager).mockResolvedValue({} as never);
    vi.spyOn(runner, "normalizePackagesWithVersions").mockResolvedValue([
      new ActionPackageName("curl", "1.0"),
    ]);
    vi.spyOn(runner, "getCacheRoot").mockReturnValue(cacheDir);
    vi.spyOn(runner, "getCacheKey").mockResolvedValue("cache-apt-pkgs_key");
    vi.spyOn(runner, "restorePackages").mockResolvedValue(undefined);
    vi.mocked(cacheMod.restoreCache).mockResolvedValue("cache-apt-pkgs_key");
    vi.spyOn(Manifest, "readFromFile")
      .mockReturnValueOnce(
        Manifest.deserialize(
          JSON.stringify({
            entries: [{ name: "curl", version: "1.0", filepaths: [] }],
            cacheKeyInput: "",
            cacheKey: "",
            forceUpdateIncrement: "4",
            arch: "x86_64",
          }),
        ),
      )
      .mockReturnValueOnce(
        Manifest.deserialize(
          JSON.stringify({
            entries: [
              { name: "curl", version: "1.0", filepaths: [] },
              { name: "dep", version: "1.0", filepaths: [] },
            ],
            cacheKeyInput: "",
            cacheKey: "",
            forceUpdateIncrement: "4",
            arch: "x86_64",
          }),
        ),
      );

    await expect(
      runner.runAction({
        packages: "curl",
        version: "v1",
        executeInstallScripts: true,
        emptyPackagesBehavior: "error",
        debug: false,
      }),
    ).resolves.toEqual({
      cacheHit: true,
      packageVersionList: "curl=1.0",
      allPackageVersionList: "curl=1.0,dep=1.0",
    });

    expect(runner.restorePackages).toHaveBeenCalledWith(cacheDir, true);
  });

  it("runAction wrapper valid inputs expected delegated runner output", async () => {
    const logger = winston.createLogger({ silent: true });
    const delegated = {
      cacheHit: false,
      packageVersionList: "curl=1.0",
      allPackageVersionList: "curl=1.0,dep=1.0",
    };

    const runSpy = vi
      .spyOn(ActionRunner.prototype, "runAction")
      .mockResolvedValue(delegated);

    await expect(
      runActionEntry(
        {
          packages: "curl",
          version: "v1",
          executeInstallScripts: false,
          emptyPackagesBehavior: "error",
          debug: false,
        },
        { run: vi.fn() } as never,
        logger,
      ),
    ).resolves.toEqual(delegated);

    expect(DefaultCommandRunner).toHaveBeenCalledWith(logger, logger);
    expect(runSpy).toHaveBeenCalledOnce();
  });
});
