---
page_type: sample
description: Minecraft Add-On project for Minecraft Creator Tools, used for testing and in-game integration.
languages:
  - typescript
products:
  - minecraft
---

# Minecraft Creator Tools — Minecraft Add-On Project

This folder contains a Minecraft: Bedrock Edition Add-On project used for in-game testing and development of Minecraft Creator Tools. It includes script modules, behavior packs, and resource packs that run inside Minecraft and the Minecraft Editor.

## Prerequisites

**Install Node.js tools, if you haven't already**

We're going to use the package manager [npm](https://www.npmjs.com/package/npm) to get more tools to make the process of building our project easier.

Visit [https://nodejs.org/](https://nodejs.org).

Download the version with "LTS" next to the number and install it. (LTS stands for Long Term Support, if you're curious.) In the Node.js Windows installer, accept the installation defaults. You do not need to install any additional tools for Native compilation.

**Install Visual Studio Code, if you haven't already**

Visit the [Visual Studio Code website](https://code.visualstudio.com) and install Visual Studio Code.

## Getting Started

1. Use npm to install dependent modules:

   ```powershell
   npm i
   ```

1. Use this shortcut command to open the project in Visual Studio Code:

   ```powershell
   code .
   ```

## Building and Deploying

Run the following to deploy to your local Minecraft installation:

```powershell
npm run local-deploy
```

Create an addon file to share:

```powershell
npm run mcaddon
```

## Manifest

- [scripts/](scripts/): TypeScript source for in-game Creator Tools logic.
- [behavior_packs/](behavior_packs/): Behavior pack resources and JSON definitions.
- [resource_packs/](resource_packs/): Resource pack assets.

## Security Note: `mct:eval` Command and `script_eval` Capability

The `creator_tools_ingame` behavior pack declares `"capabilities": ["script_eval"]` and registers an `mct:eval` custom command that evaluates JavaScript at runtime inside the Minecraft server scripting context. **This is an intentional developer/debug feature**, not a production capability.

- **Purpose:** Interactive debugging and rapid iteration during add-on development — inspect world state, test API calls, and evaluate expressions without reloading packs.
- **Access control:** The command is restricted to `CommandPermissionLevel.GameDirectors` (operator-only), and the Minecraft engine independently gates the `script_eval` manifest capability.
- **Scope:** Code executes within the existing server script sandbox with no privilege escalation beyond what a behavior pack script already has.
- **Not for end users:** This behavior pack is a development-time tool and is not intended to be shipped in end-user content.
