#!/usr/bin/env -S node --experimental-strip-types

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { defineCommand, defineOptions } from "@robingenz/zli";
import process from "node:process";
import { z } from "zod";
import {
  confirmPrompt,
  createCliConfig,
  GITHUB_USER_AGENT,
  ROOT_DIR,
  commandExists,
  fail,
  logInfo,
  logSuccess,
  logWarn,
  readNodeMajorVersion,
  runCli,
  runMain,
  run,
  runCaptureOutput,
  tryRun,
} from "../devopslib.mts";

type ReferenceSpec = {
  path: string;
  replacements: Array<[RegExp, string]>;
};

type NodeRegistryPackage = {
  versions?: Record<string, unknown>;
};

type AptRunner = (args: string[]) => void;

const rootDir = ROOT_DIR;

function listYamlFiles(rootPath: string): string[] {
  const yamlFiles: string[] = [];
  const excludedDirs = new Set([".git", "node_modules", "dist", "coverage"]);

  const walk = (directory: string) => {
    const entries = readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!excludedDirs.has(entry.name)) {
          walk(fullPath);
        }
        continue;
      }

      const lower = entry.name.toLowerCase();
      if (lower.endsWith(".yml") || lower.endsWith(".yaml")) {
        yamlFiles.push(fullPath);
      }
    }
  };

  walk(rootPath);
  return yamlFiles.sort((left, right) => left.localeCompare(right));
}

function buildReferenceSpecs(nodeMajor: string): ReferenceSpec[] {
  const yamlReferenceSpecs: ReferenceSpec[] = listYamlFiles(rootDir).map(
    (filePath) => ({
      path: filePath,
      replacements: [
        [/node-version:\s*\[\d+(?:\.x)?\]/g, `node-version: [${nodeMajor}]`],
        [/node-version:\s*\d+(?:\.x)?/g, `node-version: ${nodeMajor}`],
      ],
    }),
  );

  return [
    {
      path: `${rootDir}/package.json`,
      replacements: [
        [/"node":\s*">=\d+(?:\.\d+\.\d+)?"/g, `"node": ">=${nodeMajor}"`],
      ],
    },
    {
      path: `${rootDir}/scripts/devopslib.mts`,
      replacements: [
        [
          /export const CURRENT_NODE_VERSION = "\d+";/g,
          `export const CURRENT_NODE_VERSION = "${nodeMajor}";`,
        ],
      ],
    },
    ...yamlReferenceSpecs,
    {
      path: `${rootDir}/README.md`,
      replacements: [[/- Node\.js \d+\+/g, `- Node.js ${nodeMajor}+`]],
    },
  ];
}

function applyReplacements(
  content: string,
  replacements: ReferenceSpec["replacements"],
): string {
  let updated = content;
  for (const [pattern, replacement] of replacements) {
    updated = updated.replace(pattern, replacement);
  }
  return updated;
}

function updateNodeVersionReferences(nodeMajor: string): void {
  const files = buildReferenceSpecs(nodeMajor);
  let changedCount = 0;

  for (const entry of files) {
    const original = readFileSync(entry.path, "utf8");
    const updated = applyReplacements(original, entry.replacements);

    if (updated !== original) {
      writeFileSync(entry.path, updated, "utf8");
      changedCount += 1;
      logInfo(`Updated Node version references in ${entry.path}.`);
    }
  }

  if (changedCount === 0) {
    logInfo("No Node version reference updates were needed.");
  } else {
    logSuccess(`Updated Node version references in ${changedCount} file(s).`);
  }
}

function verifyNodeVersionReferences(nodeMajor: string): void {
  const files = buildReferenceSpecs(nodeMajor);
  const drifted: string[] = [];

  for (const entry of files) {
    const original = readFileSync(entry.path, "utf8");
    const updated = applyReplacements(original, entry.replacements);
    if (updated !== original) {
      drifted.push(entry.path);
    }
  }

  if (drifted.length > 0) {
    fail(`Node version references are out of sync in: ${drifted.join(", ")}`);
  }

  logSuccess("All Node version references are synchronized with .node_ver.");
}

