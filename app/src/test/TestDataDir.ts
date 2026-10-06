// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * TestDataDir - Keeps tests out of the developer's real Creator Tools profile.
 *
 * The CLI, its MCP server, and LocalEnvironment save state such as Minecraft EULA acceptance,
 * preferences, passcodes, worlds, and Bedrock Dedicated Server downloads in the folders that
 * LocalUtilities resolves: under MCTOOLS_DATA_DIR when it's set, otherwise in the real profile
 * (~/.mctools on macOS and Linux, mctools_* folders in AppData\Local on Windows).
 *
 * Importing this module points MCTOOLS_DATA_DIR at a new temporary folder for the whole test
 * process, so a CLI process spawned with the inherited environment gets it, and deletes the folder
 * when the process exits. It also removes an inherited MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA,
 * so tests start as a new user who hasn't accepted the EULA. A spawn that needs acceptance, such as
 * `create` or `add`, passes `env: cliEnv({ acceptEula: true })`. applyTestDataDir() returns the folder.
 *
 * A spawn with its own `env` keeps the folder by spreading `...process.env` or using cliEnv(). The MCP
 * SDK's StdioClientTransport doesn't pass the environment on, so give it
 * `env: { [DATA_DIR_ENV]: applyTestDataDir() }`.
 *
 * A test file that starts processes is isolated when it loads this module or CommandLineTestHelpers.ts,
 * which imports it, directly or through another file. The import has to survive compilation, so
 * import a value you use or the module itself (`import "./TestDataDir";`), not only a type.
 * CliTestIsolationTest checks every file under src/test for this and for each launch's env.
 * TestPaths.ts doesn't import it: the opt-in real-BDS suites in src/test-extra/ use TestPaths and
 * rely on the EULA acceptance and server download saved in the real profile.
 */

// This file imports only Node built-ins, and tsconfig.test.json doesn't load Node's types by
// default, so reference them here. Otherwise ts-node can fail to compile it when it's the only
// file not in its compile cache.
/// <reference types="node" />

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export const DATA_DIR_ENV = "MCTOOLS_DATA_DIR";
export const EULA_ENV = "MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA";

let rootDir: string | undefined;
let defaultDataDir: string | undefined;
let eulaAcceptedDataDir: string | undefined;

/**
 * Points MCTOOLS_DATA_DIR at a temporary folder for this process and the processes it spawns, and
 * removes an inherited EULA environment variable. Returns the folder. Importing this module already
 * calls it. Only the first call changes the environment, so a test that temporarily overrides either
 * variable isn't affected later.
 */
export function applyTestDataDir(): string {
  if (defaultDataDir) {
    return defaultDataDir;
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mct-test-data-"));
  process.on("exit", () => removeFolder(root));
  rootDir = root;

  defaultDataDir = path.join(root, "default");
  fs.mkdirSync(defaultDataDir);

  setEnvironmentVariable(process.env, DATA_DIR_ENV, defaultDataDir);
  setEnvironmentVariable(process.env, EULA_ENV, undefined);

  return defaultDataDir;
}

/**
 * Creates an empty data folder, for a test that needs a first-run state no other test can change.
 * It's deleted with the default folder when the process exits.
 */
export function createTestDataDir(name: string): string {
  applyTestDataDir();

  return fs.mkdtempSync(path.join(rootDir as string, name + "-"));
}

export interface ICliEnvOptions {
  /**
   * Accept the Minecraft EULA through its environment variable. Unless `dataDir` is given, the
   * process uses a data folder shared only by spawns that accept, because `create`, `add`, and
   * `eula` save the acceptance. That keeps the default folder in a first-run state.
   */
  acceptEula?: boolean;

  /** Data folder to use instead, for example one from createTestDataDir(). */
  dataDir?: string;
}

/** The environment for a spawned CLI process: this process's environment with the test data folder. */
export function cliEnv(options: ICliEnvOptions = {}): NodeJS.ProcessEnv {
  let dataDir = options.dataDir;

  if (!dataDir && options.acceptEula) {
    if (!eulaAcceptedDataDir) {
      eulaAcceptedDataDir = createTestDataDir("eula-accepted");
    }
    dataDir = eulaAcceptedDataDir;
  }

  const env = { ...process.env };
  setEnvironmentVariable(env, DATA_DIR_ENV, dataDir || applyTestDataDir());
  setEnvironmentVariable(env, EULA_ENV, options.acceptEula ? "true" : undefined);

  return env;
}

/**
 * Sets a variable in `env`, or removes it when `value` is undefined. Names are matched
 * case-insensitively because Windows treats them that way, and a copy of the environment keeps
 * whichever casing the parent process used.
 */
export function setEnvironmentVariable(env: NodeJS.ProcessEnv, name: string, value: string | undefined) {
  for (const key of Object.keys(env)) {
    if (key.toUpperCase() === name.toUpperCase()) {
      delete env[key];
    }
  }

  if (value !== undefined) {
    env[name] = value;
  }
}

function removeFolder(folder: string) {
  try {
    fs.rmSync(folder, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    // On Windows, a CLI process that's still exiting can hold a file open. The folder is in the
    // system's temporary folder, so leaving it behind is harmless.
  }
}

applyTestDataDir();
