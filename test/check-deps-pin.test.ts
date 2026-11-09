import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkDependencyPin, type PackageJson, type PackageLock } from "../scripts/ops/check_deps_pin.mts";

const NAME = "pinned-dep";
const VERSION = "1.2.3";
const SHA = "0123456789abcdef0123456789abcdef01234567";
const SHA_SPEC = `git+https://github.com/example/pinned-dep.git#${SHA}`;
const REGISTRY_RESOLVED = `https://registry.npmjs.org/${NAME}/-/${NAME}-${VERSION}.tgz`;
const INTEGRITY = "sha512-AAAA";
// No node_modules here, so the symlink check never fires.
const ROOT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "check-deps-pin-"));

const packageJsonOf = (spec: string): PackageJson => ({
  dependencies: { [NAME]: spec },
});

const lockOf = (rootSpec: string, entry: NonNullable<PackageLock["packages"]>[string]): PackageLock => ({
  packages: {
    "": { dependencies: { [NAME]: rootSpec } },
    [`node_modules/${NAME}`]: entry,
  },
});

const REGISTRY_ENTRY = {
  version: VERSION,
  resolved: REGISTRY_RESOLVED,
  integrity: INTEGRITY,
};

const check = (spec: string, lock: PackageLock) =>
  checkDependencyPin(NAME, packageJsonOf(spec), lock, ROOT_DIR);

describe("checkDependencyPin", () => {
  it("checkDependencyPin exact registry version with matching lock returns no problems", () => {
    expect(check(VERSION, lockOf(VERSION, REGISTRY_ENTRY))).toEqual([]);
  });

  it("checkDependencyPin commit SHA with matching lock returns no problems", () => {
    const lock = lockOf(SHA_SPEC, { resolved: `git+ssh://x.git#${SHA}` });

    expect(check(SHA_SPEC, lock)).toEqual([]);
  });

  it.each(["^1.2.3", "~1.2.3", "latest", "1.2", "git+https://x.git#main"])(
    "checkDependencyPin unpinned spec %s returns a pin problem",
    (spec) => {
      expect(check(spec, lockOf(spec, REGISTRY_ENTRY))).toEqual([expect.stringContaining("is not pinned")]);
    },
  );

  it.each([
    ["version", { ...REGISTRY_ENTRY, version: "1.2.4" }, "version"],
    ["resolved", { ...REGISTRY_ENTRY, resolved: "https://evil.example/x.tgz" }, "is not from"],
    ["integrity", { ...REGISTRY_ENTRY, integrity: undefined }, "integrity"],
    ["link", { ...REGISTRY_ENTRY, link: true }, "is a link"],
  ])(
    "checkDependencyPin registry pin with mismatched lock %s returns a problem",
    (_field, entry, message) => {
      expect(check(VERSION, lockOf(VERSION, entry))).toEqual([expect.stringContaining(message)]);
    },
  );

  it("checkDependencyPin lock root spec differs returns a mismatch problem", () => {
    expect(check(VERSION, lockOf("1.2.4", REGISTRY_ENTRY))).toEqual([
      expect.stringContaining("does not match package.json"),
    ]);
  });
});
