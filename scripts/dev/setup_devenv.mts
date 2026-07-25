#!/usr/bin/env -S node --experimental-strip-types

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { defineCommand, defineOptions } from "@robingenz/zli";
import { z } from "zod";
import {
  ROOT_DIR,
  commandExists,
  createCliConfig,
  ensureDirExists,
  fail,
  logInfo,
  logSuccess,
  logWarn,
  path,
  readNodeMajorVersion,
  readJsonFile,
  runCli,
  runMain,
  run,
  tryRun,
  writeJsonFile,
} from "../devopslib.mts";

type IdeSettings = Record<string, unknown>;

type AuditCounts = {
  critical: number;
  high: number;
};

type SupportedIde = "vscode" | "cursor" | "windsurf" | "zed" | "jetbrains";

type SetupDevEnvOptions = {
  ide: SupportedIde;
};

const SUPPORTED_IDES: SupportedIde[] = [
  "vscode",
  "cursor",
  "windsurf",
  "zed",
  "jetbrains",
];

const IDE_TARGET_DIRS: Record<SupportedIde, string> = {
  vscode: ".vscode",
  cursor: ".cursor",
  windsurf: ".windsurf",
  zed: ".zed",
  jetbrains: ".idea",
};

const IDE_SETTINGS_RELPATHS: Partial<Record<SupportedIde, string>> = {
  vscode: ".vscode/settings.json",
  cursor: ".cursor/settings.json",
  windsurf: ".windsurf/settings.json",
  zed: ".zed/settings.json",
};

const AGENTS_MD_SETTING_KEY = "chat.useAgentsMdFile";
const AGENTS_MD_SUPPORTED_IDES: ReadonlySet<SupportedIde> = new Set([
  "vscode",
  "cursor",
  "windsurf",
]);

type JsonPrimitive = null | boolean | number | string;
interface JsonArray extends Array<JsonLike> {}
interface JsonRecord {
  [key: string]: JsonLike;
}
type JsonLike = JsonPrimitive | JsonArray | JsonRecord;

function isJsonRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeJsonArrays(
  existing: JsonLike[],
  template: JsonLike[],
): JsonLike[] {
  const merged = [...existing];
  const seen = new Set(existing.map((item) => JSON.stringify(item)));

  for (const item of template) {
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      merged.push(item);
      seen.add(key);
    }
  }

  return merged;
}

function mergeJsonWithTemplate(
  existing: JsonLike,
  template: JsonLike,
): JsonLike {
  if (Array.isArray(existing) && Array.isArray(template)) {
    return mergeJsonArrays(existing, template);
  }

  if (isJsonRecord(existing) && isJsonRecord(template)) {
    const merged: JsonRecord = { ...existing };

    for (const [key, templateValue] of Object.entries(template)) {
      const existingValue = merged[key];
      if (existingValue === undefined) {
        merged[key] = templateValue;
        continue;
      }

      merged[key] = mergeJsonWithTemplate(existingValue, templateValue);
    }

    return merged;
  }

  // For scalar/shape mismatches, template wins.
  return template;
}

