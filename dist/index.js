import * as core from "@actions/core";
import { parseBoolean, runAction } from "./action.js";
import winston from "winston";
function parseEmptyPackagesBehavior(value) {
    if (value === "error" || value === "warn" || value === "ignore") {
        return value;
    }
    throw new Error(`empty_packages_behavior value '${value}' must be one of: error, warn, ignore.`);
}
function getInputs() {
    const executeInstallScriptsRaw = core.getInput("execute_install_scripts");
    const debugRaw = core.getInput("debug");
    const emptyPackagesBehaviorRaw = core.getInput("empty_packages_behavior") || "error";
    return {
        packages: core.getInput("packages", { required: true }),
        version: core.getInput("version"),
        executeInstallScripts: parseBoolean(executeInstallScriptsRaw, "execute_install_scripts"),
        emptyPackagesBehavior: parseEmptyPackagesBehavior(emptyPackagesBehaviorRaw),
        debug: parseBoolean(debugRaw, "debug"),
    };
}
async function main() {
    try {
        const inputs = getInputs();
        const logger = winston.createLogger({
            level: inputs.debug ? "debug" : "info",
            format: winston.format.combine(winston.format.colorize(), winston.format.printf(({ level, message }) => `${level}: ${message}`)),
            transports: [new winston.transports.Console()],
        });
        const outputs = await runAction(inputs, logger);
        core.setOutput("cache-hit", String(outputs.cacheHit));
        core.setOutput("package-version-list", outputs.packageVersionList);
        core.setOutput("all-package-version-list", outputs.allPackageVersionList);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        core.setFailed(message);
    }
}
void main();
//# sourceMappingURL=index.js.map