import fs from "node:fs";
import { CacheKey } from "./cache.js";
import { packageNameFromJSON, PackageName } from "ts-apt";

/** Parsed JSON form of a {@link ManifestEntry}. */
interface ManifestEntryJson {
  readonly packageName: Parameters<typeof packageNameFromJSON>[0];
  readonly filepaths: string[];
}

/** Parsed JSON form of a {@link Manifest}. */
interface ManifestJson {
  readonly created: string | number;
  readonly entries: readonly ManifestEntryJson[];
  readonly cacheKey: string;
}

/**
 * Throws when a field a manifest needs is missing or has the wrong type.
 *
 * @param ok Whether the field is valid.
 * @param field Name of the field, for the error message.
 * @param where What was being parsed (e.g. `manifest`).
 */
function requireField(ok: boolean, field: string, where: string): void {
  if (!ok) {
    throw new Error(`Invalid ${where}: '${field}' is required and has the wrong type or is missing.`);
  }
}

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
  constructor(packageName: PackageName, filepaths: string[]) {
    this.packageName = packageName;
    this.filepaths = [...filepaths].sort((a, b) => a.localeCompare(b));
  }

  /**
   * Creates an entry from its parsed JSON form.
   *
   * @param json Parsed JSON object as written by {@link Manifest.writeToFile}.
   * @returns The deserialized entry.
   * @throws Error when `packageName` or `filepaths` is missing.
   */
  static fromJSON(json: ManifestEntryJson): ManifestEntry {
    requireField(json?.packageName != null, "packageName", "manifest entry");
    requireField(Array.isArray(json.filepaths), "filepaths", "manifest entry");
    return new ManifestEntry(packageNameFromJSON(json.packageName), json.filepaths);
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
   * @throws Error when `created`, `entries` or `cacheKey` is missing.
   */
  static fromJSON(json: ManifestJson): Manifest {
    requireField(json?.created != null, "created", "manifest");
    requireField(Array.isArray(json.entries), "entries", "manifest");
    requireField(typeof json.cacheKey === "string", "cacheKey", "manifest");
    return new Manifest(
      new Date(json.created),
      json.entries.map((entry) => ManifestEntry.fromJSON(entry)),
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
    await fs.promises.writeFile(filePath, JSON.stringify(this, null, 2), "utf8");
  }
}
