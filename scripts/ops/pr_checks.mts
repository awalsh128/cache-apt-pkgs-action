#!/usr/bin/env -S node --experimental-strip-types

import process from "node:process";
import path from "node:path";
import { defineCommand, defineOptions } from "@robingenz/zli";
import { z } from "zod";
import {
  compareSemVer,
  formatSemVer,
  isAdminActor,
  loadActionRepoData,
  parseActionRepoSlug,
  resolveActionRefSha,
  SHA_PIN_PATTERN,
} from "./opslib.mts";
import {
  createCliConfig,
  fail,
  logError,
  logInfo,
  logWarn,
  logSuccess,
  ROOT_DIR,
  runCli,
  runMain,
  runCaptureOutput,
  tryRun,
} from "../devopslib.mts";

type PrCheckOptions = {
  baseRef: string;
  headRef: string;
  allowAdminBypass: boolean;
};

type ActionUse = {
  actionPath: string;
  ref: string;
  lineNumber: number;
};

type ActionRefChange = {
  filePath: string;
  lineNumber: number;
  actionPath: string;
  previousRef: string | null;
  currentRef: string;
};

function runGitNameOnly(args: string[], cwd: string): string[] {
  const output = runCaptureOutput("git", args, {
    cwd,
  });

  if (!output) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function tryGit(args: string[]): {
  ok: boolean;
  stdout: string;
  stderr: string;
} {
  const result = tryRun("git", args, {
    cwd: ROOT_DIR,
    stdio: "pipe",
  });

  return {
    ok: result.ok,
    stdout: String(result.stdout ?? "").trim(),
    stderr: String(result.stderr ?? "").trim(),
  };
}

function extractActionUses(content: string): ActionUse[] {
  const usesPattern = /^\s*uses:\s*["']?([^"'\s#]+)["']?/;
  const uses: ActionUse[] = [];
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
    if (atIndex <= 0 || atIndex === spec.length - 1) {
      continue;
    }

    const actionPath = spec.slice(0, atIndex);
    const ref = spec.slice(atIndex + 1);
    uses.push({
      actionPath,
      ref,
      lineNumber: index + 1,
    });
  }

  return uses;
}

function groupUsesByActionPath(uses: ActionUse[]): Map<string, ActionUse[]> {
  const grouped = new Map<string, ActionUse[]>();
  for (const use of uses) {
    const list = grouped.get(use.actionPath) ?? [];
    list.push(use);
    grouped.set(use.actionPath, list);
  }

  return grouped;
}

function findActionRefChanges(
  filePath: string,
  previousContent: string,
  currentContent: string,
): ActionRefChange[] {
  const previousByPath = groupUsesByActionPath(
    extractActionUses(previousContent),
  );
  const currentByPath = groupUsesByActionPath(
    extractActionUses(currentContent),
  );
  const actionPaths = new Set<string>([
    ...previousByPath.keys(),
    ...currentByPath.keys(),
  ]);
  const changes: ActionRefChange[] = [];

  for (const actionPath of actionPaths) {
    const previousUses = previousByPath.get(actionPath) ?? [];
    const currentUses = currentByPath.get(actionPath) ?? [];
    const pairedCount = Math.min(previousUses.length, currentUses.length);

    for (let index = 0; index < pairedCount; index += 1) {
      const previousUse = previousUses[index];
      const currentUse = currentUses[index];
      if (!previousUse || !currentUse) {
        continue;
      }
      if (previousUse.ref === currentUse.ref) {
        continue;
      }

      changes.push({
        filePath,
        lineNumber: currentUse.lineNumber,
        actionPath,
        previousRef: previousUse.ref,
        currentRef: currentUse.ref,
      });
    }

    if (currentUses.length > previousUses.length) {
      for (
        let index = previousUses.length;
        index < currentUses.length;
        index += 1
      ) {
        const currentUse = currentUses[index];
        if (!currentUse) {
          continue;
        }

        changes.push({
          filePath,
          lineNumber: currentUse.lineNumber,
          actionPath,
          previousRef: null,
          currentRef: currentUse.ref,
        });
      }
    }
  }

  return changes;
}

