import { describe, expect, it, vi } from "vitest";
import winston from "winston";
import { CommandExecutionError, createPackageName, type PackageManager } from "ts-apt";
import { digestImageState } from "../src/imageState.js";

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

describe("digestImageState", () => {
  it("digestImageState same packages in another order returns the same state", async () => {
    const first = await digestImageState(simulatorUnpacking("a", "b"), REQUESTED, NO_IMAGE_ENV, logger);
    const second = await digestImageState(simulatorUnpacking("b", "a"), REQUESTED, NO_IMAGE_ENV, logger);

    expect(first).toEqual(second);
  });

  it("digestImageState a dependency apt no longer unpacks returns a different state", async () => {
    const before = await digestImageState(simulatorUnpacking("a", "b"), REQUESTED, NO_IMAGE_ENV, logger);
    const after = await digestImageState(simulatorUnpacking("a"), REQUESTED, NO_IMAGE_ENV, logger);

    expect(after).not.toBe(before);
  });

  it("digestImageState a version change only returns the same state", async () => {
    const newer = {
      install: vi.fn().mockResolvedValue([{ name: createPackageName("a", "2.0", "amd64") }]),
    } as never;

    const before = await digestImageState(simulatorUnpacking("a"), REQUESTED, NO_IMAGE_ENV, logger);
    const after = await digestImageState(newer, REQUESTED, NO_IMAGE_ENV, logger);

    expect(after).toEqual(before);
  });

  it("digestImageState simulation fails and image variables are set returns a runner-image state", async () => {
    const state = await digestImageState(failingSimulator(), REQUESTED, IMAGE_ENV, logger);

    expect(state).toEqual({ source: "runner-image", digest: expect.stringMatching(/^[0-9a-f]{16}$/) });
  });

  it("digestImageState simulation fails and image versions differ returns different states", async () => {
    const older = await digestImageState(failingSimulator(), REQUESTED, IMAGE_ENV, logger);
    const newer = await digestImageState(
      failingSimulator(),
      REQUESTED,
      { ...IMAGE_ENV, ImageVersion: "20260301.1.0" },
      logger,
    );

    expect(newer).not.toBe(older);
  });

  it("digestImageState simulation fails and no image variables are set returns no state", async () => {
    const state = await digestImageState(failingSimulator(), REQUESTED, NO_IMAGE_ENV, logger);

    expect(state).toBeUndefined();
  });

  it("digestImageState failure that is not a command error rethrows it", async () => {
    const simulator = { install: vi.fn().mockRejectedValue(new TypeError("bug")) } as never;

    await expect(digestImageState(simulator, REQUESTED, NO_IMAGE_ENV, logger)).rejects.toThrow("bug");
  });
});
