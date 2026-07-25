import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Cache, CacheKey, isAptListsFresh } from "../src/cache.ts";
import { ActionPackageName } from "../src/action.ts";

describe("io", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects fresh apt lists when a file exists within search depth", () => {
    vi.spyOn(fs, "statSync").mockImplementation(
      (currentPath: fs.PathLike) =>
        ({
          isDirectory: () =>
            String(currentPath) !== "/var/lib/apt/lists/partial/pkg.idx",
        }) as fs.Stats,
    );

    vi.spyOn(fs, "readdirSync")
      .mockImplementationOnce(() => ["partial"] as never)
      .mockImplementationOnce(() => ["pkg.idx"] as never);

    expect(isAptListsFresh()).toBe(true);
  });

  it("returns a boolean for the current system apt list state", () => {
    expect(typeof isAptListsFresh()).toBe("boolean");
  });

  it("serializes package values", () => {
    expect(new ActionPackageName("git", "1.2.3").serialize()).toBe("git@1.2.3");
  });

  it("serializes and deserializes cache keys", () => {
    const key = new CacheKey("v1", "4", "arm64", ["curl=1", "git=2"]);
    expect(key.serialize()).toBe("v1 | 4 | arm64 | curl=1,git=2");

    expect(CacheKey.deserialize(key.serialize())).toEqual(
      new CacheKey("v1", "4", "arm64", ["curl=1", "git=2"]),
    );
  });

  it("rejects invalid serialized cache keys", () => {
    expect(() => CacheKey.deserialize("invalid")).toThrow(
      /Invalid serialized cache key/,
    );
  });

  it("builds cache paths under the current home directory", () => {
    const cache = new Cache("custom-cache", {
      run: vi.fn(),
    } as never);

    expect(cache.path).toBe(path.join(os.homedir(), "custom-cache"));
  });

  it("hashes cache keys without appending the default x86_64 architecture", async () => {
    const commandRunner = {
      run: vi.fn().mockResolvedValue({ stdout: "x86_64\n" }),
    };
    const cache = new Cache("cache-apt-pkgs", commandRunner as never);

    const expectedHash = crypto
      .createHash("md5")
      .update("curl=1 git=2 @ 'v1' 4")
      .digest("hex");

    await expect(cache.getKey(["curl=1", "git=2"], "v1")).resolves.toBe(
      `cache-apt-pkgs_${expectedHash}`,
    );
  });

  it("hashes cache keys with non-default architectures", async () => {
    const commandRunner = {
      run: vi.fn().mockResolvedValue({ stdout: "arm64\n" }),
    };
    const cache = new Cache("cache-apt-pkgs", commandRunner as never);

    const expectedHash = crypto
      .createHash("md5")
      .update("curl=1 git=2 @ 'v1' 4 arm64")
      .digest("hex");

    await expect(cache.getKey(["curl=1", "git=2"], "v1")).resolves.toBe(
      `cache-apt-pkgs_${expectedHash}`,
    );
  });
});
