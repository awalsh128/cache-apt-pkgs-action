#!/usr/bin/env -S node --experimental-strip-types

import {
  accessSync,
  constants,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import {
  execFileSync,
  spawnSync,
  type ExecFileSyncOptions,
  type SpawnSyncOptions,
} from "node:child_process";
import {
  defineConfig,
  processConfig,
  type CommandDefinition,
  type DefineConfig,
  type ProcessResult,
} from "@robingenz/zli";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

export { fileURLToPath, path, process };

export class Paths {
  importMetaUrl: string;

  constructor(importMetaUrl: string) {
    this.importMetaUrl = importMetaUrl;
  }

  scriptDir() {
    return path.dirname(fileURLToPath(this.importMetaUrl));
  }

  repoRootDir() {
    return path.resolve(this.scriptDir(), "..");
  }
}

export const ROOT_DIR = new Paths(import.meta.url).repoRootDir();

export const REPO_OWNER = "awalsh128";
export const REPO_NAME = "cache-apt-pkgs-action";
export const REPO_SLUG = `${REPO_OWNER}/${REPO_NAME}`;
export const REPO_URL = `https://github.com/${REPO_SLUG}.git`;
export const GITHUB_API_BASE_URL = "https://api.github.com";
export const GITHUB_USER_AGENT = `${REPO_NAME}-dev-scripts`;

export const VSCODE_SETTINGS_RELPATH = ".vscode/settings.json";
export const VSCODE_SETTINGS_DEFAULTS = {
  "chat.tools.terminal.autoApprove": {
    "*": true,
  },
  "chat.useAgentsMdFile": true,
};

export const CURRENT_NODE_VERSION = "24";

export function usage(scriptPath: string, params: string) {
  return `usage: ${path.basename(scriptPath)} ${params}`;
}

export const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
} as const;

export type COLOR = (typeof COLORS)[keyof typeof COLORS];

export type LogParams = {
  color?: COLOR;
  indent?: number;
};

export function fail(message: string, exitCode = 1, params: LogParams = {}) {
  logError(message, params);
  process.exit(exitCode);
}

export function log(message: string, params: LogParams = {}) {
  console.log(
    `${" ".repeat(params.indent ?? 0)}${params.color ?? ""}${message}${COLORS.reset}`,
  );
}

export function logInfo(message: string, params: LogParams = {}) {
  log(`ℹ️  ${message}`, params);
}

export function logSuccess(message: string, params: LogParams = {}) {
  log(`✅ ${message}`, params);
}

export function logWarn(message: string, params: LogParams = {}) {
  log(`⚠️  ${message}`, params);
}

export function logError(message: string, params: LogParams = {}) {
  log(`❌ ${message}`, params);
}

export function assertNonEmpty(
  value: string,
  message: string,
  usageMessage?: string,
) {
  if (!value || value.trim().length === 0) {
    if (usageMessage) {
      console.error(usageMessage);
    }
    fail(message);
  }
}

