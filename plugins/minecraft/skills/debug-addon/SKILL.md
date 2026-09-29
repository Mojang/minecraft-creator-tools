---
name: debug-addon
description: Find and fix problems in a Minecraft Bedrock Edition add-on (behavior packs and resource packs) using Minecraft Creator Tools validation. Use this whenever someone asks why their add-on, pack, mob, item, block, or texture isn't working, won't load, is invisible, shows a missing texture or raw name like item.foo:bar, has Content Log errors, fails validation, needs upgrading to current Minecraft versions, or needs checking and packaging as a .mcaddon for release. Also use it right after creating or changing add-on content, even if the user didn't ask for validation. Not for Minecraft Java Edition mods, datapacks, or plugins, and not for browser or Home Assistant add-ons.
---

# Debug a Minecraft Bedrock add-on

Validation catches most packaging and reference mistakes, so start there, then fall back to the runtime checklist for problems validation can't see. Keep going until validation reports zero errors, then tell the user what you changed.

## 1. Find the project folder

Validate the folder that contains `behavior_packs/` and/or `resource_packs/`. A single pack folder (one with `manifest.json`) also works. If you can't tell which folder the user means, look for `manifest.json` files and ask if there's more than one candidate.

## 2. Run validation

Run the bundled summary script from this skill's folder:

```bash
node "<this-skill-folder>/scripts/validate-summary.mjs" <project-folder>
```

It runs `npx -y @minecraft/creator-tools@latest validate -i <folder> --json --force`, sending the CLI's report files to a temporary folder. It then drops the dozens of "passed" entries, merges duplicates, checks that pack dependencies point at real packs (which the CLI doesn't), lists references to vanilla (`minecraft:`) content separately, and moves known false positives into a "likely noise" section. Exit code 0 means no errors; exit code 2 means validation couldn't run or found no project, so don't report success.

Why not call the CLI directly? You can (`--json` output has `errors`, `warnings`, `recommendations` totals and a `projects[].items[]` list), but three things trip people up:

- The CLI writes report files into an `out/` folder in the current directory, which clutters the user's project. Pass `-o <temp folder>` to avoid it.
- Those reports double as a cache: without `--force`, re-validating returns the earlier results, so your fixes look like they did nothing.
- Most entries are `testPass`, `info`, or `featureAggregate` rows, which are not problems.

The MCP server's `validateFile` tool works too, but the script gives a cleaner result for whole projects.

## 3. Fix, in this order

1. **Errors.** These stop content from loading or being accepted.
2. **Warnings.** Treat them as real. An `UNLINK` warning pointing at your own namespace (for example `geometry.demo.goblin` not found) usually means something is invisible or missing in game.
3. **Recommendations.** Optional. Only change these when the user asks to upgrade or wants a clean report.

Check every ID in the "vanilla references" section: they're expected, because vanilla content lives outside the project, but a misspelled one such as `minecraft:stik` is a real bug. Leave "likely noise" alone unless the user wants a spotless report; Bedrock accepts those files as they are.

Look up fixes in `references/validation-issues.md`. For anything not listed there, open the `docs:` link the script prints; every check has a page in the Minecraft Creator Tools validation reference.

Missing pack icons are the most common error, and new projects created with Creator Tools don't include them. Create placeholders with:

```bash
node "<this-skill-folder>/scripts/make-pack-icon.mjs" <project>/behavior_packs/<pack> <project>/resource_packs/<pack> --color "#3C8527"
```

## 4. Re-run until there are no errors

Run the summary script again after each round of fixes. Stop when there are zero errors and no warnings you can explain as real problems. If a fix doesn't take effect, check you edited the file at the path the report shows (paths are relative to the project folder).

## 5. If it still doesn't work in game

Validation only checks files. For symptoms like an invisible mob, a purple-and-black texture, or a raw name such as `entity.demo:goblin.name`, work through `references/runtime-symptoms.md`. If that doesn't explain it, ask the user to turn on Minecraft's Content Log and paste what it shows; `references/content-log.md` explains how to turn it on and read it.

Raw names are the most common runtime complaint, because Creator Tools doesn't generate localization. Fix them all at once:

```bash
node "<this-skill-folder>/scripts/add-missing-names.mjs" <project-folder> --name "demo:goblin=Swamp Goblin"
```

It adds missing mob and block names to the resource pack's `texts/en_US.lang` and a `minecraft:display_name` to items that lack one, and never changes existing names. Pass `--name` for anything whose ID doesn't title-case into the right name; `--dry-run` shows what it would do.

To inspect content without Minecraft (for example on a Mac, where the game can't be launched from here), suggest the user run `npx -y @minecraft/creator-tools@latest view -i <project-folder>`. It opens a read-only browser view with 3D previews and keeps running until they stop it, so don't run it yourself as a blocking command.

## Upgrading an old add-on

- `npx -y @minecraft/creator-tools@latest fix setnewestminengineversion -i <folder>` updates `min_engine_version` in every manifest. This one works reliably.
- `fix setnewestformatversions` may report `updatedCount: 0` and change nothing. Update `format_version` in individual files by hand instead, and only when you know the file's schema didn't change between versions; re-validate after each change.
- `fix randomizealluids` is destructive: it breaks existing worlds that use the packs. Only run it when the user is copying a project to make a new one, and confirm first.

Run `npx -y @minecraft/creator-tools@latest fix --list` to see all fixes. Suggest committing to git (or making a copy) before running fixes, since they edit files in place.

## Packaging for release

Once validation shows no errors:

```bash
npx -y @minecraft/creator-tools@latest exportaddon -i <project-folder> -o <output-folder>
```

This writes `<project>.mcaddon` containing every behavior and resource pack. Opening that file on a device with Minecraft installed imports it. Before exporting, check that each pack has a real `pack_icon.png` (not a placeholder, if the user cares) and a sensible `header.version` in `manifest.json`.

## Things to avoid

- Don't accept the Minecraft EULA for the user. Validation, fixes, and export don't need it. If a command says the EULA wasn't accepted, ask the user to run `npx -y @minecraft/creator-tools@latest eula` themselves.
- Don't edit files under a Minecraft installation's vanilla packs. Only change the user's project.
