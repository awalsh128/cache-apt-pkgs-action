import {
  createPackageManager,
  type CommandRunner,
  type PackageInfo,
  type PackageManager,
  type PackageName,
} from "ts-apt";
import { Cache, CacheKey } from "./cache.js";
import { Manifest, ManifestEntry } from "./manifest.js";
import { ActionPackageNames, buildFileList, ownedAlternatives } from "./packages.js";
import winston from "winston";

type EmptyPackageBehavior = "error" | "warn" | "ignore";

const FORCE_UPDATE_INCREMENT = "1";

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

    // apt-fast only speeds up installs, so a restore doesn't probe for it.
    const restoreManager = await createPackageManager(false, this.logger, this.logger);
    const manifest = await this.timed("Cache restore", () =>
      this.cache.loadAndRestore(cacheKey, inputs.executeInstallScripts, restoreManager),
    );

    if (manifest !== undefined) {
      const nativeArch = await restoreManager.getNativeArchitecture();
      return this.toOutputs(true, manifest.entries, packageNames, nativeArch);
    }

    // Only a fresh install gains from apt-fast, so the miss path gets its own manager.
    const installManager = await createPackageManager(true, this.logger, this.logger);
    const nativeArch = await installManager.getNativeArchitecture();

    // Runner images ship an apt index that can predate the archive, so a package whose version was
    // superseded (e.g. a security update) 404s on download. Refresh it before every fresh install.
    await this.timed("apt update", () => installManager.update());
    const reportedInfos = await this.timed("apt install", () =>
      installManager.install(packageNames.toArray()),
    );
    const packageInfos = await this.addAlreadyInstalled(installManager, packageNames, reportedInfos);
    // Collect each package's installed files so the archives have content, and the alternatives it
    // registered, since their links aren't in the file list.
    const alternatives = await this.timed("Listing alternatives", () => installManager.listAlternatives());
    const entries = await this.timed("Listing installed files", () =>
      Promise.all(
        packageInfos.map(async (info) => {
          const files = await buildFileList(info.name, installManager);
          return new ManifestEntry(info.name, files, ownedAlternatives(files, alternatives));
        }),
      ),
    );
    const outputs = this.toOutputs(false, entries, packageNames, nativeArch);
    const savedManifest = new Manifest(new Date(), entries, cacheKey, inputs, outputs);
    await this.timed("Archive and cache save", () => this.cache.archiveAndSave(savedManifest));
    return outputs;
  }

  /**
   * Adds the requested packages apt didn't report, because they were already installed.
   *
   * apt prints no `Inst` or `Setting up` line for a package that is already installed at the requested
   * version (e.g. one the runner image ships), so the install output alone would leave it out of the
   * cache. A requested package that isn't installed under its own name is left out, since apt can satisfy
   * it with a provider (e.g. a virtual package).
   *
   * @param installManager Package manager used for the install.
   * @param packageNames Packages the workflow requested.
   * @param reported Packages apt reported installing.
   * @returns `reported`, followed by each already-installed requested package.
   */
  private async addAlreadyInstalled(
    installManager: PackageManager,
    packageNames: ActionPackageNames,
    reported: readonly PackageInfo[],
  ): Promise<PackageInfo[]> {
    const unreported = packageNames.missingFrom(reported.map((info) => info.name));
    if (unreported.length === 0) {
      return [...reported];
    }
    const installed = await installManager.listInstalled();
    const alreadyInstalled = installed.filter(
      (info) => packageNames.includes(info.name) && unreported.some((name) => name.name === info.name.name),
    );
    return [...reported, ...alreadyInstalled];
  }

  /**
   * Builds the action outputs from the installed packages.
   *
   * @param cacheHit Whether the packages came from the cache.
   * @param entries Installed packages, from the manifest.
   * @param packageNames Packages the workflow requested.
   * @param nativeArch Runner architecture as reported by dpkg (e.g. amd64).
   * @returns Action outputs consumed by the workflow runtime.
   */
  private toOutputs(
    cacheHit: boolean,
    entries: readonly ManifestEntry[],
    packageNames: ActionPackageNames,
    nativeArch: string,
  ): ActionOutputs {
    const installed = entries.map((entry) => entry.packageName);
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
