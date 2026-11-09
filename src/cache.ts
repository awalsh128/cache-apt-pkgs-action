import * as ghcache from "@actions/cache";
import * as winston from "winston";
import * as crypto from "node:crypto";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ActionPackageNames, findInstallScript } from "./packages.js";
import { Manifest, ManifestEntry } from "./manifest.js";
import { CommandRunner, PackageName } from "ts-apt";

export const CACHE_DEFAULT_DIRNAME = "cache-apt-pkgs";
export const CACHE_KEY_FILENAME = "cache_key.md5";

/**
 * Resolves the absolute cache directory path for a cache directory name.
 *
 * @param cacheDir Directory name under the user's home directory.
 * @returns Absolute path to the cache directory.
 */
export function resolveCacheDir(
  cacheDir: string = CACHE_DEFAULT_DIRNAME,
): string {
  return path.join(os.homedir(), cacheDir);
}

/**
 * Disables the command runner's default timeout for long-running commands.
 *
 * Archiving large packages (e.g. linux-headers) and some maintainer scripts
 * (e.g. ca-certificates-java postinst) can take longer than the default.
 */
const NO_TIMEOUT_MS = -1;

/**
 * Shell script that extracts each archive given as an argument onto `/`.
 *
 * Paths are passed as positional arguments, not interpolated, so they are
 * never parsed by the shell.
 */
const EXTRACT_ARCHIVES_SCRIPT =
  'for archive do tar --extract --file="$archive" --directory=/ --keep-directory-symlink || exit 1; done';

/** Maintainer scripts run on restore when install scripts are enabled. */
type InstallScriptType = "preinst" | "postinst";

/** Order dpkg runs maintainer scripts in during install. */
const INSTALL_SCRIPT_ORDER: readonly InstallScriptType[] = [
  "preinst",
  "postinst",
];

/** Action argument dpkg passes to each maintainer script on a fresh install. */
const INSTALL_SCRIPT_ACTIONS: Readonly<Record<InstallScriptType, string>> = {
  preinst: "install",
  postinst: "configure",
};

export const MANIFEST_MAIN_FILENAME = "manifest_main.json";
export const MANIFEST_ALL_FILENAME = "manifest_all.json";

/**
 * Structured representation of cache key components for the GitHub Actions cache service.
 */
export class CacheKey {
  /** Version set by user to create a miss, re-install and cache from scratch. */
  readonly version: string;
  /** Global force update increment for cases of cache bugs introduced by action development. */
  readonly forceUpdateIncrement: string;
  /** System architecture for which the cache is valid. Prevent cross architecture cache hits. */
  readonly arch: string;
  /** Normalized package names included in the cache so future unordered list comparisons are consistent. */
  readonly packageNames: ActionPackageNames;
  /** MD5 hash of the serialized cache key. Not considered sensitive in the GitHub Cache action. */
  readonly hash: string;

  constructor(
    version: string,
    forceUpdateIncrement: string,
    arch: string,
    packageNames: ActionPackageNames,
  ) {
    this.version = version;
    this.forceUpdateIncrement = forceUpdateIncrement;
    this.arch = arch;
    this.packageNames = packageNames;
    this.hash = crypto
      .createHash("md5")
      .update(this.toJSON(false))
      .digest("hex");
  }

  /**
   * Parses a serialized cache key into a strongly typed CacheKey.
   *
   * @param serialized Serialized cache key string.
   * @returns Parsed cache key object.
   * @throws Error when serialized value does not contain all expected fields.
   */
  static fromJSON(json: string): CacheKey {
    const obj = JSON.parse(json);
    return new CacheKey(
      obj.version!,
      obj.forceUpdateIncrement!,
      obj.arch!,
      ActionPackageNames.fromJSON(obj.packageNames!),
    );
  }

  /**
   * Serializes cache key fields to a stable, human-readable format.
   *
   * NOTE: Object is always stable JSON stringification for consistent hashing.
   *
   * @param readable Whether to pretty-print the JSON output. Defaults to false.
   * @returns Serialized cache key components.
   */
  toJSON(readable: boolean = false): string {
    // Helper to sort keys recursively
    const sortObj = (o: any): any => {
      if (o === null || typeof o !== "object") return o;
      if (Array.isArray(o)) return o.map(sortObj);
      return Object.keys(o)
        .sort()
        .reduce((acc, key) => {
          acc[key] = sortObj(o[key]);
          return acc;
        }, {} as any);
    };
    return JSON.stringify(sortObj(this), null, readable ? 2 : 0);
  }

  toString(): string {
    return `${this.hash} (key input: ${this.toJSON(true)})`;
  }
}

/**
 * Computes action cache path and cache keys for package sets.
 */
export class Cache {
  /** Absolute path to the local cache directory. */
  readonly path: string;

