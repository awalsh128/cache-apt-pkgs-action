#!/usr/bin/env -S node --experimental-strip-types
/// <reference types="node" />

import { spawn } from "child_process";
import { mkdir, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import process from "process";
import { ROOT_DIR, fail, logInfo, logSuccess } from "../devopslib.mts";

type LogResult = {
  cmdLine: string;
  exitCode: number;
  stdout: string;
  stderr: string;
};

type TestLogEntry = {
  filepath: string;
  execCmdLine: string;
  preExecCmdLine?: string[];
  postExecCmdLine?: string[];
};

function toLog(result: LogResult): string {
  return `*** CMD_LINE ${result.cmdLine}\n*** EXIT_CODE ${result.exitCode}\n*** STDOUT\n${result.stdout}*** STDERR\n${result.stderr}`;
}

/** Determine exit code: use code if available, else map signal to 137 (SIGKILL) or 143 (SIGTERM) */
function getFinalExitCode(
  code: number | null,
  signal: NodeJS.Signals | null,
): number {
  if (code !== null) {
    return code;
  } else if (signal === "SIGTERM") {
    return 143; // Standard for SIGTERM (128 + 14)
  } else if (signal === "SIGKILL") {
    return 137; // Standard for SIGKILL (128 + 9)
  }
  return 1; // Fallback for unknown signal
}

async function execute(cmdLine: string): Promise<LogResult> {
  return await new Promise<LogResult>((resolve, reject) => {
    const parts = cmdLine.trim().split(/\s+/);
    const [command, ...args] = parts;
    if (!command) {
      reject(new Error("Command line cannot be empty."));
      return;
    }
    const env = { ...process.env };
    if (!env.LC_ALL) {
      env.LC_ALL = "C";
    }

    const commonEnv = {
      ...env,
      PATH: `${process.env.PATH}:/usr/bin`,
      DEBIAN_FRONTEND: "noninteractive",
      DEBCONF_NONINTERACTIVE_SEEN: "true",
    };

    const child = spawn(command, args, {
      env: commonEnv,
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    /**
     * Ensures promise resolution or rejection happens once.
     *
     * @param fn Finalizer callback to execute once settled.
     */
    const finalize = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      fn();
    };

    // 1. Attach 'error' FIRST (Critical for crash safety)
    child.on("error", (error: Error) => {
      finalize(() => reject(error));
    });

    // 2. Attach 'stdout' and 'stderr' stream listeners (Capture output)
    child.stdout?.on("data", (chunk: Buffer) => {
      const str = chunk.toString("utf8");
      stdout += str;
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const str = chunk.toString("utf8");
      stderr += str;
    });

    // 3. Attach 'close' last (Handles exit logic)
    child.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
      if (stderr.includes("Permission denied")) {
        finalize(() =>
          reject(
            new Error(`Permission denied error:
          - command: ${command}
          - args: ${args.join(" ")}
          - stdout: ${stdout}
          - stderr: ${stderr}
          - code: ${code}
          - signal: ${signal}
          `),
          ),
        );
        return;
      }
      finalize(() => {
        const finalExitCode = getFinalExitCode(code, signal);

        resolve({
          cmdLine,
          exitCode: finalExitCode,
          stdout,
          stderr,
        });
      });
    });
  });
}

async function writeLogFile(
  baseDir: string,
  relativePath: string,
  result: LogResult,
): Promise<string> {
  const outputPath = resolve(baseDir, `${relativePath}.log`);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, toLog(result), "utf8");
  return outputPath;
}

const PERMISSION_DENIED_EXIT_CODE = 100;

async function main(): Promise<void> {
  const testDataDir = resolve(ROOT_DIR, "test/data");
  let written = 0;

  for (const entry of testLogFiles) {
    if (entry.preExecCmdLine) {
      for (const cmd of entry.preExecCmdLine) {
        await execute(cmd);
      }
    }

    const result = await execute(entry.execCmdLine);
    const outputPath = await writeLogFile(testDataDir, entry.filepath, result);
    if (entry.postExecCmdLine) {
      for (const cmd of entry.postExecCmdLine) {
        await execute(cmd);
      }
    }

    written += 1;
    logInfo(`Wrote ${outputPath}`);
  }

  await execute("apt-get upgrade -y");
  await execute("apt-get autoremove -y");

  logSuccess(`Wrote ${written} command execution log(s).`);
}

