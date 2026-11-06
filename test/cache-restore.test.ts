import fs from "node:fs";
import path from "node:path";
import * as ghcache from "@actions/cache";
import * as tar from "tar";
import { createPackageName, type PackageName } from "ts-apt";
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
vi.mock("tar", () => ({ extract: vi.fn(), create: vi.fn() }));

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

function createCache(): Cache {
  const logger = winston.createLogger({ silent: true });
  return new Cache({ run: vi.fn() } as never, logger);
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

    const manifest = await createCache().loadAndRestore(KEY, false);

    expect(manifest).toBeDefined();
    expect(
      vi.mocked(tar.extract).mock.calls.map(([options]) => options?.file),
    ).toEqual(INSTALL_ORDER.map(archivePath));
  });

  it("loadAndRestore archive missing returns undefined without extracting", async () => {
    await writeCache(INSTALL_ORDER.slice(1));

    const manifest = await createCache().loadAndRestore(KEY, false);

    expect(manifest).toBeUndefined();
    expect(tar.extract).not.toHaveBeenCalled();
  });

  it("archiveAndSave packages with files creates archives of their files", async () => {
    const cacheId = await createCache().archiveAndSave(MANIFEST);

    expect(cacheId).toBe(CACHE_ID);
    // tar.create is overloaded, so type the (options, files) call shape used.
    const createCalls = vi.mocked(tar.create).mock.calls as unknown as [
      { file: string },
      string[],
    ][];
    expect(createCalls.map(([options, files]) => [options.file, files])).toEqual(INSTALL_ORDER.map((pkg) => [archivePath(pkg), filesOf(pkg)]));
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
});
