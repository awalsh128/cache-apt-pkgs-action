import * as core from "@actions/core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAction, type ActionInputs } from "./action.js";
import { DefaultCommandRunner } from "ts-apt";
import { Cache, CACHE_DEFAULT_DIRNAME } from "./cache.js";
import { Instruments } from "./instrumentation.js";

/**
 * Marks the bundled ts-apt apt-fast script executable when it's present.
 *
 * ts-apt spawns the script directly, and some ways of shipping the bundle
 * (e.g. workflow artifacts) drop file modes.
 *
 * @param bundleDir Directory of the running bundle (i.e. dist/action).
 */
function ensureBundledScriptsExecutable(
  bundleDir: string = path.dirname(fileURLToPath(import.meta.url)),
): void {
  const aptFastPath = path.join(bundleDir, "..", "scripts", "dist", "apt-fast.sh");
  if (fs.existsSync(aptFastPath)) {
    fs.chmodSync(aptFastPath, 0o755);
  }
}

/**
 * Parses empty package behavior input from workflow configuration.
 *
 * @param value Raw behavior input.
 * @returns Parsed behavior enum value.
 * @throws Error when value is outside the supported set.
 */
function parseEmptyPackagesBehavior(value: string): "error" | "warn" | "ignore" {
  if (value === "error" || value === "warn" || value === "ignore") {
    return value;
  }

  throw new Error(`empty_packages_behavior value '${value}' must be one of: error, warn, ignore.`);
}

/**
 * Reads and validates typed action inputs from GitHub Actions runtime.
 *
 * @returns Parsed and validated action inputs.
 */
function getInputs(): ActionInputs {
  const emptyPackagesBehaviorRaw = core.getInput("empty_packages_behavior") || "error";

  return {
    packages: core.getInput("packages", { required: true }),
    version: core.getInput("version"),
    executeInstallScripts: core.getBooleanInput("execute_install_scripts"),
    emptyPackagesBehavior: parseEmptyPackagesBehavior(emptyPackagesBehaviorRaw),
    debug: core.getBooleanInput("debug"),
  };
}

/**
 * Main action entrypoint. Sets outputs on success and fails the action on error.
 *
 * @returns Nothing.
 */
async function main(): Promise<void> {
  const cacheDir = CACHE_DEFAULT_DIRNAME;
  const inputs = getInputs();
  const debug = inputs.debug || core.isDebug();
  const instruments = new Instruments(cacheDir, debug);
  let failed = false;
  try {
    ensureBundledScriptsExecutable();
    const commandRunner = new DefaultCommandRunner(instruments.execLogger, instruments.execLogger);

    const outputs = await runAction(
      inputs,
      commandRunner,
      new Cache(commandRunner, instruments.appLogger, instruments.cacheDir),
      instruments.appLogger,
    );

    core.setOutput("cache-hit", String(outputs.cacheHit));
    core.setOutput("package-version-list", outputs.packageVersionList);
    core.setOutput("all-package-version-list", outputs.allPackageVersionList);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(message);
    failed = true;
  } finally {
    // The upload takes over a second, so only pay for it when the logs are
    // wanted. Logs are diagnostics, so a failed upload shouldn't fail the action.
    if (debug || failed) {
      await instruments.artifacts.upload().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        core.warning(`Failed to upload diagnostic artifacts: ${message}`);
      });
    }
  }
}

void main();