  private readonly logger: winston.Logger;
  private readonly commandRunner: CommandRunner;

  constructor(
    commandRunner: CommandRunner,
    logger: winston.Logger,
    cacheDir: string = CACHE_DEFAULT_DIRNAME,
  ) {
    this.path = resolveCacheDir(cacheDir);
    this.commandRunner = commandRunner;
    this.logger = logger;
  }

  /**
   * Runs a package's maintainer scripts in the order dpkg runs them on install.
   *
   * @param packageName Package whose scripts to run.
   */
  private async runInstallScripts(packageName: PackageName): Promise<void> {
    for (const scriptType of INSTALL_SCRIPT_ORDER) {
      await this.runInstallScript(packageName, scriptType);
    }
  }

  /**
   * Runs one maintainer script, if the package has it, with the action dpkg passes.
   *
   * @param packageName Package whose script to run.
   * @param scriptType Maintainer script to run.
   */
  private async runInstallScript(
    packageName: PackageName,
    scriptType: InstallScriptType,
  ): Promise<void> {
    const scriptPath = await findInstallScript(packageName, scriptType, "/");
    if (!scriptPath) {
      this.logger.info(
        `No ${scriptType} script found for package ${packageName.serialize()}, skipping`,
      );
      return;
    }
    this.logger.info(
      `Running ${scriptType} script '${path.basename(scriptPath)}' for package ${packageName.serialize()}...`,
    );
    await this.commandRunner.run(
      "sudo",
      ["sh", "-x", scriptPath, INSTALL_SCRIPT_ACTIONS[scriptType]],
      { timeoutMs: NO_TIMEOUT_MS },
    );
    this.logger.info(`Ran ${scriptType} script for ${packageName.name}`);
  }

  async loadAndRestore(
    key: CacheKey,
    executeInstallScripts: boolean,
  ): Promise<Manifest | undefined> {
    const cacheHit = await ghcache.restoreCache([this.path], key.hash);

    if (!cacheHit) {
      this.logger.info(
        `Cache miss for key ${key.hash}, skipping cache restore.`,
      );
      return undefined;
    }

    const logFileError = async (prefixMessage: string) => {
      const contents = await fs
        .readdir(this.path)
        .then((entries) => entries.join("\n"))
        .catch(
          (reason: any) => `Unable to read cache directory contents: ${reason}`,
        );
      this.logger.error(
        `${prefixMessage}, skipping cache restore.\n` +
          `This may indicate a cache corruption or an unexpected cache hit for a different package set.\n` +
          `Cache directory contents:\n${contents}`,
      );
    };

    this.logger.info(`Cache hit for key ${key.hash}, restoring...`);
    const manifestPath = path.join(this.path, MANIFEST_MAIN_FILENAME);
    if (
      !(await fs
        .access(manifestPath, fs.constants.R_OK)
        .then(() => true)
        .catch(() => false))
    ) {
      await logFileError(`Manifest file not found at ${manifestPath}`);
      return undefined;
    }
    const manifestAllPath = path.join(this.path, MANIFEST_ALL_FILENAME);
    const manifestAll = await Manifest.readFromFile(manifestAllPath).catch(
      () => undefined,
    );
    if (!manifestAll || manifestAll.entries.length === 0) {
      await logFileError(
        `Manifest of all packages not found or empty at ${manifestAllPath}`,
      );
      return undefined;
    }

    // Restore in the order apt installed the packages (i.e. the order of the
    // manifest entries) and not by archive filename. Install scripts can depend
    // on files from packages installed before them (see issue #196).
    // Packages without files (e.g. metapackages) have no archive to restore.
    const archivePaths = manifestAll.entries
      .filter((entry) => entry.filepaths.length > 0)
      .map((entry) => ({
        packageName: entry.packageName,
        archivePath: path.join(
          this.path,
          entry.packageName.serialize() + ".tar",
        ),
      }));
    for (const { archivePath } of archivePaths) {
      if (
        !(await fs
          .access(archivePath, fs.constants.R_OK)
          .then(() => true)
          .catch(() => false))
      ) {
        await logFileError(`Archive file not found at ${archivePath}`);
        return undefined;
      }
    }

    if (executeInstallScripts) {
      // Each package's scripts must run before the next package is extracted.
      for (const { packageName, archivePath } of archivePaths) {
        await this.extractArchives([archivePath]);
        await this.runInstallScripts(packageName);
      }
    } else {
      // One process for all archives avoids a sudo and tar spawn per package.
      await this.extractArchives(archivePaths.map((item) => item.archivePath));
    }

    // Return every installed package so outputs can report dependencies too.
    return manifestAll;
  }