function applyIdeTemplate(ide: SupportedIde): void {
  const templateDir = path.join(
    ROOT_DIR,
    "scripts",
    "dev",
    "ide_templates",
    ide,
  );
  if (!existsSync(templateDir)) {
    fail(`IDE template directory does not exist: ${templateDir}`);
  }

  const targetDir = path.join(ROOT_DIR, IDE_TARGET_DIRS[ide]);
  ensureDirExists(targetDir);

  const entries = readdirSync(templateDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const templatePath = path.join(templateDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (!entry.name.endsWith(".json")) {
      if (!existsSync(targetPath)) {
        writeFileSync(targetPath, readFileSync(templatePath, "utf8"), "utf8");
        logInfo(`Applied template file ${targetPath}`);
      } else {
        logInfo(`Skipped existing non-JSON file ${targetPath}`);
      }
      continue;
    }

    const templateJson = readJsonFile(templatePath) as JsonLike;
    if (!existsSync(targetPath)) {
      writeJsonFile(targetPath, templateJson);
      logInfo(`Applied JSON template ${targetPath}`);
      continue;
    }

    const existingJson = readJsonFile(targetPath) as JsonLike;
    const mergedJson = mergeJsonWithTemplate(existingJson, templateJson);
    writeJsonFile(targetPath, mergedJson);
    logInfo(`Merged JSON template into ${targetPath}`);
  }
}

function getIdeSettingsPath(ide: SupportedIde): string | null {
  const relPath = IDE_SETTINGS_RELPATHS[ide];
  if (!relPath) {
    return null;
  }
  return path.join(ROOT_DIR, relPath);
}

function ensureIdeSettingsFile(ide: SupportedIde): string | null {
  const ideSettingsPath = getIdeSettingsPath(ide);
  if (!ideSettingsPath) {
    return null;
  }

  const ideSettingsDir = path.dirname(ideSettingsPath);
  ensureDirExists(ideSettingsDir);

  const templateSettingsPath = path.join(
    ROOT_DIR,
    "scripts",
    "dev",
    "ide_templates",
    ide,
    "settings.json",
  );

  if (!existsSync(templateSettingsPath)) {
    if (!existsSync(ideSettingsPath)) {
      writeJsonFile(ideSettingsPath, {});
      logWarn(`Created missing ${ideSettingsPath}`);
    }
    return ideSettingsPath;
  }

  const templateSettingsJson = readJsonFile(templateSettingsPath) as JsonLike;

  if (!existsSync(ideSettingsPath)) {
    writeJsonFile(ideSettingsPath, templateSettingsJson);
    logWarn(`Created missing ${ideSettingsPath}`);
    return ideSettingsPath;
  }

  const existingSettingsJson = readJsonFile(ideSettingsPath) as JsonLike;
  const mergedSettingsJson = mergeJsonWithTemplate(
    existingSettingsJson,
    templateSettingsJson,
  );
  writeJsonFile(ideSettingsPath, mergedSettingsJson);

  return ideSettingsPath;
}

function ensureAgentsFilesUsed(ide: SupportedIde): void {
  if (!AGENTS_MD_SUPPORTED_IDES.has(ide)) {
    return;
  }

  const ideSettingsPath = getIdeSettingsPath(ide);
  if (!ideSettingsPath || !existsSync(ideSettingsPath)) {
    return;
  }

  const ideSettingsJson = readJsonFile(ideSettingsPath) as IdeSettings;

  if (!ideSettingsJson[AGENTS_MD_SETTING_KEY]) {
    ideSettingsJson[AGENTS_MD_SETTING_KEY] = true;
    writeJsonFile(ideSettingsPath, ideSettingsJson);
    logWarn(
      `Updated ${ideSettingsPath} to enable chat.useAgentsMdFile for AGENTS.md support.`,
    );
  }
}

function ensureAptDependencies(): void {
  if (!commandExists("apt-get")) {
    fail("apt-get is required for system dependency installation.");
  }

  const aptPackages: Array<[string, string]> = [
    ["curl", "curl"],
    ["gh", "gh"],
    ["git", "git"],
    ["jq", "jq"],
    ["flock", "util-linux"],
    ["node-typescript", "node-typescript"],
    ["shellcheck", "shellcheck"],
  ];

  const missingPackages = [
    ...new Set(
      aptPackages
        .filter(([command]) => !commandExists(command))
        .map(([, packageName]) => packageName),
    ),
  ];

  if (missingPackages.length === 0) {
    logSuccess("All required apt CLI dependencies are already installed.");
    return;
  }

  const aptRunner: (args: string[]) => void = commandExists("sudo")
    ? (args) => run("sudo", ["apt-get", ...args])
    : (args) => run("apt-get", args);

  logInfo(`Installing missing apt packages: ${missingPackages.join(" ")}`);
  aptRunner(["update"]);
  aptRunner(["install", "-y", ...missingPackages]);
}

function ensureNodeDependencies(nodeVersionMajor: string): void {
  if (!commandExists("npm")) {
    fail(
      `npm is required but not installed. Install Node.js >=${nodeVersionMajor} first.`,
    );
  }

  // Fast deterministic install path aligned with lockfile-based CI behavior.
  logInfo(
    "Installing npm dependencies (including devDependencies) via npm ci...",
  );
  run("npm", ["ci", "--include=dev"]);
}

function warnIfDockerMissing(): void {
  if (commandExists("docker")) {
    logSuccess(
      "Docker CLI detected for devcontainer-backed integration tests.",
    );
    return;
  }

  logWarn(
    "Docker is not installed. Devcontainer-backed integration tests will be unavailable until Docker is installed.",
  );
}

function parseAuditJson(outputText: string): {
  metadata?: { vulnerabilities?: Record<string, unknown> };
} {
  if (!outputText || outputText.trim().length === 0) {
    fail("npm audit produced empty output.");
  }

  try {
    return JSON.parse(outputText);
  } catch {
    const firstBraceIndex = outputText.indexOf("{");
    const lastBraceIndex = outputText.lastIndexOf("}");
    if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
      return JSON.parse(outputText.slice(firstBraceIndex, lastBraceIndex + 1));
    }
    fail("Unable to parse npm audit JSON output.");
    throw new Error("unreachable");
  }
}

