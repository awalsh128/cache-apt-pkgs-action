import { describe, expect, it, vi } from "vitest";
import winston from "winston";
import { CommandExecutionError, createPackageName, type PackageManager } from "ts-apt";
import { fingerprintImage } from "../src/fingerprint.js";

const logger = winston.createLogger({ silent: true });
const REQUESTED = [createPackageName("curl")];
const NO_IMAGE_ENV = {};
const IMAGE_ENV = { ImageOS: "ubuntu24", ImageVersion: "20260201.15.1" };

/** Builds a simulator whose install reports the given package names as the ones apt would unpack. */
function simulatorUnpacking(...names: string[]): PackageManager {
  const installed = names.map((name) => ({ name: createPackageName(name, "1.0", "amd64") }));
  return { install: vi.fn().mockResolvedValue(installed) } as never;
}

function failingSimulator(): PackageManager {
  const failure = new CommandExecutionError({
    command: "apt-get",
    args: [],
    exitCode: 100,
    stderr: "E: boom",
    stdout: "",
  });
  return { install: vi.fn().mockRejectedValue(failure) } as never;
}

describe("fingerprintImage", () => {
  it("fingerprintImage same packages in another order returns the same fingerprint", async () => {
    const first = await fingerprintImage(simulatorUnpacking("a", "b"), REQUESTED, NO_IMAGE_ENV, logger);
    const second = await fingerprintImage(simulatorUnpacking("b", "a"), REQUESTED, NO_IMAGE_ENV, logger);

    expect(first).toBe(second);
  });

  it("fingerprintImage a dependency apt no longer unpacks returns a different fingerprint", async () => {
    const before = await fingerprintImage(simulatorUnpacking("a", "b"), REQUESTED, NO_IMAGE_ENV, logger);
    const after = await fingerprintImage(simulatorUnpacking("a"), REQUESTED, NO_IMAGE_ENV, logger);

    expect(after).not.toBe(before);
  });

  it("fingerprintImage a version change only returns the same fingerprint", async () => {
    const newer = {
      install: vi.fn().mockResolvedValue([{ name: createPackageName("a", "2.0", "amd64") }]),
    } as never;

    const before = await fingerprintImage(simulatorUnpacking("a"), REQUESTED, NO_IMAGE_ENV, logger);
    const after = await fingerprintImage(newer, REQUESTED, NO_IMAGE_ENV, logger);

    expect(after).toBe(before);
  });

  it("fingerprintImage simulation fails and image variables are set returns an image fingerprint", async () => {
    const fingerprint = await fingerprintImage(failingSimulator(), REQUESTED, IMAGE_ENV, logger);

    expect(fingerprint).toMatch(/^image:[0-9a-f]{16}$/);
  });

  it("fingerprintImage simulation fails and image versions differ returns different fingerprints", async () => {
    const older = await fingerprintImage(failingSimulator(), REQUESTED, IMAGE_ENV, logger);
    const newer = await fingerprintImage(
      failingSimulator(),
      REQUESTED,
      { ...IMAGE_ENV, ImageVersion: "20260301.1.0" },
      logger,
    );

    expect(newer).not.toBe(older);
  });

  it("fingerprintImage simulation fails and no image variables are set returns an empty fingerprint", async () => {
    const fingerprint = await fingerprintImage(failingSimulator(), REQUESTED, NO_IMAGE_ENV, logger);

    expect(fingerprint).toBe("");
  });

  it("fingerprintImage failure that is not a command error rethrows it", async () => {
    const simulator = { install: vi.fn().mockRejectedValue(new TypeError("bug")) } as never;

    await expect(fingerprintImage(simulator, REQUESTED, NO_IMAGE_ENV, logger)).rejects.toThrow("bug");
  });
});
