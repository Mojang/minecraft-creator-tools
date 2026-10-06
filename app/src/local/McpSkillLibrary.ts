// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Serves the Minecraft agent skills over MCP and the `mct skills` command, so anyone who runs the
 * MCP server or the CLI can get skills that match the CLI version they're running.
 *
 * Source: `plugins/minecraft/skills/<name>/SKILL.md` (plus `references/` and `scripts/`) at the
 * repo root. `gulp jsnbuild` copies it to `toolbuild/jsn/skills/`, so the npm package ships
 * `<package>/skills/` next to `<package>/cli/`. Each skill also has `agents/openai.yaml` and
 * `assets/` icons: display metadata for OpenAI clients that install skill folders directly. Only
 * markdown files are served here, so agents never see them.
 *
 * Delivery:
 * - `getSkill` tool (registered by `register()`): returns a skill's SKILL.md or one of its
 *   reference files. Its description summarizes every skill, which is how agents find them: tools
 *   work in every client, and some clients (Copilot CLI, for one) ignore server instructions from
 *   servers that aren't allowlisted.
 * - Server `instructions` (`buildInstructions()`): a short pointer to `getSkill` for clients that
 *   load instructions.
 * - `mct skills [name] [file]` (src/cli/commands/content/SkillsCommand.ts) lists and prints the same
 *   rendered text, and `mct --help` names the skills, so agents that only use the CLI can find them.
 *   Nothing is copied into agent skill folders.
 * - Not yet: prompts, and `skill://` resources from the MCP Skills extension (SEP-2640). The
 *   extension's `skills/list` and `skills/get` requests need a newer protocol revision than the SDK
 *   in use supports, and without them clients don't treat resources as skills.
 *
 * Text served over MCP or printed by `mct skills` is rewritten by `renderText()`:
 * - `<this-skill-folder>` and `<other-skill-name-skill-folder>` placeholders become absolute paths
 *   inside the installed package, so the bundled scripts can be run as written. Skills quote the
 *   whole script path (`node "<this-skill-folder>/scripts/x.mjs"`) so install paths with spaces
 *   work, and the path uses forward slashes, which every shell and Node accept on Windows too.
 *   Copies installed straight from GitHub (`npx skills add`) skip this rendering, so each skill also
 *   defines its placeholders in prose where they first appear ("`<this-skill-folder>` is the folder
 *   that contains this SKILL.md"). After rendering, that sentence names the absolute path instead,
 *   which is still true. McpSkillLibraryTest checks both forms.
 * - `@minecraft/creator-tools@<tag>` becomes the running release version (for example `@0.18.0`),
 *   so CLI commands in a skill run the same version as the server or CLI. Dev builds keep the
 *   source tag.
 */

import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import Log from "../core/Log";

export interface IMcpSkill {
  name: string;
  description: string;
  folderPath: string;
  /** Markdown files in the skill folder, relative to it with forward slashes. SKILL.md is first. */
  files: string[];
}

const SKILL_FILE = "SKILL.md";
const PACKAGE_REFERENCE = /@minecraft\/creator-tools@[^\s`"')\]]+/g;
const FOLDER_PLACEHOLDER = /<([a-z0-9-]+)-skill-folder>/g;
const RELEASE_VERSION = /^\d+\.\d+\.\d+$/;
const MAX_ANCESTOR_SEARCH_DEPTH = 8;

export default class McpSkillLibrary {
  readonly skills: IMcpSkill[];
  readonly cliVersion: string;

  constructor(skills: IMcpSkill[], cliVersion: string) {
    this.skills = skills;
    this.cliVersion = cliVersion;
  }

  get skillNames(): string[] {
    return this.skills.map((skill) => skill.name);
  }

  getSkill(name: string): IMcpSkill | undefined {
    return this.skills.find((skill) => skill.name === name);
  }

  /**
   * Finds the skills folder: `<package>/skills` when running from the npm package
   * (`startDir` is `<package>/cli`), otherwise `plugins/minecraft/skills` in an ancestor folder
   * (a repo checkout, including tests run from `app/src`). An installed package only uses its own
   * skills, so it never picks up a different version from a folder it happens to be inside.
   */
  static findSkillsRoot(startDir: string = __dirname): string | undefined {
    const packageSkills = path.resolve(startDir, "..", "skills");
    if (McpSkillLibrary.isSkillsRoot(packageSkills)) {
      return packageSkills;
    }
    if (fs.existsSync(path.resolve(startDir, "..", "package.json"))) {
      return undefined;
    }

    let dir = path.resolve(startDir);
    for (let i = 0; i < MAX_ANCESTOR_SEARCH_DEPTH; i++) {
      const candidate = path.join(dir, "plugins", "minecraft", "skills");
      if (McpSkillLibrary.isSkillsRoot(candidate)) {
        return candidate;
      }

      const parent = path.dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }

    return undefined;
  }

  static isSkillsRoot(folderPath: string): boolean {
    try {
      return fs
        .readdirSync(folderPath, { withFileTypes: true })
        .some((entry) => entry.isDirectory() && fs.existsSync(path.join(folderPath, entry.name, SKILL_FILE)));
    } catch {
      return false;
    }
  }

  /**
   * Loads every `<name>/SKILL.md` under the skills folder. Returns an empty library if none is found.
   * Never throws: a skill that can't be read is skipped and logged with Log.debug, so one damaged or
   * unreadable file can't stop `mct mcp` from starting or break `mct --help`.
   */
  static load(cliVersion: string, skillsRoot: string | undefined = McpSkillLibrary.findSkillsRoot()): McpSkillLibrary {
    const skills: IMcpSkill[] = [];

    let entries: fs.Dirent[] = [];
    if (skillsRoot) {
      try {
        entries = fs.readdirSync(skillsRoot, { withFileTypes: true });
      } catch (e) {
        Log.debug(`Could not read the skills folder ${skillsRoot}: ${McpSkillLibrary.errorMessage(e)}`);
      }
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const folderPath = path.join(skillsRoot!, entry.name);
      const skillFilePath = path.join(folderPath, SKILL_FILE);
      try {
        if (!fs.existsSync(skillFilePath)) {
          continue;
        }

        const { attributes } = McpSkillLibrary.parseFrontmatter(fs.readFileSync(skillFilePath, "utf8"));
        if (attributes.name !== entry.name || !attributes.description) {
          Log.debug(`Skipping skill "${entry.name}": SKILL.md needs a name matching its folder and a description.`);
          continue;
        }

        skills.push({
          name: attributes.name,
          description: attributes.description,
          folderPath,
          files: [SKILL_FILE, ...McpSkillLibrary.listMarkdownFiles(folderPath).filter((file) => file !== SKILL_FILE)],
        });
      } catch (e) {
        Log.debug(`Skipping skill "${entry.name}": ${McpSkillLibrary.errorMessage(e)}`);
      }
    }

    skills.sort((a, b) => a.name.localeCompare(b.name));
    return new McpSkillLibrary(skills, cliVersion);
  }

  private static errorMessage(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
  }

  /** Parses the single-line `key: value` YAML frontmatter used by SKILL.md files. */
  static parseFrontmatter(text: string): { attributes: Record<string, string>; body: string } {
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
    if (!match) {
      return { attributes: {}, body: text };
    }

    const attributes: Record<string, string> = {};
    for (const line of match[1].split(/\r?\n/)) {
      const separator = line.indexOf(":");
      if (separator <= 0 || /^\s/.test(line)) {
        continue;
      }

      let value = line.substring(separator + 1).trim();
      if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value[value.length - 1] === value[0]) {
        value = value.substring(1, value.length - 1);
      }
      attributes[line.substring(0, separator).trim()] = value;
    }

    return { attributes, body: text.substring(match[0].length) };
  }

  private static listMarkdownFiles(folderPath: string, relativeFolder = ""): string[] {
    const files: string[] = [];
    for (const entry of fs.readdirSync(path.join(folderPath, relativeFolder), { withFileTypes: true })) {
      const relativePath = relativeFolder ? `${relativeFolder}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        files.push(...McpSkillLibrary.listMarkdownFiles(folderPath, relativePath));
      } else if (entry.name.toLowerCase().endsWith(".md")) {
        files.push(relativePath);
      }
    }
    return files.sort();
  }

  /** The package tag CLI commands should use: the running release version, or undefined for dev builds. */
  get packageTag(): string | undefined {
    return RELEASE_VERSION.test(this.cliVersion) ? this.cliVersion : undefined;
  }

  renderText(text: string, skill: IMcpSkill): string {
    let rendered = text.replace(FOLDER_PLACEHOLDER, (placeholder, name: string) => {
      const target = name === "this" ? skill : this.getSkill(name);
      return target ? target.folderPath.replace(/\\/g, "/") : placeholder;
    });

    const tag = this.packageTag;
    if (tag) {
      rendered = rendered.replace(PACKAGE_REFERENCE, `@minecraft/creator-tools@${tag}`);
    }

    return rendered;
  }

  /** Normalizes a skill file argument (`./references/x.md`, `references\x.md`) to its listed form. */
  static normalizeFile(file: string): string {
    return file.replace(/\\/g, "/").replace(/^\.\//, "");
  }

  /**
   * Reads a skill file (SKILL.md by default) with frontmatter removed and placeholders rendered.
   * Only files listed in `skill.files` can be read, so `file` can't escape the skill folder. Returns
   * undefined when the file isn't listed or can't be read.
   */
  readFile(name: string, file: string = SKILL_FILE): string | undefined {
    const skill = this.getSkill(name);
    const normalizedFile = McpSkillLibrary.normalizeFile(file);
    if (!skill || !skill.files.includes(normalizedFile)) {
      return undefined;
    }

    let text: string;
    try {
      text = fs.readFileSync(path.join(skill.folderPath, ...normalizedFile.split("/")), "utf8");
    } catch (e) {
      Log.debug(`Could not read ${normalizedFile} in skill "${name}": ${McpSkillLibrary.errorMessage(e)}`);
      return undefined;
    }
    return this.renderText(McpSkillLibrary.parseFrontmatter(text).body.trim(), skill);
  }

  /** Short server instructions pointing agents to getSkill. Undefined when no skills were found. */
  buildInstructions(): string | undefined {
    if (this.skills.length === 0) {
      return undefined;
    }

    return (
      `Minecraft Creator Tools ${this.cliVersion} includes skills: tested, step-by-step guides for common Minecraft Bedrock add-on tasks. ` +
      "Before starting an add-on task, check the getSkill tool's description for a matching skill, call getSkill with its name, and follow the guide it returns."
    );
  }

  /** The getSkill tool description, which summarizes every skill so agents know when to use one. */
  buildToolDescription(): string {
    const lines = [
      "Returns a tested, step-by-step guide (skill) for a Minecraft Bedrock add-on task, matched to this version of Minecraft Creator Tools. Call it before starting one of these tasks, then follow the guide:",
    ];
    for (const skill of this.skills) {
      lines.push(`- ${skill.name}: ${McpSkillLibrary.firstSentence(skill.description)}`);
    }
    return lines.join("\n");
  }

  static firstSentence(text: string): string {
    const match = /^(.+?[.!?])(\s|$)/.exec(text);
    return match ? match[1] : text;
  }

  /**
   * Builds the getSkill (or `mct skills <name>`) response: the requested file plus where to find the
   * skill's other files. `otherFilesHint` says how to read those files from where the agent is.
   */
  buildSkillResponse(
    name: string,
    file?: string,
    otherFilesHint: string = "read with getSkill's file argument"
  ): { text: string; isError: boolean } {
    const skill = this.getSkill(name);
    if (!skill) {
      return {
        text: `Unknown skill "${name}". Available skills: ${this.skillNames.join(", ")}.`,
        isError: true,
      };
    }

    const requestedFile = McpSkillLibrary.normalizeFile(file || SKILL_FILE);
    const content = this.readFile(name, requestedFile);
    if (content === undefined) {
      return {
        text: `Skill "${name}" has no file "${requestedFile}". Available files: ${skill.files.join(", ")}.`,
        isError: true,
      };
    }

    const otherFiles = skill.files.filter((candidate) => candidate !== requestedFile);
    const header = [`Skill: ${skill.name} (${requestedFile})`, `Skill folder: ${skill.folderPath}`];
    if (otherFiles.length > 0) {
      header.push(`Other files (${otherFilesHint}): ${otherFiles.join(", ")}`);
    }

    return { text: `${header.join("\n")}\n\n${content}`, isError: false };
  }

  /** Registers the getSkill tool. Does nothing when no skills were found. */
  register(server: McpServer): void {
    if (this.skills.length === 0) {
      return;
    }

    const names = this.skillNames as [string, ...string[]];

    // Loosely typed for the same reason as MinecraftMcpServer._registerTool: the SDK's generic
    // zod typings are deep enough to slow down or break type-checking.
    const looseServer = server as unknown as { registerTool: (...args: unknown[]) => unknown };

    looseServer.registerTool(
      "getSkill",
      {
        title: "Get a Minecraft Creator Tools skill",
        description: this.buildToolDescription(),
        inputSchema: {
          name: z.enum(names).describe("Skill name."),
          file: z
            .string()
            .optional()
            .describe("A file inside the skill, such as references/behaviors.md. Defaults to SKILL.md."),
        },
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async (args: { name: string; file?: string }) => {
        const response = this.buildSkillResponse(args.name, args.file);
        return { content: [{ type: "text" as const, text: response.text }], isError: response.isError };
      }
    );
  }
}
