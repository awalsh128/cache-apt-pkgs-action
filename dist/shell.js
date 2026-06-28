import { spawnSync } from "node:child_process";
import fs from "node:fs";
export function runCommand(command, args = [], options = {}) {
    const result = spawnSync(command, args, {
        encoding: "utf8",
        ...options,
    });
    const stdout = typeof result.stdout === "string"
        ? result.stdout
        : result.stdout
            ? result.stdout.toString("utf8")
            : "";
    const stderr = typeof result.stderr === "string"
        ? result.stderr
        : result.stderr
            ? result.stderr.toString("utf8")
            : "";
    return {
        status: result.status ?? 1,
        stdout,
        stderr,
    };
}
export function runCommandOrThrow(command, args = [], options = {}) {
    const result = runCommand(command, args, options);
    if (result.status !== 0) {
        throw new Error([
            `Command failed: ${command} ${args.join(" ")}`,
            `exit: ${result.status}`,
            result.stdout ? `stdout:\n${result.stdout.trim()}` : "",
            result.stderr ? `stderr:\n${result.stderr.trim()}` : "",
        ]
            .filter(Boolean)
            .join("\n"));
    }
    return result;
}
export function fileIsFresh(path, withinMinutes) {
    if (!fs.existsSync(path)) {
        return false;
    }
    const stat = fs.statSync(path);
    const maxAgeMs = withinMinutes * 60 * 1000;
    return Date.now() - stat.mtimeMs <= maxAgeMs;
}
//# sourceMappingURL=shell.js.map