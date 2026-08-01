import fs from "node:fs";
import { CacheKey } from "./cache.js";
import { packageNameFromJSON, PackageInfo, PackageName } from "ts-apt";

export class ManifestEntry {
  readonly packageName: PackageName;
  readonly filepaths: string[];

  constructor(packageName: PackageName, filepaths: string[] = []) {
    this.packageName = packageName;
    this.filepaths = [...filepaths].sort((a, b) => a.localeCompare(b));
  }

  static fromJSON(json: any): ManifestEntry {
    return new ManifestEntry(
      packageNameFromJSON(json.packageName),
      json.filepaths as string[],
    );
  }
}

export class Manifest {
  constructor(
    public readonly created: Date,
    public readonly entries: ManifestEntry[],
    public readonly cacheKey: CacheKey,
  ) {}

  // Static factory method
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

  static async readFromFile(filePath: string): Promise<Manifest> {
    const content = await fs.promises.readFile(filePath, "utf-8");
    return Manifest.fromJSON(JSON.parse(content));
  }

  static from(
    date: Date,
    cacheKey: CacheKey,
    packageInfos: PackageInfo[],
  ): Manifest {
    const entries = packageInfos.map(
      (info: PackageInfo) => new ManifestEntry(info.name, []),
    );
    return new Manifest(date, entries, cacheKey);
  }

  async writeToFile(filePath: string): Promise<void> {
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(this, null, 2),
      "utf8",
    );
  }
}