export function commandExists(command: string) {
  const isExecutable = (candidatePath: string) => {
    try {
      accessSync(candidatePath, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  };

  if (command.includes("/")) {
    return isExecutable(command);
  }

  const pathValue = process.env.PATH ?? "";
  const dirs = pathValue.split(path.delimiter).filter(Boolean);
  return dirs.some((dirPath: string) =>
    isExecutable(path.join(dirPath, command)),
  );
}

export function ensureDirExists(dirPath: string) {
  mkdirSync(dirPath, { recursive: true });
}

export function readJsonFile(filePath: string) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function writeJsonFile(filePath: string, value: unknown) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function readNodeMajorVersion(rootDir = ROOT_DIR): string {
  const nodeVersionPath = path.join(rootDir, ".node_ver");

  let fileText: string = "";
  try {
    fileText = readFileSync(nodeVersionPath, "utf8");
  } catch (error) {
    fail(
      `Missing or unreadable version file at ${nodeVersionPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const lines = fileText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length !== 1) {
    fail(".node_ver must contain exactly one non-empty line.");
  }

  const rawVersion = lines[0] ?? "";
  if (rawVersion.length === 0) {
    fail(".node_ver must contain exactly one non-empty line.");
  }
  if (!/^\d+$/.test(rawVersion)) {
    fail(
      ".node_ver must contain only the Node.js major version (e.g. 20, 24).",
    );
  }

  return rawVersion;
}

function normalizeExecOptions(
  optionsOrQuiet: boolean | ExecFileSyncOptions | undefined,
): ExecFileSyncOptions {
  if (typeof optionsOrQuiet === "boolean") {
    return {
      cwd: ROOT_DIR,
      env: process.env,
      encoding: "utf8",
      stdio: optionsOrQuiet ? "pipe" : "inherit",
    };
  }

  const options = optionsOrQuiet ?? {};
  return {
    cwd: options.cwd ?? ROOT_DIR,
    env: options.env ?? process.env,
    encoding: options.encoding ?? "utf8",
    maxBuffer: options.maxBuffer,
    killSignal: options.killSignal,
    shell: options.shell,
    uid: options.uid,
    gid: options.gid,
    timeout: options.timeout,
  };
}

function normalizeSpawnOptions(
  optionsOrQuiet: boolean | SpawnSyncOptions | undefined,
  forcePipe = false,
): SpawnSyncOptions {
  if (typeof optionsOrQuiet === "boolean") {
    return {
      cwd: ROOT_DIR,
      env: process.env,
      encoding: "utf8",
      stdio: forcePipe ? "pipe" : optionsOrQuiet ? "pipe" : "inherit",
    } satisfies SpawnSyncOptions;
  }

  const options = optionsOrQuiet ?? {};
  return {
    cwd: options.cwd ?? ROOT_DIR,
    env: options.env ?? process.env,
    encoding: options.encoding ?? "utf8",
    stdio: forcePipe ? "pipe" : (options.stdio ?? "inherit"),
  } satisfies SpawnSyncOptions;
}

export function run(
  command: string,
  args: string[] = [],
  optionsOrQuiet: boolean | ExecFileSyncOptions | undefined = undefined,
) {
  const options = normalizeExecOptions(optionsOrQuiet);
  try {
    return execFileSync(command, args, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to execute '${command} ${args.join(" ")}'. ${message}`,
    );
  }
}

export function tryRun(
  command: string,
  args: string[] = [],
  optionsOrQuiet: boolean | SpawnSyncOptions | undefined = undefined,
) {
  const options = normalizeSpawnOptions(optionsOrQuiet);
  const result = spawnSync(command, args, options);

  if (result.error) {
    throw new Error(
      `Failed to spawn '${command} ${args.join(" ")}'. ${result.error.message}`,
    );
  }

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function runCaptureOutput(
  command: string,
  args: string[] = [],
  options: boolean | SpawnSyncOptions | undefined = undefined,
) {
  const normalizedOptions = normalizeSpawnOptions(options, true);
  const result = spawnSync(command, args, normalizedOptions);

  if (result.error) {
    throw new Error(
      `Failed to spawn '${command} ${args.join(" ")}'. ${result.error.message}`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `Command '${command} ${args.join(" ")}' exited with status ${result.status}:\n${String(result.stderr ?? "").trim()}`,
    );
  }

  return String(result.stdout ?? "").trim();
}

type CliAction = (
  options: unknown,
  args: string[],
) => unknown | Promise<unknown>;

type CliResult = ProcessResult<CommandDefinition<any, any>>;

type CliCommands = Record<string, CommandDefinition<any, any>>;

type CliConfig = DefineConfig<CliCommands>;

type CliConfigParams = {
  name?: string;
  importMetaUrl?: string;
  description: string;
  commands: CliCommands;
  defaultCommand?: CommandDefinition<any, any>;
};

type CliResultCommand = {
  command: {
    action: CliAction;
  };
  options: unknown;
  args: string[];
};

export function createCliConfig(params: CliConfigParams) {
  const derivedName = (() => {
    if (params.name && params.name.trim().length > 0) {
      return params.name;
    }

    if (params.importMetaUrl && params.importMetaUrl.trim().length > 0) {
      const filePath = fileURLToPath(params.importMetaUrl);
      const parsed = path.parse(filePath);
      if (parsed.name.trim().length > 0) {
        return parsed.name;
      }
    }

    fail(
      "createCliConfig requires either a non-empty 'name' or a valid 'importMetaUrl'.",
    );
  })();

  return defineConfig({
    meta: {
      name: derivedName,
      version: process.env.npm_package_version ?? "0.0.0",
      description: params.description,
    },
    commands: params.commands,
    defaultCommand: params.defaultCommand,
  });
}

export async function runCli(
  cliConfig: CliConfig,
  argv: string[] = process.argv.slice(2),
): Promise<void> {
  const result = processConfig(cliConfig, argv) as CliResult;
  const commandResult = result as unknown as CliResultCommand;
  await commandResult.command.action(commandResult.options, commandResult.args);
}

export async function runMain(
  action: () => void | Promise<void>,
  exitCode = 1,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error), exitCode);
  }
}

export async function confirmPrompt(
  message: string,
  yesPattern: RegExp = /^[yY]$/,
  noPattern: RegExp = /^[nN]$/,
) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const getText = (pattern: RegExp) =>
      pattern.source
        .trim()
        .replace(/^\^/, "")
        .replace(/\$$/, "")
        .replace(/\\([^\\])/g, "$1");
    while (true) {
      const answer = await rl
        .question(
          `${message} [${getText(yesPattern)} | ${getText(noPattern)}] `,
        )
        .then((ans: string) => ans.trim().toLowerCase());
      if (yesPattern.test(answer) || answer.trim() === "") {
        return;
      }
      if (noPattern.test(answer)) {
        fail("Aborted.", 0);
      }
      logError(
        `Invalid option '${answer}' selected. Options are: ${getText(yesPattern)} or ${getText(noPattern)}`,
      );
    }
  } finally {
    rl.close();
  }
}
