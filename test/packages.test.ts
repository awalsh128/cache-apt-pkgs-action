import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPackageName } from "ts-apt";
import {
  ActionPackageNames,
  updateAptLists,
  buildFileList,
  findInstallScript,
} from "../src/packages.js";
import { describe, expect, it, vi } from "vitest";

const PACKAGE_NAME = createPackageName("test-package", "1.0.0", "amd64");

function makeTempRoot(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function ensureScriptsDir(root: string): string {
  const scriptsDir = path.join(root, "var", "lib", "dpkg", "info");
  fs.mkdirSync(scriptsDir, { recursive: true });
  return scriptsDir;
}

describe("packages", () => {
  it("buildFileList returns an array of package files", async () => {
    const root = makeTempRoot("pkg-files-");
    const scriptsDir = ensureScriptsDir(root);
    const packageFiles = [
      path.join(scriptsDir, "test-package.list"),
      path.join(scriptsDir, "test-package.md5sums"),
      path.join(scriptsDir, "test-package.postinst"),
      path.join(scriptsDir, "test-package.preinst"),
    ];
    for (const filePath of packageFiles) {
      fs.writeFileSync(filePath, "", "utf8");
    }

    const manager = {
      listInstalledFiles: vi.fn().mockResolvedValue(packageFiles),
    };
    const result = await buildFileList(PACKAGE_NAME, manager as any, root);

    expect(result).toEqual(packageFiles.map((item) => item.slice(1)).sort());
  });

  it("buildFileList returns an empty array when no files are found", async () => {
    const root = makeTempRoot("pkg-empty-");

    const manager = {
      listInstalledFiles: vi.fn().mockResolvedValue([]),
    };

    const result = await buildFileList(PACKAGE_NAME, manager as any, root);
    expect(result).toEqual([]);
  });

  it("findInstallScript returns undefined when scripts directory does not exist", async () => {
    const missingRoot = makeTempRoot("pkg-missing-");

    const result = await findInstallScript(
      PACKAGE_NAME,
      "preinst",
      missingRoot,
    );
    expect(result).toBeUndefined();
  });

  it("findInstallScript returns undefined when no matching scripts are found", async () => {
    const root = makeTempRoot("pkg-no-match-");
    const scriptsDir = ensureScriptsDir(root);
    fs.writeFileSync(
      path.join(scriptsDir, "other-package.preinst"),
      "",
      "utf8",
    );

    const result = await findInstallScript(PACKAGE_NAME, "preinst", root);
    expect(result).toBeUndefined();
  });

  it("findInstallScript returns the first matching script when multiple are found", async () => {
    const root = makeTempRoot("pkg-match-");
    const scriptsDir = ensureScriptsDir(root);
    fs.writeFileSync(
      path.join(scriptsDir, "test-package.postinst"),
      "",
      "utf8",
    );
    fs.writeFileSync(path.join(scriptsDir, "test-package.preinst"), "", "utf8");
    fs.writeFileSync(
      path.join(scriptsDir, "test-package.preinst.backup"),
      "",
      "utf8",
    );

    const result = await findInstallScript(PACKAGE_NAME, "preinst", root);
    expect(result).toBe(path.join(scriptsDir, "test-package.preinst"));
  });

  it("updateAptLists calls the package manager's update method", async () => {
    const aptListsPath = makeTempRoot("apt-lists-");

    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    };
    const packageManager = {
      update: mockUpdate,
    };

    await updateAptLists(
      packageManager as any,
      mockLogger as any,
      aptListsPath,
    );

    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  describe("ActionPackageNames", () => {
    it("fromInput parses APT serialized input", () => {
      const input = "test-package=1.0.0 amd64 other-package=2.0.0 i386";
      const result = ActionPackageNames.fromInput(input);
      expect(result.toArray()).toEqual([
        createPackageName("other-package", "2.0.0", "i386"),
        createPackageName("test-package", "1.0.0", "amd64"),
      ]);
    });

    it("fromInput returns an empty list when input is empty", () => {
      const result = ActionPackageNames.fromInput("");
      expect(result.toArray()).toEqual([]);
    });

    it("fromInput returns an empty list when input is whitespace", () => {
      const result = ActionPackageNames.fromInput("   ");
      expect(result.toArray()).toEqual([]);
    });

    it("fromJSON parses an array of serialized package names", () => {
      const json = [
        { name: "test-package", version: "1.0.0", arch: "amd64" },
        { name: "other-package", version: "2.0.0", arch: "i386" },
      ];
      const result = ActionPackageNames.fromJSON(json);
      expect(result.toArray()).toEqual([
        createPackageName("other-package", "2.0.0", "i386"),
        createPackageName("test-package", "1.0.0", "amd64"),
      ]);
    });

    it("fromJSON returns an empty list when input is empty", () => {
      const result = ActionPackageNames.fromJSON([]);
      expect(result.toArray()).toEqual([]);
    });

    it("length returns the number of package names", () => {
      const input = "test-package=1.0.0 amd64 other-package=2.0.0 i386";
      const result = ActionPackageNames.fromInput(input);
      expect(result.length).toBe(2);
    });

    it("toArray returns a sorted array of package names", () => {
      const input = "test-package=1.0.0 amd64 other-package=2.0.0 i386";
      const result = ActionPackageNames.fromInput(input);
      expect(result.toArray()).toEqual([
        createPackageName("other-package", "2.0.0", "i386"),
        createPackageName("test-package", "1.0.0", "amd64"),
      ]);
    });
  });
});