  /**
   * Extracts package archives, in order, onto the root filesystem.
   *
   * Runs system tar under sudo because package files live in root-owned
   * directories. All archives share one sudo shell so the process cost is paid
   * once. Stops at the first archive with any entry error.
   *
   * @param archivePaths Absolute paths to the package archives.
   */
  private async extractArchives(
    archivePaths: readonly string[],
  ): Promise<void> {
    if (archivePaths.length === 0) {
      return;
    }
    await this.commandRunner.run(
      "sudo",
      ["sh", "-c", EXTRACT_ARCHIVES_SCRIPT, "sh", ...archivePaths],
      { timeoutMs: NO_TIMEOUT_MS },
    );
  }

  private async createArchive(manifestEntry: ManifestEntry): Promise<void> {
    const archivePath = path.join(
      this.path,
      manifestEntry.packageName.serialize() + ".tar",
    );
    if (
      await fs
        .access(archivePath)
        .then(() => true)
        .catch(() => false)
    ) {
      this.logger.warn(
        `Archive already exists for package ${manifestEntry.packageName.serialize()} at ${archivePath}, skipping creation.`,
      );
      return;
    }
    if (manifestEntry.filepaths.length === 0) {
      // tar can't create an empty archive, and restore skips these entries.
      this.logger.info(
        `No files to archive for package ${manifestEntry.packageName.serialize()}, skipping creation.`,
      );
      return;
    }
    this.logger.info(
      `Archiving package ${manifestEntry.packageName.serialize()} with ${manifestEntry.filepaths.length} files...`,
    );
    // Packages can install root-only files (e.g. /etc/default/cacerts from
    // ca-certificates-java), so system tar runs under sudo. The file list is
    // piped on stdin because large packages exceed the argument size limit,
    // and is NUL-separated so no path is parsed as a tar option.
    await this.commandRunner.run(
      "sudo",
      [
        "tar",
        "--create",
        `--file=${archivePath}`,
        "--directory=/",
        "--null",
        "--verbatim-files-from",
        "--files-from=-",
      ],
      { input: manifestEntry.filepaths.join("\0"), timeoutMs: NO_TIMEOUT_MS },
    );
    // Hand the archive back to the runner user so the cache save can manage it.
    await this.commandRunner.run("sudo", [
      "chown",
      `${os.userInfo().uid}:${os.userInfo().gid}`,
      archivePath,
    ]);
    this.logger.info(
      `Archive created for package ${manifestEntry.packageName.serialize()} at ${archivePath}`,
    );
  }

  private async writeManifests(manifest: Manifest): Promise<void> {
    const allEntries = manifest.entries;
    const packages = manifest.cacheKey.packageNames;
    // Keep the installed name, which carries the resolved version and arch.
    const mainEntries = allEntries.filter((entry) =>
      packages.includes(entry.packageName),
    );

    const write = async (manifest: Manifest, filename: string) => {
      this.logger.info(
        `Writing manifest ${filename} with ${manifest.entries.length} entries to ${this.path}`,
      );
      await fs.mkdir(this.path, { recursive: true });
      const filePath = path.join(this.path, filename);
      await manifest.writeToFile(filePath);
      this.logger.info(`Wrote manifest`);
    };

    const now = new Date();

    await write(
      new Manifest(now, mainEntries, manifest.cacheKey),
      MANIFEST_MAIN_FILENAME,
    );
    await write(
      new Manifest(now, allEntries, manifest.cacheKey),
      MANIFEST_ALL_FILENAME,
    );
  }

  /**
   * Writes the manifests and per-package archives, then saves the cache.
   *
   * @param manifest Installed packages, in install order, with their files.
   * @returns GitHub Actions cache ID.
   */
  async archiveAndSave(manifest: Manifest): Promise<number> {
    const key = manifest.cacheKey;
    if (!ghcache.isFeatureAvailable()) {
      throw new Error(
        "GitHub Actions cache service is not available in this environment",
      );
    }
    await fs.mkdir(this.path, { recursive: true });

    this.logger.info(
      `Writing cache key to ${path.join(this.path, CACHE_KEY_FILENAME)} with ${key}...`,
    );
    await fs.writeFile(
      path.join(this.path, CACHE_KEY_FILENAME),
      key.hash,
      "utf8",
    );
    this.logger.info(`Wrote cache key`);

    await this.writeManifests(manifest);
    for (const entry of manifest.entries) {
      await this.createArchive(entry);
    }

    this.logger.info(
      `Saving cache with key ${key} for ${manifest.entries.length} entries...`,
    );

    try {
      const cacheId = await ghcache.saveCache(
        [this.path],
        manifest.cacheKey.hash,
      );
      if (cacheId === undefined) {
        throw new Error("Cache save failed: no cache action ID returned.");
      }
      this.logger.info(`Saved cache with cache action ID: ${cacheId}`);
      return cacheId;
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `Failed to save cache: ${error.message}`
          : `Failed to save cache: ${String(error)}`,
      );
    }
  }
}
