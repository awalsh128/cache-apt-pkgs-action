import type { ActionInputs, ActionOutputs } from "../src/action.js";

/** Inputs stored in a test manifest; restore never reads them, so the values don't matter. */
export const MANIFEST_INPUTS: ActionInputs = {
  packages: "curl",
  version: "test",
  executeInstallScripts: false,
  emptyPackagesBehavior: "error",
  debug: false,
};

/** Outputs stored in a test manifest; restore never reads them, so the values don't matter. */
export const MANIFEST_OUTPUTS: ActionOutputs = {
  cacheHit: false,
  packageVersionList: "curl=8.5.0",
  allPackageVersionList: "curl=8.5.0",
};
