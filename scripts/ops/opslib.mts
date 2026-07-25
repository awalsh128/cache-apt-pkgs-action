#!/usr/bin/env -S node --experimental-strip-types

import process from "node:process";
import { runCaptureOutput, tryRun } from "../devopslib.mts";

export type SemVer = {
  major: number;
  minor: number;
  patch: number;
};

export type ActionRepoData = {
  tagToSha: Map<string, string>;
  shaToBestVersion: Map<string, SemVer>;
};

export const SHA_PIN_PATTERN = /^[0-9a-f]{40}$/i;
const SEMVER_TAG_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

const actionRepoCache = new Map<string, ActionRepoData>();

function runGit(args: string[], cwd: string): string {
  return runCaptureOutput("git", args, {
    cwd,
  });
}

function tryGit(
  args: string[],
  cwd: string,
): {
  ok: boolean;
  stdout: string;
  stderr: string;
} {
  const result = tryRun("git", args, {
    cwd,
    stdio: "pipe",
  });

  return {
    ok: result.ok,
    stdout: String(result.stdout ?? "").trim(),
    stderr: String(result.stderr ?? "").trim(),
  };
}

export function parseActionRepoSlug(actionPath: string): string {
  const parts = actionPath.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(
      `Action path '${actionPath}' must include at least owner/repo.`,
    );
  }

  return `${parts[0]}/${parts[1]}`;
}

export function parseSemVer(tag: string): SemVer | null {
  const match = SEMVER_TAG_PATTERN.exec(tag.trim());
  if (!match) {
    return null;
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    return null;
  }

  return { major, minor, patch };
}

export function compareSemVer(left: SemVer, right: SemVer): number {
  if (left.major !== right.major) {
    return left.major - right.major;
  }
  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }
  return left.patch - right.patch;
}

export function formatSemVer(version: SemVer): string {
  return `v${version.major}.${version.minor}.${version.patch}`;
}

export function loadActionRepoData(
  repoSlug: string,
  cwd = process.cwd(),
): ActionRepoData {
  const cached = actionRepoCache.get(repoSlug);
  if (cached) {
    return cached;
  }

  const remoteUrl = `https://github.com/${repoSlug}.git`;
  const output = runGit(["ls-remote", "--tags", remoteUrl], cwd);
  const tagToSha = new Map<string, string>();

  for (const line of output.split("\n")) {
    if (!line.trim()) {
      continue;
    }

    const [sha, ref] = line.split(/\s+/);
    const prefix = "refs/tags/";
    if (!sha || !ref || !ref.startsWith(prefix)) {
      continue;
    }

    const rawTag = ref.slice(prefix.length);
    const isPeeled = rawTag.endsWith("^{}");
    const tag = isPeeled ? rawTag.slice(0, -3) : rawTag;
    if (isPeeled || !tagToSha.has(tag)) {
      tagToSha.set(tag, sha.toLowerCase());
    }
  }

  const shaToBestVersion = new Map<string, SemVer>();
  for (const [tag, sha] of tagToSha.entries()) {
    const version = parseSemVer(tag);
    if (!version) {
      continue;
    }

    const existing = shaToBestVersion.get(sha);
    if (!existing || compareSemVer(version, existing) > 0) {
      shaToBestVersion.set(sha, version);
    }
  }

  const loaded = {
    tagToSha,
    shaToBestVersion,
  };
  actionRepoCache.set(repoSlug, loaded);
  return loaded;
}

export function resolveActionRefSha(
  repoSlug: string,
  ref: string,
  tagToSha: Map<string, string>,
  cwd = process.cwd(),
): string | null {
  const normalizedRef = ref.toLowerCase();
  if (SHA_PIN_PATTERN.test(normalizedRef)) {
    return normalizedRef;
  }

  if (tagToSha.has(ref)) {
    return tagToSha.get(ref) ?? null;
  }

  const remoteUrl = `https://github.com/${repoSlug}.git`;
  const resolved = tryGit(["ls-remote", remoteUrl, ref], cwd);
  if (!resolved.ok || !resolved.stdout) {
    return null;
  }

  const firstLine = resolved.stdout.split("\n")[0] ?? "";
  const [sha] = firstLine.split(/\s+/);
  return sha ? sha.toLowerCase() : null;
}

export async function isAdminActor(
  actor: string,
  repository: string,
  token = process.env.GITHUB_TOKEN ?? "",
): Promise<boolean> {
  if (!actor || !repository || !token) {
    return false;
  }

  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    return false;
  }

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/collaborators/${encodeURIComponent(actor)}/permission`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "ts-apt-opslib",
    },
  });

  if (!response.ok) {
    return false;
  }

  const payload = (await response.json()) as { permission?: string };
  return payload.permission === "admin";
}
