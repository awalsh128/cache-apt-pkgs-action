import * as crypto from "node:crypto";
import { CommandExecutionError, type PackageManager, type PackageName } from "ts-apt";
import type winston from "winston";

/** Where an {@link ImageState} digest came from. */
export type ImageStateSource = "install-plan" | "runner-image";

/**
 * Digest of the part of the runner image that decides what a restore can rely on, kept in the cache key.
 *
 * `install-plan` hashes the packages apt would unpack for the request, i.e. what the image lacks.
 * `runner-image` hashes `ImageOS` and `ImageVersion`, used when the plan can't be simulated.
 */
export interface ImageState {
  readonly source: ImageStateSource;
  readonly digest: string;
}

/** Hex characters kept from the digest; enough to tell image states apart in a readable key. */
const DIGEST_LENGTH = 16;

/**
 * Digests what the runner image already has, for the cache key.
 *
 * A restore only extracts the packages apt unpacked on the image the cache was built on. If a later image
 * drops a dependency that was pre-installed, the archive has no copy of it and the restore leaves the
 * package broken (see issue #187). Folding the set of packages apt would unpack (the install plan) into the key makes that
 * case a cache miss and a fresh install.
 *
 * The digest hashes package names and architectures, not versions, so a routine security update on
 * the image doesn't invalidate every cache.
 *
 * When the simulation fails, it falls back to `ImageOS` and `ImageVersion` (set on GitHub-hosted
 * runners). When those are unset too, there is no image state and the key doesn't depend on the image.
 *
 * @param simulator Package manager created in simulate mode, so nothing is installed.
 * @param requested Packages the workflow asked for.
 * @param env Environment to read `ImageOS` and `ImageVersion` from.
 * @param logger Logger for the fallback notice.
 * @returns The image state, or `undefined` when none could be derived.
 */
export async function digestImageState(
  simulator: PackageManager,
  requested: readonly PackageName[],
  env: NodeJS.ProcessEnv,
  logger: winston.Logger,
): Promise<ImageState | undefined> {
  try {
    const wouldUnpack = await simulator.install(requested);
    const names = wouldUnpack.map((info) => `${info.name.name}:${info.name.arch ?? ""}`).sort();
    return { source: "install-plan", digest: digest(names.join("\n")) };
  } catch (error) {
    // Not an install failure the user must see: the real install runs next and reports it.
    if (!(error instanceof CommandExecutionError)) {
      throw error;
    }
    logger.warn(`Could not simulate the install to digest the runner image state: ${error.message}`);
  }

  const { ImageOS: imageOs, ImageVersion: imageVersion } = env;
  if (imageOs && imageVersion) {
    return { source: "runner-image", digest: digest(`${imageOs}\n${imageVersion}`) };
  }
  return undefined;
}

function digest(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, DIGEST_LENGTH);
}
