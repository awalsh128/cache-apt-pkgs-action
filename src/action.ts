import * as cache from "@actions/cache";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createPackageManager,
  type CommandRunner,
  DefaultCommandRunner,
  type PackageManager,
} from "../node_modules/ts-apt/dist/index.js";
import { type PackageName } from "../node_modules/ts-apt/dist/types.js";
import { isAptListsFresh } from "./io.js";
import { readManifestAsCsv, writeManifest } from "./manifest.js";
import * as tar from "tar";
import winston from "winston";

type TarModule = typeof import("tar");

type EmptyPackageBehavior = "error" | "warn" | "ignore";

const FORCE_UPDATE_INCREMENT = "4";
const CACHE_DIRNAME = "cache-apt-pkgs";
const CACHE_PREFIX = "cache-apt-pkgs_";

export interface ActionInputs {
  readonly packages: string;
  readonly version: string;
  readonly executeInstallScripts: boolean;
  readonly emptyPackagesBehavior: EmptyPackageBehavior;
  readonly debug: boolean;
}

export interface ActionOutputs {
  readonly cacheHit: boolean;
  readonly packageVersionList: string;
  readonly allPackageVersionList: string;
}

export class ActionPackageName implements PackageName {
  constructor(
    readonly name: string,
    readonly version?: string,
    readonly distro?: string,
  ) {}

  serialize(): string {
    return this.version ? `${this.name}=${this.version}` : this.name;
  }
}

function toPackageName(packageSpecifier: string): ActionPackageName {
  const [name, version] = packageSpecifier.split("=");
  if (!name) {
    throw new Error("Package name cannot be empty.");
  }

  return new ActionPackageName(name, version);
}

export function parseBoolean(value: string, fieldName: string): boolean {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }

  throw new Error(
    `${fieldName} value '${value}' must be either true or false.`,
  );
}

