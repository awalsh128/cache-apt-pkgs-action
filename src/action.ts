import { createPackageManager, type CommandRunner, type PackageName } from "ts-apt";
import { Cache, CacheKey } from "./cache.js";
import { Manifest, ManifestEntry } from "./manifest.js";
import { ActionPackageNames, buildFileList } from "./packages.js";
import winston from "winston";

type EmptyPackageBehavior = "error" | "warn" | "ignore";

const FORCE_UPDATE_INCREMENT = "0";

const EMPTY_PACKAGES_MESSAGE = "Packages argument is empty.";

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

  constructor(cache: Cache, commandRunner: CommandRunner, logger: winston.Logger) {
    this.cache = cache;
    this.commandRunner = commandRunner;
    this.logger = logger;
  }

  /**
   * Converts package names into the action output CSV format.
   *
   * Arch is shown only for foreign-arch packages (e.g. `libc6:i386=2.39`), so
   * native output matches the v1 format while multi-arch installs stay
   * unambiguous. Entries are sorted with `PackageName.compareTo` so the output
   * is stable across install order.
   *
   * @param packageNames Installed package names.
   * @param nativeArch Runner architecture as reported by dpkg (e.g. amd64).
   * @returns Comma-delimited name[:arch]=version list.
   */
  private toCsv(packageNames: readonly PackageName[], nativeArch: string): string {
    return [...packageNames]
      .sort((a, b) => a.compareTo(b))
      .map((name) => {
        const foreignArch = name.arch !== undefined && name.arch !== nativeArch ? `:${name.arch}` : "";
        const version = name.version === undefined ? "" : `=${name.version}`;
        return `${name.name}${foreignArch}${version}`;
      })
      .join(",");
  }

  /**
   * Applies `empty_packages_behavior` when the package list is empty, which includes a list that only had
   * separators (e.g. commas). Nothing is restored, installed or cached.
   *
   * @param behavior What to do about the empty list.
   * @returns Empty outputs, for `warn` and `ignore`.
   * @throws Error for `error`.
   */
  private handleEmptyPackages(behavior: EmptyPackageBehavior): ActionOutputs {
    if (behavior === "error") {
      throw new Error(EMPTY_PACKAGES_MESSAGE);
    }
    if (behavior === "warn") {
      this.logger.warn(EMPTY_PACKAGES_MESSAGE);
    }
    return { cacheHit: false, packageVersionList: "", allPackageVersionList: "" };
  }

  /**
   * Runs a step and logs how long it took, so a slow run shows which step was slow without debug logging.
   *
   * @param label Name of the step, as it should read in the log.
   * @param work The step to run.
   * @returns What the step returns.
   */
  private async timed<T>(label: string, work: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await work();
    } finally {
      this.logger.info(`${label} took ${((performance.now() - start) / 1000).toFixed(1)}s`);
    }
  }

  /**
   * Executes the end-to-end action flow and returns action outputs.
   *
   * @param inputs Validated action inputs.
   * @returns Action outputs consumed by the workflow runtime.
   */
  async runAction(inputs: ActionInputs): Promise<ActionOutputs> {
    if (inputs.version.includes(" ")) {
      throw new Error(`Version value '${inputs.version}' cannot contain spaces.`);
    }

    const packageNames = ActionPackageNames.fromInput(inputs.packages);
    if (packageNames.length === 0) {
      return this.handleEmptyPackages(inputs.emptyPackagesBehavior);
    }

    const cacheKey = new CacheKey(inputs.version, FORCE_UPDATE_INCREMENT, process.arch, packageNames);

    let manifest = await this.timed("Cache restore", () =>
      this.cache.loadAndRestore(cacheKey, inputs.executeInstallScripts),
    );
    const cacheHit = manifest !== undefined;

    // Needed on a cache hit too, to resolve the native arch for outputs.
    // apt-fast only speeds up installs, so skip probing for it on a hit.
    const installManager = await createPackageManager(!cacheHit, this.logger, this.logger);

    if (!cacheHit) {
      // Runner images ship an apt index that can predate the archive, so a package whose version was
      // superseded (e.g. a security update) 404s on download. Refresh it before every fresh install.
      await this.timed("apt update", () => installManager.update());
      const packageInfos = await this.timed("apt install", () =>
        installManager.install(packageNames.toArray()),
      );
      // Collect each package's installed files so the archives have content.
      const entries = await this.timed("Listing installed files", () =>
        Promise.all(
          packageInfos.map(
            async (info) => new ManifestEntry(info.name, await buildFileList(info.name, installManager)),
          ),
        ),
      );
      manifest = new Manifest(new Date(), entries, cacheKey);
      const savedManifest = manifest;
      await this.timed("Archive and cache save", () => this.cache.archiveAndSave(savedManifest));
    }

    const nativeArch = await installManager.getNativeArchitecture();
    const installed = manifest!.entries.map((entry) => entry.packageName);
    return {
      cacheHit,
      packageVersionList: this.toCsv(
        installed.filter((name) => packageNames.includes(name)),
        nativeArch,
      ),
      allPackageVersionList: this.toCsv(installed, nativeArch),
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
