import * as fs from "fs";
import type { PackageName, PackageManager } from "ts-apt/types.ts";
import path from "path";
import { createPackageName, deserializePackageName } from "ts-apt/package.ts";
import winston from "winston";

/**
 * Collects installed file and lifecycle script paths for archive creation.
 *
 * @param packageManager ts-apt package manager instance.
 * @param packageName Package descriptor.
 * @returns Sorted unique file list suitable for tar archiving.
 */
export async function buildFileList(
  packageName: PackageName,
  packageManager: PackageManager,
): Promise<string[]> {
  // Converts absolute paths to tar-relative paths.
  const tarRelativePath = (filePath: string) =>
    filePath.startsWith("/") ? filePath.slice(1) : filePath;

  const files = (await packageManager.listInstalledFiles(packageName))
    .filter((filePath) => {
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const stat = fs.lstatSync(filePath);
      return stat.isFile() || stat.isSymbolicLink();
    })
    .map((filePath) => tarRelativePath(filePath));

  const preinst = await findInstallScript(packageName, "preinst", "/");
  const postinst = await findInstallScript(packageName, "postinst", "/");

  if (preinst) {
    files.push(tarRelativePath(preinst));
  }
  if (postinst) {
    files.push(tarRelativePath(postinst));
  }

  return files.sort((a, b) => a.localeCompare(b));
}

/**
 * Finds package lifecycle install scripts in dpkg metadata when present.
 *
 * @param packageName Package name to resolve scripts for.
 * @param extension Script extension to resolve.
 * @param root Root filesystem path used to resolve dpkg metadata.
 * @returns Absolute script path when found.
 */
export async function findInstallScript(
  packageName: PackageName,
  extension: "preinst" | "postinst",
  root: string,
): Promise<string | undefined> {
  const scriptsDir = path.join(root, "var", "lib", "dpkg", "info");
  if (!fs.existsSync(scriptsDir)) {
    return undefined;
  }

  const pattern = new RegExp(
    `^${packageName.serialize()}(:.*)?\\.${extension}$`,
  );
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

/**
 * Resolves a concrete version for an unpinned package name.
 *
 * @param packageManager ts-apt package manager instance used for metadata lookup.
 * @param packageName Package name with or without a version pin.
 * @returns Resolved package version.
 * @throws Error when no version can be resolved.
 */
export async function resolvePackageVersion(
  packageManager: PackageManager,
  packageName: PackageName,
): Promise<string> {
  const packageInfo = await packageManager.getPackageInfo([packageName]);
  const version = packageInfo[0]?.version;
  if (!version) {
    throw new Error(
      `Unable to resolve package version for '${packageName.serialize()}'.`,
    );
  }

  return version;
}

export class ActionPackageNames {
  private readonly items: PackageName[];

  private constructor(items: PackageName[]) {
    this.items = items.sort();
  }

  static fromInput(serializedPackageNames: string): ActionPackageNames {
    const names = serializedPackageNames
      .replace(/[,\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .map((part) => deserializePackageName(part.trim()));
    return new ActionPackageNames(names);
  }

  static fromJSON(json: any): ActionPackageNames {
    const items = (json as any[]).map((item: any) =>
      createPackageName(item.name, item.version, item.rc),
    );
    return new ActionPackageNames(items);
  }

  get length(): number {
    return this.items.length;
  }

  toArray(): ReadonlyArray<PackageName> {
    return this.items;
  }
}

/**
 * Updates apt lists only when the local lists directory appears stale.
 *
 * @param packageManager ts-apt package manager instance.
 * @returns Nothing.
 */
export async function updateAptLists(
  packageManager: PackageManager,
  logger: winston.Logger,
): Promise<void> {
  const aptListsPath = "/var/lib/apt/lists";
  const maxDepth = 5;

  const search = async (
    currentPath: string,
    currentDepth: number,
  ): Promise<boolean> => {
    if (currentDepth > maxDepth) {
      return false;
    }

    try {
      const stats = fs.statSync(currentPath);
      if (stats.isDirectory()) {
        const entries = await fs.promises.readdir(currentPath);
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry);
          if (await search(fullPath, currentDepth + 1)) {
            return true;
          }
        }
      } else {
        return true;
      }
    } catch {
      // Ignore permission errors or inaccessible paths.
    }

    return false;
  };

  if (await search(aptListsPath, 0)) {
    logger.info(
      `Apt lists directory '${aptListsPath}' appears to contain files, skipping 'apt update'`,
    );
    return;
  }

  logger.info(
    `Apt lists directory '${aptListsPath}' appears stale or empty, running 'apt update'...`,
  );
  await packageManager.update();
}
