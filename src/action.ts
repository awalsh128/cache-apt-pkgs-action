import {
  createPackageManager,
  type CommandRunner,
  type PackageName,
} from "ts-apt";
import { Cache, CacheKey } from "./cache.js";
import { Manifest } from "./manifest.js";
import { ActionPackageNames } from "./packages.js";
import winston from "winston";

type EmptyPackageBehavior = "error" | "warn" | "ignore";

const FORCE_UPDATE_INCREMENT = "0";

/** Inputs accepted by the GitHub Action runtime. */
export interface ActionInputs {
  readonly packages: string;
  readonly version: string;
  readonly executeInstallScripts: boolean;
  readonly emptyPackagesBehavior: EmptyPackageBehavior;
  readonly debug: boolean;
}

/** Outputs emitted by the GitHub Action runtime. */
export interface ActionOutputs {
  readonly cacheHit: boolean;
  readonly packageVersionList: string;
  readonly allPackageVersionList: string;
}

/** Orchestrates package normalization, cache restore/save, install, and outputs. */
export class ActionRunner {
  private readonly cache: Cache;
  private readonly commandRunner: CommandRunner;
  private readonly logger: winston.Logger;

  constructor(
    cache: Cache,
    commandRunner: CommandRunner,
    logger: winston.Logger,
  ) {
    this.cache = cache;
    this.commandRunner = commandRunner;
    this.logger = logger;
  }

  /**
   * Converts manifest entries into the action output CSV format.
   *
   * @param manifest Parsed manifest.
   * @returns Comma-delimited name=version list.
   */
  private toCsv(manifest: Manifest): string {
    return manifest.entries
      .map((entry) => entry.packageName.serialize())
      .join(",");
  }

  /**
   * Executes the end-to-end action flow and returns action outputs.
   *
   * @param inputs Validated action inputs.
   * @returns Action outputs consumed by the workflow runtime.
   */
  async runAction(inputs: ActionInputs): Promise<ActionOutputs> {
    const packageNames = ActionPackageNames.fromInput(inputs.packages);
    const cacheKey = new CacheKey(
      inputs.version,
      FORCE_UPDATE_INCREMENT,
      process.arch,
      packageNames,
    );

    let manifest = await this.cache.loadAndRestore(
      cacheKey,
      inputs.executeInstallScripts,
    );
    const cacheHit = manifest !== undefined;

    if (!cacheHit) {
      const installManager = await createPackageManager(
        true,
        this.logger,
        this.logger,
      );
      const packageInfos = await installManager.install(packageNames.toArray());
      manifest = Manifest.from(new Date(), cacheKey, packageInfos);
      await this.cache.archiveAndSave(cacheKey, packageInfos);
    }

    return {
      cacheHit,
      packageVersionList: this.toCsv(manifest!),
      allPackageVersionList: this.toCsv(manifest!),
    };
  }
}

/**
 * Public entrypoint used by src/index.ts and tests.
 *
 * @param inputs Validated action inputs.
 * @param commandRunner Command runner used by package operations.
 * @param logger Logger instance used for command and restore diagnostics.
 * @returns Action outputs consumed by the workflow runtime.
 */
export async function runAction(
  inputs: ActionInputs,
  commandRunner: CommandRunner,
  cache: Cache,
  logger: winston.Logger,
): Promise<ActionOutputs> {
  const actionRunner = new ActionRunner(cache, commandRunner, logger);
  return await actionRunner.runAction(inputs);
}
