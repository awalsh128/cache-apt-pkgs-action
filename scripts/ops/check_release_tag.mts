#!/usr/bin/env -S node --experimental-strip-types
import {
  fail,
  logInfo,
  logSuccess,
  readJsonFile,
  ROOT_DIR,
} from "../devopslib.mts";

const tag: string | undefined = process.env.RELEASE_TAG;
if (!tag) {
  logInfo("RELEASE_TAG is not set; skipping release tag preflight checks.");
  process.exit(0);
}

if (!/^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(tag)) {
  fail(
    `Release tag '${tag}' is invalid. Expected semantic version format like v1.2.3 or v1.2.3-rc.1`,
  );
}

const packageJsonPath = `${ROOT_DIR}/package.json`;
const packageJson = readJsonFile(packageJsonPath) as { version?: string };
if (
  typeof packageJson.version !== "string" ||
  packageJson.version.length === 0
) {
  fail("package.json version is missing or invalid.");
}

const expectedTag = `v${packageJson.version}`;
if (tag !== expectedTag) {
  fail(
    `Release tag and package version mismatch: RELEASE_TAG='${tag}' but package.json version='${packageJson.version}'. Expected tag '${expectedTag}'.`,
  );
}

logSuccess(
  `Release preflight passed for tag ${tag} and package version ${packageJson.version}.`,
);
