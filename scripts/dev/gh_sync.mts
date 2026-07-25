#!/usr/bin/env -S node --experimental-strip-types

/**
 * Sync GitHub repository metadata using GitHub CLI.
 *
 * Supported targets:
 * - `settings`: repository settings
 * - `rulesets`: repository rulesets and desired bypass actors
 * - `vars`: repository Actions variables
 * - `tags`: repository Git tags
 * - `all`: every supported target
 *
 * Examples:
 *   npm run repo:settings:download
 *   npm run repo:rulesets:upload -- --dry-run
 *   node --experimental-strip-types ./scripts/dev/gh_sync.mts download --target vars
 */

import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineCommand, defineOptions } from "@robingenz/zli";
import { z } from "zod";
import {
  REPO_NAME,
  REPO_OWNER,
  commandExists,
  createCliConfig,
  fail,
  logInfo,
  logSuccess,
  logWarn,
  runCli,
  runMain,
} from "../devopslib.mts";

type SyncTarget = "settings" | "rulesets" | "vars" | "tags" | "all";

type RepoSettings = {
  name?: string;
  description?: string | null;
  homepage?: string | null;
  default_branch?: string;
  has_issues?: boolean;
  has_projects?: boolean;
  has_wiki?: boolean;
  is_template?: boolean;
  allow_squash_merge?: boolean;
  allow_merge_commit?: boolean;
  allow_rebase_merge?: boolean;
  allow_auto_merge?: boolean;
  delete_branch_on_merge?: boolean;
  allow_update_branch?: boolean;
  web_commit_signoff_required?: boolean;
  squash_merge_commit_title?: string;
  squash_merge_commit_message?: string;
  merge_commit_title?: string;
  merge_commit_message?: string;
  security_and_analysis?: {
    advanced_security?: { status?: string };
    secret_scanning?: { status?: string };
    secret_scanning_push_protection?: { status?: string };
  };
};

type SettingsFile = {
  owner: string;
  repo: string;
  exportedAt: string;
  settings: RepoSettings;
};

type BypassActor = {
  actor_id: number;
  actor_type:
    | "RepositoryRole"
    | "Team"
    | "Integration"
    | "OrganizationAdmin"
    | "DeployKey";
  bypass_mode: "always" | "pull_request";
};

type Ruleset = {
  id: number;
  name: string;
  target: string;
  enforcement: string;
  conditions?: {
    ref_name?: {
      include?: string[];
      exclude?: string[];
    };
  };
  rules?: Array<Record<string, unknown>>;
  bypass_actors: BypassActor[];
};

type AppBypassConfig = {
  appId: number;
  appLabel?: string;
  bypassMode: "always" | "pull_request";
};

type RulesetsFile = {
  owner: string;
  repo: string;
  exportedAt: string;
  appsBypassActors: AppBypassConfig[];
  rulesets: Ruleset[];
};

type RepoVariable = {
  name: string;
  value: string;
};

type VariablesFile = {
  owner: string;
  repo: string;
  exportedAt: string;
  variables: RepoVariable[];
};

type RepoTag = {
  name: string;
  sha: string;
};

type TagsFile = {
  owner: string;
  repo: string;
  exportedAt: string;
  tags: RepoTag[];
};

const DEFAULT_TARGET_PATHS = {
  settings: ".github/repo-settings.json",
  rulesets: ".github/repo-rulesets.json",
  vars: ".github/repo-vars.json",
  tags: ".github/repo-tags.json",
} as const;

const SETTINGS_KEYS: Array<keyof RepoSettings> = [
  "name",
  "description",
  "homepage",
  "default_branch",
  "has_issues",
  "has_projects",
  "has_wiki",
  "is_template",
  "allow_squash_merge",
  "allow_merge_commit",
  "allow_rebase_merge",
  "allow_auto_merge",
  "delete_branch_on_merge",
  "allow_update_branch",
  "web_commit_signoff_required",
  "squash_merge_commit_title",
  "squash_merge_commit_message",
  "merge_commit_title",
  "merge_commit_message",
  "security_and_analysis",
];

function runGh(args: string[], input?: string): string {
  const result = spawnSync("gh", args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: "pipe",
    input,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || "unknown error";
    fail(`gh ${args.join(" ")} failed: ${stderr}`);
  }

  return result.stdout ?? "";
}

