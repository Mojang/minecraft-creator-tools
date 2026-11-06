// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { ChildProcess } from "child_process";
import type { Browser } from "playwright";
import Log from "../core/Log";

/** How long to keep reading a browser's pipes after its process exits, so its last output isn't lost. */
export const BROWSER_PIPE_DRAIN_MS = 250;

/**
 * Lets `browser.close()` finish once the browser's own process has exited, even when a process the
 * browser started still holds the browser's output pipes.
 *
 * Playwright resolves `browser.close()`, and removes the temporary profile, only after every stdio
 * pipe to the browser process closes. A process the browser starts inherits its stdout and stderr and
 * keeps them open after the browser exits, as Microsoft Edge's updater does on macOS. After the browser
 * process exits, this reads its remaining output for `BROWSER_PIPE_DRAIN_MS`, then closes our ends of
 * its pipes. It never stops or signals a process. A child that writes to those pipes afterwards gets
 * an error, as it would once `mct` exits.
 *
 * Playwright doesn't expose the process of a browser from `launch()`. This uses the in-process mapping
 * from API objects to server objects that Playwright's Electron client uses for
 * `ElectronApplication.process()`. Without it, closing waits for those pipes as before.
 * See docs/PlaywrightBrowserManagement.md.
 */
export function releaseBrowserPipesAfterExit(browser: Browser): void {
  const browserProcess = getBrowserProcess(browser);
  if (browserProcess) {
    releasePipesAfterExit(browserProcess);
  }
}

/** Closes our ends of a child process's pipes `BROWSER_PIPE_DRAIN_MS` after the process exits. */
export function releasePipesAfterExit(childProcess: ChildProcess): void {
  const release = () => {
    // setImmediate gives the event loop one more I/O pass after the timer to read output written before the exit.
    setTimeout(() => setImmediate(() => closePipes(childProcess)), BROWSER_PIPE_DRAIN_MS).unref();
  };
  if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
    release();
  } else {
    childProcess.once("exit", release);
  }
}

function closePipes(childProcess: ChildProcess): void {
  const open = childProcess.stdio.filter((stream) => stream && !stream.destroyed);
  if (open.length === 0) {
    return;
  }
  Log.verbose(
    `Process ${childProcess.pid} exited, but a process it started still holds ${open.length} of its pipes. Closing them.`
  );
  for (const stream of open) {
    stream?.destroy();
  }
}

function getBrowserProcess(browser: Browser): ChildProcess | undefined {
  try {
    const connection = (browser as unknown as { _connection?: { toImpl?: (object: unknown) => unknown } })._connection;
    const server = connection?.toImpl?.(browser) as
      | { options?: { browserProcess?: { process?: ChildProcess } } }
      | undefined;
    return server?.options?.browserProcess?.process;
  } catch {
    return undefined;
  }
}
