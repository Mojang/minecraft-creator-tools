// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Tests for serving the agent skills over MCP (McpSkillLibrary): loading the repo's skills,
 * rendering text for the running version, and what an MCP client sees (instructions, the
 * getSkill tool, prompts, and skill:// resources).
 */

import { expect } from "chai";
import "mocha";
import * as childProcess from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import McpSkillLibrary from "../local/McpSkillLibrary";
import MinecraftMcpServer from "../local/MinecraftMcpServer";
import TestPaths from "./TestPaths";

const SKILLS_ROOT = path.join(TestPaths.repoRoot, "plugins", "minecraft", "skills");
const EXPECTED_SKILLS = [
  "create-block",
  "create-item",
  "create-mob",
  "creator-tools-cli",
  "debug-addon",
  "design-model",
];

/** Skill folder paths are rendered with forward slashes on every platform. */
function rendered(folderPath: string): string {
  return folderPath.replace(/\\/g, "/");
}

function textOf(result: object): string {
  const content = ((result as { content?: unknown }).content ?? []) as { type: string; text?: string }[];
  return content.map((item) => item.text ?? "").join("\n");
}

async function connect(server: McpServer): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "skills-test", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("McpSkillLibrary", () => {
  describe("loading", () => {
    const library = McpSkillLibrary.load("1.2.3", SKILLS_ROOT);

    it("loads every skill in plugins/minecraft/skills", () => {
      expect(library.skillNames).to.deep.equal(EXPECTED_SKILLS);
    });

    it("reads name and description from each SKILL.md", () => {
      for (const skill of library.skills) {
        expect(skill.description.length, skill.name).to.be.greaterThan(50);
        expect(path.basename(skill.folderPath)).to.equal(skill.name);
      }
    });

    it("lists SKILL.md first, then the skill's other markdown files", () => {
      expect(library.getSkill("create-mob")!.files).to.deep.equal(["SKILL.md", "references/behaviors.md"]);
      expect(library.getSkill("creator-tools-cli")!.files).to.deep.equal(["SKILL.md", "references/commands.md"]);
    });

    it("finds the repo's skills from app/src", () => {
      expect(McpSkillLibrary.findSkillsRoot(path.join(TestPaths.appRoot, "src", "local"))).to.equal(
        path.resolve(SKILLS_ROOT)
      );
    });
  });

  describe("findSkillsRoot", () => {
    let tempRoot: string;

    beforeEach(() => {
      tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mct-skills-"));
    });

    afterEach(() => {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    });

    it("prefers <package>/skills next to <package>/cli", () => {
      fs.mkdirSync(path.join(tempRoot, "cli"));
      fs.mkdirSync(path.join(tempRoot, "skills", "demo"), { recursive: true });
      fs.writeFileSync(path.join(tempRoot, "skills", "demo", "SKILL.md"), "---\nname: demo\ndescription: d\n---\n");

      expect(McpSkillLibrary.findSkillsRoot(path.join(tempRoot, "cli"))).to.equal(path.join(tempRoot, "skills"));
    });

    it("returns undefined, and load() returns an empty library, when there are no skills", () => {
      fs.mkdirSync(path.join(tempRoot, "cli"));
      expect(McpSkillLibrary.findSkillsRoot(path.join(tempRoot, "cli"))).to.equal(undefined);

      const empty = McpSkillLibrary.load("1.2.3", path.join(tempRoot, "cli"));
      expect(empty.skills).to.deep.equal([]);
      expect(empty.buildInstructions()).to.equal(undefined);
    });

    it("skips skills whose name doesn't match their folder", () => {
      fs.mkdirSync(path.join(tempRoot, "demo"));
      fs.writeFileSync(path.join(tempRoot, "demo", "SKILL.md"), "---\nname: other\ndescription: d\n---\n");

      expect(McpSkillLibrary.load("1.2.3", tempRoot).skills).to.deep.equal([]);
    });

    it("skips a skill it can't read and keeps the others, instead of throwing", () => {
      fs.mkdirSync(path.join(tempRoot, "good"));
      fs.writeFileSync(path.join(tempRoot, "good", "SKILL.md"), "---\nname: good\ndescription: d\n---\n# Good");
      // A folder where SKILL.md should be makes readFileSync fail (EISDIR) on every platform.
      fs.mkdirSync(path.join(tempRoot, "broken", "SKILL.md"), { recursive: true });

      const library = McpSkillLibrary.load("1.2.3", tempRoot);
      expect(library.skillNames).to.deep.equal(["good"]);

      fs.rmSync(path.join(tempRoot, "good", "SKILL.md"));
      expect(library.readFile("good")).to.equal(undefined);
      expect(library.buildSkillResponse("good").isError).to.equal(true);
    });

    it("doesn't search parent folders from an installed package", () => {
      fs.mkdirSync(path.join(tempRoot, "pkg", "cli"), { recursive: true });
      fs.writeFileSync(path.join(tempRoot, "pkg", "package.json"), "{}");
      fs.mkdirSync(path.join(tempRoot, "plugins", "minecraft", "skills", "demo"), { recursive: true });
      fs.writeFileSync(
        path.join(tempRoot, "plugins", "minecraft", "skills", "demo", "SKILL.md"),
        "---\nname: demo\ndescription: d\n---\n"
      );

      expect(McpSkillLibrary.findSkillsRoot(path.join(tempRoot, "pkg", "cli"))).to.equal(undefined);
      fs.rmSync(path.join(tempRoot, "pkg", "package.json"));
      expect(McpSkillLibrary.findSkillsRoot(path.join(tempRoot, "pkg", "cli"))).to.equal(
        path.join(tempRoot, "plugins", "minecraft", "skills")
      );
    });
  });

  describe("tool description", () => {
    it("summarizes every skill, since some clients ignore server instructions", () => {
      const library = McpSkillLibrary.load("1.2.3", SKILLS_ROOT);
      const description = library.buildToolDescription();
      for (const skill of library.skills) {
        expect(description).to.include(`- ${skill.name}: ${McpSkillLibrary.firstSentence(skill.description)}`);
      }
    });

    const cases: { text: string; expected: string }[] = [
      { text: "Does one thing. Then another.", expected: "Does one thing." },
      { text: "Uses v1.2 files, then stops. More.", expected: "Uses v1.2 files, then stops." },
      { text: "No trailing period", expected: "No trailing period" },
    ];
    for (const testCase of cases) {
      it(`firstSentence: ${testCase.text}`, () => {
        expect(McpSkillLibrary.firstSentence(testCase.text)).to.equal(testCase.expected);
      });
    }
  });

  describe("parseFrontmatter", () => {
    const cases: { title: string; text: string; attributes: Record<string, string>; body: string }[] = [
      {
        title: "plain values",
        text: "---\nname: demo\ndescription: Does things: well.\n---\n# Body\n",
        attributes: { name: "demo", description: "Does things: well." },
        body: "# Body\n",
      },
      {
        title: "quoted values and CRLF line endings",
        text: "---\r\nname: \"demo\"\r\ndescription: 'Quoted'\r\n---\r\nBody",
        attributes: { name: "demo", description: "Quoted" },
        body: "Body",
      },
      { title: "no frontmatter", text: "# Just a body", attributes: {}, body: "# Just a body" },
    ];

    for (const testCase of cases) {
      it(testCase.title, () => {
        const parsed = McpSkillLibrary.parseFrontmatter(testCase.text);
        expect(parsed.attributes).to.deep.equal(testCase.attributes);
        expect(parsed.body).to.equal(testCase.body);
      });
    }
  });

  describe("renderText", () => {
    const skill = { name: "create-mob", description: "d", folderPath: "/pkg/skills/create-mob", files: ["SKILL.md"] };
    const debugAddon = { name: "debug-addon", description: "d", folderPath: "/pkg/skills/debug-addon", files: [] };

    const cases: { title: string; version: string; input: string; expected: string }[] = [
      {
        title: "pins package references to a release version",
        version: "0.18.0",
        input: "Run `npx -y @minecraft/creator-tools@latest validate` or `npx @minecraft/creator-tools@0.17.8 eula`.",
        expected:
          "Run `npx -y @minecraft/creator-tools@0.18.0 validate` or `npx @minecraft/creator-tools@0.18.0 eula`.",
      },
      {
        title: "keeps package references in a dev build",
        version: "0.0.1-dev",
        input: "npx -y @minecraft/creator-tools@latest mcp",
        expected: "npx -y @minecraft/creator-tools@latest mcp",
      },
      {
        title: "keeps package references before semantic-release stamps the version",
        version: "0.0.0-semantically-released",
        input: "(`npx -y @minecraft/creator-tools@latest view`)",
        expected: "(`npx -y @minecraft/creator-tools@latest view`)",
      },
      {
        title: "replaces skill folder placeholders",
        version: "0.0.1-dev",
        input: "node <this-skill-folder>/a.mjs && node <debug-addon-skill-folder>/scripts/b.mjs <unknown-skill-folder>",
        expected:
          "node /pkg/skills/create-mob/a.mjs && node /pkg/skills/debug-addon/scripts/b.mjs <unknown-skill-folder>",
      },
    ];

    for (const testCase of cases) {
      it(testCase.title, () => {
        const library = new McpSkillLibrary([skill, debugAddon], testCase.version);
        expect(library.renderText(testCase.input, skill)).to.equal(testCase.expected);
      });
    }

    const installs: { title: string; root: string; expected: string }[] = [
      {
        title: "a POSIX install path with spaces",
        root: "/Users/Jane Doe/my project/node_modules/@minecraft/creator-tools/skills",
        expected: "/Users/Jane Doe/my project/node_modules/@minecraft/creator-tools/skills",
      },
      {
        title: "a Windows install path with spaces",
        root: "C:\\Users\\Jane Doe\\AppData\\Roaming\\npm\\node_modules\\@minecraft\\creator-tools\\skills",
        expected: "C:/Users/Jane Doe/AppData/Roaming/npm/node_modules/@minecraft/creator-tools/skills",
      },
    ];

    for (const install of installs) {
      it(`quotes every script path in every skill file for ${install.title}`, () => {
        const real = McpSkillLibrary.load("0.18.0", SKILLS_ROOT);
        const separator = install.root.includes("\\") ? "\\" : "/";
        const moved = new McpSkillLibrary(
          real.skills.map((candidate) => ({ ...candidate, folderPath: install.root + separator + candidate.name })),
          "0.18.0"
        );
        let scriptCommands = 0;

        for (const original of real.skills) {
          const target = moved.getSkill(original.name)!;
          for (const file of original.files) {
            const text = fs.readFileSync(path.join(original.folderPath, ...file.split("/")), "utf8");
            const output = moved.renderText(text, target);

            expect(output, `${original.name}/${file}`).not.to.match(/<[a-z0-9-]+-skill-folder>/);
            for (const line of output.split("\n").filter((candidate) => /\bnode\s+\S*\.mjs|\.mjs"/.test(candidate))) {
              if (!line.includes(install.expected)) {
                continue;
              }
              scriptCommands++;
              expect(line, `${original.name}/${file}`).to.match(
                new RegExp(
                  `node "${install.expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[a-z0-9-]+/scripts/[a-z0-9-]+\\.mjs"`
                )
              );
            }
          }
        }

        expect(scriptCommands, "script commands found").to.equal(6);
      });
    }
  });

  /**
   * `npx skills add` copies the raw skill folders without renderText(), so each skill defines its
   * folder placeholders in prose before using them, and following that definition must reach a real
   * script, including in a sibling skill's folder.
   */
  describe("raw installs (npx skills add)", () => {
    const PLACEHOLDER = /<([a-z0-9-]+)-skill-folder>/g;
    const SCRIPT_COMMAND = /node "<([a-z0-9-]+)-skill-folder>\/([^"]+)"/g;
    const library = McpSkillLibrary.load("0.18.0", SKILLS_ROOT);
    const debugAddonFolder = rendered(path.join(SKILLS_ROOT, "debug-addon"));

    function definitionOf(placeholderName: string): string {
      return placeholderName === "this"
        ? "`<this-skill-folder>` is the folder that contains this SKILL.md"
        : `\`<${placeholderName}-skill-folder>\` is the ${placeholderName} skill's folder, next to this skill's folder`;
    }

    it("defines each placeholder in prose before its first command", () => {
      let filesWithPlaceholders = 0;

      for (const skill of library.skills) {
        for (const file of skill.files) {
          const lines = fs.readFileSync(path.join(skill.folderPath, ...file.split("/")), "utf8").split("\n");
          const seen = new Set<string>();
          let inFence = false;

          for (const line of lines) {
            if (line.trimStart().startsWith("```")) {
              inFence = !inFence;
              continue;
            }
            for (const match of line.matchAll(PLACEHOLDER)) {
              const placeholderName = match[1];
              if (seen.has(placeholderName)) {
                continue;
              }
              seen.add(placeholderName);
              const where = `${skill.name}/${file}: first <${placeholderName}-skill-folder>`;
              expect(inFence, `${where} is inside a code block`).to.equal(false);
              expect(line, where).to.include(definitionOf(placeholderName));
            }
          }

          if (seen.size > 0) {
            filesWithPlaceholders++;
          }
        }
      }

      expect(filesWithPlaceholders, "files with placeholders").to.equal(4);
    });

    it("resolves every script command to a script that starts, in a copied skills folder", () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mct-raw-skills-"));
      const installRoot = path.join(tempRoot, "Agent Skills", ".agents", "skills");
      let scriptCommands = 0;

      try {
        fs.cpSync(SKILLS_ROOT, installRoot, { recursive: true });
        const installed = McpSkillLibrary.load("0.18.0", installRoot);
        expect(installed.skillNames).to.deep.equal(EXPECTED_SKILLS);

        for (const skill of installed.skills) {
          for (const file of skill.files) {
            const text = fs.readFileSync(path.join(skill.folderPath, ...file.split("/")), "utf8");
            for (const match of text.matchAll(SCRIPT_COMMAND)) {
              const [, placeholderName, scriptPath] = match;
              const folder =
                placeholderName === "this"
                  ? skill.folderPath
                  : path.join(path.dirname(skill.folderPath), placeholderName);
              const script = path.join(folder, ...scriptPath.split("/"));
              const where = `${skill.name}/${file}: ${match[0]}`;

              expect(fs.existsSync(script), `${where} -> ${script}`).to.equal(true);
              const check = childProcess.spawnSync(process.execPath, ["--check", script], { encoding: "utf8" });
              expect(check.status, `${where}\n${check.stderr}`).to.equal(0);
              scriptCommands++;
            }
          }
        }
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }

      expect(scriptCommands, "script commands found").to.equal(6);
    });

    const renderedDefinitions: { skill: string; expected: string }[] = [
      { skill: "debug-addon", expected: `\`${debugAddonFolder}\` is the folder that contains this SKILL.md` },
      ...["create-block", "create-item", "create-mob"].map((skill) => ({
        skill,
        expected: `\`${debugAddonFolder}\` is the debug-addon skill's folder, next to this skill's folder`,
      })),
    ];

    for (const testCase of renderedDefinitions) {
      it(`still reads correctly once getSkill and mct skills fill in the path for ${testCase.skill}`, () => {
        expect(library.readFile(testCase.skill)).to.include(testCase.expected);
      });
    }
  });

  describe("readFile", () => {
    const library = McpSkillLibrary.load("0.18.0", SKILLS_ROOT);

    it("returns the body without frontmatter, rendered for this version", () => {
      const text = library.readFile("debug-addon")!;
      expect(text.startsWith("# Debug a Minecraft Bedrock add-on")).to.equal(true);
      expect(text).to.include("@minecraft/creator-tools@0.18.0");
      expect(text).not.to.include("<this-skill-folder>");
      expect(text).to.include(`node "${rendered(path.join(SKILLS_ROOT, "debug-addon"))}/scripts/validate-summary.mjs"`);
    });

    for (const file of ["../create-mob/SKILL.md", "/etc/passwd", "scripts/validate-summary.mjs", "missing.md"]) {
      it(`refuses ${file}`, () => {
        expect(library.readFile("debug-addon", file)).to.equal(undefined);
      });
    }
  });

  describe("over MCP", () => {
    let client: Client;

    before(async () => {
      const library = McpSkillLibrary.load("0.18.0", SKILLS_ROOT);
      const server = new McpServer({ name: "test", version: "1.0.0" }, { instructions: library.buildInstructions() });
      library.register(server);
      client = await connect(server);
    });

    after(async () => {
      await client.close();
    });

    it("sends short instructions that point to getSkill", () => {
      const instructions = client.getInstructions() ?? "";
      expect(instructions).to.include("Minecraft Creator Tools 0.18.0 includes skills");
      expect(instructions).to.include("call getSkill");
      expect(instructions.length).to.be.lessThan(500);
    });

    it("exposes only a read-only getSkill tool that lists every skill", async () => {
      const tools = (await client.listTools()).tools;
      expect(tools.map((candidate) => candidate.name)).to.deep.equal(["getSkill"]);
      expect(tools[0].annotations?.readOnlyHint).to.equal(true);
      expect((tools[0].inputSchema.properties as any).name.enum).to.deep.equal(EXPECTED_SKILLS);
      for (const name of EXPECTED_SKILLS) {
        expect(tools[0].description).to.include(`- ${name}: `);
      }
    });

    it("getSkill returns the rendered guide and lists the skill's other files", async () => {
      const result = await client.callTool({ name: "getSkill", arguments: { name: "create-mob" } });
      const text = textOf(result);

      expect(result.isError).to.equal(false);
      expect(text).to.include("Skill: create-mob (SKILL.md)");
      expect(text).to.include(`Skill folder: ${path.join(SKILLS_ROOT, "create-mob")}`);
      expect(text).to.include("Other files (read with getSkill's file argument): references/behaviors.md");
      expect(text).to.include(
        `node "${rendered(path.join(SKILLS_ROOT, "debug-addon"))}/scripts/add-missing-names.mjs"`
      );
      expect(text).not.to.match(/<[a-z-]+-skill-folder>/);
      expect(text).not.to.match(/^---\nname:/m);
    });

    it("getSkill reads reference files and reports unknown ones", async () => {
      const reference = await client.callTool({
        name: "getSkill",
        arguments: { name: "creator-tools-cli", file: "references/commands.md" },
      });
      expect(reference.isError).to.equal(false);
      expect(textOf(reference)).to.include("#### `validate [suite]");

      const missing = await client.callTool({ name: "getSkill", arguments: { name: "create-mob", file: "nope.md" } });
      expect(missing.isError).to.equal(true);
      expect(textOf(missing)).to.include("Available files: SKILL.md, references/behaviors.md");
    });
  });

  describe("Electron packaging", () => {
    it("unpacks the skills next to the CLI, so the MCP child process can load and run them", () => {
      /* eslint-disable @typescript-eslint/no-var-requires */
      const forgeConfig = require(path.join(TestPaths.appRoot, "forge.config.js"));
      // @electron/asar decides what to unpack with minimatch(file, unpack, { matchBase: true }), so use
      // the same minimatch it loads.
      const minimatch: (file: string, pattern: string, options: object) => boolean = require(
        require.resolve("minimatch", { paths: [path.dirname(require.resolve("@electron/asar"))] })
      );
      /* eslint-enable @typescript-eslint/no-var-requires */
      const unpack: string = forgeConfig.packagerConfig.asar.unpack;
      const appRoot = "/resources/app";

      for (const file of [
        "toolbuild/jsn/cli/index.mjs",
        "toolbuild/jsn/package.json",
        "toolbuild/jsn/skills/debug-addon/SKILL.md",
        "toolbuild/jsn/skills/debug-addon/scripts/validate-summary.mjs",
        "toolbuild/jsn/skills/creator-tools-cli/references/commands.md",
      ]) {
        expect(minimatch(`${appRoot}/${file}`, unpack, { matchBase: true }), file).to.equal(true);
      }
    });
  });

  describe("MinecraftMcpServer", () => {
    it("sends skill instructions and registers getSkill", async () => {
      const mcpServer = new MinecraftMcpServer();
      const internals = mcpServer as unknown as { _server: McpServer; _skills: McpSkillLibrary };
      internals._skills.register(internals._server);

      const client = await connect(internals._server);
      try {
        expect(client.getInstructions() ?? "").to.include("call getSkill");
        const tools = (await client.listTools()).tools.map((tool) => tool.name);
        expect(tools).to.include("getSkill");
      } finally {
        await client.close();
      }
    });
  });
});
