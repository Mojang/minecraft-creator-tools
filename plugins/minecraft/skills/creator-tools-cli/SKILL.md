---
name: creator-tools-cli
description: Run the Minecraft Creator Tools command line (mct, the @minecraft/creator-tools npm package) for Minecraft Bedrock Edition add-ons. Use this whenever you need a Creator Tools command that isn't an MCP tool, or the MCP server isn't connected, for example validating or fixing a project, packaging it as a .mcaddon or .mcpack, deploying it to Minecraft, rendering a model or vanilla block to a PNG, opening the browser viewer or editor, creating a project from a template, running a local server, or looking up a command's options. For creating mobs, items, or blocks use create-mob, create-item, or create-block, and for finding and fixing validation problems use debug-addon. Not for Minecraft Java Edition.
---

# Run Minecraft Creator Tools commands

Run commands with:

```bash
npx -y @minecraft/creator-tools@latest <command> [arguments] [options]
```

If the user has it installed globally, `mct <command>` works too. Most commands work on a project folder passed with `-i <folder>`: the folder that contains `behavior_packs/` and/or `resource_packs/`, or a single pack folder.

`references/commands.md` lists every command with its arguments and options. It's generated from the CLI itself, so trust it over memory or older docs. `<command> --help` prints the same details.

## CLI or MCP tools?

When the Minecraft Creator Tools MCP server is connected, prefer its tools for what they cover: `createMinecraftContent` (new mobs, items, and blocks), `designModel`, `designStructure`, the `writeImageFile*` tools, and `validateFile`. Use the CLI for everything else: whole-project validation, fixes, packaging, deploying, rendering, and the browser viewer.

## Pick a command

| Task                                 | Command                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| Check a project for problems         | `validate -i <folder>` (use the debug-addon skill, which wraps this)            |
| Apply an automatic fix or upgrade    | `fix --list`, then `fix <fix-name> -i <folder>`                                 |
| Package for sharing                  | Validate first (debug-addon), then `exportaddon -i <folder> -o <output-folder>` |
| Copy packs into Minecraft (Windows)  | `deploy retail -i <folder>` (or `preview` for Minecraft Preview)                |
| Render a model to a PNG              | `rendermodel <file>.geo.json <output>.png -i <folder>`                          |
| Render a vanilla block, mob, or item | `rendervanilla <block\|mob\|item> minecraft:<id> <output>.png`                  |
| Let the user browse or edit content  | `view -i <folder>` or `edit -i <folder>`                                        |
| Create a project from a template     | `create <name> <template> <creator> <description> -y` (creates `./<name>`)      |
| Add template content to a project    | `add --list-types`, then `add <type> <namespace:name> -i <folder> -y`           |
| Show project details                 | `info -i <folder>`                                                              |
| Show the installed version           | `version`                                                                       |

## Rules

- **Never accept the Minecraft EULA for the user**, including with `eula --accept` or the `MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA` environment variable. Validation, fixes, packaging, and rendering don't need it. Creating from templates and running servers do: if a command says the EULA wasn't accepted, ask the user to run `npx -y @minecraft/creator-tools@latest eula` themselves.
- **Don't run long-running commands as blocking steps.** `view`, `edit`, `serve`, `dedicatedserve`, and `mcp` keep running until stopped. Suggest the command to the user, or run it in the background if your environment supports that.
- **Avoid interactive prompts.** `create`, `add`, and some other commands ask questions when arguments are missing. Pass every argument and add `-y` (`--yes`) so they don't wait for input.
- **Keep the user's project clean.** Several commands write reports to `./out` by default; pass `-o <temp-folder>` when you only need the output. Add `--json` when you'll parse the result.
- **Commands such as `fix` edit files in place.** Suggest committing to git (or making a copy) first, and use `-n` (`--dry-run`) to preview where it's supported.
