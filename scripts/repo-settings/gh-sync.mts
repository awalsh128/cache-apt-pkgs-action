#!/usr/bin/env node

/**
 * Syncs GitHub repository metadata with tracked JSON files, using the GitHub CLI (`gh`).
 *
 * Usage: gh-sync.mts <download|upload> [--target settings|rulesets|vars|tags|all] [--file PATH]
 *                    [--owner OWNER] [--repo REPO] [--dry-run]
 *
 * Targets and their default files:
 *   settings  .github/repo-settings.json  repository settings
 *   rulesets  .github/repo-rulesets.json  rulesets plus the apps that should be able to bypass them
 *   vars      .github/repo-vars.json      Actions variables
 *   tags      .github/repo-tags.json      Git tags (created if missing, never retargeted)
 *   all       every target (default; --file is not allowed)
 *
 * `--owner` and `--repo` default to the repository of the current directory (`gh repo view`).
 * `--dry-run` applies to `upload` only; it prints what would change and changes nothing.
 * Needs Node 24 (runs .mts directly) and an authenticated `gh`. Exits 1 on any error.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

type Action = "download" | "upload";
type Target = "settings" | "rulesets" | "vars" | "tags";

interface Context {
  owner: string;
  repo: string;
  file: string;
  dryRun: boolean;
}

interface BypassActor {
  actor_id: number;
  actor_type: "RepositoryRole" | "Team" | "Integration" | "OrganizationAdmin" | "DeployKey";
  bypass_mode: "always" | "pull_request";
}

interface Ruleset {
  id: number;
  name: string;
  target: string;
  enforcement: string;
  conditions?: unknown;
  rules?: Record<string, unknown>[];
  bypass_actors: BypassActor[];
}

interface AppBypass {
  appId: number;
  appLabel?: string;
  bypassMode: "always" | "pull_request";
}

interface Variable {
  name: string;
  value: string;
}

interface Tag {
  name: string;
  sha: string;
}

/** Every tracked file starts with these fields, followed by the target-specific payload. */
interface Envelope {
  owner: string;
  repo: string;
  exportedAt: string;
  [key: string]: unknown;
}

const TARGETS: readonly Target[] = ["settings", "rulesets", "vars", "tags"];

const DEFAULT_FILES: Record<Target, string> = {
  settings: ".github/repo-settings.json",
  rulesets: ".github/repo-rulesets.json",
  vars: ".github/repo-vars.json",
  tags: ".github/repo-tags.json",
};

const SETTINGS_KEYS = [
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
] as const;

class SyncError extends Error {}

function fail(message: string): never {
  throw new SyncError(message);
}

const info = (message: string) => console.log(`INFO  ${message}`);
const warn = (message: string) => console.warn(`WARN  ${message}`);
const success = (message: string) => console.log(`OK    ${message}`);