export function normalizeInputPackages(inputPackages: string): string[] {
  return inputPackages
    .replace(/[,\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export class ActionRunner {
  private readonly commandRunner: CommandRunner;
  private readonly tar: TarModule;
  private readonly logger: winston.Logger;

  constructor(
    commandRunner: CommandRunner,
    tarModule: TarModule,
    logger: winston.Logger,
  ) {
    this.commandRunner = commandRunner;
    this.tar = tarModule;
    this.logger = logger;
  }

  parseBoolean(value: string, fieldName: string): boolean {
    return parseBoolean(value, fieldName);
  }

  normalizeInputPackages(inputPackages: string): string[] {
    return normalizeInputPackages(inputPackages);
  }

  async resolvePackageVersion(
    packageManager: PackageManager,
    packageName: string,
  ): Promise<string> {
    const packageInfo = await packageManager.getPackageInfo([
      toPackageName(packageName),
    ]);
    const version = packageInfo[0]?.version;
    if (!version) {
      throw new Error(
        `Unable to resolve package version for '${packageName}'.`,
      );
    }

    return version;
  }

  async normalizePackagesWithVersions(
    packageManager: PackageManager,
    inputPackages: string,
  ): Promise<string[]> {
    const raw = this.normalizeInputPackages(inputPackages);
    const packages = await Promise.all(
      raw.map(async (pkg) => {
        if (pkg.includes("=")) {
          return pkg;
        }

        return `${pkg}=${await this.resolvePackageVersion(packageManager, pkg)}`;
      }),
    );

    return packages.sort((a, b) => a.localeCompare(b));
  }

  validateEmptyPackages(
    behavior: EmptyPackageBehavior,
    packages: string[],
  ): void {
    if (packages.length > 0) {
      return;
    }

    if (behavior === "ignore") {
      return;
    }

    if (behavior === "warn") {
      process.stdout.write("::warning::Packages argument is empty.\n");
      return;
    }

    throw new Error("Packages argument is empty.");
  }

  getCacheRoot(): string {
    return path.join(os.homedir(), CACHE_DIRNAME);
  }

  async getCacheKey(
    normalizedPackages: string[],
    version: string,
  ): Promise<string> {
    const architecture = (await this.commandRunner.run("arch")).stdout.trim();
    let value = `${normalizedPackages.join(" ")} @ ${version} ${FORCE_UPDATE_INCREMENT}`;

    if (architecture !== "x86_64") {
      value = `${value} ${architecture}`;
    }

    const hash = crypto.createHash("md5").update(value).digest("hex");
    return `${CACHE_PREFIX}${hash}`;
  }

  findInstallScript(
    packageName: string,
    extension: "preinst" | "postinst",
    root: string,
  ): string | undefined {
    const scriptsDir = path.join(root, "var", "lib", "dpkg", "info");
    if (!fs.existsSync(scriptsDir)) {
      return undefined;
    }

    const pattern = new RegExp(`^${packageName}(:.*)?\\.${extension}$`);
    const matches = fs
      .readdirSync(scriptsDir)
      .filter((entry) => pattern.test(entry))
      .sort((a, b) => a.localeCompare(b));
    const candidate = matches[0];
    if (!candidate) {
      return undefined;
    }

    return path.join(scriptsDir, candidate);
  }

  tarRelativePath(filePath: string): string {
    return filePath.startsWith("/") ? filePath.slice(1) : filePath;
  }

  async buildFileListForPackage(
    packageManager: PackageManager,
    packageName: string,
  ): Promise<string[]> {
    const files = (
      await packageManager.listInstalledFiles(toPackageName(packageName))
    )
      .filter((filePath) => {
        if (!fs.existsSync(filePath)) {
          return false;
        }

        const stat = fs.lstatSync(filePath);
        return stat.isFile() || stat.isSymbolicLink();
      })
      .map(this.tarRelativePath);

    const preinst = this.findInstallScript(packageName, "preinst", "/");
    const postinst = this.findInstallScript(packageName, "postinst", "/");

    if (preinst) {
      files.push(this.tarRelativePath(preinst));
    }
    if (postinst) {
      files.push(this.tarRelativePath(postinst));
    }

    return Array.from(new Set(files)).sort((a, b) => a.localeCompare(b));
  }

  async updateAptLists(packageManager: PackageManager): Promise<void> {
    if (isAptListsFresh()) {
      return;
    }

    await packageManager.update();
  }

  packageSpecifierToName(packageSpecifier: string): string {
    return packageSpecifier.split("=")[0] ?? packageSpecifier;
  }

  async installAndCachePackages(
    cacheDir: string,
    packages: string[],
    packageManager: PackageManager,
  ): Promise<void> {
    await this.updateAptLists(packageManager);
    writeManifest(path.join(cacheDir, "manifest_main.log"), packages);

    const installedPackages = await packageManager.install(
      packages.map(toPackageName),
    );

    const manifestAll: string[] = [];
    for (const pkg of installedPackages) {
      const packageName = pkg.name;
      const packageVersion = pkg.version;
      if (!packageName || !packageVersion) {
        continue;
      }

      const archivePath = path.join(
        cacheDir,
        `${packageName}=${packageVersion}.tar`,
      );
      if (!fs.existsSync(archivePath)) {
        const filesToArchive = await this.buildFileListForPackage(
          packageManager,
          packageName,
        );
        await this.tar.create(
          {
            cwd: "/",
            file: archivePath,
            portable: false,
            preservePaths: false,
            follow: false,
            noDirRecurse: false,
          },
          filesToArchive,
        );
      }

      manifestAll.push(`${packageName}=${packageVersion}`);
    }

    writeManifest(path.join(cacheDir, "manifest_all.log"), manifestAll);
  }

  async restorePackages(
    cacheDir: string,
    executeInstallScripts: boolean,
  ): Promise<void> {
    const archives = fs
      .readdirSync(cacheDir)
      .filter((entry) => entry.endsWith(".tar"))
      .sort((a, b) => a.localeCompare(b));

    for (const archive of archives) {
      const archivePath = path.join(cacheDir, archive);
      await this.tar.extract({
        cwd: "/",
        file: archivePath,
        preservePaths: true,
      });

      if (!executeInstallScripts) {
        continue;
      }

      const packageName = archive.split("=")[0] ?? "";
      if (!packageName) {
        continue;
      }

      const preinst = this.findInstallScript(packageName, "preinst", "/");
      if (preinst) {
        this.logger.info(`Running pre-install script for ${packageName}`);
        await this.commandRunner.run("sudo", ["sh", "-x", preinst, "install"]);
      }

      const postinst = this.findInstallScript(packageName, "postinst", "/");
      if (postinst) {
        this.logger.info(`Running post-install script for ${packageName}`);
        await this.commandRunner.run("sudo", [
          "sh",
          "-x",
          postinst,
          "configure",
        ]);
      }
    }
  }

  async runAction(inputs: ActionInputs): Promise<ActionOutputs> {
    if (/\s/.test(inputs.version)) {
      throw new Error(
        `Version value '${inputs.version}' cannot contain spaces.`,
      );
    }

    const packageInfoManager = await createPackageManager(false);
    const normalizedPackages = await this.normalizePackagesWithVersions(
      packageInfoManager,
      inputs.packages,
    );
    this.validateEmptyPackages(
      inputs.emptyPackagesBehavior,
      normalizedPackages,
    );

    const cacheDir = this.getCacheRoot();
    fs.mkdirSync(cacheDir, { recursive: true });

    if (normalizedPackages.length === 0) {
      writeManifest(path.join(cacheDir, "manifest_main.log"), []);
      writeManifest(path.join(cacheDir, "manifest_all.log"), []);
      return {
        cacheHit: false,
        packageVersionList: "",
        allPackageVersionList: "",
      };
    }

    const key = await this.getCacheKey(normalizedPackages, inputs.version);
    fs.writeFileSync(
      path.join(cacheDir, "cache_key.md5"),
      key.replace(CACHE_PREFIX, ""),
      "utf8",
    );

    const restoredKey = await cache.restoreCache([cacheDir], key);
    const cacheHit = restoredKey === key;

    if (cacheHit) {
      await this.restorePackages(cacheDir, inputs.executeInstallScripts);
    } else {
      const installManager = await createPackageManager(true);
      const installTargets = normalizedPackages.map((packageSpecifier) =>
        this.packageSpecifierToName(packageSpecifier),
      );
      await this.installAndCachePackages(
        cacheDir,
        installTargets,
        installManager,
      );
      await cache.saveCache([cacheDir], key);
    }

    return {
      cacheHit,
      packageVersionList: readManifestAsCsv(
        path.join(cacheDir, "manifest_main.log"),
      ),
      allPackageVersionList: readManifestAsCsv(
        path.join(cacheDir, "manifest_all.log"),
      ),
    };
  }
}

export async function runAction(
  inputs: ActionInputs,
  logger: winston.Logger,
): Promise<ActionOutputs> {
  const commandRunner = new DefaultCommandRunner(logger, logger);
  const actionRunner = new ActionRunner(commandRunner, tar, logger);
  return await actionRunner.runAction(inputs);
}
