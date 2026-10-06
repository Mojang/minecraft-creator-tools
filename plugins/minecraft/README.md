# Minecraft Creator Tools skills

[![skills.sh](https://skills.sh/b/mojang/minecraft-creator-tools)](https://skills.sh/mojang/minecraft-creator-tools)

[Agent Skills](https://agentskills.io) for [Minecraft Creator Tools](https://aka.ms/mcthomepage). Ask your agent for what you want to make ("create a hostile swamp goblin", "why won't my add-on load?") and the skills handle the Bedrock Edition details: which files to create, how they connect, and how to check the result.

The MCP server gives the agent tools (create content, validate, design models). The skills teach it how to use them for common Minecraft tasks.

## Skills

| Skill                                                    | What it does                                                                                                           | Try asking                                                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [`create-mob`](skills/create-mob/SKILL.md)               | Creates a new mob or changes an existing one: health, attacks, AI behavior, taming, riding, drops, and spawning.       | "Make a rideable red panda." "Make my goblin scared of zombies."                              |
| [`create-item`](skills/create-item/SKILL.md)             | Creates or changes weapons, tools, food, armor, throwables, and crafting recipes.                                      | "Add a magic hammer that mines like an iron pickaxe." "Create ruby armor."                    |
| [`create-block`](skills/create-block/SKILL.md)           | Creates or changes blocks: light, mining time, drops, facing direction, and ore generation.                            | "Make a glowing mushroom block you can harvest." "Add a ruby ore that generates underground." |
| [`design-model`](skills/design-model/SKILL.md)           | Designs 3D models and textures for mobs, and draws pixel-art item icons and block textures.                            | "Make my beetle look like a beetle." "Draw a purple hammer icon."                             |
| [`debug-addon`](skills/debug-addon/SKILL.md)             | Validates an add-on, fixes what's wrong, explains Content Log errors, upgrades old add-ons, and packages a `.mcaddon`. | "Why won't my add-on load?" "Package my add-on to share."                                     |
| [`creator-tools-cli`](skills/creator-tools-cli/SKILL.md) | Picks and runs the right `mct` command, with a command reference generated from the CLI itself.                        | "Render my goblin model to a PNG." "Deploy my add-on to Minecraft."                           |

All skills target Minecraft: Bedrock Edition add-ons (behavior packs and resource packs), not Java Edition.

## How agents get the skills

The skills ship inside the [`@minecraft/creator-tools`](https://aka.ms/mctnpm) npm package, and its MCP server serves them. Add the server to your agent (command `npx`, arguments `-y @minecraft/creator-tools@latest mcp`; the [Creator Tools CLI readme](../../app/jsnode/README.md) has setup examples for common agents), and the agent gets a `getSkill` tool that returns each skill's guide and reference files. The tool's description lists the skills, so agents pick the right one on their own.

Agents that use the command line without the MCP server can find the skills too: `mct --help` names them, `mct skills` lists them, and `mct skills <name>` prints a skill's guide (`mct skills <name> <file>` prints one of its reference files). Nothing is copied into your agent's skill folders.

Either way, the skills match the installed version, with script paths filled in for that install. Requires Node.js 22 or later.

To keep copies in your agent's skill folders instead, install them from GitHub with the [`skills`](https://github.com/vercel-labs/skills) CLI: `npx skills add Mojang/minecraft-creator-tools`. These copies come from the public repo's `main` branch rather than an installed package, so refresh them with `npx skills update`. The create skills and `design-model` still need the MCP server.

### Install as a plugin

This folder is also an agent plugin named `minecraft`. It installs the skills and adds the MCP server (as `minecraft`) in one step:

- **GitHub Copilot CLI:** `copilot plugin marketplace add Mojang/minecraft-creator-tools`, then `copilot plugin install minecraft@creator-tools`.
- **Claude Code:** `/plugin marketplace add Mojang/minecraft-creator-tools`, then `/plugin install minecraft@creator-tools`.

With the plugin, you don't need to add the MCP server yourself. If you added it before, remove that entry (older setup instructions named it `minecraft-creator-tools`) so your agent doesn't see every tool twice.

## Things to know

- **Minecraft EULA.** Validation, fixes, and packaging don't need it. Creating projects from Creator Tools templates does; accept it yourself with `npx @minecraft/creator-tools@latest eula`. The skills never accept it for you.
- **Trying content in game.** Deploying straight into Minecraft (`mct deploy`) works on Windows. On other platforms, `npx @minecraft/creator-tools@latest view -i <folder>` opens a browser preview, and `exportaddon` builds a `.mcaddon` you can open on any device with Minecraft.
- **Generator workarounds.** The create skills include steps that work around gaps in Creator Tools 0.17's content generator (missing names and pack icons, some ignored fields). These steps will be removed as the generator is fixed.

## Coming next

- `add-script`: gameplay with the Script API (events, custom components, "make this interactive").
- `override-vanilla`: safe changes to vanilla mobs, loot, recipes, and spawning.
- Later: structure design, and testing in game once there are tools to deploy and read the Content Log.

## For contributors

Skills follow the [Agent Skills](https://agentskills.io) format. Test prompts and trigger tests live in [`plugins/evals`](../evals/README.md); run them after changing a skill. How the MCP server loads and serves the skills is described at the top of [McpSkillLibrary.ts](../../app/src/local/McpSkillLibrary.ts). After changing CLI commands or options, run `npm run update-cli-skill-reference` in `app/` to refresh the `creator-tools-cli` command list.

The [skills.sh page](https://skills.sh/mojang/minecraft-creator-tools) groups the skills into sections using `skills.sh.json` (kept in `toexternal/` in the internal repo), which the release copies to the public repo root. When you add, rename, or remove a skill, update its group there. skills.sh picks up changes the next time someone installs from the public repo.

A new skill also needs `agents/openai.yaml` (the name, short description, icon, and example prompt that ChatGPT and Codex show; copy an existing one) and copies of `assets/icon.png` and `assets/icon-small.png` from another skill. `npm run test-release-copy` (repo root) checks them.

### Plugin and registry manifests

Paths are relative to this folder unless they start with `/` (the repository root).

| File                                      | Used by                                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `plugin.json`, `mcp.json`                 | [Agent Plugins 1.0](https://agent-plugins.org) clients: Copilot CLI, VS Code                          |
| `.claude-plugin/plugin.json`, `.mcp.json` | Claude Code, and older Copilot clients                                                                |
| `assets/icon.png`                         | The 512×512 icon that `/server.json` links to                                                         |
| `/.claude-plugin/marketplace.json`        | The `creator-tools` marketplace                                                                       |
| `/server.json`                            | The [MCP Registry](https://registry.modelcontextprotocol.io) entry `net.minecraft/mcp`                |
| `mcpName` in `/app/jsnode/package.json`   | Tells the MCP Registry that the `@minecraft/creator-tools` npm package belongs to `net.minecraft/mcp` |

**Versions.** npm versions are set by semantic-release when the public repo is released; don't edit them. The plugin has its own version, bumped by hand in `plugin.json`, `.claude-plugin/plugin.json`, and `/.claude-plugin/marketplace.json` whenever the skills or manifests change in a way users should get. The plugin always runs `@minecraft/creator-tools@latest`, so server fixes don't need a plugin bump. Listings that pin a commit (such as awesome-copilot's) need a new submission after a bump.

**Publishing to the MCP Registry.** `/server.json` keeps the `0.0.0-semantically-released` placeholder. To publish after an npm release, set `version` and `packages[0].version` to the released version, sign in, and run `mcp-publisher publish`. The `net.minecraft` namespace is verified with a DNS TXT record on `minecraft.net`, so sign in with `mcp-publisher login dns --domain minecraft.net --private-key <key>`; in CI, read the key from a protected secret. npm has no `0.0.0-semantically-released` version, so if the version step is skipped, the registry's package check fails and nothing is published.
