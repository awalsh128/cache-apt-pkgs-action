#!/usr/bin/env -S node --experimental-strip-types

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { defineCommand, defineOptions } from "@robingenz/zli";
import { z } from "zod";
import {
  loadActionRepoData,
  parseActionRepoSlug,
  resolveActionRefSha,
} from "./opslib.mts";
import {
  COLORS,
  createCliConfig,
  fail,
  GITHUB_API_BASE_URL,
  GITHUB_USER_AGENT,
  log,
  logError,
  logInfo,
  logSuccess,
  logWarn,
  runCli,
  runMain,
  runCaptureOutput,
} from "../devopslib.mts";

type ActionPin = {
  filePath: string;
  lineNumber: number;
  actionPath: string;
  currentRef: string;
};

type GitHubRelease = {
  tag_name: string;
  html_url?: string;
};

type RepoData = {
  tagMap: Map<string, string>;
  latestRelease: GitHubRelease | null;
  releases: GitHubRelease[];
};

type ActionAnalysis = {
  actionPath: string;
  repoSlug: string;
  currentRef: string;
  currentSha: string;
  currentRelease: GitHubRelease | null;
  latestRelease: GitHubRelease | null;
  latestSha: string | null;
  notPinned: boolean;
  isCurrent: boolean;
};

