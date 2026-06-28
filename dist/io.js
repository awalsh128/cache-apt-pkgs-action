import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as os from "os";
export function isAptListsFresh() {
    const aptListsPath = "/var/lib/apt/lists";
    const maxDepth = 5;
    function search(currentPath, currentDepth) {
        if (currentDepth > maxDepth)
            return false;
        try {
            const stats = fs.statSync(currentPath);
            if (stats.isDirectory()) {
                const entries = fs.readdirSync(currentPath);
                for (const entry of entries) {
                    const fullPath = path.join(currentPath, entry);
                    if (search(fullPath, currentDepth + 1)) {
                        return true;
                    }
                }
            }
            else {
                return true;
            }
        }
        catch (error) {
            // Ignore permission errors or inaccessible paths
        }
        return false;
    }
    return search(aptListsPath, 0);
}
export class Package {
    name;
    version;
    constructor(name, version) {
        this.name = name;
        this.version = version;
    }
    serialize() {
        return `${this.name}@${this.version}`;
    }
}
const FORCE_UPDATE_INCREMENT = "4";
const CACHE_DIRNAME = "cache-apt-pkgs";
const CACHE_PREFIX = "cache-apt-pkgs_";
export class CacheKey {
    version;
    forceUpdateIncrement;
    arch;
    normalizedPackages;
    constructor(version, forceUpdateIncrement, arch, normalizedPackages) {
        this.version = version;
        this.forceUpdateIncrement = forceUpdateIncrement;
        this.arch = arch;
        this.normalizedPackages = normalizedPackages;
    }
    serialize() {
        return `${this.version}|${this.forceUpdateIncrement}|${this.arch}|${this.normalizedPackages.join(",")}`;
    }
}
export function deserializeCacheKey(serialized) {
    const parts = serialized.split("|");
    if (parts.length !== 4) {
        throw new Error(`Invalid serialized cache key: ${serialized}`);
    }
    const [version, forceUpdateIncrement, arch, normalizedPackagesStr] = parts;
    const normalizedPackages = normalizedPackagesStr.split(",");
    return new CacheKey(version, forceUpdateIncrement, arch, normalizedPackages);
}
export class Cache {
    cachePath;
    commandRunner;
    constructor(cacheDir = CACHE_DIRNAME, commandRunner) {
        this.cachePath = path.join(os.homedir(), cacheDir);
        this.commandRunner = commandRunner;
    }
    async getKey(normalizedPackages, version) {
        const architecture = await (await this.commandRunner.run("arch")).stdout.trim();
        let value = `${normalizedPackages.join(" ")} @ ${version} ${FORCE_UPDATE_INCREMENT}`;
        if (architecture !== "x86_64") {
            value = `${value} ${architecture}`;
        }
        const hash = crypto.createHash("md5").update(value).digest("hex");
        return `${CACHE_PREFIX}${hash}`;
    }
}
//# sourceMappingURL=io.js.map