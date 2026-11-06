import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import fs from "node:fs";

// ts-apt runs scripts/dist/apt-fast.sh, which it finds relative to its own
// module (i.e. ../scripts/dist from the bundle). Bundling moves that module
// into dist/action/index.js, so ship the scripts at dist/scripts/dist.
const TS_APT_SCRIPTS_SRC = "node_modules/ts-apt/scripts/dist";
const TS_APT_SCRIPTS_DEST = "dist/scripts/dist";

/** Copies the ts-apt shell scripts next to the bundle after it's written. */
function copyTsAptScripts() {
  return {
    name: "copy-ts-apt-scripts",
    writeBundle() {
      fs.cpSync(TS_APT_SCRIPTS_SRC, TS_APT_SCRIPTS_DEST, { recursive: true });
    },
  };
}

/**
 * Bundles the action and all of its dependencies into dist/action/index.js,
 * the entrypoint action.yml runs. GitHub Actions doesn't install node_modules, so
 * the bundle has to be self-contained.
 *
 * The input is the tsc output from `npm run build:lib`, so TypeScript is only
 * compiled one way.
 *
 * @type {import('rollup').RollupOptions}
 */
export default {
  input: "dist/src/index.js",
  output: {
    file: "dist/action/index.js",
    format: "es",
    sourcemap: true,
    // Some CommonJS dependencies call require() at runtime.
    banner:
      "import { createRequire as __createRequire } from 'node:module';\n" +
      "const require = __createRequire(import.meta.url);",
  },
  plugins: [
    nodeResolve({ preferBuiltins: true, exportConditions: ["node"] }),
    commonjs(),
    json(),
    copyTsAptScripts(),
  ],
  onwarn(warning, warn) {
    // Dependencies trigger these and they are harmless and very noisy:
    // top level `this` in ES modules, misplaced /*@__PURE__*/ comments and
    // circular imports inside third-party packages.
    const fromDependency = (warning.ids ?? [warning.id ?? ""]).every((id) =>
      id.includes("node_modules"),
    );
    if (
      warning.code === "THIS_IS_UNDEFINED" ||
      (fromDependency &&
        ["INVALID_ANNOTATION", "CIRCULAR_DEPENDENCY"].includes(warning.code))
    ) {
      return;
    }
    warn(warning);
  },
};
