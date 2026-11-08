import fs from "node:fs";
import path from "node:path";
import * as ghcache from "@actions/cache";
import {
  createPackageName,
  type CommandOptions,
  type PackageName,
} from "ts-apt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import winston from "winston";

import {
  Cache,
  CacheKey,
  CACHE_DEFAULT_DIRNAME,
  MANIFEST_ALL_FILENAME,
  MANIFEST_MAIN_FILENAME,
} from "../src/cache.js";
import { Manifest, ManifestEntry } from "../src/manifest.js";
import { ActionPackageNames } from "../src/packages.js";

// Cache resolves its directory from os.homedir(), so point it at a temp dir.
const { HOME_DIR } = await vi.hoisted(async () => {
  const nodeFs = await import("node:fs");
  const nodeOs = await import("node:os");
  const nodePath = await import("node:path");
  return {
    HOME_DIR: nodeFs.mkdtempSync(
      nodePath.join(nodeOs.tmpdir(), "cache-restore-test-"),
    ),
  };
});

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, homedir: () => HOME_DIR };
});
vi.mock("@actions/cache", () => ({
  restoreCache: vi.fn(),
  saveCache: vi.fn(),
  isFeatureAvailable: vi.fn(),
}));

const CACHE_DIR = path.join(HOME_DIR, CACHE_DEFAULT_DIRNAME);
const CACHE_ID = 42;
const REQUESTED_PACKAGE = createPackageName("app", "1.0");
// Install order from apt, deliberately not alphabetical.
const INSTALL_ORDER = [
  createPackageName("zlib1g", "1.2"),
  createPackageName("libfoo", "2.0"),
  REQUESTED_PACKAGE,
];
// Packages without files (e.g. metapackages) get no archive.
const METAPACKAGE = createPackageName("meta", "1.0");
const KEY = new CacheKey(
  "v1",
  "1",
  "x86_64",
  ActionPackageNames.fromInput(REQUESTED_PACKAGE.serialize()),
);

const archivePath = (packageName: PackageName) =>
  path.join(CACHE_DIR, packageName.serialize() + ".tar");
const filesOf = (packageName: PackageName) => [
  `usr/lib/${packageName.name}.so`,
];
const entryOf = (packageName: PackageName) =>
  new ManifestEntry(packageName, filesOf(packageName));
const MANIFEST = new Manifest(
  new Date(0),
  [...INSTALL_ORDER.map(entryOf), new ManifestEntry(METAPACKAGE)],
  KEY,
);

async function writeCache(archivedPackages = INSTALL_ORDER): Promise<void> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  await new Manifest(
    MANIFEST.created,
    [entryOf(REQUESTED_PACKAGE)],
    KEY,
  ).writeToFile(path.join(CACHE_DIR, MANIFEST_MAIN_FILENAME));
  await MANIFEST.writeToFile(path.join(CACHE_DIR, MANIFEST_ALL_FILENAME));
  archivedPackages.forEach((pkg) => fs.writeFileSync(archivePath(pkg), ""));
}

/** Archive operations observed through the command runner. */
interface TarCalls {
  created: [archive: string, files: string[]][];
  extracted: string[];
  /** Number of commands run that extracted archives. */
  extractCommands?: number;
}

const argValue = (args: string[], flag: string) =>
  args.find((arg) => arg.startsWith(`${flag}=`))?.slice(flag.length + 1);

/** Records sudo tar calls, including the file list piped to tar create. */
function recordTar(calls: TarCalls) {
  return vi.fn(
    async (_command: string, args: string[] = [], options: CommandOptions = {}) => {
      const archive = argValue(args, "--file") ?? "";
      if (args.includes("--create")) {
        calls.created.push([archive, String(options.input ?? "").split("\0")]);
      }
      // Extraction runs as `sh -c <script> sh <archive>...`.
      if (args[0] === "sh" && args[1] === "-c") {
        calls.extracted.push(...args.slice(4));
        calls.extractCommands = (calls.extractCommands ?? 0) + 1;
      }
      return { cmdLine: "", stdout: "", stderr: "", exitCode: 0 };
    },
  );
}

