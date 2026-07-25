#!/usr/bin/env -S node --experimental-strip-types

import {
  fail,
  logInfo,
  logSuccess,
  logError,
  readJsonFile,
  ROOT_DIR,
  REPO_SLUG,
} from "../devopslib.mts";

type ErrorCollector = {
  errors: string[];
  add: (message: string) => void;
};

type JsonRecord = Record<string, unknown>;

const packageJson = readJsonFile(`${ROOT_DIR}/package.json`) as JsonRecord;
const vscodeSettingsJson = readJsonFile(
  `${ROOT_DIR}/.vscode/settings.json`,
) as JsonRecord;
const tsconfigJson = readJsonFile(`${ROOT_DIR}/tsconfig.json`) as JsonRecord;
const typedocJson = readJsonFile(`${ROOT_DIR}/typedoc.json`) as JsonRecord;

function tokenizePath(pathExpression: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  let index = 0;

  while (index < pathExpression.length) {
    const ch = pathExpression[index];

    if (ch === ".") {
      index += 1;
      continue;
    }

    if (ch === "[") {
      const endIndex = pathExpression.indexOf("]", index);
      if (endIndex < 0) {
        throw new Error(`Invalid path expression '${pathExpression}'`);
      }

      const indexText = pathExpression.slice(index + 1, endIndex).trim();
      if (!/^\d+$/.test(indexText)) {
        throw new Error(`Invalid array index in path '${pathExpression}'`);
      }

      tokens.push(Number(indexText));
      index = endIndex + 1;
      continue;
    }

    let endIndex = index;
    while (
      endIndex < pathExpression.length &&
      pathExpression[endIndex] !== "." &&
      pathExpression[endIndex] !== "["
    ) {
      endIndex += 1;
    }

    tokens.push(pathExpression.slice(index, endIndex));
    index = endIndex;
  }

  return tokens;
}

function getByPath(
  root: unknown,
  pathExpression: string,
): { found: boolean; value: unknown } {
  const tokens = tokenizePath(pathExpression);
  let cursor = root;

  for (const token of tokens) {
    if (typeof token === "number") {
      if (!Array.isArray(cursor) || token < 0 || token >= cursor.length) {
        return { found: false, value: undefined };
      }
      cursor = cursor[token];
      continue;
    }

    if (cursor === null || typeof cursor !== "object") {
      return { found: false, value: undefined };
    }

    if (!Object.prototype.hasOwnProperty.call(cursor, token)) {
      return { found: false, value: undefined };
    }

    cursor = (cursor as Record<string, unknown>)[token];
  }

  return { found: true, value: cursor };
}

function createErrorCollector(fileLabel: string): ErrorCollector {
  const errors: string[] = [];
  return {
    errors,
    add(message: string) {
      errors.push(`${fileLabel}: ${message}`);
    },
  };
}

function valueType(value: unknown): string {
  if (Array.isArray(value)) {
    return "array";
  }

  if (value === null) {
    return "null";
  }

  return typeof value;
}

function expectFieldType(
  doc: unknown,
  fieldPath: string,
  expectedType: string,
  addError: (message: string) => void,
) {
  const result = getByPath(doc, fieldPath);
  if (!result.found) {
    addError(`missing required field '${fieldPath}'`);
    return;
  }

  const actualType = valueType(result.value);
  if (actualType !== expectedType) {
    addError(
      `field '${fieldPath}' type '${actualType}' does not match expected '${expectedType}'`,
    );
  }
}

function expectFieldValue(
  doc: unknown,
  fieldPath: string,
  expectedValue: unknown,
  addError: (message: string) => void,
  errorMessage?: string,
) {
  const result = getByPath(doc, fieldPath);
  if (!result.found) {
    addError(`missing required field '${fieldPath}'`);
    return;
  }

  if (result.value !== expectedValue) {
    addError(
      `field '${fieldPath}' value '${result.value}' does not match expected '${expectedValue}'${errorMessage ? `: ${errorMessage}` : ""}`,
    );
  }
}

function validatePackageJson(json: JsonRecord): string[] {
  const { errors, add } = createErrorCollector("package.json");
  logInfo("Validating package.json...");

  expectFieldValue(json, "name", "ts-apt", add);
  expectFieldValue(json, "license", "Apache-2.0", add);
  expectFieldValue(json, "repository.type", "git", add);
  expectFieldValue(
    json,
    "repository.url",
    `https://github.com/${REPO_SLUG}.git`,
    add,
  );

  return errors;
}

function validateTsconfigJson(json: JsonRecord): string[] {
  logInfo("Validating tsconfig.json...");
  const { errors, add } = createErrorCollector("tsconfig.json");

  expectFieldType(json, "extends", "string", add);
  expectFieldType(json, "compilerOptions", "object", add);

  return errors;
}

function validateTypedocJson(json: JsonRecord): string[] {
  logInfo("Validating typedoc.json...");
  const { errors, add } = createErrorCollector("typedoc.json");

  expectFieldType(json, "entryPoints", "array", add);
  expectFieldType(json, "out", "string", add);

  return errors;
}

function validateVscodeSettingsJson(json: JsonRecord): string[] {
  logInfo("Validating .vscode/settings.json...");
  const { errors, add } = createErrorCollector(".vscode/settings.json");

  const autoApprove = json["chat.tools.terminal.autoApprove"];
  if (
    autoApprove === undefined ||
    autoApprove === null ||
    typeof autoApprove !== "object" ||
    Array.isArray(autoApprove)
  ) {
    add("missing required field 'chat.tools.terminal.autoApprove'");
  }

  const useAgentsMdFile = json["chat.useAgentsMdFile"];
  if (useAgentsMdFile !== true) {
    add("missing required field 'chat.useAgentsMdFile'");
  }

  return errors;
}

function main(): void {
  const errors = [
    ...validatePackageJson(packageJson),
    ...validateTsconfigJson(tsconfigJson),
    ...validateTypedocJson(typedocJson),
    ...validateVscodeSettingsJson(vscodeSettingsJson),
  ];

  if (errors.length > 0) {
    logError(`Found ${errors.length} validation issue(s):`);
    for (const errorText of errors) {
      logError(`- ${errorText}`);
    }
    fail("Validation failed.");
  }

  logSuccess("Validation passed.");
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
