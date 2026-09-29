// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Keeps the creator-tools-cli skill's command reference in sync with the CLI.
 *
 * The reference is generated from the Commander definitions (CliReferenceGenerator). The MCP
 * server generates it at runtime; the checked-in copy under plugins/ is for plugin users, and this
 * test fails when it's stale. Refresh it with `npm run update-cli-skill-reference` in app/.
 */

import { expect } from "chai";
import "mocha";
import * as fs from "fs";
import * as path from "path";
import { getAllCommands } from "../cli/commands/index";
import { CLI_REFERENCE_HEADER, generateCliReference } from "../cli/core/CliReferenceGenerator";
import TestPaths from "./TestPaths";

const REFERENCE_PATH = path.join(
  TestPaths.repoRoot,
  "plugins",
  "minecraft",
  "skills",
  "creator-tools-cli",
  "references",
  "commands.md"
);

describe("CLI reference for the creator-tools-cli skill", () => {
  const commands = getAllCommands();
  const reference = generateCliReference(commands);

  it("documents every public command with its aliases", () => {
    for (const { metadata } of commands) {
      if (metadata.internal || metadata.debugOnly) {
        continue;
      }

      expect(reference).to.match(new RegExp("^#### `" + metadata.name + "[ `]", "m"), metadata.name);
      for (const alias of metadata.aliases ?? []) {
        expect(reference).to.include("`" + alias + "`", `${metadata.name} alias ${alias}`);
      }
    }
  });

  it("leaves out internal and debug-only commands", () => {
    const hidden = commands.filter(({ metadata }) => metadata.internal || metadata.debugOnly);
    expect(hidden.length).to.be.greaterThan(0);
    for (const { metadata } of hidden) {
      expect(reference).not.to.match(new RegExp("^#### `" + metadata.name + "[ `]", "m"), metadata.name);
    }
  });

  it("lists global options, arguments, and command options", () => {
    expect(reference).to.include("- `-i, --input-folder [path to folder]`:");
    expect(reference).to.include("#### `validate [suite] [exclusions] [aggregateReports]`");
    expect(reference).not.to.include("--internalOnlyRunningInTheContextOfTestCommandLines");
  });

  it("is deterministic", () => {
    expect(generateCliReference(getAllCommands())).to.equal(reference);
  });

  it("matches the checked-in skill reference", () => {
    if (process.env.UPDATE_CLI_SKILL_REFERENCE === "1") {
      fs.mkdirSync(path.dirname(REFERENCE_PATH), { recursive: true });
      fs.writeFileSync(REFERENCE_PATH, reference);
    }

    const checkedIn = fs.existsSync(REFERENCE_PATH)
      ? fs.readFileSync(REFERENCE_PATH, "utf8").replace(/\r\n/g, "\n")
      : "";
    expect(checkedIn.startsWith(CLI_REFERENCE_HEADER), "checked-in reference is missing or not generated").to.equal(
      true
    );
    expect(checkedIn).to.equal(
      reference,
      "plugins/minecraft/skills/creator-tools-cli/references/commands.md is stale. Run `npm run update-cli-skill-reference` in app/."
    );
  });
});