async function fetchJson(url: string): Promise<unknown | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": GITHUB_USER_AGENT,
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, { headers });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API request failed (${response.status}): ${body}`);
  }

  return response.json();
}

async function getLatestRelease(
  repoSlug: string,
): Promise<GitHubRelease | null> {
  const release = await fetchJson(
    `${GITHUB_API_BASE_URL}/repos/${repoSlug}/releases/latest`,
  );
  return release && typeof release === "object"
    ? (release as GitHubRelease)
    : null;
}

async function getReleases(repoSlug: string): Promise<GitHubRelease[]> {
  const releases = await fetchJson(
    `${GITHUB_API_BASE_URL}/repos/${repoSlug}/releases?per_page=100`,
  );
  return Array.isArray(releases) ? releases : [];
}

function findReleaseBySha(
  releases: GitHubRelease[],
  tagMap: Map<string, string>,
  sha: string,
): GitHubRelease | null {
  return (
    releases.find(
      (release) => tagMap.get(release.tag_name)?.toLowerCase() === sha,
    ) ?? null
  );
}

function walkFiles(rootDir: string): string[] {
  const results: string[] = [];

  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
      continue;
    }

    if (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")) {
      results.push(fullPath);
    }
  }

  return results.sort((a, b) => a.localeCompare(b));
}

function findActionPins(rootDir: string): ActionPin[] {
  const results: ActionPin[] = [];
  const usesPattern = /^\s*uses:\s*["']?([^"'\s#]+)["']?/;

  for (const filePath of walkFiles(rootDir)) {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      const match = usesPattern.exec(line);
      if (!match) {
        continue;
      }

      const spec = match[1] ?? "";
      if (
        !spec.includes("@") ||
        spec.startsWith("./") ||
        spec.startsWith("docker://")
      ) {
        continue;
      }

      const atIndex = spec.lastIndexOf("@");
      const actionPath = spec.slice(0, atIndex);
      const currentRef = spec.slice(atIndex + 1);
      if (!actionPath || !currentRef) {
        continue;
      }

      results.push({
        filePath,
        lineNumber: index + 1,
        actionPath,
        currentRef,
      });
    }
  }

  return results;
}

const repoCache = new Map<string, Promise<RepoData>>();

async function getRepoData(repoSlug: string): Promise<RepoData> {
  const cached = repoCache.get(repoSlug);
  if (cached) {
    return cached;
  }

  const promise = (async (): Promise<RepoData> => {
    const { tagToSha: tagMap } = loadActionRepoData(repoSlug, process.cwd());
    const [latestRelease, releases] = await Promise.all([
      getLatestRelease(repoSlug),
      getReleases(repoSlug),
    ]);
    return { tagMap, latestRelease, releases };
  })();

  repoCache.set(repoSlug, promise);
  return promise;
}

async function analyzeAction(
  actionPath: string,
  currentRef: string,
): Promise<ActionAnalysis> {
  const repoSlug = parseActionRepoSlug(actionPath);
  const { tagMap, latestRelease, releases } = await getRepoData(repoSlug);
  const currentSha = resolveActionRefSha(
    repoSlug,
    currentRef,
    tagMap,
    process.cwd(),
  );
  if (!currentSha) {
    throw new Error(`Unable to resolve ref '${currentRef}' for ${repoSlug}.`);
  }
  const currentRelease = findReleaseBySha(releases, tagMap, currentSha);
  const latestSha = latestRelease
    ? (tagMap.get(latestRelease.tag_name) ?? null)
    : null;
  const isCurrent = latestSha !== null && latestSha === currentSha;

  return {
    actionPath,
    repoSlug,
    currentRef,
    currentSha,
    currentRelease,
    latestRelease,
    latestSha,
    notPinned: latestSha === null,
    isCurrent,
  };
}

function printAnalysis(analysis: ActionAnalysis): number {
  const logFieldValue = (field: string, value: string) => {
    log(`${COLORS.cyan}${field}:${COLORS.reset} ${value}`, {
      indent: 3,
    });
  };
  logFieldValue("Action", analysis.actionPath);
  logFieldValue("Repository", analysis.repoSlug);
  logFieldValue("Current ref", analysis.currentRef);
  logFieldValue("Current sha", analysis.currentSha);
  logFieldValue("Current release", analysis.currentRelease?.tag_name ?? "none");
  logFieldValue(
    "Current release URL",
    analysis.currentRelease?.html_url ?? "none",
  );
  logFieldValue("Latest release", analysis.latestRelease?.tag_name ?? "none");
  logFieldValue(
    "Latest pin",
    analysis.latestSha
      ? `${analysis.actionPath}@${analysis.latestSha}`
      : "none",
  );
  logFieldValue(
    "Latest release URL",
    analysis.latestRelease?.html_url ?? "none",
  );
  if (analysis.latestSha === null) {
    logError(`Status: no release found`);
    return 1;
  }
  if (analysis.isCurrent) {
    logSuccess(`Status: up to date`);
  } else {
    logWarn(`Status: update available`);
  }
  return 0;
}

const checkLatestActionPinCommand = defineCommand({
  description: "Check whether a GitHub Actions reference is up to date",
  options: defineOptions(
    z.object({
      scan: z
        .boolean()
        .default(false)
        .describe("Scan a directory for pinned GitHub Actions references"),
    }),
    { s: "scan" },
  ),
  args: z.array(z.string()).max(2),
  action: async (options: { scan: boolean }, args: string[]) => {
    if (options.scan) {
      if (args.length > 1) {
        fail("--scan accepts at most one directory argument.");
      }

      const rootDir = path.resolve(process.cwd(), args[0] ?? ".github");
      const pins = findActionPins(rootDir);
      if (pins.length === 0) {
        logInfo(`No pinned GitHub Actions found under ${rootDir}.`);
        return;
      }

      let updateCount = 0;
      for (const pin of pins) {
        const analysis = await analyzeAction(pin.actionPath, pin.currentRef);
        logInfo(`File: ${pin.filePath}:${pin.lineNumber}`, {
          color: COLORS.yellow,
        });
        printAnalysis(analysis);
        console.log("");
        if (analysis.latestSha && !analysis.isCurrent) {
          updateCount += 1;
        }
      }

      logSuccess(`Scanned ${pins.length} pinned action reference(s).`);
      logWarn(`Updates available: ${updateCount}`);
      return;
    }

    let actionPath = "";
    let currentRef = "";

    if (args.length === 1) {
      const singleArg = args[0] ?? "";
      const atIndex = singleArg.lastIndexOf("@");
      if (atIndex <= 0 || atIndex === singleArg.length - 1) {
        fail(
          "Action reference must be provided as <owner/repo[/path]@ref> or <owner/repo[/path] ref>.",
        );
      }

      actionPath = singleArg.slice(0, atIndex);
      currentRef = singleArg.slice(atIndex + 1);
    } else if (args.length === 2) {
      actionPath = args[0] ?? "";
      currentRef = args[1] ?? "";
      if (actionPath.length === 0 || currentRef.length === 0) {
        fail(
          "Action reference must be provided as <owner/repo[/path]@ref> or <owner/repo[/path] ref>.",
        );
      }
    } else {
      fail(
        "Action reference must be provided as <owner/repo[/path]@ref> or <owner/repo[/path] ref>.",
      );
    }

    const analysis = await analyzeAction(actionPath, currentRef);
    printAnalysis(analysis);

    if (analysis.latestSha && !analysis.isCurrent) {
      process.exitCode = 2;
    }
  },
});

const cliConfig = createCliConfig({
  importMetaUrl: import.meta.url,
  description: "Check whether a GitHub Actions reference is up to date",
  commands: {
    run: checkLatestActionPinCommand,
  },
  defaultCommand: checkLatestActionPinCommand,
});

async function main(): Promise<void> {
  await runCli(cliConfig);
}

await runMain(main, 1);
