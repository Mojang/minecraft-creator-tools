# Minecraft Creator Tools

### Copyright (c) 2026 Mojang AB. Licensed under the MIT License.

- [License](https://aka.ms/mctlicense)
- [GitHub](https://aka.ms/mcthomepage)
- [Report an Issue](https://aka.ms/mctbugs)
- [Changelog](CHANGELOG.md)

This code is currently in pre-release alpha state.

See the public docs at [https://learn.microsoft.com/minecraft/creator/documents/mctoolsoverview](https://learn.microsoft.com/minecraft/creator/documents/mctoolsoverview) for more.

## Getting Started

Requires Node.js 22+ and npm 10+.

```bash
npx mct
```

Displays default information and available commands.

Use `--help` with any command for detailed usage, or `--all-commands` to see internal/advanced commands.

---

## Commands

### Validation

| Command            | Aliases | Description                                                                                                                   |
| ------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `validate`         | `val`   | Validate a Minecraft project against a suite of rules. Supports suites: `all`, `default`, `addon`, `currentplatform`, `main`. |
| `search`           | `s`     | Search a content index for matching items by term or annotation category.                                                     |
| `aggregatereports` | `aggr`  | Aggregate exported metadata across multiple projects. Optionally builds a content index.                                      |

```bash
npx mct validate -i d:\mycontent\myprojectfolder
npx mct validate addon -i d:\mycontent\myprojectfolder -v
```

### Project

| Command       | Aliases | Description                                                                                                                                        |
| ------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create`      | `c`     | Create a new Minecraft project from a template. Prompts interactively for name, template, creator, and description.                                |
| `add`         | `a`     | Add new content to an existing project (entity, block, item, spawnLootRecipes, worldGen, visuals, singleFiles).                                    |
| `fix`         | —       | Apply automated fixes: `latestbetascriptversion`, `randomizealluids`, `setnewestformatversions`, `setnewestminengineversion`.                      |
| `set`         | —       | Set a project property (`name`, `title`, `description`, `bpscriptentrypoint`, `bpuuid`, `rpuuid`).                                                 |
| `info`        | `i`     | Display information about the current project.                                                                                                     |
| `setup`       | —       | Ensure project configuration files are up to date and healthy.                                                                                     |
| `deploy`      | `dp`    | Copy project files to a destination: `mcuwp` (Bedrock), `mcpreview` (Preview), `server`, or a custom path. Supports `--test-world` and `--launch`. |
| `exportaddon` | —       | Package the project into an `.mcaddon` file.                                                                                                       |
| `exportworld` | —       | Export a flat GameTest `.mcworld` file for the project's behavior packs.                                                                           |

```bash
npx mct create
npx mct add entity -i d:\mycontent\myprojectfolder
npx mct fix latestbetascriptversion -i d:\mycontent\myprojectfolder
npx mct deploy mcuwp -i d:\mycontent\myprojectfolder --test-world --launch
npx mct exportaddon -i d:\mycontent\myprojectfolder -o d:\output
```

### Content Viewing & Editing

| Command | Aliases | Description                                                                                                                     |
| ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `view`  | —       | Open a read-only web browser UI to inspect Minecraft content with 3D previews, component inspector, and more.                   |
| `edit`  | —       | Open a read-write web browser UI to edit Minecraft content with visual editors at three experience levels (Focused, Full, Raw). |

```bash
npx mct view -i d:\mycontent\myprojectfolder
npx mct edit -i d:\mycontent\myprojectfolder
```

### Server

| Command                            | Aliases            | Description                                                                                                                                   |
| ---------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `serve`                            | `server`           | Start a web server with optional Bedrock Dedicated Server integration. Features include a map renderer, command tools, and player management. |
| `mcp`                              | —                  | Run as a local MCP (Model Context Protocol) server for AI tool integration.                                                                   |
| `dedicatedserve`                   | `bds`, `dedicated` | Start only the Bedrock Dedicated Server without the web UI.                                                                                   |
| `passcodes`                        | `pc`               | Display active passcodes for web server authentication.                                                                                       |
| `setserverprops`                   | `serverprops`      | Display or set server properties (`--domain`, `--port`, `--title`, `--motd`).                                                                 |
| `minecrafteulaandprivacystatement` | `eula`             | View and accept the Minecraft End User License Agreement.                                                                                     |

```bash
npx mct serve --adminpc mypassword --port 6126
npx mct serve --source-server-path "C:\BDS" --adminpc mypassword
npx mct mcp -i d:\mycontent\myprojectfolder
npx mct setserverprops --domain 10.0.0.6 --port 80
```

### Render

| Command           | Aliases                 | Description                                                                                                                   |
| ----------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `rendermodel`     | `rm`                    | Render a model geometry file (`.geo.json`) from the project to a PNG image.                                                   |
| `rendervanilla`   | `rv`                    | Render vanilla Minecraft blocks, mobs, or items to PNG images. Supports batch via comma-separated identifiers or `@filename`. |
| `renderstructure` | `renstruct`, `renderst` | Render an `.mcstructure` file to a PNG image.                                                                                 |
| `buildstructure`  | `buildstruct`           | Build an `.mcstructure` file from IBlockVolume JSON. Supports stdin input with `-`.                                           |

```bash
npx mct rendervanilla mob minecraft:creeper -o creeper.png
npx mct rendervanilla block minecraft:stone,minecraft:dirt -o blocks/
npx mct rendermodel mymodel.geo.json -i d:\mycontent\myprojectfolder
npx mct buildstructure input.json output.mcstructure --preview preview.png
```

### World

| Command           | Aliases      | Description                                                                                     |
| ----------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| `world`           | —            | Display or modify world settings (beta APIs, editor mode, data-driven items, associated packs). |
| `ensureworld`     | —            | Create or ensure a flat GameTest world exists for a project.                                    |
| `deploytestworld` | `deploytest` | Deploy a test world with project packs to Minecraft. Supports `--launch`.                       |

```bash
npx mct world -i d:\mycontent\myworld
npx mct world set -i d:\mycontent\myworld --betaApis true
npx mct deploytestworld -i d:\mycontent\myprojectfolder --launch
```

### Info

| Command   | Aliases    | Description                           |
| --------- | ---------- | ------------------------------------- |
| `version` | `ver`, `v` | Display version and path information. |

---

## Global Options

These options are available with all commands:

| Option                       | Description                                    |
| ---------------------------- | ---------------------------------------------- |
| `-i, --input-folder <path>`  | Input project folder                           |
| `-o, --output-folder <path>` | Output folder for results                      |
| `-v, --verbose`              | Verbose output                                 |
| `-q, --quiet`                | Quiet mode (suppresses non-error output)       |
| `--json`                     | JSON output format                             |
| `--debug`                    | Enable debug mode                              |
| `--force`                    | Force operation without confirmation           |
| `--dry-run`                  | Show what would be done without making changes |
| `--threads <n>`              | Number of parallel worker threads              |
| `--all-commands`             | Show all commands including internal ones      |

---

## Configuring the HTTP Server

Use `mct setserverprops` to configure the serving domain and port:

```bash
npx mct setserverprops --domain 10.0.0.6 --port 80
```

The `--domain` should typically be the internal IP address of your machine. For example, in an Azure environment your external IP might be 10.20.30.2 but the internal IP might be 10.0.0.6.

---

## Using the MCP Server with VS Code

Minecraft Creator Tools includes a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that lets AI tools create and validate Minecraft Bedrock content interactively.

**1. Install the package globally:**

```bash
npm install -g @minecraft/creator-tools
```

**2. Accept the Minecraft EULA:**

Before the MCP server will work, you must accept the Minecraft End User License Agreement:

```bash
npx mct eula
```

Follow the prompts to review and accept. The MCP server will not start until the EULA has been accepted.

**3. Configure VS Code:**

Create a `.vscode/mcp.json` file in your project folder:

```json
{
  "servers": {
    "minecraft-creator-tools": {
      "type": "stdio",
      "command": "mct",
      "args": ["mcp", "-i", "${workspaceFolder}"]
    }
  }
}
```

Or, to make the MCP server available in all your VS Code projects, open the Command Palette (`Ctrl+Shift+P`), search for **MCP: Open User Configuration**, and add:

```json
{
  "servers": {
    "minecraft-creator-tools": {
      "type": "stdio",
      "command": "mct",
      "args": ["mcp"]
    }
  }
}
```

---

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft trademarks or logos is subject to and must follow [Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/legal/intellectualproperty/trademarks/usage/general). Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship. Any use of third-party trademarks or logos are subject to those third-party’s policies.