async function getAvailableNodeMajors(): Promise<string[]> {
  let packageJson: NodeRegistryPackage | null = null;
  try {
    const response = await fetch("https://registry.npmjs.org/node", {
      headers: {
        Accept: "application/json",
        "User-Agent": GITHUB_USER_AGENT,
      },
    });

    if (!response.ok) {
      fail(
        `Unable to read Node.js versions from npm registry: HTTP ${response.status}`,
      );
    }

    packageJson = (await response.json()) as NodeRegistryPackage;
  } catch (error) {
    fail(
      `Unable to read Node.js versions from npm registry: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const versions = Object.keys(packageJson?.versions ?? {});
  if (!Array.isArray(versions) || versions.length === 0) {
    fail("Unexpected npm registry response for Node.js versions.");
  }

  return [
    ...new Set(
      versions
        .map((version) => String(version).split(".")[0] ?? "")
        .filter((major) => major.length > 0),
    ),
  ]
    .filter((major) => /^\d+$/.test(major))
    .sort((left, right) => Number(left) - Number(right));
}

function runScriptWithOptionalSudo(scriptText: string): void {
  if (!commandExists("bash")) {
    fail("bash is required to run the NodeSource setup script.");
  }

  const usesSudo = commandExists("sudo");
  const command = usesSudo ? "sudo" : "bash";
  const args = usesSudo ? ["-E", "bash", "-s", "--"] : ["-s", "--"];

  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    input: scriptText,
    stdio: ["pipe", "inherit", "inherit"],
    env: process.env,
  });

  if (result.error) {
    throw new Error(
      `Failed to execute NodeSource setup script: ${result.error.message}`,
    );
  }

  if (result.status !== 0) {
    throw new Error(
      `NodeSource setup script failed with exit code ${result.status ?? "unknown"}.`,
    );
  }
}

async function setupNodeSourceRepo(nodeMajor: string): Promise<void> {
  const setupUrl = `https://deb.nodesource.com/setup_${nodeMajor}.x`;

  logInfo(`Configuring NodeSource for Node.js ${nodeMajor}.x...`);

  let scriptText = "";
  try {
    const response = await fetch(setupUrl, {
      headers: {
        Accept: "text/plain",
        "User-Agent": GITHUB_USER_AGENT,
      },
    });

    if (!response.ok) {
      fail(
        `Unable to download NodeSource setup script: HTTP ${response.status}`,
      );
    }

    scriptText = await response.text();
  } catch (error) {
    fail(
      `Unable to download NodeSource setup script: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!scriptText.trim()) {
    fail("Downloaded NodeSource setup script is empty.");
  }

  runScriptWithOptionalSudo(scriptText);
}

function installNodejs(nodeMajor: string): void {
  if (!commandExists("apt-get")) {
    fail("APT is required to install Node.js packages.");
  }

  const aptRunner: AptRunner = commandExists("sudo")
    ? (args) => {
        run("sudo", ["apt-get", ...args], { cwd: rootDir });
      }
    : (args) => {
        run("apt-get", args, { cwd: rootDir });
      };

  logInfo("Updating apt package index...");
  aptRunner(["update"]);

  logInfo("Installing nodejs package...");
  aptRunner(["install", "-y", "nodejs"]);

  const fullNodeVersion = runCaptureOutput("node", ["-v"], { cwd: rootDir });
  if (!fullNodeVersion.startsWith(`v${nodeMajor}.`)) {
    fail(
      `Installed Node.js version (${fullNodeVersion}) does not match expected major v${nodeMajor}.`,
    );
  }

  logSuccess(
    `Node.js ${fullNodeVersion} installed/updated for major ${nodeMajor}.`,
  );
}

function verifyInstalledNodeMajor(nodeMajor: string): void {
  const nodeResult = tryRun("node", ["-v"], { cwd: rootDir, stdio: "pipe" });
  if (!nodeResult.ok) {
    fail("Node.js is not installed or not available on PATH.");
  }

  const fullNodeVersion = String(nodeResult.stdout ?? "").trim();
  if (!fullNodeVersion.startsWith(`v${nodeMajor}.`)) {
    fail(
      `Installed Node.js version (${fullNodeVersion}) does not match expected major v${nodeMajor}.`,
    );
  }

  logSuccess(`Installed Node.js version matches major ${nodeMajor}.`);
}

const nodeVersionOptions = defineOptions(
  z
    .object({
      verify: z
        .boolean()
        .default(false)
        .describe("Verify version references and installed Node.js"),
      update: z
        .boolean()
        .default(false)
        .describe("Update version references and install Node.js"),
    })
    .refine((options) => options.verify !== options.update, {
      message: "Specify exactly one of --verify or --update.",
    }),
  { v: "verify", u: "update" },
);

const nodeVersionCommand = defineCommand({
  description: "Verify or update Node.js version references",
  options: nodeVersionOptions,
  action: async (options) => {
    const nodeMajor = readNodeMajorVersion(rootDir);
    if (nodeMajor.length === 0) {
      fail(".node_ver must contain a valid Node.js major version.");
    }

    if (options.verify) {
      verifyNodeVersionReferences(nodeMajor);
      verifyInstalledNodeMajor(nodeMajor);
      return;
    }

    if (!commandExists("apt") && !commandExists("apt-get")) {
      fail("APT is required to install Node.js packages.");
    }

    const availableMajors = await getAvailableNodeMajors();
    if (!availableMajors.includes(nodeMajor)) {
      fail(
        `Node.js major ${nodeMajor} is not listed as available. Available majors: ${availableMajors.join(", ")}`,
      );
    }

    logWarn(
      `You are about to install/update Node.js for major ${nodeMajor}.x. This may break your development environment and NPM users.`,
    );
    await confirmPrompt(
      `Type "i confirm change to ${nodeMajor}" to proceed:`,
      new RegExp(`^i confirm change to ${nodeMajor}$`),
      /^n$/,
    );

    updateNodeVersionReferences(nodeMajor);
    await setupNodeSourceRepo(nodeMajor);
    installNodejs(nodeMajor);
    verifyNodeVersionReferences(nodeMajor);
  },
});

const cliConfig = createCliConfig({
  importMetaUrl: import.meta.url,
  description: "Verify or update Node.js version references",
  commands: {
    run: nodeVersionCommand,
  },
  defaultCommand: nodeVersionCommand,
});

async function main(): Promise<void> {
  await runCli(cliConfig);
}

await runMain(main);
