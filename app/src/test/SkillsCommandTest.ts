// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Tests for `mct skills` (SkillsCommand): the list, the printed skill files, their JSON forms, and
 * the "Agent skills" section of `mct --help`. The CLI end-to-end checks are in
 * ContentCommandLineTest.ts; loading and rendering are covered by McpSkillLibraryTest.ts.
 */

import { expect } from "chai";
import "mocha";
import * as path from "path";
import McpSkillLibrary from "../local/McpSkillLibrary";
import {
  buildSkillFileJson,
  buildSkillListJson,
  buildSkillListText,
  buildSkillsHelpSection,
  printSkills,
  skillsCommand,
} from "../cli/commands/content/SkillsCommand";
import { ILogger } from "../cli/core/ICommandContext";
import { getAllCommands } from "../cli/commands/index";
import TestPaths from "./TestPaths";

const SKILLS_ROOT = path.join(TestPaths.repoRoot, "plugins", "minecraft", "skills");

describe("mct skills", () => {
  const library = McpSkillLibrary.load("0.18.0", SKILLS_ROOT);
  const empty = new McpSkillLibrary([], "0.18.0");

  it("is a public command, so it shows in mct --help and the CLI reference", () => {
    expect(getAllCommands()).to.include(skillsCommand);
    expect(skillsCommand.metadata.name).to.equal("skills");
    expect(skillsCommand.metadata.aliases).to.deep.equal(["skill"]);
    expect(skillsCommand.metadata.internal).to.not.equal(true);
    expect(skillsCommand.metadata.debugOnly).to.not.equal(true);
    expect(skillsCommand.metadata.isWriteCommand).to.equal(false);
  });

  describe("list", () => {
    it("names every skill with the first sentence of its description", () => {
      const text = buildSkillListText(library);
      expect(text).to.include("Minecraft Creator Tools 0.18.0 includes 6 skills");
      expect(text).to.include("`mct skills <name>`");
      expect(text).to.include("`npx -y @minecraft/creator-tools@0.18.0 skills <name>`");
      for (const skill of library.skills) {
        expect(text).to.match(
          new RegExp(`^  ${skill.name} +${escapeRegExp(McpSkillLibrary.firstSentence(skill.description))}$`, "m")
        );
      }
      expect(text).to.include(`Skills folder: ${path.resolve(SKILLS_ROOT)}`);
    });

    it("says so when there are no skills", () => {
      expect(buildSkillListText(empty)).to.equal(
        "No skills were found in this installation of Minecraft Creator Tools."
      );
    });

    it("lists full descriptions, folders, and files as JSON", () => {
      const json = buildSkillListJson(library) as any;
      expect(json.command).to.equal("skills");
      expect(json.version).to.equal("0.18.0");
      expect(json.skills.map((skill: any) => skill.name)).to.deep.equal(library.skillNames);

      const createMob = json.skills.find((skill: any) => skill.name === "create-mob");
      expect(createMob.description).to.equal(library.getSkill("create-mob")!.description);
      expect(createMob.folder).to.equal(path.join(path.resolve(SKILLS_ROOT), "create-mob"));
      expect(createMob.files).to.deep.equal(["SKILL.md", "references/behaviors.md"]);
    });
  });

  describe("printing a skill", () => {
    it("tells the agent how to print the skill's other files from the CLI", () => {
      const response = library.buildSkillResponse("create-mob", undefined, "print with `mct skills create-mob <file>`");
      expect(response.isError).to.equal(false);
      expect(response.text).to.include("Skill: create-mob (SKILL.md)");
      expect(response.text).to.include(
        "Other files (print with `mct skills create-mob <file>`): references/behaviors.md"
      );
      expect(response.text).to.include("@minecraft/creator-tools@0.18.0");
      expect(response.text).not.to.match(/<[a-z0-9-]+-skill-folder>/);
    });

    const files: { title: string; file?: string; expectedFile: string; expectedOtherFiles: string[] }[] = [
      { title: "SKILL.md by default", expectedFile: "SKILL.md", expectedOtherFiles: ["references/behaviors.md"] },
      {
        title: "a reference file written with ./",
        file: "./references/behaviors.md",
        expectedFile: "references/behaviors.md",
        expectedOtherFiles: ["SKILL.md"],
      },
      {
        title: "a reference file written with backslashes",
        file: "references\\behaviors.md",
        expectedFile: "references/behaviors.md",
        expectedOtherFiles: ["SKILL.md"],
      },
    ];

    for (const testCase of files) {
      it(`prints ${testCase.title} as JSON`, () => {
        const json = buildSkillFileJson(library, "create-mob", testCase.file) as any;
        expect(json.name).to.equal("create-mob");
        expect(json.file).to.equal(testCase.expectedFile);
        expect(json.otherFiles).to.deep.equal(testCase.expectedOtherFiles);
        expect(json.folder).to.equal(path.join(path.resolve(SKILLS_ROOT), "create-mob"));
        expect(json.content).to.equal(library.readFile("create-mob", testCase.expectedFile));
      });
    }

    for (const [name, file] of [
      ["nope", undefined],
      ["create-mob", "nope.md"],
      ["create-mob", "../debug-addon/SKILL.md"],
    ] as [string, string | undefined][]) {
      it(`returns no JSON for ${name} ${file ?? ""}`.trim(), () => {
        expect(buildSkillFileJson(library, name, file)).to.equal(undefined);
      });
    }
  });

  describe("printSkills", () => {
    /** A logger that records stdout data and errors, as the CLI's logger would print them. */
    function recorder(): { log: ILogger; data: string[]; errors: string[] } {
      const data: string[] = [];
      const errors: string[] = [];
      const ignore = () => undefined;
      const log: ILogger = {
        info: ignore,
        warn: ignore,
        verbose: ignore,
        debug: ignore,
        success: ignore,
        progress: ignore,
        error: (message) => errors.push(message),
        data: (message) => data.push(message),
      };
      return { log, data, errors };
    }

    const cases: {
      title: string;
      request: { name?: string; file?: string; json: boolean };
      exitCode: number;
      check: (data: string[], errors: string[]) => void;
    }[] = [
      {
        title: "lists the skills",
        request: { json: false },
        exitCode: 0,
        check: (data) => expect(data).to.deep.equal([buildSkillListText(library)]),
      },
      {
        title: "lists the skills as JSON",
        request: { json: true },
        exitCode: 0,
        check: (data) => expect(JSON.parse(data[0])).to.deep.equal(buildSkillListJson(library)),
      },
      {
        title: "prints a skill with the CLI hint for its other files",
        request: { name: "create-mob", json: false },
        exitCode: 0,
        check: (data) =>
          expect(data).to.deep.equal([
            library.buildSkillResponse("create-mob", undefined, "print with `mct skills create-mob <file>`").text,
          ]),
      },
      {
        title: "prints a reference file as JSON",
        request: { name: "create-mob", file: "references/behaviors.md", json: true },
        exitCode: 0,
        check: (data) =>
          expect(JSON.parse(data[0])).to.deep.equal(
            buildSkillFileJson(library, "create-mob", "references/behaviors.md")
          ),
      },
      {
        title: "reports an unknown skill on stderr",
        request: { name: "nope", json: true },
        exitCode: 1,
        check: (data, errors) => {
          expect(data).to.deep.equal([]);
          expect(errors[0]).to.include("Available skills: create-block,");
        },
      },
      {
        title: "reports an unknown file on stderr",
        request: { name: "create-mob", file: "nope.md", json: false },
        exitCode: 1,
        check: (data, errors) => {
          expect(data).to.deep.equal([]);
          expect(errors[0]).to.include("Available files: SKILL.md, references/behaviors.md");
        },
      },
    ];

    for (const testCase of cases) {
      it(testCase.title, () => {
        const { log, data, errors } = recorder();
        expect(printSkills(library, testCase.request, log)).to.equal(testCase.exitCode);
        testCase.check(data, errors);
      });
    }

    it("fails when the install has no skills", () => {
      const { log, data, errors } = recorder();
      expect(printSkills(empty, { json: false }, log)).to.equal(1);
      expect(data).to.deep.equal([]);
      expect(errors).to.deep.equal(["No skills were found in this installation of Minecraft Creator Tools."]);
    });
  });

  describe("mct --help", () => {
    it("names the skills and how to read them", () => {
      const section = buildSkillsHelpSection(library)!;
      const help = section.paragraphs.join("\n");
      expect(section.title).to.equal("AGENT SKILLS");
      expect(help).to.include(library.skillNames.join(", "));
      expect(help).to.include("`mct skills`");
      expect(help).to.include("`mct skills <name>`");
      expect(help).to.include("`npx -y @minecraft/creator-tools@0.18.0 skills`");
      expect(
        buildSkillsHelpSection(new McpSkillLibrary(library.skills, "0.0.1-dev"))!.paragraphs.join("\n")
      ).to.include("`npx -y @minecraft/creator-tools@latest skills`");
    });

    it("leaves the section out when there are no skills", () => {
      expect(buildSkillsHelpSection(empty)).to.equal(undefined);
    });
  });
});

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
