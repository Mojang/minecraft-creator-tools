// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Tests for resolveMcpWorkingFolder: `mct mcp` keeps its current-directory default, except when an
 * agent plugin starts it inside the plugin's install folder.
 */

/// <reference types="node" />

import { expect } from "chai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { resolveMcpWorkingFolder } from "../cli/commands/server/McpWorkingFolder";

describe("resolveMcpWorkingFolder", function () {
  let tempRoot: string;
  let pluginRoot: string;
  let projectFolder: string;

  before(function () {
    tempRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mct-mcp-working-folder-")));
    pluginRoot = path.join(tempRoot, "installed-plugins", "minecraft");
    projectFolder = path.join(tempRoot, "my-addon");
    fs.mkdirSync(path.join(pluginRoot, "skills"), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, "installed-plugins", "minecraft-other"), { recursive: true });
    fs.mkdirSync(projectFolder, { recursive: true });
  });

  after(function () {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const cases: {
    name: string;
    inputFolder: () => string;
    inputFolderSpecified: boolean;
    env: () => NodeJS.ProcessEnv;
    cwd: () => string;
    expected: () => string | undefined;
  }[] = [
    {
      name: "uses the current directory default when no plugin started the server",
      inputFolder: () => projectFolder,
      inputFolderSpecified: false,
      env: () => ({}),
      cwd: () => projectFolder,
      expected: () => projectFolder,
    },
    {
      name: "reports no working folder when started in the plugin root (Agent Plugins default)",
      inputFolder: () => pluginRoot,
      inputFolderSpecified: false,
      env: () => ({ PLUGIN_ROOT: pluginRoot }),
      cwd: () => pluginRoot,
      expected: () => undefined,
    },
    {
      name: "reports no working folder when started below the plugin root",
      inputFolder: () => path.join(pluginRoot, "skills"),
      inputFolderSpecified: false,
      env: () => ({ COPILOT_PLUGIN_ROOT: pluginRoot }),
      cwd: () => path.join(pluginRoot, "skills"),
      expected: () => undefined,
    },
    {
      name: "reports no working folder when project discovery walked above the plugin root",
      inputFolder: () => tempRoot,
      inputFolderSpecified: false,
      env: () => ({ CLAUDE_PLUGIN_ROOT: pluginRoot }),
      cwd: () => pluginRoot,
      expected: () => undefined,
    },
    {
      name: "keeps the default when a plugin started the server in the user's project",
      inputFolder: () => projectFolder,
      inputFolderSpecified: false,
      env: () => ({ CLAUDE_PLUGIN_ROOT: pluginRoot }),
      cwd: () => projectFolder,
      expected: () => projectFolder,
    },
    {
      name: "doesn't treat a sibling folder with a shared name prefix as inside the plugin",
      inputFolder: () => path.join(tempRoot, "installed-plugins", "minecraft-other"),
      inputFolderSpecified: false,
      env: () => ({ PLUGIN_ROOT: pluginRoot }),
      cwd: () => path.join(tempRoot, "installed-plugins", "minecraft-other"),
      expected: () => path.join(tempRoot, "installed-plugins", "minecraft-other"),
    },
    {
      name: "always uses an explicit -i folder",
      inputFolder: () => projectFolder,
      inputFolderSpecified: true,
      env: () => ({ PLUGIN_ROOT: pluginRoot }),
      cwd: () => pluginRoot,
      expected: () => projectFolder,
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, function () {
      const result = resolveMcpWorkingFolder(
        testCase.inputFolder(),
        testCase.inputFolderSpecified,
        testCase.env(),
        testCase.cwd()
      );

      expect(result).to.equal(testCase.expected());
    });
  }
});
