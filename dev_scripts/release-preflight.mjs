import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "..");
const packageJsonPath = path.join(repoRoot, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

const rawTag = process.env.RELEASE_TAG ?? process.argv[2] ?? "";
if (!rawTag) {
  throw new Error("RELEASE_TAG must be provided for release preflight checks.");
}

if (!/^v\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.-]+)?$/.test(rawTag)) {
  throw new Error(`Release tag '${rawTag}' is not a valid semver-style tag.`);
}

const expectedVersion = String(packageJson.version ?? "");
const actualVersion = rawTag.slice(1);
if (expectedVersion !== actualVersion) {
  throw new Error(
    `Release tag '${rawTag}' does not match package.json version '${expectedVersion}'.`,
  );
}

if (packageJson.private === true) {
  throw new Error("package.json must not be private for publish releases.");
}

process.stdout.write(`Release preflight passed for ${rawTag}.\n`);