function getAuditCounts(): AuditCounts {
  const audit = tryRun("npm", ["audit", "--json"], {
    cwd: ROOT_DIR,
    stdio: "pipe",
  });

  const report = parseAuditJson(String(audit.stdout ?? ""));
  const vulnerabilities = report?.metadata?.vulnerabilities ?? {};

  return {
    critical: Number(vulnerabilities.critical ?? 0),
    high: Number(vulnerabilities.high ?? 0),
  };
}

function runAuditFix(force = false): void {
  const args = force ? ["audit", "fix", "--force"] : ["audit", "fix"];
  const result = tryRun("npm", args, {
    cwd: ROOT_DIR,
    stdio: "inherit",
  });

  if (!result.ok) {
    logWarn(
      `npm ${args.join(" ")} exited with code ${result.status ?? "unknown"}. Continuing to verification...`,
    );
  }
}

function ensureAuditRemediation(): void {
  let counts = getAuditCounts();
  logInfo(`Audit baseline: high=${counts.high}, critical=${counts.critical}.`);

  if (counts.high === 0 && counts.critical === 0) {
    logSuccess("No high/critical npm vulnerabilities detected.");
    return;
  }

  logWarn(
    `Detected vulnerabilities: high=${counts.high}, critical=${counts.critical}. Running npm audit fix...`,
  );
  runAuditFix(false);
  counts = getAuditCounts();
  logInfo(
    `Audit after npm audit fix: high=${counts.high}, critical=${counts.critical}.`,
  );

  if (counts.high === 0 && counts.critical === 0) {
    logSuccess(
      "High/critical npm vulnerabilities remediated with npm audit fix.",
    );
    return;
  }

  logWarn(
    `High/critical vulnerabilities remain: high=${counts.high}, critical=${counts.critical}. Running npm audit fix --force...`,
  );
  runAuditFix(true);
  counts = getAuditCounts();
  logInfo(
    `Audit after npm audit fix --force: high=${counts.high}, critical=${counts.critical}.`,
  );

  if (counts.high > 0 || counts.critical > 0) {
    fail(
      `Unable to remediate all high/critical vulnerabilities: high=${counts.high}, critical=${counts.critical}.`,
    );
  }

  logSuccess("High/critical npm vulnerabilities remediated.");
}

async function main(options: SetupDevEnvOptions): Promise<void> {
  const nodeVersionMajor = readNodeMajorVersion();

  logInfo(`Applying IDE template for '${options.ide}'...`);
  applyIdeTemplate(options.ide);

  logInfo(`Ensuring ${options.ide} settings file is present and aligned...`);
  ensureIdeSettingsFile(options.ide);
  if (AGENTS_MD_SUPPORTED_IDES.has(options.ide)) {
    logInfo(`Ensuring chat.useAgentsMdFile is enabled for ${options.ide}...`);
    ensureAgentsFilesUsed(options.ide);
  }
  logInfo("Ensuring required APT dependencies are installed...");
  ensureAptDependencies();
  logInfo("Checking optional Docker support...");
  logInfo(
    `Setting up development environment for Node.js v${nodeVersionMajor}.x...`,
  );
  ensureNodeDependencies(nodeVersionMajor);
  ensureAuditRemediation();
  warnIfDockerMissing();
  logSuccess("Development environment setup complete.");
}

const setupDevenvCommand = defineCommand({
  description: "Set up local development environment",
  options: defineOptions(
    z.object({
      ide: z
        .enum(SUPPORTED_IDES as [SupportedIde, ...SupportedIde[]])
        .default("vscode")
        .describe("IDE template to apply before dependency setup"),
    }),
    {
      i: "ide",
    },
  ),
  action: async (options: SetupDevEnvOptions) => {
    await main(options);
  },
});

const cliConfig = createCliConfig({
  importMetaUrl: import.meta.url,
  description: "Set up local development environment",
  commands: {
    run: setupDevenvCommand,
  },
  defaultCommand: setupDevenvCommand,
});

await runMain(async () => {
  await runCli(cliConfig);
});
