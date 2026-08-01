import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Cache, CacheKey } from "../src/cache.js";
import { ActionPackageNames } from "../src/packages.js";

const ARCH = "arm64";
const CACHE_VER = "v1";
const FORCE_UPDATE_INCREMENT = "4";
const INPUT_PACKAGE_NAMES = ["curl=1", "git=2"];
const SERIALIZED_INPUT_PACKAGE_NAMES = INPUT_PACKAGE_NAMES.join(" ");
const HASH = "6753d4609b4f220748c84ac0893bd97d";
const CACHE_KEY_JSON =
  '{"arch":"arm64","forceUpdateIncrement":"4","hash":"6753d4609b4f220748c84ac0893bd97d","packageNames":{"items":[{"name":"curl","version":"1"},{"name":"git","version":"2"}]},"version":"v1"}';

describe("cache", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("CacheKey", () => {
    it("creates a cache key with the expected hash", () => {
      const key = new CacheKey(
        CACHE_VER,
        FORCE_UPDATE_INCREMENT,
        ARCH,
        ActionPackageNames.fromInput(SERIALIZED_INPUT_PACKAGE_NAMES),
      );
      expect(key.hash).toBe(HASH);
    });

    it("creates a cache key of unordered package names with the expected hash", () => {
      const key = new CacheKey(
        CACHE_VER,
        FORCE_UPDATE_INCREMENT,
        ARCH,
        ActionPackageNames.fromInput(INPUT_PACKAGE_NAMES.reverse().join(" ")),
      );
      expect(key.hash).toBe(HASH);
    });

    it("creates a cache key with the expected hash", () => {
      const key = new CacheKey(
        CACHE_VER,
        FORCE_UPDATE_INCREMENT,
        ARCH,
        ActionPackageNames.fromInput(SERIALIZED_INPUT_PACKAGE_NAMES),
      );
      expect(key.hash).toBe(HASH);
    });

    it("JSON roundtrips cache keys", () => {
      const key = new CacheKey(
        CACHE_VER,
        FORCE_UPDATE_INCREMENT,
        ARCH,
        ActionPackageNames.fromInput(SERIALIZED_INPUT_PACKAGE_NAMES),
      );

      expect(key.toJSON()).toBe(CACHE_KEY_JSON);

      expect(CacheKey.fromJSON(key.toJSON())).toEqual(
        new CacheKey(
          CACHE_VER,
          FORCE_UPDATE_INCREMENT,
          ARCH,
          ActionPackageNames.fromInput(SERIALIZED_INPUT_PACKAGE_NAMES),
        ),
      );
    });
  });

  // it("rejects invalid serialized cache keys", () => {
  //   expect(() => CacheKey.fromJSON("invalid")).toThrow(
  //     /Invalid serialized cache key/,
  //   );
  // });

  // it("builds cache paths under the current home directory", () => {
  //   const cache = new Cache({
  //     run: vi.fn(),
  //   } as never);

  //   expect(cache.path).toBe(path.join(os.homedir(), "custom-cache"));
  // });

  // it("hashes cache keys without appending the default x86_64 architecture", async () => {
  //   const commandRunner = {
  //     run: vi.fn().mockResolvedValue({ stdout: "x86_64\n" }),
  //   };
  //   const cache = new Cache("cache-apt-pkgs", commandRunner as never);

  //   const expectedHash = crypto
  //     .createHash("md5")
  //     .update("curl=1 git=2 @ 'v1' 4")
  //     .digest("hex");

  //   await expect(cache.getKey(["curl=1", "git=2"], "v1")).resolves.toBe(
  //     `cache-apt-pkgs_${expectedHash}`,
  //   );
  // });

  // it("hashes cache keys with non-default architectures", async () => {
  //   const commandRunner = {
  //     run: vi.fn().mockResolvedValue({ stdout: "arm64\n" }),
  //   };
  //   const cache = new Cache("cache-apt-pkgs", commandRunner as never);

  //   const expectedHash = crypto
  //     .createHash("md5")
  //     .update("curl=1 git=2 @ 'v1' 4 arm64")
  //     .digest("hex");

  //   await expect(cache.key(["curl=1", "git=2"], "v1")).resolves.toBe(
  //     `cache-apt-pkgs_${expectedHash}`,
  //   );
  // });
});
