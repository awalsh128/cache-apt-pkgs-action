import * as core from "@actions/core";
import { DefaultArtifactClient } from "@actions/artifact";
import winston from "winston";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  CACHE_KEY_FILENAME,
  MANIFEST_ALL_FILENAME,
  MANIFEST_MAIN_FILENAME,
} from "./cache.js";

const APP_LOG_FILENAME = "capa_app.log";
const EXEC_LOG_FILENAME = "capa_exec.log";

function createStream(
  filepath: string,
): winston.transports.StreamTransportInstance {
  return new winston.transports.Stream({
    stream: fs.createWriteStream(filepath, {
      flags: "a",
    }),
  });
}

/**
 * Manages artifact creation and upload.
 */
export class Artifacts {
  constructor(
    /** Directory that all the artifacts are stored. */
    readonly dir: string,
    /** Filenames of monitored artifacts. */
    readonly artifactFilenames: string[],
    /** Whether debug is enabled which affects artifacts otherwise not. */
    readonly debug: boolean = false,
    /** Unique runner ID of the GitHub Action workflow run. */
    readonly runId: string = process.env.GITHUB_RUN_ID ??
      `ghrunid-notfound-${crypto.randomUUID()}`,
  ) {}

  /** Upload artifacts to GitHub Actions via [@actions/artifact]. */
  upload(): string {
    const client = new DefaultArtifactClient();
    client.uploadArtifact(
      "capa_artifacts-" + this.runId,
      this.artifactFilenames
        .map((filename) => path.join(this.dir, filename))
        .filter((filepath) => fs.existsSync(filepath)),
      this.dir,
      {
        retentionDays: 7,
      },
    );
    return this.runId;
  }
}

/** Create the logger used for command line execution */
function createExecLogger(debug: boolean, filepath: string): winston.Logger {
  const logger = winston.createLogger({
    level: debug ? "debug" : "info",
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message }) => `${level}: ${message}`),
    ),
    transports: [new winston.transports.Console(), createStream(filepath)],
  });
  return logger;
}

/** Create the logger used for GitHub Actions integration. */
function createGitHubLogger(debug: boolean, filepath: string): winston.Logger {
  const logger = winston.createLogger({
    level: debug ? "debug" : "info",
    transports: [createStream(filepath)],
  });
  logger.on("logged", (info) => {
    switch (info.level) {
      case "debug":
        if (debug) core.debug(info.message);
        break;
      case "info":
        core.info(info.message);
        break;
      case "warn":
        core.warning(info.message);
        break;
      case "error":
        core.error(info.message);
        break;
      default:
        core.error(`[UNKNOWN LEVEL]: ${info.level}, message: ${info.message}`);
        break;
    }
  });
  return logger;
}

/** Container for all instrumentation: telemetry, logging, and artifacts generated */
export class Instruments {
  /** Cache directory where all artifacts are stored, including cached packages. */
  readonly cacheDir: string;
  /** Whether debug is enabled which affects artifacts otherwise not. */
  readonly debug: boolean;
  /** Manages artifact creation and upload.  */
  readonly artifacts: Artifacts;
  /** Logger used for GitHub Actions integration. */
  readonly appLogger: winston.Logger;
  /** Logger used for command line execution. */
  readonly execLogger: winston.Logger;

  constructor(cacheDir: string, debug: boolean, artifacts?: Artifacts) {
    this.cacheDir = cacheDir;
    this.debug = debug;

    this.artifacts =
      artifacts ??
      new Artifacts(cacheDir, [
        APP_LOG_FILENAME,
        EXEC_LOG_FILENAME,
        CACHE_KEY_FILENAME,
        MANIFEST_MAIN_FILENAME,
        MANIFEST_ALL_FILENAME,
      ]);
    this.appLogger = createGitHubLogger(
      debug,
      path.join(cacheDir, APP_LOG_FILENAME),
    );
    this.execLogger = createExecLogger(
      debug,
      path.join(cacheDir, EXEC_LOG_FILENAME),
    );
  }
}
