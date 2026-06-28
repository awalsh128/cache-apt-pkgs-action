import { ActionPackageName } from "./action.js";
import fs from "fs";
import { CacheKey, deserializeCacheKey } from "./io.js";

class ManifestEntry {
  readonly packageName: ActionPackageName;
  readonly filepaths: string[];

  constructor(packageName: ActionPackageName, filepaths: string[]) {
    this.packageName = packageName;
    this.filepaths = filepaths;
  }
}

class Manifest {
  readonly cacheTimestamp: string;
  readonly cacheTimestampMs: string;
  readonly cacheKey: CacheKey;
  readonly entries: ManifestEntry[];

  constructor(cacheDate: Date, cacheKey: CacheKey, entries: ManifestEntry[]) {
    this.cacheTimestamp = cacheDate.toISOString();
    this.cacheTimestampMs = new Date(this.cacheTimestamp).getTime().toString();
    this.cacheKey = cacheKey;
    this.entries = entries;
  }

  readFromFile(filepath: string): Manifest | null {
    fs.readFileSync(file, JSON.parse())
  }

  writeToFile(filePath: string): void {
    fs.writeFileSync(filePath, JSON.stringify(this, null, 2), "utf-8");
  }
}