function ensureDirForFile(filePath: string): string {
  const absPath = path.resolve(filePath);
  mkdirSync(path.dirname(absPath), { recursive: true });
  return absPath;
}

function writeJsonFile(
  filePath: string,
  payload: unknown,
  successLabel: string,
): void {
  const absPath = ensureDirForFile(filePath);
  writeFileSync(absPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  logSuccess(`Wrote ${successLabel} to ${absPath}`);
}

function readJsonFile<T>(filePath: string, defaultValue: T): T {
  const absPath = path.resolve(filePath);
  const raw = readFileSync(absPath, "utf8");
  const parsed = JSON.parse(raw) as T | null;

  if (!parsed || typeof parsed !== "object") {
    fail(`Invalid JSON in ${absPath}`);
  }

  return { ...defaultValue, ...parsed };
}

function writeTempPayload(payload: unknown, prefix: string): string {
  const tempDir = mkdtempSync(path.join(tmpdir(), prefix));
  const payloadFile = path.join(tempDir, "payload.json");
  writeFileSync(payloadFile, JSON.stringify(payload), "utf8");
  return payloadFile;
}

function withTempPayload<T>(
  payload: unknown,
  prefix: string,
  fn: (payloadFile: string) => T,
): T {
  const tempDir = mkdtempSync(path.join(tmpdir(), prefix));
  const payloadFile = path.join(tempDir, "payload.json");

  try {
    writeFileSync(payloadFile, JSON.stringify(payload), "utf8");
    return fn(payloadFile);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function pickSettings(repoJson: Record<string, unknown>): RepoSettings {
  const settings: RepoSettings = {};

  for (const key of SETTINGS_KEYS) {
    if (!(key in repoJson)) {
      continue;
    }

    (settings as Record<string, unknown>)[key] = repoJson[key] as unknown;
  }

  return settings;
}

function buildPatchPayload(settings: RepoSettings): RepoSettings {
  const payload: RepoSettings = {};

  for (const key of SETTINGS_KEYS) {
    const value = settings[key];
    if (value === undefined) {
      continue;
    }

    (payload as Record<string, unknown>)[key] = value;
  }

  return payload;
}

function readSettingsFile(filePath: string): SettingsFile {
  return readJsonFile<SettingsFile>(filePath, {
    owner: REPO_OWNER,
    repo: REPO_NAME,
    exportedAt: new Date(0).toISOString(),
    settings: {},
  });
}

function downloadSettings(owner: string, repo: string, filePath: string): void {
  logInfo(`Downloading repository settings for ${owner}/${repo}...`);
  const output = runGh(["api", `repos/${owner}/${repo}`]);
  const repoJson = JSON.parse(output) as Record<string, unknown>;
  const payload: SettingsFile = {
    owner,
    repo,
    exportedAt: new Date().toISOString(),
    settings: pickSettings(repoJson),
  };

  writeJsonFile(filePath, payload, "repository settings");
}

function uploadSettings(
  owner: string,
  repo: string,
  filePath: string,
  dryRun: boolean,
): void {
  const settingsFile = readSettingsFile(filePath);
  const payload = buildPatchPayload(settingsFile.settings);

  if (Object.keys(payload).length === 0) {
    fail("Settings payload is empty. Nothing to upload.");
  }

  logInfo(`Uploading repository settings to ${owner}/${repo}...`);

  if (dryRun) {
    logInfo("Dry-run mode enabled. Payload that would be uploaded:");
    console.log(JSON.stringify(payload, null, 2));
    logSuccess("Dry-run complete. No remote changes were made.");
    return;
  }

  withTempPayload(payload, "ts-apt-repo-settings-", (payloadFile) => {
    runGh([
      "api",
      "-X",
      "PATCH",
      `repos/${owner}/${repo}`,
      "--input",
      payloadFile,
    ]);
  });

  logSuccess(`Uploaded repository settings to ${owner}/${repo}`);
}

function readRulesetsFile(filePath: string): RulesetsFile {
  return readJsonFile<RulesetsFile>(filePath, {
    owner: REPO_OWNER,
    repo: REPO_NAME,
    exportedAt: new Date(0).toISOString(),
    appsBypassActors: [],
    rulesets: [],
  });
}

function fetchRulesets(owner: string, repo: string): Ruleset[] {
  const listRaw = runGh(["api", `/repos/${owner}/${repo}/rulesets`]);
  const list = JSON.parse(listRaw) as Array<{ id: number }>;

  return list.map((entry) => {
    const detailRaw = runGh([
      "api",
      `/repos/${owner}/${repo}/rulesets/${entry.id}`,
    ]);
    return JSON.parse(detailRaw) as Ruleset;
  });
}

function mergeBypassActors(
  ruleset: Ruleset,
  appsBypassActors: AppBypassConfig[],
): BypassActor[] {
  const desiredActors = [...ruleset.bypass_actors];

  for (const cfg of appsBypassActors) {
    const exists = desiredActors.some(
      (actor) =>
        actor.actor_id === cfg.appId && actor.actor_type === "Integration",
    );

    if (exists) {
      continue;
    }

    desiredActors.push({
      actor_id: cfg.appId,
      actor_type: "Integration",
      bypass_mode: cfg.bypassMode,
    });
  }

  return desiredActors;
}

function buildRulesetPutPayload(
  ruleset: Ruleset,
  appsBypassActors: AppBypassConfig[],
): Record<string, unknown> {
  return {
    name: ruleset.name,
    target: ruleset.target,
    enforcement: ruleset.enforcement,
    conditions: ruleset.conditions ?? {
      ref_name: { include: ["~ALL"], exclude: [] },
    },
    rules: ruleset.rules ?? [],
    bypass_actors: mergeBypassActors(ruleset, appsBypassActors),
  };
}

function downloadRulesets(owner: string, repo: string, filePath: string): void {
  logInfo(`Downloading rulesets for ${owner}/${repo}...`);
  const rulesets = fetchRulesets(owner, repo);

  const existing = (() => {
    try {
      return readRulesetsFile(filePath);
    } catch {
      return null;
    }
  })();

  const payload: RulesetsFile = {
    owner,
    repo,
    exportedAt: new Date().toISOString(),
    appsBypassActors: existing?.appsBypassActors ?? [],
    rulesets,
  };

  writeJsonFile(filePath, payload, "rulesets");
  logInfo(`Found ${rulesets.length} ruleset(s).`);
}

function uploadRulesets(
  owner: string,
  repo: string,
  filePath: string,
  dryRun: boolean,
): void {
  const config = readRulesetsFile(filePath);

  if (config.rulesets.length === 0) {
    logWarn("No rulesets configured; nothing to apply.");
    return;
  }

  logInfo(`Fetching current rulesets for ${owner}/${repo}...`);
  const remoteRulesets = fetchRulesets(owner, repo);
  const remoteById = new Map(
    remoteRulesets.map((ruleset) => [ruleset.id, ruleset]),
  );

  if (remoteRulesets.length === 0) {
    logWarn("No rulesets found in the repository.");
    return;
  }

  for (const ruleset of config.rulesets) {
    const remoteRuleset = remoteById.get(ruleset.id);

    if (!remoteRuleset) {
      fail(`Ruleset "${ruleset.name}" (${ruleset.id}) was not found remotely.`);
    }

    const payload = buildRulesetPutPayload(ruleset, config.appsBypassActors);
    logInfo(
      `Ruleset "${ruleset.name}" (${ruleset.id}): syncing full definition...`,
    );

    if (dryRun) {
      logInfo(
        `Dry-run mode: would PUT with ${JSON.stringify(payload, null, 2)}`,
      );
      continue;
    }

    runGh(
      [
        "api",
        "-X",
        "PUT",
        `/repos/${owner}/${repo}/rulesets/${ruleset.id}`,
        "--input",
        "-",
      ],
      JSON.stringify(payload),
    );

    logSuccess(`Ruleset "${ruleset.name}" (${ruleset.id}) synchronized.`);
  }

  logSuccess(
    dryRun
      ? "Dry-run complete. No remote changes were made."
      : "Rulesets applied successfully.",
  );
}

function readVariablesFile(filePath: string): VariablesFile {
  return readJsonFile<VariablesFile>(filePath, {
    owner: REPO_OWNER,
    repo: REPO_NAME,
    exportedAt: new Date(0).toISOString(),
    variables: [],
  });
}

function fetchVariables(owner: string, repo: string): RepoVariable[] {
  const output = runGh(["api", `/repos/${owner}/${repo}/actions/variables`]);
  const parsed = JSON.parse(output) as {
    variables?: Array<{ name: string; value: string }>;
  };
  return (parsed.variables ?? [])
    .map((variable) => ({ name: variable.name, value: variable.value }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function downloadVariables(
  owner: string,
  repo: string,
  filePath: string,
): void {
  logInfo(`Downloading repository variables for ${owner}/${repo}...`);
  const payload: VariablesFile = {
    owner,
    repo,
    exportedAt: new Date().toISOString(),
    variables: fetchVariables(owner, repo),
  };

  writeJsonFile(filePath, payload, "repository variables");
}

function uploadVariables(
  owner: string,
  repo: string,
  filePath: string,
  dryRun: boolean,
): void {
  const config = readVariablesFile(filePath);
  const remoteVariables = fetchVariables(owner, repo);
  const remoteByName = new Map(
    remoteVariables.map((variable) => [variable.name, variable]),
  );

  if (config.variables.length === 0) {
    logWarn("No repository variables configured; nothing to apply.");
    return;
  }

  for (const variable of config.variables) {
    const existing = remoteByName.get(variable.name);

    if (!existing) {
      logInfo(`Repository variable "${variable.name}": creating...`);
      if (!dryRun) {
        runGh(
          [
            "api",
            "-X",
            "POST",
            `/repos/${owner}/${repo}/actions/variables`,
            "--input",
            "-",
          ],
          JSON.stringify(variable),
        );
      }
      continue;
    }

    if (existing.value === variable.value) {
      logInfo(`Repository variable "${variable.name}": already up to date.`);
      continue;
    }

    logInfo(`Repository variable "${variable.name}": updating...`);
    if (!dryRun) {
      runGh(
        [
          "api",
          "-X",
          "PATCH",
          `/repos/${owner}/${repo}/actions/variables/${variable.name}`,
          "--input",
          "-",
        ],
        JSON.stringify({ value: variable.value }),
      );
    }
  }

  logSuccess(
    dryRun
      ? "Dry-run complete. No remote changes were made."
      : "Repository variables applied successfully.",
  );
}

function readTagsFile(filePath: string): TagsFile {
  return readJsonFile<TagsFile>(filePath, {
    owner: REPO_OWNER,
    repo: REPO_NAME,
    exportedAt: new Date(0).toISOString(),
    tags: [],
  });
}

function fetchTags(owner: string, repo: string): RepoTag[] {
  const output = runGh(["api", `/repos/${owner}/${repo}/tags?per_page=100`]);
  const parsed = JSON.parse(output) as Array<{
    name: string;
    commit?: { sha?: string };
  }>;
  return parsed
    .map((tag) => ({ name: tag.name, sha: tag.commit?.sha ?? "" }))
    .filter((tag) => tag.sha.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function downloadTags(owner: string, repo: string, filePath: string): void {
  logInfo(`Downloading repository tags for ${owner}/${repo}...`);
  const payload: TagsFile = {
    owner,
    repo,
    exportedAt: new Date().toISOString(),
    tags: fetchTags(owner, repo),
  };

  writeJsonFile(filePath, payload, "repository tags");
}

function uploadTags(
  owner: string,
  repo: string,
  filePath: string,
  dryRun: boolean,
): void {
  const config = readTagsFile(filePath);
  const remoteTags = fetchTags(owner, repo);
  const remoteByName = new Map(remoteTags.map((tag) => [tag.name, tag]));

  if (config.tags.length === 0) {
    logWarn("No repository tags configured; nothing to apply.");
    return;
  }

  for (const tag of config.tags) {
    const existing = remoteByName.get(tag.name);

    if (!existing) {
      logInfo(`Repository tag "${tag.name}": creating at ${tag.sha}...`);
      if (!dryRun) {
        runGh(
          [
            "api",
            "-X",
            "POST",
            `/repos/${owner}/${repo}/git/refs`,
            "--input",
            "-",
          ],
          JSON.stringify({ ref: `refs/tags/${tag.name}`, sha: tag.sha }),
        );
      }
      continue;
    }

    if (existing.sha === tag.sha) {
      logInfo(`Repository tag "${tag.name}": already up to date.`);
      continue;
    }

    fail(
      `Repository tag "${tag.name}" points to ${existing.sha}, expected ${tag.sha}. ` +
        "Tag sync will not retarget existing tags automatically.",
    );
  }

  logSuccess(
    dryRun
      ? "Dry-run complete. No remote changes were made."
      : "Repository tags applied successfully.",
  );
}

function resolveFilePath(
  target: Exclude<SyncTarget, "all">,
  fileOverride?: string,
): string {
  return fileOverride?.trim() || DEFAULT_TARGET_PATHS[target];
}

function applyTarget(
  action: "download" | "upload",
  target: Exclude<SyncTarget, "all">,
  owner: string,
  repo: string,
  fileOverride: string | undefined,
  dryRun: boolean,
): void {
  const filePath = resolveFilePath(target, fileOverride);

  if (target === "settings") {
    if (action === "download") {
      downloadSettings(owner, repo, filePath);
    } else {
      uploadSettings(owner, repo, filePath, dryRun);
    }
    return;
  }

  if (target === "rulesets") {
    if (action === "download") {
      downloadRulesets(owner, repo, filePath);
    } else {
      uploadRulesets(owner, repo, filePath, dryRun);
    }
    return;
  }

  if (target === "vars") {
    if (action === "download") {
      downloadVariables(owner, repo, filePath);
    } else {
      uploadVariables(owner, repo, filePath, dryRun);
    }
    return;
  }

  if (action === "download") {
    downloadTags(owner, repo, filePath);
  } else {
    uploadTags(owner, repo, filePath, dryRun);
  }
}

function applyTargets(
  action: "download" | "upload",
  target: SyncTarget,
  owner: string,
  repo: string,
  fileOverride: string | undefined,
  dryRun: boolean,
): void {
  if (target === "all") {
    if (fileOverride?.trim()) {
      fail(
        "--file cannot be used with --target all. Use the default target files instead.",
      );
    }

    for (const currentTarget of [
      "settings",
      "rulesets",
      "vars",
      "tags",
    ] as const) {
      applyTarget(action, currentTarget, owner, repo, undefined, dryRun);
    }
    return;
  }

  applyTarget(action, target, owner, repo, fileOverride, dryRun);
}

function ensurePrerequisites(): void {
  if (!commandExists("gh")) {
    fail("GitHub CLI ('gh') is required.");
  }

  const authCheck = spawnSync("gh", ["auth", "status"], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (authCheck.status !== 0) {
    fail("GitHub CLI is not authenticated. Run 'gh auth login' first.");
  }
}

const sharedOptions = defineOptions(
  z.object({
    owner: z.string().default(REPO_OWNER).describe("GitHub repository owner"),
    repo: z.string().default(REPO_NAME).describe("GitHub repository name"),
    target: z
      .enum(["settings", "rulesets", "vars", "tags", "all"])
      .default("all")
      .describe("Metadata target to sync"),
    file: z
      .string()
      .optional()
      .describe("Override the default JSON file path for a single target"),
    dryRun: z
      .boolean()
      .default(false)
      .describe("Print changes without applying them"),
  }),
  { o: "owner", r: "repo", t: "target", f: "file", d: "dryRun" },
);

const downloadCommand = defineCommand({
  description: "Download GitHub repository metadata to tracked JSON files",
  options: sharedOptions,
  action: async (options) => {
    applyTargets(
      "download",
      options.target,
      options.owner,
      options.repo,
      options.file,
      options.dryRun,
    );
  },
});

const uploadCommand = defineCommand({
  description: "Upload GitHub repository metadata from tracked JSON files",
  options: sharedOptions,
  action: async (options) => {
    applyTargets(
      "upload",
      options.target,
      options.owner,
      options.repo,
      options.file,
      options.dryRun,
    );
  },
});

const cliConfig = createCliConfig({
  importMetaUrl: import.meta.url,
  description: "Sync GitHub repository settings, rulesets, variables, and tags",
  commands: {
    download: downloadCommand,
    upload: uploadCommand,
  },
});

async function main(): Promise<void> {
  ensurePrerequisites();
  await runCli(cliConfig);
}

await runMain(main);
