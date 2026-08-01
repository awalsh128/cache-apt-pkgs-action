import { Artifacts, Instruments } from "../src/instrumentation.ts";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("instrumentation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

      const artifacts = new Artifacts(dir, ARTIFACT_FILENAMES, debug);
      expect(artifacts.runId).toMatch(/^ghrunid-notfound-/);
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