function createCache(calls: TarCalls = { created: [], extracted: [] }): Cache {
  const logger = winston.createLogger({ silent: true });
  return new Cache({ run: recordTar(calls) } as never, logger);
}

describe("Cache", () => {
  beforeEach(() => {
    vi.mocked(ghcache.restoreCache).mockResolvedValue(KEY.hash);
    vi.mocked(ghcache.saveCache).mockResolvedValue(CACHE_ID);
    vi.mocked(ghcache.isFeatureAvailable).mockReturnValue(true);
  });

  afterEach(() => {
    fs.rmSync(CACHE_DIR, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("loadAndRestore cache hit extracts archives in install order", async () => {
    await writeCache();

    const calls: TarCalls = { created: [], extracted: [] };

    const manifest = await createCache(calls).loadAndRestore(KEY, false);

    expect(manifest).toBeDefined();
    expect(calls.extracted).toEqual(INSTALL_ORDER.map(archivePath));
  });

  it("loadAndRestore without install scripts extracts all archives in one command", async () => {
    await writeCache();

    const calls: TarCalls = { created: [], extracted: [] };

    await createCache(calls).loadAndRestore(KEY, false);

    expect(calls.extractCommands).toBe(1);
  });

  it("loadAndRestore with install scripts extracts archives one at a time in install order", async () => {
    await writeCache();

    const calls: TarCalls = { created: [], extracted: [] };

    await createCache(calls).loadAndRestore(KEY, true);

    expect(calls.extracted).toEqual(INSTALL_ORDER.map(archivePath));
    expect(calls.extractCommands).toBe(INSTALL_ORDER.length);
  });

  it("loadAndRestore archive missing returns undefined without extracting", async () => {
    await writeCache(INSTALL_ORDER.slice(1));

    const calls: TarCalls = { created: [], extracted: [] };

    const manifest = await createCache(calls).loadAndRestore(KEY, false);

    expect(manifest).toBeUndefined();
    expect(calls.extracted).toEqual([]);
  });

  it("archiveAndSave packages with files creates archives of their files", async () => {
    const calls: TarCalls = { created: [], extracted: [] };

    const cacheId = await createCache(calls).archiveAndSave(MANIFEST);

    expect(cacheId).toBe(CACHE_ID);
    expect(calls.created).toEqual(
      INSTALL_ORDER.map((pkg) => [archivePath(pkg), filesOf(pkg)]),
    );
  });

  it("archiveAndSave manifest written records package files", async () => {
    await createCache().archiveAndSave(MANIFEST);

    const written = await Manifest.readFromFile(
      path.join(CACHE_DIR, MANIFEST_ALL_FILENAME),
    );
    expect(written.entries.map((entry) => entry.filepaths)).toEqual(
      MANIFEST.entries.map((entry) => entry.filepaths),
    );
  });

  it("loadAndRestore cache hit returns all installed packages", async () => {
    await writeCache();

    const manifest = await createCache().loadAndRestore(KEY, false);

    expect(
      manifest?.entries.map((entry) => entry.packageName.serialize()),
    ).toEqual(MANIFEST.entries.map((entry) => entry.packageName.serialize()));
  });

  it("archiveAndSave requested package without version records installed entry in main manifest", async () => {
    const unversionedKey = new CacheKey(
      "v1",
      "1",
      "x86_64",
      ActionPackageNames.fromInput(REQUESTED_PACKAGE.name),
    );

    await createCache().archiveAndSave(
      new Manifest(MANIFEST.created, MANIFEST.entries, unversionedKey),
    );

    const written = await Manifest.readFromFile(
      path.join(CACHE_DIR, MANIFEST_MAIN_FILENAME),
    );
    expect(
      written.entries.map((entry) => [
        entry.packageName.serialize(),
        entry.filepaths,
      ]),
    ).toEqual([[REQUESTED_PACKAGE.serialize(), filesOf(REQUESTED_PACKAGE)]]);
  });
});
