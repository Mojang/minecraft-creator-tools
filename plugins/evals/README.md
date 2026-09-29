# Skill evals

Test prompts for the skills in [`plugins/minecraft/skills`](../minecraft/skills), in the format used by Anthropic's [skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator). This folder isn't shipped in the npm package.

Each skill has two files:

- `evals.json`: realistic tasks with `expectations` that can be checked in the output files and transcript. Paths in `files` are relative to the repository root. Copy each input folder to a scratch location before running, since the agent edits it.
- `trigger-evals.json`: about 20 requests, half of which should load the skill and half of which are near-misses that shouldn't (Java Edition, other kinds of "add-ons", sibling skills).

`fixtures/` holds small add-ons used as inputs:

- `invisible-mob`: a generated mob whose client entity points at a geometry name that doesn't exist, so it's invisible in game. Its only real validation finding is an `UNLINK` warning. It also has no localization.
- `fungi-addon`: a clean add-on with a glowing mushroom block, two items, and a recipe. It validates with zero errors and warnings.

## Running

With skill-creator installed in Claude Code, ask it to evaluate a skill, pointing it at the skill folder and its `evals.json` here. For each prompt it runs the agent with and without the skill and grades the expectations. For trigger tests, use skill-creator's description optimizer with `trigger-evals.json`.

Run the evals after changing a skill, and add a prompt whenever a real user request exposes a gap. Every eval assumes the agent has the Minecraft Creator Tools MCP server available (`npx -y @minecraft/creator-tools mcp`).
