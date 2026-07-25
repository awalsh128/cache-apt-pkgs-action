import * as core from "@actions/core";
import { runAction, type ActionInputs } from "./action.js";
import { DefaultCommandRunner } from "ts-apt";
import { Cache, CACHE_DEFAULT_DIRNAME } from "./cache.ts";
import { Instruments } from "./instrumentation.js";

/**
 * Parses empty package behavior input from workflow configuration.
 *
 * @param value Raw behavior input.
 * @returns Parsed behavior enum value.
 * @throws Error when value is outside the supported set.
 */
function parseEmptyPackagesBehavior(
  value: string,
): "error" | "warn" | "ignore" {
  if (value === "error" || value === "warn" || value === "ignore") {
    return value;
  }

  throw new Error(
    `empty_packages_behavior value '${value}' must be one of: error, warn, ignore.`,
  );
}

/**
 * Reads and validates typed action inputs from GitHub Actions runtime.
 *
 * @returns Parsed and validated action inputs.
 */
function getInputs(): ActionInputs {
  const emptyPackagesBehaviorRaw =
    core.getInput("empty_packages_behavior") || "error";

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
  const instruments = new Instruments(cacheDir, inputs.debug || core.isDebug());
  try {
    const commandRunner = new DefaultCommandRunner(
      instruments.execLogger,
      instruments.execLogger,
    );

    const outputs = await runAction(
      inputs,
      commandRunner,
      new Cache(commandRunner, instruments.appLogger, cacheDir),
      instruments.appLogger,
    );

    core.setOutput("cache-hit", String(outputs.cacheHit));
    core.setOutput("package-version-list", outputs.packageVersionList);
    core.setOutput("all-package-version-list", outputs.allPackageVersionList);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(message);
  } finally {
    instruments.artifacts.upload();
  }
}

void main();
