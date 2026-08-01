import * as fs from "fs";
import path from "path";
import {
  createPackageName,
  deserializePackageName,
  type PackageName,
  type PackageManager,
} from "ts-apt";
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
  root: string = "/",
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

  const preinst = await findInstallScript(packageName, "preinst", root);
  const postinst = await findInstallScript(packageName, "postinst", root);

  if (preinst) {
    files.push(tarRelativePath(preinst));
  }
  if (postinst) {
    files.push(tarRelativePath(postinst));
  }

  return [...new Set(files)].sort((a, b) => a.localeCompare(b));
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

  const pattern = new RegExp(`^${packageName.name}(:.*)?\\.${extension}$`);
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

export class ActionPackageNames {
  private readonly items: PackageName[];

  private constructor(items: PackageName[]) {
    this.items = items.sort((a, b) => a.compareTo(b));
  }

  static fromInput(serializedPackageNames: string): ActionPackageNames {
    const tokens = serializedPackageNames
      .replace(/[,\\\n]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    const names: PackageName[] = [];

    for (let index = 0; index < tokens.length; ) {
      const current = tokens[index]!;
      const next = tokens[index + 1];

      const splitNameArch = (namePart: string) => {
        const [name = "", arch] = namePart.split(":", 2);
        return { name, arch };
      };

      try {
        if (current.includes("=")) {
          const [namePart, ...versionParts] = current.split("=");
          const version = versionParts.join("=").trim();
          if (namePart === undefined || namePart.trim() === "") {
            index += 1;
            continue;
          }

          const split = splitNameArch(namePart.trim());
          let arch = split.arch;

          if (
            arch === undefined &&
            next !== undefined &&
            !next.includes("=") &&
            next.trim() !== ""
          ) {
            arch = next.trim();
            index += 1;
          }

          names.push(
            createPackageName(
              split.name,
              version === "" ? undefined : version,
              arch,
            ),
          );
          index += 1;
          continue;
        }

        const split = splitNameArch(current);
        names.push(createPackageName(split.name, undefined, split.arch));
      } catch {
        // Ignore invalid package tokens.
      }

      index += 1;
    }

    return new ActionPackageNames(names);
  }

  static fromJSON(json: any): ActionPackageNames {
    const sourceItems = Array.isArray(json)
      ? json
      : Array.isArray(json?.items)
        ? json.items
        : [];

    const items = sourceItems.map((item: any) =>
      createPackageName(item.name, item.version, item.arch),
    );
    return new ActionPackageNames(items);
  }

  get length(): number {
    return this.items.length;
  }

  toArray(): readonly PackageName[] {
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
  aptListsPath: string = "/var/lib/apt/lists",
): Promise<void> {
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
