import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPackageName, type Alternative, type PackageManager } from "ts-apt";
import { ActionPackageNames, buildFileList, findInstallScript, ownedAlternatives } from "../src/packages.js";
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
    const result = await buildFileList(PACKAGE_NAME, manager as unknown as PackageManager, root);

    expect(result).toEqual(packageFiles.map((item) => item.slice(1)).sort());
  });

  it("buildFileList returns an empty array when no files are found", async () => {
    const root = makeTempRoot("pkg-empty-");

    const manager = {
      listInstalledFiles: vi.fn().mockResolvedValue([]),
    };

    const result = await buildFileList(PACKAGE_NAME, manager as unknown as PackageManager, root);
    expect(result).toEqual([]);
  });

  it("findInstallScript returns undefined when scripts directory does not exist", async () => {
    const missingRoot = makeTempRoot("pkg-missing-");

    const result = await findInstallScript(PACKAGE_NAME, "preinst", missingRoot);
    expect(result).toBeUndefined();
  });

  it("findInstallScript returns undefined when no matching scripts are found", async () => {
    const root = makeTempRoot("pkg-no-match-");
    const scriptsDir = ensureScriptsDir(root);
    fs.writeFileSync(path.join(scriptsDir, "other-package.preinst"), "", "utf8");

    const result = await findInstallScript(PACKAGE_NAME, "preinst", root);
    expect(result).toBeUndefined();
  });

  it("findInstallScript returns the first matching script when multiple are found", async () => {
    const root = makeTempRoot("pkg-match-");
    const scriptsDir = ensureScriptsDir(root);
    fs.writeFileSync(path.join(scriptsDir, "test-package.postinst"), "", "utf8");
    fs.writeFileSync(path.join(scriptsDir, "test-package.preinst"), "", "utf8");
    fs.writeFileSync(path.join(scriptsDir, "test-package.preinst.backup"), "", "utf8");

    const result = await findInstallScript(PACKAGE_NAME, "preinst", root);
    expect(result).toBe(path.join(scriptsDir, "test-package.preinst"));
  });

  it.each([
    ["g++", "g++.postinst"],
    ["libstdc++6", "libstdc++6:amd64.postinst"],
  ])(
    "findInstallScript name %s with regex metacharacters returns its script",
    async (name, scriptFilename) => {
      const root = makeTempRoot("pkg-metachar-");
      const scriptsDir = ensureScriptsDir(root);
      fs.writeFileSync(path.join(scriptsDir, scriptFilename), "", "utf8");

      const result = await findInstallScript(createPackageName(name), "postinst", root);
      expect(result).toBe(path.join(scriptsDir, scriptFilename));
    },
  );

  it("findInstallScript name with dot does not match a similarly named package", async () => {
    const root = makeTempRoot("pkg-dot-");
    const scriptsDir = ensureScriptsDir(root);
    fs.writeFileSync(path.join(scriptsDir, "libaXb.postinst"), "", "utf8");

    const result = await findInstallScript(createPackageName("liba.b"), "postinst", root);
    expect(result).toBeUndefined();
  });

  it("buildFileList installed paths missing on disk excludes them", async () => {
    const root = makeTempRoot("pkg-missing-file-");
    const presentFile = path.join(root, "present");
    fs.writeFileSync(presentFile, "", "utf8");
    const manager = {
      listInstalledFiles: vi.fn().mockResolvedValue([presentFile, path.join(root, "absent")]),
    };

    const result = await buildFileList(PACKAGE_NAME, manager as unknown as PackageManager, root);

    expect(result).toEqual([presentFile.slice(1)]);
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

    it("fromInput version without package name ignores the token", () => {
      const result = ActionPackageNames.fromInput("=1.0.0 curl");

      expect(result.toArray()).toEqual([createPackageName("curl")]);
    });

    // Regression issue #84: multiline YAML block scalars (folded and literal) reach the action as
    // newline- or backslash-separated text and must parse to the same packages as a single line.
    it.each([
      ["folded block with extra spaces", "xdot  rolldice distro-info-data\n"],
      ["literal block with newlines", "xdot\nrolldice\ndistro-info-data\n"],
      ["backslash line continuation", "xdot \\\nrolldice distro-info-data"],
    ])("fromInput %s parses the same as one line", (_label, input) => {
      const result = ActionPackageNames.fromInput(input);

      expect(result.toArray()).toEqual([
        createPackageName("distro-info-data"),
        createPackageName("rolldice"),
        createPackageName("xdot"),
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

    it.each([
      ["same name without arch returns true", "xdot", createPackageName("xdot", "1.3-1"), true],
      ["requested without arch returns true", "xdot", createPackageName("xdot", "1.3-1", "amd64"), true],
      ["installed without arch returns true", "xdot:amd64", createPackageName("xdot", "1.3-1"), true],
      ["matching arch returns true", "xdot:amd64", createPackageName("xdot", "1.3-1", "amd64"), true],
      ["different arch returns false", "xdot:i386", createPackageName("xdot", "1.3-1", "amd64"), false],
      ["different name returns false", "xdot", createPackageName("rolldice", "1.16"), false],
    ])("includes %s", (_case, input, installed, expected) => {
      expect(ActionPackageNames.fromInput(input).includes(installed)).toBe(expected);
    });
  });

  describe("ownedAlternatives", () => {
    const alternativeAt = (path: string): Alternative => ({
      name: "group",
      link: "/usr/bin/group",
      path,
      priority: 10,
      slaves: [],
    });

    it("ownedAlternatives alternative path in the package files returns it", () => {
      const own = alternativeAt("/usr/bin/identify-im6.q16");

      expect(ownedAlternatives(["usr/bin/identify-im6.q16"], [own])).toEqual([own]);
    });

    it("ownedAlternatives alternative path under a merged-usr symlink returns it", () => {
      const root = makeTempRoot("pkg-alternatives-");
      fs.mkdirSync(path.join(root, "usr", "bin"), { recursive: true });
      fs.symlinkSync("usr/bin", path.join(root, "bin"));
      const own = alternativeAt("/bin/nano");

      expect(ownedAlternatives(["usr/bin/nano"], [own], root)).toEqual([own]);
    });

    it("ownedAlternatives package file under a merged-usr symlink returns the alternative", () => {
      const root = makeTempRoot("pkg-alternatives-");
      fs.mkdirSync(path.join(root, "usr", "bin"), { recursive: true });
      fs.symlinkSync("usr/bin", path.join(root, "bin"));
      const own = alternativeAt("/usr/bin/nano");

      expect(ownedAlternatives(["bin/nano"], [own], root)).toEqual([own]);
    });

    it("ownedAlternatives alternative in a directory that doesn't exist returns it when the path matches", () => {
      const root = makeTempRoot("pkg-alternatives-");
      const own = alternativeAt("/opt/missing/tool");

      expect(ownedAlternatives(["opt/missing/tool"], [own], root)).toEqual([own]);
    });

    it("ownedAlternatives directory can't be resolved for another reason throws", () => {
      expect(() => ownedAlternatives(["usr/bin/nano"], [alternativeAt("/bin/nano")], "bad\0root")).toThrow();
    });

    it("ownedAlternatives alternative path not in the package files returns none", () => {
      expect(ownedAlternatives(["usr/bin/other"], [alternativeAt("/usr/bin/identify-im6.q16")])).toEqual([]);
    });

    it("ownedAlternatives no alternatives returns none", () => {
      expect(ownedAlternatives(["usr/bin/other"], [])).toEqual([]);
    });
  });
});
