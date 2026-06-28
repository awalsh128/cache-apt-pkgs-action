import fs from "node:fs";
export function writeManifest(filePath, entries) {
    const normalized = [...entries].filter(Boolean).sort((a, b) => a.localeCompare(b));
    fs.writeFileSync(filePath, normalized.join("\n"), "utf8");
}
export function readManifestAsCsv(filePath) {
    if (!fs.existsSync(filePath)) {
        return "";
    }
    return fs
        .readFileSync(filePath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join(",");
}
//# sourceMappingURL=manifest.js.map