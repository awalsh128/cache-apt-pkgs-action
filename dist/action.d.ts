import { type PackageManager, type CommandRunner } from "../../ts-apt/dist/index.js";
import winston from "winston";
type TarModule = typeof import("tar");
type EmptyPackageBehavior = "error" | "warn" | "ignore";
interface PackageName {
    readonly name: string;
    readonly version?: string;
    readonly distro?: string;
    serialize(): string;
}
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
export declare class ActionPackageName implements PackageName {
    readonly name: string;
    readonly version?: string | undefined;
    constructor(name: string, version?: string | undefined);
    serialize(): string;
}
export declare function parseBoolean(value: string, fieldName: string): boolean;
export declare function normalizeInputPackages(inputPackages: string): string[];
export declare class ActionRunner {
    private readonly commandRunner;
    private readonly tar;
    private readonly logger;
    constructor(commandRunner: CommandRunner, tarModule: TarModule, logger: winston.Logger);
    parseBoolean(value: string, fieldName: string): boolean;
    normalizeInputPackages(inputPackages: string): string[];
    resolvePackageVersion(packageManager: PackageManager, packageName: string): Promise<string>;
    normalizePackagesWithVersions(packageManager: PackageManager, inputPackages: string): Promise<string[]>;
    validateEmptyPackages(behavior: EmptyPackageBehavior, packages: string[]): void;
    getCacheRoot(): string;
    getCacheKey(normalizedPackages: string[], version: string): Promise<string>;
    findInstallScript(packageName: string, extension: "preinst" | "postinst", root: string): string | undefined;
    tarRelativePath(filePath: string): string;
    buildFileListForPackage(packageManager: PackageManager, packageName: string): Promise<string[]>;
    updateAptLists(packageManager: PackageManager): Promise<void>;
    packageSpecifierToName(packageSpecifier: string): string;
    installAndCachePackages(cacheDir: string, packages: string[], packageManager: PackageManager): Promise<void>;
    restorePackages(cacheDir: string, executeInstallScripts: boolean): Promise<void>;
    runAction(inputs: ActionInputs): Promise<ActionOutputs>;
}
export declare function runAction(inputs: ActionInputs, logger: winston.Logger): Promise<ActionOutputs>;
export {};