function gh(args: string[], input?: string): string {
  const result = spawnSync("gh", args, { encoding: "utf8", input });
  if (result.error) {
    fail(`GitHub CLI ('gh') is required: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`gh ${args.join(" ")} failed: ${result.stderr.trim() || "unknown error"}`);
  }
  return result.stdout;
}

function ghJson<T>(args: string[]): T {
  return JSON.parse(gh(args)) as T;
}

function readJson<T extends object>(file: string): T {
  const parsed = JSON.parse(readFileSync(path.resolve(file), "utf8")) as T | null;
  if (!parsed || typeof parsed !== "object") {
    fail(`Invalid JSON in ${path.resolve(file)}`);
  }
  return parsed;
}

function writeJson(file: string, payload: Envelope, label: string): void {
  const absPath = path.resolve(file);
  mkdirSync(path.dirname(absPath), { recursive: true });
  writeFileSync(absPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  success(`Wrote ${label} to ${absPath}`);
}

function envelope(ctx: Context, fields: Record<string, unknown>): Envelope {
  return { owner: ctx.owner, repo: ctx.repo, exportedAt: new Date().toISOString(), ...fields };
}

function finish(ctx: Context, applied: string): void {
  success(ctx.dryRun ? "Dry-run complete. No remote changes were made." : applied);
}

// settings

function pickSettings(source: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(SETTINGS_KEYS.filter((key) => key in source).map((key) => [key, source[key]]));
}

function downloadSettings(ctx: Context): void {
  info(`Downloading repository settings for ${ctx.owner}/${ctx.repo}...`);
  const remote = ghJson<Record<string, unknown>>(["api", `repos/${ctx.owner}/${ctx.repo}`]);
  writeJson(ctx.file, envelope(ctx, { settings: pickSettings(remote) }), "repository settings");
}

function uploadSettings(ctx: Context): void {
  const config = readJson<{ settings?: Record<string, unknown> }>(ctx.file);
  const payload = pickSettings(config.settings ?? {});
  if (Object.keys(payload).length === 0) {
    fail("Settings payload is empty. Nothing to upload.");
  }

  info(`Uploading repository settings to ${ctx.owner}/${ctx.repo}...`);
  if (ctx.dryRun) {
    info("Dry-run mode enabled. Payload that would be uploaded:");
    console.log(JSON.stringify(payload, null, 2));
  } else {
    const dir = mkdtempSync(path.join(tmpdir(), "repo-settings-sync-"));
    try {
      const payloadFile = path.join(dir, "payload.json");
      writeFileSync(payloadFile, JSON.stringify(payload), "utf8");
      gh(["api", "-X", "PATCH", `repos/${ctx.owner}/${ctx.repo}`, "--input", payloadFile]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  finish(ctx, `Uploaded repository settings to ${ctx.owner}/${ctx.repo}`);
}

// rulesets

function fetchRulesets(ctx: Context): Ruleset[] {
  const list = ghJson<{ id: number }[]>(["api", `/repos/${ctx.owner}/${ctx.repo}/rulesets`]);
  return list.map((entry) =>
    ghJson<Ruleset>(["api", `/repos/${ctx.owner}/${ctx.repo}/rulesets/${entry.id}`]),
  );
}

function withAppBypass(ruleset: Ruleset, apps: AppBypass[]): BypassActor[] {
  const actors = [...ruleset.bypass_actors];
  for (const app of apps) {
    if (!actors.some((actor) => actor.actor_id === app.appId && actor.actor_type === "Integration")) {
      actors.push({ actor_id: app.appId, actor_type: "Integration", bypass_mode: app.bypassMode });
    }
  }
  return actors;
}

function downloadRulesets(ctx: Context): void {
  info(`Downloading rulesets for ${ctx.owner}/${ctx.repo}...`);
  const rulesets = fetchRulesets(ctx);

  let appsBypassActors: AppBypass[] = [];
  try {
    appsBypassActors = readJson<{ appsBypassActors?: AppBypass[] }>(ctx.file).appsBypassActors ?? [];
  } catch {
    // No tracked file yet: start with no extra bypass apps.
  }

  writeJson(ctx.file, envelope(ctx, { appsBypassActors, rulesets }), "rulesets");
  info(`Found ${rulesets.length} ruleset(s).`);
}

function uploadRulesets(ctx: Context): void {
  const config = readJson<{ appsBypassActors?: AppBypass[]; rulesets?: Ruleset[] }>(ctx.file);
  const desired = config.rulesets ?? [];
  if (desired.length === 0) {
    warn("No rulesets configured; nothing to apply.");
    return;
  }

  info(`Fetching current rulesets for ${ctx.owner}/${ctx.repo}...`);
  const remoteIds = new Set(fetchRulesets(ctx).map((ruleset) => ruleset.id));
  if (remoteIds.size === 0) {
    warn("No rulesets found in the repository.");
    return;
  }

  for (const ruleset of desired) {
    if (!remoteIds.has(ruleset.id)) {
      fail(`Ruleset "${ruleset.name}" (${ruleset.id}) was not found remotely.`);
    }

    const payload = {
      name: ruleset.name,
      target: ruleset.target,
      enforcement: ruleset.enforcement,
      conditions: ruleset.conditions ?? { ref_name: { include: ["~ALL"], exclude: [] } },
      rules: ruleset.rules ?? [],
      bypass_actors: withAppBypass(ruleset, config.appsBypassActors ?? []),
    };
    info(`Ruleset "${ruleset.name}" (${ruleset.id}): syncing full definition...`);

    if (ctx.dryRun) {
      info(`Dry-run mode: would PUT with ${JSON.stringify(payload, null, 2)}`);
      continue;
    }
    gh(
      ["api", "-X", "PUT", `/repos/${ctx.owner}/${ctx.repo}/rulesets/${ruleset.id}`, "--input", "-"],
      JSON.stringify(payload),
    );
    success(`Ruleset "${ruleset.name}" (${ruleset.id}) synchronized.`);
  }
  finish(ctx, "Rulesets applied successfully.");
}

// variables

function fetchVariables(ctx: Context): Variable[] {
  const { variables = [] } = ghJson<{ variables?: Variable[] }>([
    "api",
    `/repos/${ctx.owner}/${ctx.repo}/actions/variables`,
  ]);
  return variables
    .map(({ name, value }) => ({ name, value }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function downloadVariables(ctx: Context): void {
  info(`Downloading repository variables for ${ctx.owner}/${ctx.repo}...`);
  writeJson(ctx.file, envelope(ctx, { variables: fetchVariables(ctx) }), "repository variables");
}

function uploadVariables(ctx: Context): void {
  const desired = readJson<{ variables?: Variable[] }>(ctx.file).variables ?? [];
  const remote = new Map(fetchVariables(ctx).map((variable) => [variable.name, variable]));
  if (desired.length === 0) {
    warn("No repository variables configured; nothing to apply.");
    return;
  }

  const base = `/repos/${ctx.owner}/${ctx.repo}/actions/variables`;
  for (const variable of desired) {
    const existing = remote.get(variable.name);
    if (!existing) {
      info(`Repository variable "${variable.name}": creating...`);
      if (!ctx.dryRun) {
        gh(["api", "-X", "POST", base, "--input", "-"], JSON.stringify(variable));
      }
    } else if (existing.value === variable.value) {
      info(`Repository variable "${variable.name}": already up to date.`);
    } else {
      info(`Repository variable "${variable.name}": updating...`);
      if (!ctx.dryRun) {
        gh(
          ["api", "-X", "PATCH", `${base}/${variable.name}`, "--input", "-"],
          JSON.stringify({ value: variable.value }),
        );
      }
    }
  }
  finish(ctx, "Repository variables applied successfully.");
}

// tags

function fetchTags(ctx: Context): Tag[] {
  const tags = ghJson<{ name: string; commit?: { sha?: string } }[]>([
    "api",
    `/repos/${ctx.owner}/${ctx.repo}/tags?per_page=100`,
  ]);
  return tags
    .map((tag) => ({ name: tag.name, sha: tag.commit?.sha ?? "" }))
    .filter((tag) => tag.sha.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function downloadTags(ctx: Context): void {
  info(`Downloading repository tags for ${ctx.owner}/${ctx.repo}...`);
  writeJson(ctx.file, envelope(ctx, { tags: fetchTags(ctx) }), "repository tags");
}

function uploadTags(ctx: Context): void {
  const desired = readJson<{ tags?: Tag[] }>(ctx.file).tags ?? [];
  const remote = new Map(fetchTags(ctx).map((tag) => [tag.name, tag]));
  if (desired.length === 0) {
    warn("No repository tags configured; nothing to apply.");
    return;
  }

  for (const tag of desired) {
    const existing = remote.get(tag.name);
    if (!existing) {
      info(`Repository tag "${tag.name}": creating at ${tag.sha}...`);
      if (!ctx.dryRun) {
        gh(
          ["api", "-X", "POST", `/repos/${ctx.owner}/${ctx.repo}/git/refs`, "--input", "-"],
          JSON.stringify({ ref: `refs/tags/${tag.name}`, sha: tag.sha }),
        );
      }
    } else if (existing.sha === tag.sha) {
      info(`Repository tag "${tag.name}": already up to date.`);
    } else {
      fail(
        `Repository tag "${tag.name}" points to ${existing.sha}, expected ${tag.sha}. ` +
          "Tag sync will not retarget existing tags automatically.",
      );
    }
  }
  finish(ctx, "Repository tags applied successfully.");
}

// cli

const HANDLERS: Record<Target, Record<Action, (ctx: Context) => void>> = {
  settings: { download: downloadSettings, upload: uploadSettings },
  rulesets: { download: downloadRulesets, upload: uploadRulesets },
  vars: { download: downloadVariables, upload: uploadVariables },
  tags: { download: downloadTags, upload: uploadTags },
};

function main(): void {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      owner: { type: "string", short: "o" },
      repo: { type: "string", short: "r" },
      target: { type: "string", short: "t", default: "all" },
      file: { type: "string", short: "f" },
      "dry-run": { type: "boolean", short: "d", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  const action = positionals[0];
  if (values.help || positionals.length !== 1 || (action !== "download" && action !== "upload")) {
    console.log(
      "Usage: gh-sync.mts <download|upload> [--target settings|rulesets|vars|tags|all] [--file PATH]\n" +
        "                   [--owner OWNER] [--repo REPO] [--dry-run]",
    );
    process.exitCode = values.help ? 0 : 1;
    return;
  }

  const target = values.target ?? "all";
  if (target !== "all" && !TARGETS.includes(target as Target)) {
    fail(`Unknown --target "${target}". Use settings, rulesets, vars, tags or all.`);
  }
  const file = values.file?.trim();
  if (target === "all" && file) {
    fail("--file cannot be used with --target all. Use the default target files instead.");
  }

  gh(["auth", "status"]);
  let { owner, repo } = values;
  if (!owner || !repo) {
    const current = ghJson<{ owner: { login: string }; name: string }>([
      "repo",
      "view",
      "--json",
      "owner,name",
    ]);
    owner ??= current.owner.login;
    repo ??= current.name;
  }

  for (const current of target === "all" ? TARGETS : [target as Target]) {
    HANDLERS[current][action]({
      owner,
      repo,
      file: file || DEFAULT_FILES[current],
      dryRun: values["dry-run"],
    });
  }
}

try {
  main();
} catch (error) {
  console.error(`ERROR ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
