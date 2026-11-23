import * as crypto from "node:crypto";
import { CommandExecutionError, type PackageManager, type PackageName } from "ts-apt";
import type winston from "winston";

/** Prefix of a fingerprint built from the packages apt would unpack. */
const APT_PREFIX = "apt";

/** Prefix of a fingerprint built from the runner image variables. */
const IMAGE_PREFIX = "image";

/** Hex characters kept from the digest; enough to tell image states apart in a readable key. */
const DIGEST_LENGTH = 16;

/**
 * Fingerprints what the runner image already has, for the cache key.
 *
 * A restore only extracts the packages apt unpacked on the image the cache was built on. If a later image
 * drops a dependency that was pre-installed, the archive has no copy of it and the restore leaves the
 * package broken (see issue #187). Folding the set of packages apt would unpack into the key makes that
 * case a cache miss and a fresh install.
 *
 * The fingerprint hashes package names and architectures, not versions, so a routine security update on
 * the image doesn't invalidate every cache.
 *
 * When the simulation fails, it falls back to `ImageOS` and `ImageVersion` (set on GitHub-hosted
 * runners). When those are unset too, the fingerprint is empty and the key doesn't depend on the image.
 *
 * @param simulator Package manager created in simulate mode, so nothing is installed.
 * @param requested Packages the workflow asked for.
 * @param env Environment to read `ImageOS` and `ImageVersion` from.
 * @param logger Logger for the fallback notice.
 * @returns A short, stable fingerprint, or an empty string when none could be derived.
 */
export async function fingerprintImage(
  simulator: PackageManager,
  requested: readonly PackageName[],
  env: NodeJS.ProcessEnv,
  logger: winston.Logger,
): Promise<string> {
  try {
    const wouldUnpack = await simulator.install(requested);
    const names = wouldUnpack.map((info) => `${info.name.name}:${info.name.arch ?? ""}`).sort();
    return `${APT_PREFIX}:${digest(names.join("\n"))}`;
  } catch (error) {
    // Not an install failure the user must see: the real install runs next and reports it.
    if (!(error instanceof CommandExecutionError)) {
      throw error;
    }
    logger.warn(`Could not simulate the install to fingerprint the runner image: ${error.message}`);
  }

  const { ImageOS: imageOs, ImageVersion: imageVersion } = env;
  if (imageOs && imageVersion) {
    return `${IMAGE_PREFIX}:${digest(`${imageOs}\n${imageVersion}`)}`;
  }
  return "";
}

function digest(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, DIGEST_LENGTH);
}
