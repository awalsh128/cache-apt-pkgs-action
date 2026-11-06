import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";

/**
 * Bundles the action and all of its dependencies into dist/index.js, the
 * entrypoint action.yml runs. GitHub Actions doesn't install node_modules, so
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
    file: "dist/index.js",
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
