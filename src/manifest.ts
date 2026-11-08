import fs from "node:fs";
import { CacheKey } from "./cache.js";
import { packageNameFromJSON, PackageName } from "ts-apt";

/** One installed package and the files archived for it in the cache. */
export class ManifestEntry {
  /** Installed package, with the version and arch apt resolved. */
  readonly packageName: PackageName;
  /**
   * Files installed by the package, relative to `/` (no leading slash) so they
   * can be passed straight to tar. Sorted for stable output. Empty for
   * packages without files (e.g. metapackages), which get no archive.
   */
  readonly filepaths: string[];

  /**
   * @param packageName Installed package.
   * @param filepaths Root-relative file paths; copied and sorted.
   */
  constructor(packageName: PackageName, filepaths: string[] = []) {
    this.packageName = packageName;
    this.filepaths = [...filepaths].sort((a, b) => a.localeCompare(b));
  }

  /**
   * Creates an entry from its parsed JSON form.
   *
   * @param json Parsed JSON object as written by {@link Manifest.writeToFile}.
   * @returns The deserialized entry.
   */
  static fromJSON(json: any): ManifestEntry {
    return new ManifestEntry(
      packageNameFromJSON(json.packageName),
      json.filepaths as string[],
    );
  }
}

/**
 * Record of the packages stored in a cache, written alongside the archives.
 *
 * Restore reads it to find each package's archive and to report outputs.
 */
export class Manifest {
  /**
   * @param created When the manifest was created.
   * @param entries Packages in the order apt installed them. Restore relies on
   *   this order because install scripts can depend on earlier packages
   *   (see issue #196).
   * @param cacheKey Key the cache was saved under.
   */
  constructor(
    /** When the manifest was created. */
    public readonly created: Date,
    /** Packages in the order apt installed them. */
    public readonly entries: ManifestEntry[],
    /** Key the cache was saved under. */
    public readonly cacheKey: CacheKey,
  ) {}

  /**
   * Creates a manifest from its parsed JSON form.
   *
   * @param json Parsed JSON object as written by {@link Manifest.writeToFile}.
   *   Its `cacheKey` is the serialized string from {@link CacheKey.toJSON}.
   * @returns The deserialized manifest.
   */
  static fromJSON(json: any): Manifest {
    return new Manifest(
      new Date(json.created),
      json.entries.map(
        (e: any) =>
          new ManifestEntry(
            packageNameFromJSON(e.packageName),
            e.filepaths as string[],
          ),
      ),
      CacheKey.fromJSON(json.cacheKey),
    );
  }

  /**
   * Reads and parses a manifest file.
   *
   * @param filePath Path to a manifest JSON file.
   * @returns The parsed manifest.
   * @throws Error when the file can't be read or isn't a valid manifest.
   */
  static async readFromFile(filePath: string): Promise<Manifest> {
    const content = await fs.promises.readFile(filePath, "utf-8");
    return Manifest.fromJSON(JSON.parse(content));
  }

  /**
   * Writes the manifest as pretty-printed JSON, replacing any existing file.
   *
   * @param filePath Destination path.
   */
  async writeToFile(filePath: string): Promise<void> {
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(this, null, 2),
      "utf8",
    );
  }
}
