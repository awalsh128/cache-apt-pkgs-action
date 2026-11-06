import fs from "node:fs";
import path from "node:path";
import * as ghcache from "@actions/cache";
import * as tar from "tar";
import { createPackageName } from "ts-apt";
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
vi.mock("@actions/cache", () => ({ restoreCache: vi.fn() }));
vi.mock("tar", () => ({ extract: vi.fn(), create: vi.fn() }));

const CACHE_DIR = path.join(HOME_DIR, CACHE_DEFAULT_DIRNAME);
const REQUESTED_PACKAGE = createPackageName("app", "1.0");
// Install order from apt, deliberately not alphabetical.
const INSTALL_ORDER = [
  createPackageName("zlib1g", "1.2"),
  createPackageName("libfoo", "2.0"),
  REQUESTED_PACKAGE,
];
const KEY = new CacheKey(
  "v1",
  "1",
  "x86_64",
  ActionPackageNames.fromInput(REQUESTED_PACKAGE.serialize()),
);

const archivePath = (packageName: { serialize(): string }) =>
  path.join(CACHE_DIR, packageName.serialize() + ".tar");

async function writeCache(archivedPackages = INSTALL_ORDER): Promise<void> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const created = new Date(0);
  await new Manifest(
    created,
    [new ManifestEntry(REQUESTED_PACKAGE)],
    KEY,
  ).writeToFile(path.join(CACHE_DIR, MANIFEST_MAIN_FILENAME));
  await new Manifest(
    created,
    INSTALL_ORDER.map((pkg) => new ManifestEntry(pkg)),
    KEY,
  ).writeToFile(path.join(CACHE_DIR, MANIFEST_ALL_FILENAME));
  archivedPackages.forEach((pkg) => fs.writeFileSync(archivePath(pkg), ""));
}

function createCache(): Cache {
  const logger = winston.createLogger({ silent: true });
  return new Cache({ run: vi.fn() } as never, logger);
}

describe("Cache.loadAndRestore", () => {
  beforeEach(() => {
    vi.mocked(ghcache.restoreCache).mockResolvedValue(KEY.hash);
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
});
