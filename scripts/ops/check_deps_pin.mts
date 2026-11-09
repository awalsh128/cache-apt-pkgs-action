#!/usr/bin/env -S node --experimental-strip-types
/**
 * Fails when a dependency is not pinned to an immutable, published source.
 *
 * Guards against shipping code built or tested against a locally linked
 * dependency (e.g. npm run dev:tsapt:link), which CI cannot see. For each
 * dependency name given as an argument, checks that:
 *   1. node_modules/<name> is not a symlink (skipped if it is absent).
 *   2. package.json pins <name> to either an exact npm registry version
 *      (e.g. `1.1.1`, no ranges) or a full git commit SHA (`...#<40 hex>`).
 *   3. package-lock.json resolves <name> to that same pin and not a link.
 *      A registry pin must resolve from registry.npmjs.org with an integrity
 *      hash, since npm never lets a published version change.
 *
 * Used by .husky/pre-push and the CI action-deps-pinned job.
 *
 * Usage: check_deps_pin.mts <dependency> [<dependency>...]
 */

import fs from "node:fs";
import path from "node:path";
import {
  fail,
  logError,
  logSuccess,
  readJsonFile,
  ROOT_DIR,
  runMain,
  usage,
} from "../devopslib.mts";

const SHA_PIN_PATTERN = /#([0-9a-f]{40})$/;
/** Exact semver version, optionally prerelease; rejects ranges and tags. */
const EXACT_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?$/;
const NPM_REGISTRY_URL = "https://registry.npmjs.org/";

/** Parsed package.json, limited to the fields the check reads. */
export type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type LockEntry = {
  version?: string;
  resolved?: string;
  integrity?: string;
  link?: boolean;
};

/** Parsed package-lock.json, limited to the fields the check reads. */
export type PackageLock = {
  packages?: Record<
    string,
    LockEntry & {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    }
  >;
};

function isSymlink(filePath: string): boolean {
  try {
    return fs.lstatSync(filePath).isSymbolicLink();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

/**
 * Checks that a dependency is pinned to an immutable source.
 *
 * @param name Dependency name as it appears in package.json.
 * @param packageJson Parsed package.json.
 * @param packageLock Parsed package-lock.json.
 * @param rootDir Repository root used to find node_modules.
 * @returns One problem message per failed check; empty when the pin is valid.
 */
export function checkDependencyPin(
  name: string,
  packageJson: PackageJson,
  packageLock: PackageLock,
  rootDir: string = ROOT_DIR,
): string[] {
  const problems: string[] = [];

  const modulePath = path.join(rootDir, "node_modules", name);
  if (isSymlink(modulePath)) {
    problems.push(
      `node_modules/${name} is a symlink to ${fs.readlinkSync(modulePath)}; unlink it and run 'npm ci' first.`,
    );
  }

  const spec =
    packageJson.dependencies?.[name] ?? packageJson.devDependencies?.[name];
  if (spec === undefined) {
    problems.push(`package.json has no ${name} dependency.`);
    return problems;
  }
  const sha = SHA_PIN_PATTERN.exec(spec)?.[1];
  const isExactVersion = EXACT_VERSION_PATTERN.test(spec);
  if (sha === undefined && !isExactVersion) {
    problems.push(
      `package.json ${name} '${spec}' is not pinned to an exact registry version or a full commit SHA.`,
    );
    return problems;
  }

  const root = packageLock.packages?.[""];
  const rootSpec = root?.dependencies?.[name] ?? root?.devDependencies?.[name];
  if (rootSpec !== spec) {
    problems.push(
      `package-lock.json root ${name} '${rootSpec}' does not match package.json '${spec}'.`,
    );
  }

  const entry = packageLock.packages?.[`node_modules/${name}`];
  if (entry === undefined) {
    problems.push(`package-lock.json has no node_modules/${name} entry.`);
  } else if (entry.link) {
    problems.push(
      `package-lock.json ${name} is a link to '${entry.resolved}'.`,
    );
  } else if (sha !== undefined) {
    if (!entry.resolved?.endsWith(`#${sha}`)) {
      problems.push(
        `package-lock.json ${name} resolved '${entry.resolved}' does not match pin ${sha}.`,
      );
    }
  } else {
    if (entry.version !== spec) {
      problems.push(
        `package-lock.json ${name} version '${entry.version}' does not match pin ${spec}.`,
      );
    }
    if (!entry.resolved?.startsWith(NPM_REGISTRY_URL)) {
      problems.push(
        `package-lock.json ${name} resolved '${entry.resolved}' is not from ${NPM_REGISTRY_URL}.`,
      );
    }
    if (!entry.integrity?.startsWith("sha512-")) {
      problems.push(`package-lock.json ${name} has no sha512 integrity hash.`);
    }
  }

  return problems;
}

function main(): void {
  const names = process.argv.slice(2);
  if (names.length === 0 || names.some((name) => name.length === 0)) {
    fail(usage(import.meta.url, "<dependency> [<dependency>...]"));
  }

  const packageJson = readJsonFile(
    path.join(ROOT_DIR, "package.json"),
  ) as PackageJson;
  const packageLock = readJsonFile(
    path.join(ROOT_DIR, "package-lock.json"),
  ) as PackageLock;

  const problems = names.flatMap((name) =>
    checkDependencyPin(name, packageJson, packageLock),
  );
  for (const problem of problems) {
    logError(problem);
  }
  if (problems.length > 0) {
    fail(`Dependency pin check failed with ${problems.length} error(s).`);
  }

  logSuccess(`Dependency pin check passed for ${names.join(", ")}.`);
}

// Run only as a script, so tests can import checkDependencyPin.
if (import.meta.main) {
  await runMain(main, 1);
}