function getChangedWorkflowYamlFiles(diffRange: string): string[] {
  const files = runGitNameOnly(
    [
      "diff",
      "--name-only",
      "--diff-filter=ACMR",
      diffRange,
      "--",
      ".github/workflows",
      ".github/actions",
    ],
    ROOT_DIR,
  );

  return files.filter((filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    return ext === ".yml" || ext === ".yaml";
  });
}

function getFileContentAtRef(ref: string, filePath: string): string | null {
  const result = tryGit(["show", `${ref}:${filePath}`]);
  if (!result.ok) {
    return null;
  }

  return result.stdout;
}

function validateModifiedActionRefs(
  baseRef: string,
  headRef: string,
): string[] {
  const errors: string[] = [];
  const warnings: string[] = [];

  const fetched = tryGit([
    "fetch",
    "--no-tags",
    "--depth=200",
    "origin",
    baseRef,
    headRef,
  ]);
  if (!fetched.ok) {
    errors.push(
      `Unable to fetch refs for action pin checks (${baseRef}, ${headRef}): ${fetched.stderr || "unknown error"}`,
    );
    return errors;
  }

  const baseRemoteRef = `origin/${baseRef}`;
  const headRemoteRef = `origin/${headRef}`;
  const diffRange = `${baseRemoteRef}...${headRemoteRef}`;
  const changedFiles = getChangedWorkflowYamlFiles(diffRange);
  if (changedFiles.length === 0) {
    return errors;
  }

  const actionRefChanges: ActionRefChange[] = [];
  for (const filePath of changedFiles) {
    const previousContent = getFileContentAtRef(baseRemoteRef, filePath) ?? "";
    const currentContent = getFileContentAtRef(headRemoteRef, filePath);
    if (currentContent === null) {
      continue;
    }

    actionRefChanges.push(
      ...findActionRefChanges(filePath, previousContent, currentContent),
    );
  }

  if (actionRefChanges.length === 0) {
    return errors;
  }

  logInfo(
    `Validating ${actionRefChanges.length} modified GitHub Action reference(s) in PR changes.`,
  );

  for (const change of actionRefChanges) {
    if (!SHA_PIN_PATTERN.test(change.currentRef)) {
      errors.push(
        `${change.filePath}:${change.lineNumber} '${change.actionPath}@${change.currentRef}' must use a full 40-character commit SHA pin.`,
      );
      continue;
    }

    if (!change.previousRef) {
      continue;
    }

    try {
      const repoSlug = parseActionRepoSlug(change.actionPath);
      const { tagToSha, shaToBestVersion } = loadActionRepoData(
        repoSlug,
        ROOT_DIR,
      );
      const previousSha = resolveActionRefSha(
        repoSlug,
        change.previousRef,
        tagToSha,
        ROOT_DIR,
      );
      const currentSha = resolveActionRefSha(
        repoSlug,
        change.currentRef,
        tagToSha,
        ROOT_DIR,
      );

      if (!previousSha || !currentSha) {
        warnings.push(
          `${change.filePath}:${change.lineNumber} could not resolve refs for '${change.actionPath}' to compare version progression.`,
        );
        continue;
      }

      const previousVersion = shaToBestVersion.get(previousSha);
      const currentVersion = shaToBestVersion.get(currentSha);
      if (!previousVersion || !currentVersion) {
        warnings.push(
          `${change.filePath}:${change.lineNumber} no semver release tags found for '${change.actionPath}' refs; skipping downgrade check.`,
        );
        continue;
      }

      if (compareSemVer(currentVersion, previousVersion) < 0) {
        errors.push(
          `${change.filePath}:${change.lineNumber} '${change.actionPath}' was downgraded from ${formatSemVer(previousVersion)} to ${formatSemVer(currentVersion)}.`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(
        `${change.filePath}:${change.lineNumber} failed to validate '${change.actionPath}': ${message}`,
      );
    }
  }

  for (const warning of warnings) {
    logWarn(warning);
  }

  return errors;
}

const PROHIBITED_PATHS = [
  "docs/api",
  "docs/api-md",
];

function getProhibitedPathsChanges(): string[] {
  const prohibitedPaths = PROHIBITED_PATHS;
  const staged = runGitNameOnly(
    ["diff", "--name-only", "--cached", "--", ...prohibitedPaths],
    ROOT_DIR,
  );
  const unstaged = runGitNameOnly(
    ["diff", "--name-only", "--", ...prohibitedPaths],
    ROOT_DIR,
  );
  const untracked = runGitNameOnly(
    ["ls-files", "--others", "--exclude-standard", "--", ...prohibitedPaths],
    ROOT_DIR,
  );

  return [...new Set([...staged, ...unstaged, ...untracked])].sort(
    (left, right) => left.localeCompare(right),
  );
}

function getNormalizedRef(ref: string): string {
  return ref.trim();
}

function resolveRefs(options: PrCheckOptions): {
  baseRef: string;
  headRef: string;
} {
  const baseRef = getNormalizedRef(
    options.baseRef || process.env.GITHUB_BASE_REF || "",
  );
  const headRef = getNormalizedRef(
    options.headRef || process.env.GITHUB_HEAD_REF || "",
  );

  if (
    (baseRef.length > 0 && headRef.length === 0) ||
    (headRef.length > 0 && baseRef.length === 0)
  ) {
    fail(
      "Both base and head refs must be provided together (flags or environment).",
      1,
    );
  }

  return { baseRef, headRef };
}

async function runChecks(options: PrCheckOptions): Promise<string[]> {
  const { baseRef, headRef } = resolveRefs(options);
  const errors: string[] = [];

  const changedPaths = getProhibitedPathsChanges();

  if (baseRef.length > 0 && headRef.length > 0) {
    if (baseRef === "main" && headRef !== "staging") {
      errors.push(
        `Merge to 'main' is only allowed from 'staging'. Current source: '${headRef}'.`,
      );
      errors.push("To fix this, rebase your feature branch onto 'staging'.");
    }

    errors.push(...validateModifiedActionRefs(baseRef, headRef));
  } else {
    logInfo("Base/head refs were not provided; skipping branch policy check.");
  }

  if (changedPaths.length > 0) {
    errors.push(
      `Detected prohibited path changes in:\n${changedPaths.join(", ")}\n` +
        `Please remove changes to these paths before proceeding.\n` +
        `These paths are restricted and should not be modified in pull requests.\n` +
        `Prohibited paths include:\n  -${PROHIBITED_PATHS.join("\n  -")}.`,
    );
  }

  return errors;
}

async function shouldAllowAdminBypass(
  options: PrCheckOptions,
): Promise<boolean> {
  if (!options.allowAdminBypass) {
    return false;
  }

  return isAdminActor(
    process.env.GITHUB_ACTOR ?? "",
    process.env.GITHUB_REPOSITORY ?? "",
  );
}

const prChecksCommand = defineCommand({
  description: "Run pull request checks",
  options: defineOptions(
    z.object({
      baseRef: z
        .string()
        .default("")
        .describe("Pull request base branch ref (for example: staging)"),
      headRef: z
        .string()
        .default("")
        .describe(
          "Pull request head branch ref (for example: feature/my-feature)",
        ),
      allowAdminBypass: z
        .boolean()
        .default(false)
        .describe("Allow bypass when the GitHub actor has admin permission"),
    }),
    {
      b: "baseRef",
      h: "headRef",
      a: "allowAdminBypass",
    },
  ),
  action: async (options: PrCheckOptions) => {
    const errors = await runChecks(options);
    const allowAdminBypass = await shouldAllowAdminBypass(options);

    if (errors.length == 0) {
      logSuccess("Pull request checks passed.");
      return;
    }

    for (const error of errors) {
      logError(error);
    }
    if (allowAdminBypass) {
      logWarn(
        "Admin bypass is allowed for this pull request actor. Treating as warning only.",
      );
    } else {
      fail("Pull request checks failed.");
    }
  },
});

const cliConfig = createCliConfig({
  importMetaUrl: import.meta.url,
  description: "Run pull request checks",
  commands: {
    run: prChecksCommand,
  },
  defaultCommand: prChecksCommand,
});

await runMain(async () => {
  await runCli(cliConfig);
});
