import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Artifacts, Instruments } from "../src/instrumentation.ts";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("instrumentation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  const ARTIFACT_FILENAMES = [
    "capa_app.log",
    "capa_exec.log",
    "cache_key.json",
    "manifest_main.json",
    "manifest_all.json",
  ];

  describe("Artifacts", () => {
    it("constructor initializes properties correctly", () => {
      const dir = "/path/to/artifacts";
      const debug = true;
      const runId = "test-run-id";

      const artifacts = new Artifacts(dir, ARTIFACT_FILENAMES, debug, runId);
      expect(artifacts).toEqual({
        dir: dir,
        artifactFilenames: ARTIFACT_FILENAMES,
        debug: debug,
        runId: runId,
      });
    });

    it("constructor generates a random runId when not provided", () => {
      const dir = "/path/to/artifacts";
      const debug = false;
      // GitHub Actions sets this, so clear it to test the fallback.
      vi.stubEnv("GITHUB_RUN_ID", undefined);

      const artifacts = new Artifacts(dir, ARTIFACT_FILENAMES, debug);
      expect(artifacts.runId).toMatch(/^ghrunid-notfound-/);
    });
  });

  describe("Instruments", () => {
    const CACHE_DIRNAME = "cache-apt-pkgs";

    it("constructor cache dir missing creates it under home with the logs", async () => {
      const home = fs.mkdtempSync(path.join(os.tmpdir(), "instruments-test-"));
      vi.stubEnv("HOME", home);
      const expectedDir = path.join(home, CACHE_DIRNAME);

      const instruments = new Instruments(CACHE_DIRNAME, false);
      instruments.appLogger.info("app message");
      await new Promise((resolve) => instruments.appLogger.end(resolve));

      expect(instruments.cacheDirPath).toBe(expectedDir);
      expect(instruments.artifacts.dir).toBe(expectedDir);
      await vi.waitFor(() =>
        expect(
          fs.readFileSync(path.join(expectedDir, "capa_app.log"), "utf8"),
        ).toContain("app message"),
      );
      fs.rmSync(home, { recursive: true, force: true });
    });
  });

  // describe("Instruments", () => {
  //   it("constructor initializes properties correctly", () => {
  //     const cacheDir = "/path/to/cache";
  //     const debug = true;
  //     const artifacts = new Artifacts(
  //       "/path/to/cache",
  //       ARTIFACT_FILENAMES,
  //       debug,
  //     );

  //     const instruments = new Instruments(cacheDir, debug, artifacts);
  //     expect(instruments).toEqual({
  //       cacheDir: cacheDir,
  //       debug: debug,
  //       artifacts: artifacts,
  //       appLogger: expect.toBeTypeOf("object"),
  //       execLogger: expect.toBeTypeOf("object"),
  //     });
  //   });

  //   it("constructor initializes artifacts when not provided", () => {
  //     const cacheDir = "/path/to/cache";
  //     const debug = false;

  //     const instruments = new Instruments(cacheDir, debug);
  //     expect(instruments).toEqual({
  //       cacheDir: cacheDir,
  //       debug: debug,
  //       artifacts: expect.toBeTypeOf("object"),
  //       appLogger: expect.toBeTypeOf("object"),
  //       execLogger: expect.toBeTypeOf("object"),
  //     });
  //   });
  // });
});