const testLogFiles: TestLogEntry[] = [
  {
    filepath: "autoclean",
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o DPkg::Lock::Timeout=-1 autoclean",
  },
  {
    filepath: "autoremove_found",
    preExecCmdLine: ["apt-get install -y xdot", "apt-get remove -y xdot"],
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o DPkg::Lock::Timeout=-1 autoremove",
  },
  {
    filepath: "autoremove_notfound",
    preExecCmdLine: ["apt-get autoremove -y"],
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o DPkg::Lock::Timeout=-1 autoremove",
  },
  {
    filepath: "cacheshow_mixedfoundnotfound",
    execCmdLine:
      "/usr/bin/apt-cache --quiet=0 --no-all-versions show xdot python3 nonexistentpackage",
  },
  {
    filepath: "cacheshow_multiplefound",
    execCmdLine:
      "/usr/bin/apt-cache --quiet=0 --no-all-versions show xdot python3",
  },
  {
    filepath: "cacheshow_singlefound",
    execCmdLine: "/usr/bin/apt-cache --quiet=0 --no-all-versions show python3",
  },
  {
    filepath: "cacheshow_singlenotfound",
    execCmdLine:
      "/usr/bin/apt-cache --quiet=0 --no-all-versions show nonexistentpackage",
  },
  {
    filepath: "cacheshow_virtualpackage",
    execCmdLine: "/usr/bin/apt-cache --quiet=0 --no-all-versions show libvips",
  },
  {
    filepath: "cacheshow_virtualandnotpackages",
    execCmdLine:
      "/usr/bin/apt-cache --quiet=0 --no-all-versions show libvips xdot",
  },
  {
    filepath: "cacheshowpkg_virtualpackage",
    execCmdLine: "apt-cache showpkg --quiet=0 libvips",
  },
  {
    filepath: "install_mixedfoundnotfound",
    preExecCmdLine: ["apt-get remove -y xdot"],
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o DPkg::Lock::Timeout=-1 install -f xdot nonexistentpackage",
  },
  {
    filepath: "install_mixedinstallstatus",
    preExecCmdLine: [
      "apt-get install -y xdot",
      "apt-get remove -y rolldice",
      "apt-get autoremove -y",
    ],
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o DPkg::Lock::Timeout=-1 install -f rolldice xdot",
  },
  {
    filepath: "install_singleinstalled",
    preExecCmdLine: ["apt-get install -y xdot"],
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o DPkg::Lock::Timeout=-1 install -f xdot",
  },
  {
    filepath: "install_singlenotfound",
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o DPkg::Lock::Timeout=-1 install -f nonexistentpackage",
  },
  {
    filepath: "install_singlenotinstalled",
    preExecCmdLine: ["apt-get remove -y xdot", "apt-get autoremove -y"],
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o DPkg::Lock::Timeout=-1 install -f xdot",
  },
  {
    filepath: "listinstalled",
    execCmdLine: "/usr/bin/dpkg-query -W -f ${binary:Package}=${Version}\\n",
  },
  {
    filepath: "listinstalledfiles_found",
    execCmdLine: "/usr/bin/dpkg-query -L xdot",
  },
  {
    filepath: "listinstalledfiles_notfound",
    execCmdLine: "/usr/bin/dpkg-query -L nonexistentpackage",
  },
  {
    filepath: "listupgradable_found",
    preExecCmdLine: [
      "apt-get remove -y firefox-locale-en",
      "apt-get install -y firefox-locale-en=75.0+build3-0ubuntu1",
      "apt-get remove -y uuid-dev",
      "apt-get install -y uuid-dev=2.34-0.1ubuntu9",
    ],
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o APT::Get::Show-User-Simulation-Note=false -V --simulate dist-upgrade",
  },
  {
    filepath: "listupgradable_notfound",
    preExecCmdLine: ["apt-get upgrade -y"],
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o APT::Get::Show-User-Simulation-Note=false -V --simulate dist-upgrade",
  },
  {
    filepath: "remove_mixedfoundnotfound",
    preExecCmdLine: ["apt-get install -y xdot"],
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o DPkg::Lock::Timeout=-1 remove -f xdot nonexistentpackage --autoremove",
  },
  {
    filepath: "remove_mixedinstallstatus",
    preExecCmdLine: ["apt-get install -y xdot", "apt-get remove -y rolldice"],
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o DPkg::Lock::Timeout=-1 remove -f rolldice xdot --autoremove",
  },
  {
    filepath: "remove_singlenotinstalled",
    preExecCmdLine: ["apt-get remove -y xdot"],
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o DPkg::Lock::Timeout=-1 remove -f xdot --autoremove",
  },
  {
    filepath: "remove_singlenotfound",
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o DPkg::Lock::Timeout=-1 remove -f nonexistentpackage --autoremove",
  },
  {
    filepath: "remove_singleinstalled",
    preExecCmdLine: ["apt-get install -y xdot"],
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o DPkg::Lock::Timeout=-1 remove -f xdot --autoremove",
  },
  {
    filepath: "search_multiplefound",
    execCmdLine: "/usr/bin/apt-cache --quiet=0 search vim",
  },
  {
    filepath: "search_nonefound",
    execCmdLine: "/usr/bin/apt-cache --quiet=0 search nonexistentpackage",
  },
  {
    filepath: "search_singlefound",
    execCmdLine: "/usr/bin/apt-cache --quiet=0 search vim-vimerl-syntax",
  },
  {
    filepath: "update",
    execCmdLine: "flock /var/lib/apt/lists/lock /usr/bin/apt-get update",
  },
  {
    filepath: "upgrade_mixedfoundnotfound",
    preExecCmdLine: ["apt-get remove -y xdot"],
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o DPkg::Lock::Timeout=-1 install xdot nonexistentpackage",
  },
  {
    filepath: "upgrade_mixedupgradestatus",
    preExecCmdLine: [
      "apt-get install -y xdot",
      "apt-get remove -y xxd",
      "apt-get install -y xxd=2:8.1.2269-1ubuntu5.30",
    ],
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o DPkg::Lock::Timeout=-1 install xxd xdot",
  },
  {
    filepath: "upgrade_singleupgraded",
    preExecCmdLine: ["apt-get upgrade -y xdot"],
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o DPkg::Lock::Timeout=-1 upgrade",
  },
  {
    filepath: "upgrade_singlenotfound",
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o DPkg::Lock::Timeout=-1 install nonexistentpackage",
  },
  {
    filepath: "upgrade_singlenotupgraded",
    preExecCmdLine: [
      "apt-get remove -y xxd",
      "apt-get install -y xxd=2:8.1.2269-1ubuntu5.30",
    ],
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o DPkg::Lock::Timeout=-1 install xxd",
  },
  {
    filepath: "upgrade_singleinstalled",
    preExecCmdLine: ["apt-get install xdot"],
    execCmdLine:
      "/usr/bin/apt-get --quiet=0 -y -o DPkg::Lock::Timeout=-1 install xdot",
  },
];

await main().catch((error) => {
  fail(
    "Error occurred during log creation:\n" +
      String(error) +
      "\n" +
      (error.stack || ""),
  );
});
