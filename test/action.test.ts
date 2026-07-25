import { describe, expect, it } from "vitest";
import {
  ActionPackageName,
  normalizeInputPackages,
  parseBoolean,
} from "../src/action.js";

describe("non runner functions", () => {
  const PKG_NAME = "curl";
  const PKG_VER = "1.2.3";
  const PKG_DISTRO = "focal";
  const PKG2_NAME = "git";
  const PKG3_NAME = "jq";

  it("normalizes package list syntax", () => {
    const input = `  ${PKG2_NAME}, ${PKG_NAME} \\\n      ${PKG3_NAME}   `;
    expect(normalizeInputPackages(input)).toEqual([
      PKG_NAME,
      PKG2_NAME,
      PKG3_NAME,
    ]);
  });

  it("parses true/false values", () => {
    expect(parseBoolean("true", "debug")).toBe(true);
    expect(parseBoolean("false", "debug")).toBe(false);
  });

  it("fails for invalid booleans", () => {
    expect(() => parseBoolean("TRUE", "debug")).toThrow();
  });

  it("serializes ActionPackageName with no version", () => {
    expect(new ActionPackageName(PKG_NAME).serialize()).toEqual(PKG_NAME);
  });

  it("serializes ActionPackageName with version", () => {
    expect(new ActionPackageName(PKG_NAME, PKG_VER).serialize()).toEqual(
      `${PKG_NAME}=${PKG_VER}`,
    );
  });

  it("serializes ActionPackageName with version and distro", () => {
    expect(
      new ActionPackageName(PKG_NAME, PKG_VER, PKG_DISTRO).serialize(),
    ).toEqual(`${PKG_NAME}=${PKG_VER}`);
  });
});
