<h1 align="center">Minecraft Creator Tools</h1>

<p align="center">
  <strong>From idea to playable.</strong>
</p>

<p align="center">
  Create, preview, validate, and ship Minecraft add-ons from the CLI, browser, or your AI coding agent.
</p>

<p align="center">
  <a href="https://learn.microsoft.com/minecraft/creator/documents/mctoolsoverview"><strong>Documentation</strong></a> ·
  <a href="https://mctools.dev"><strong>Web Editor</strong></a> ·
  <a href="https://github.com/Mojang/minecraft-creator-tools/releases"><strong>Changelog</strong></a> ·
  <a href="https://aka.ms/mcthomepage"><strong>GitHub</strong></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@minecraft/creator-tools"><img src="https://img.shields.io/npm/v/@minecraft/creator-tools" alt="npm version"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" alt="Node.js 22+"></a>
  <a href="https://aka.ms/mctlicense"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
  <a href="https://skills.sh/mojang/minecraft-creator-tools"><img src="https://skills.sh/b/mojang/minecraft-creator-tools" alt="skills.sh installs"></a>
</p>
<br/>

<p align="center">
  <img src="https://raw.githubusercontent.com/Mojang/minecraft-creator-tools/main/misc/readme/mct-preview.png" width="640" alt="Minecraft Creator Tools editor showing a custom mob with a 3D model preview and its behaviors">
</p>

## Install

Requires Node.js 22+ and npm 10+.

```bash
npm install -g @minecraft/creator-tools
```

Or run without installing: `npx @minecraft/creator-tools <command>`.

## Quick Start

```bash
# 1. Accept the Minecraft EULA (one time)
mct eula

# 2. Scaffold a project from a template
mct create -o ./my-addon

# 3. Add a mob, starting from the cow template
mct add cow my_cow -i ./my-addon

# 4. Check it against Minecraft rules
mct validate -i ./my-addon

# 5. Preview it in your browser
mct view -i ./my-addon

# 6. Open it in a Minecraft test world
mct deploy retail -i ./my-addon --test-world --launch
```

Run `mct add --list-types` to see the other mobs, blocks, and items you can start from. Deploying into Minecraft requires Windows with Minecraft installed. When `-i` is omitted, commands use the current folder or the nearest project folder above it.

## Popular Commands

| Command    | What it does                                                            |
| :--------- | :---------------------------------------------------------------------- |
| `create`   | Create a new project from a template.                                   |
| `add`      | Add an entity, block, item, and more to a project.                      |
| `validate` | Check a project against Minecraft rules.                                |
| `edit`     | Open a browser UI to visually edit content.                             |
| `deploy`   | Copy packs to Minecraft, Minecraft Preview, a server, or a custom path. |
| `mcp`      | Run as an MCP server for AI assistants.                                 |

<details>
<summary><strong>More commands</strong></summary>

- **Project:** `create` · `add` · `fix` · `set` · `setup` · `deploy` · `exportaddon` · `exportworld`
- **Validation:** `validate` · `search` · `aggregatereports`
- **Content:** `view` · `edit` · `autotest`
- **Server:** `serve` · `mcp` · `dedicatedserve` · `passcodes` · `setserverprops` · `eula`
- **Render:** `rendervanilla` · `rendermodel` · `renderstructure` · `renderbatch` · `buildstructure`
- **World:** `world` · `ensureworld`
- **Information:** `info` · `version` · `skills`

</details>

Run `mct --help` to list commands, `mct <command> --help` for details, or `mct --all-commands` to see everything.

## Set up MCP for your AI assistant

`mct mcp` is a [Model Context Protocol](https://modelcontextprotocol.io/) server that lets AI assistants create, validate, and design Bedrock content for you. If you haven't already, run `mct eula` to accept the Minecraft EULA.

Then add the server to your assistant. For setups without `-i`, start your assistant from inside your project folder.

<details>
<summary><strong>VS Code (GitHub Copilot)</strong></summary>

Add `.vscode/mcp.json` to your project:

```json
{
  "servers": {
    "minecraft": {
      "type": "stdio",
      "command": "mct",
      "args": ["mcp", "-i", "${workspaceFolder}"]
    }
  }
}
```

</details>

<details>
<summary><strong>GitHub Copilot CLI</strong></summary>

Run `/mcp add` inside Copilot CLI, or add this to `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "minecraft": {
      "type": "local",
      "command": "mct",
      "args": ["mcp"],
      "tools": ["*"]
    }
  }
}
```

</details>

<details>
<summary><strong>Claude Code</strong></summary>

```bash
claude mcp add minecraft -- mct mcp
```

</details>

<details>
<summary><strong>OpenAI Codex</strong></summary>

```bash
codex mcp add minecraft -- mct mcp
```

</details>

<details>
<summary><strong>Cursor, Claude Desktop, and other clients</strong></summary>

Most clients accept an `mcpServers` entry like this. Point `-i` at your project folder:

```json
{
  "mcpServers": {
    "minecraft": {
      "command": "mct",
      "args": ["mcp", "-i", "/path/to/my-addon"]
    }
  }
}
```

</details>

Then ask your assistant something like: _"Make a hostile swamp goblin that spawns at night, and show me what it looks like."_

## Skills for AI assistants

Creator Tools includes skills: step-by-step guides that show your assistant how to create mobs, items, and blocks, design models, fix and package add-ons, and run `mct` commands. They match your installed version.

- **With the MCP server**, your assistant reads them with the `getSkill` tool. You don't need to set anything up.
- **With only the command line**, `mct --help` names them, `mct skills` lists them, and `mct skills <name>` prints one. Add `--json` for machine-readable output.
- **In your assistant's skills folder**, run `npx skills add Mojang/minecraft-creator-tools` to install them. These copies come from GitHub rather than your installed version, so refresh them with `npx skills update`. The skills for creating content still need the MCP server.

Found a bug? [Report an issue](https://aka.ms/mctbugs).

**Good luck, have fun!**

---

## Legal

Copyright (c) 2026 Mojang AB. Licensed under the [MIT License](https://aka.ms/mctlicense).

This code is currently in pre-release alpha state.

### Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft trademarks or logos is subject to and must follow [Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/legal/intellectualproperty/trademarks/usage/general). Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship. Any use of third-party trademarks or logos are subject to those third-party’s policies.
