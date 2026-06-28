import { type CommandRunner } from "../../ts-apt/dist/index.js";
export declare function isAptListsFresh(): boolean;
export declare class Package {
    readonly name: string;
    readonly version: string;
    constructor(name: string, version: string);
    serialize(): string;
}
export declare class CacheKey {
    readonly version: string;
    readonly forceUpdateIncrement: string;
    readonly arch: string;
    readonly normalizedPackages: string[];
    constructor(version: string, forceUpdateIncrement: string, arch: string, normalizedPackages: string[]);
    serialize(): string;
}
export declare function deserializeCacheKey(serialized: string): CacheKey;
export declare class Cache {
    private readonly cachePath;
    private readonly commandRunner;
    constructor(cacheDir: string | undefined, commandRunner: CommandRunner);
    getKey(normalizedPackages: string[], version: string): Promise<string>;
}
