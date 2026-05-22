# Minecraft Creator Tools readme

### Copyright (c) 2026 Mojang AB

```
┌─────┐
│ ▄ ▄ │   Minecraft Creator Tools
│ ┌▀┐ │
└─────┘
```

- [License](LICENSE.md)
- [Changelog](CHANGELOG.md)

Minecraft Creator Tools (MCT) helps you build, validate, and manage Minecraft: Bedrock Edition add-on projects — from first-time creators to professional content studios. This extension brings MCT into Visual Studio Code as a chat participant, a set of language model tools for GitHub Copilot, and an embedded Model Context Protocol (MCP) server.

## What you can do in VS Code

### Chat with `@minecraft`

Use the `@minecraft` chat participant in the Copilot Chat view to get help with your Bedrock project:

- `@minecraft /validate` — Validate your Minecraft project for errors, warnings, and recommendations.
- `@minecraft /create` — Create new Minecraft content (entities, blocks, items, recipes, loot tables, and more).
- `@minecraft /explain` — Explain the currently open Minecraft file.
- `@minecraft /fix` — Find and fix issues in your Minecraft content.

### GitHub Copilot Agent mode (MCP)

MCT exposes a rich set of tools to GitHub Copilot (and any MCP-compatible assistant) so you can drive real project work from chat:

- **Project scaffolding** — Create complete add-on projects from templates (behavior pack, resource pack, script starter, editor starter, and more).
- **Content generation** — Add entities, blocks, items, attachables, recipes, loot tables, spawn rules, feature rules, biomes, animations, animation controllers, render controllers, and fog/lighting/PBR definitions.
- **Project analysis** — Inspect existing projects, infer their structure, and generate documentation.
- **Validation** — Run the full MCT validator over a project or a single file and get structured results.
- **3D model design** — Generate Bedrock-compatible geometry and textures for entities, blocks, and items, with automatic wiring to the matching content files. Starter templates are available for humanoids, animals, vehicles, birds, fish, blocks, items, and more.
- **Structure design** — Create `.mcstructure` files describing block volumes directly from chat.
- **Minecraft session management** — Register running Bedrock Dedicated Server slots as named sessions, create new sessions, and run commands against live servers (including teleporting players) for rapid iteration.
- **Local-first** — Validation and generation run locally against your workspace, so your content stays on your machine.

### Explorer integration

The **Minecraft Creator Tools** view in the Explorer surfaces your add-on projects, validation results, and quick actions for common authoring tasks.

## Getting started

1. Open a folder that contains (or will contain) a Minecraft Bedrock add-on project.
2. Open the Copilot Chat view and try `@minecraft /validate`, or switch to **Agent** mode and ask for something like _"Create a new Minecraft add-on project called my_addon"_ or _"Add a custom block called rainbow_ore."_
3. For full MCP setup details (including using MCT from outside VS Code), see the [Getting Started with MCP](https://github.com/Mojang/minecraft-creator-tools-internal/blob/main/docs/McpGettingStarted.md) guide.

**Good luck, have fun!**
