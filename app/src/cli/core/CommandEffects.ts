/**
 * CommandEffects - What each `mct` command reads, writes, and launches
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * PURPOSE:
 * One typed table, keyed by command name, that records the side effects of every command
 * registered in commands/index.ts, internal ones included. Code that must decide how a
 * command behaves (for example, whether --dry-run can be honored, or whether a command needs
 * an output folder at all) reads it through getCommandEffects(). Don't infer effects from
 * ICommandMetadata.isWriteCommand or isEditInPlace: nothing reads those flags, and some are
 * wrong (validate and search write report files but are marked read-only).
 *
 * Which global flags a command reads is ICommandMetadata.globalOptionGroups. This table doesn't
 * repeat that; it records what the command does, and a test keeps the two consistent (see
 * KEEPING IT CURRENT).
 *
 * HOW THE ENTRIES WERE BUILT:
 * Each entry comes from reading the command's execute() and the code it calls, together with
 * what cli/index.ts and CommandContextFactory do before any command runs. The surprising
 * findings were then confirmed by running the built CLI in a sandbox: a temporary folder, with
 * HOME and MCTOOLS_DATA_DIR redirected and outbound requests sent to a logging proxy. Where
 * neither settles an effect, the effect carries an `unverified` note instead of a guess.
 *
 * READING AN ENTRY:
 * - Each effect has a frequency:
 *   - "always": every run that gets past argument checks, with default options.
 *   - "sometimes": only with certain arguments, options, project content, platform, or saved
 *     state. `details` says when.
 *   - "never": the command's code doesn't do it.
 * - Entries describe the command's own code. Effects that cli/index.ts and
 *   CommandContextFactory apply before execute() runs are listed once, in STARTUP_EFFECTS,
 *   rather than repeated in every entry. getStartupEffectIds() says which apply to a command.
 * - dryRun.support is "ignored" when the command doesn't read context.dryRun, which is exactly
 *   when its globalOptionGroups doesn't include "dryRun". Otherwise it's "honored" when the
 *   command skips every effect in its entry except readsInput, and "partial" when some still
 *   happen. The CLI rejects --dry-run, before anything runs, for every command that isn't
 *   "honored" (DryRunGuard.ts). For honored commands, --dry-run also turns off the
 *   STARTUP_EFFECTS that write, except createsDataFolder, and makes the context's storage and
 *   every project read-only, so a write the command doesn't skip fails.
 *
 * COMMON PITFALLS:
 * - From the CLI, context.outputFolder is -o, which defaults to ./out, with or without --dry-run.
 *   The CLI creates it only when the run needs it (needsOutputFolder()): for commands that write
 *   there, and for add, create, fix, view, and edit when, without -i or --if, they look for projects
 *   there. It's never created under --dry-run, so it may not exist. Don't make the input folder
 *   the output folder as a dry-run shortcut: commands that write to -o would write into the project,
 *   and the docsgenerate* commands would delete its contents.
 * - Without -i, add, create, and fix look for projects in the output folder (./out), not in
 *   the current folder. See STARTUP_EFFECTS.detectsProjectsInOutputFolder.
 * - An explicit --if package is opened before execute(), including honored dry runs. A missing or unreadable
 *   package fails with exit code 1, never selecting a same-name project from saved storage.
 * - --isolated and --offline only stop vanilla-content downloads in the main thread. Version
 *   checks against raw.githubusercontent.com and registry.npmjs.org ignore them.
 * - serve's HTTP server also offers the MCP tools at /mcp (HttpServer.setMcpEnabled), so its
 *   entry includes what a client can do through those tools, marked unverified like the mcp
 *   entry. No other command's HTTP server does: view, edit, and the render commands' temporary
 *   servers answer /mcp with 404. Clients signed in with the updateState or admin passcode can
 *   also run tool commands through /api/commands, and edit signs its browser in as admin, so
 *   the serve and edit entries include those tool commands too, also unverified.
 *
 * KEEPING IT CURRENT:
 * Add an entry when you register a command, and update it when you change what a command
 * reads, writes, or launches. An entry's writesOutputFolder also decides whether the CLI creates the
 * output folder before the command runs (needsOutputFolder()), so a command recorded as "never"
 * writing there gets no output folder. CommandEffectsTest fails when a registered command has no entry,
 * when an entry has no registered command, when dryRun.support disagrees with globalOptionGroups
 * (or globalOptionGroups' dryRun group disagrees with the command's source), and when a command
 * that writes to the output folder doesn't declare the outputFolder group. DryRunGuardTest fails when
 * help lists --dry-run for a command that the CLI rejects it for, which rules out "partial".
 * Contributor notes: docs/CliCommandEffects.md.
 *
 * RELATED FILES:
 * - commands/index.ts: the registered commands this table covers
 * - core/CommandContextFactory.ts and ../index.ts: the source of STARTUP_EFFECTS; the factory creates
 *   the output folder only when needsOutputFolder() says so. For commands that don't edit in place,
 *   cli/index.ts's header names it when needsOutputFolder() says so or the command reads -o itself (its
 *   globalOptionGroups include outputFolder); for add, create, fix, view, and edit, it never does.
 * - core/DryRunGuard.ts: rejects --dry-run for commands that aren't "honored"
 * - core/GlobalOptions.ts: the global option groups that globalOptionGroups lists
 * - test/CommandEffectsTest.ts: coverage and consistency checks
 * - test/CliOutputFolderTest.ts: checks which commands create the output folder
 */

import { hasInputFileOption } from "./InputFileOption";

/** How often a command has an effect. See the file header for the definitions. */
export type EffectFrequency = "always" | "sometimes" | "never";

/** One effect of a command. */
export interface ICommandEffect {
  readonly frequency: EffectFrequency;

  /** What happens and where. For "sometimes", also when. */
  readonly details?: string;

  /** Present when neither the code nor a sandbox run settles this effect; says what is unclear. */
  readonly unverified?: string;
}

/**
 * How a command's code treats --dry-run. The CLI rejects --dry-run for every command that isn't "honored"
 * (DryRunGuard.ts), so only honored commands run with it.
 * - "honored": reads context.dryRun and skips every effect in its entry except readsInput.
 * - "partial": reads context.dryRun but still has some effects; details lists them.
 * - "ignored": doesn't read context.dryRun (its globalOptionGroups doesn't include "dryRun").
 */
export type DryRunSupport = "honored" | "partial" | "ignored";

export interface IDryRunBehavior {
  readonly support: DryRunSupport;

  /** What --dry-run skips, or what still happens under it. */
  readonly details?: string;
}

/** Everything the table records about one command. */
export interface ICommandEffects {
  /** Reads the input: a project, or other content, in the input folder (-i, --if, or the discovered project root). */
  readonly readsInput: ICommandEffect;

  /** Changes files in the project folder in place. */
  readonly changesProject: ICommandEffect;

  /** Writes reports, packages, or other files to the output folder (-o, default ./out). */
  readonly writesOutputFolder: ICommandEffect;

  /**
   * Writes somewhere other than the project and output folders: a path the user named (a deploy
   * target, a PNG path) or a fixed location (Minecraft's com.mojang folder, ./debugoutput).
   */
  readonly writesOtherLocations: ICommandEffect;

  /** Updates saved state in the Creator Tools data folder: EULA acceptance, server settings, downloaded servers. */
  readonly updatesSavedState: ICommandEffect;

  /** Makes outbound network requests: vanilla resources, template downloads, version checks. */
  readonly usesNetwork: ICommandEffect;

  /** Listens on a local port, such as an HTTP server for the web UI, rendering, or MCP. */
  readonly startsLocalServer: ICommandEffect;

  /** Starts other processes: a browser, Minecraft, Bedrock Dedicated Server, headless Chromium. */
  readonly launchesProcesses: ICommandEffect;

  /** Asks the user for input interactively. */
  readonly promptsForInput: ICommandEffect;

  /** How the command treats --dry-run today. */
  readonly dryRun: IDryRunBehavior;

  /** Surprising behavior found while mapping the command, worth knowing before relying on the entry. */
  readonly notes?: readonly string[];
}

/** The effect fields of ICommandEffects, in table order. */
export const EFFECT_KEYS = [
  "readsInput",
  "changesProject",
  "writesOutputFolder",
  "writesOtherLocations",
  "updatesSavedState",
  "usesNetwork",
  "startsLocalServer",
  "launchesProcesses",
  "promptsForInput",
] as const;

export type EffectKey = (typeof EFFECT_KEYS)[number];

/** Names of the registered commands, as in ICommandMetadata.name. */
export type CommandName =
  | "validate"
  | "aggregatereports"
  | "search"
  | "profileValidation"
  | "info"
  | "create"
  | "add"
  | "fix"
  | "setup"
  | "set"
  | "deploy"
  | "exportaddon"
  | "exportworld"
  | "serve"
  | "mcp"
  | "dedicatedserve"
  | "passcodes"
  | "setserverprops"
  | "minecrafteulaandprivacystatement"
  | "rendermodel"
  | "renderbatch"
  | "rendervanilla"
  | "renderstructure"
  | "buildstructure"
  | "docsupdateformsource"
  | "docsupdatemccat"
  | "docsgenerateformjson"
  | "docsgeneratemarkdown"
  | "docsgeneratetypes"
  | "docsgeneratejsonschema"
  | "generateschemapackage"
  | "world"
  | "ensureworld"
  | "version"
  | "skills"
  | "view"
  | "edit"
  | "autotest";

/** Effects that cli/index.ts and CommandContextFactory apply before a command's execute() runs. */
export type StartupEffectId =
  | "createsDataFolder"
  | "discoversProjectRoot"
  | "listsInputFolder"
  | "detectsProjectsInOutputFolder"
  | "createsOutputFolder"
  | "savesPasscodeFlags"
  | "setsVanillaContentRoot"
  | "readsStdin";

export interface IStartupEffect {
  readonly description: string;

  /** The only commands it applies to. When omitted, it applies to every command not in exceptCommands. */
  readonly commands?: readonly CommandName[];

  /** Commands it doesn't apply to. */
  readonly exceptCommands?: readonly CommandName[];

  /** Present when neither the code nor a sandbox run settles part of this effect. */
  readonly unverified?: string;
}

/** skills runs before CreatorTools, project detection, and output-folder setup in cli/index.ts. */
const SKIPS_SHARED_STARTUP: readonly CommandName[] = ["skills"];

export const STARTUP_EFFECTS: Readonly<Record<StartupEffectId, IStartupEffect>> = {
  createsDataFolder: {
    description:
      "LocalEnvironment creates the Creator Tools data folders when they're missing: ~/.mctools/cli, server, and " +
      "worlds on macOS and Linux; mctools_cli, mctools_server, and mctools_worlds under %LOCALAPPDATA% on Windows; " +
      "or folders under $MCTOOLS_DATA_DIR. This happens for every command, skills included.",
  },
  discoversProjectRoot: {
    description:
      "Without -i, CommandContextFactory walks up from the current folder and uses the nearest folder that has " +
      "package.json, or a behavior_packs, resource_packs, or similar folder, as the input folder.",
    exceptCommands: SKIPS_SHARED_STARTUP,
  },
  listsInputFolder: {
    description:
      "cli/index.ts and CommandContextFactory list the input folder to detect projects, even for commands that " +
      "don't use projects, and stop with an error when the folder doesn't exist. With --if, the factory opens " +
      "the explicit package before execution, after applying dry-run read-only settings. Missing or unreadable " +
      "packages fail with exit code 1 instead of reading or changing a same-name saved project. Empty or missing " +
      "--if values are rejected during parsing, before startup; direct factory calls validate raw values before " +
      "selecting any input or output folder.",
    exceptCommands: SKIPS_SHARED_STARTUP,
  },
  detectsProjectsInOutputFolder: {
    description:
      "Without -i or --if, CommandContextFactory detects projects in the output folder (default ./out) instead of " +
      "the current folder for the commands in ClUtils.getIsEditInPlaceCommand, so that folder has to exist, and " +
      "needsOutputFolder() creates it for them. With -i or --if, which name the projects, these commands don't use " +
      "-o at all, so it isn't created. --dry-run looks in the same folder but doesn't create it, so a missing one " +
      "holds one empty project, like the folder a real run creates. Of these commands, add, create, and fix work " +
      "on the detected projects; view and edit serve the input folder instead.",
    commands: ["add", "create", "fix", "view", "edit"],
  },
  createsOutputFolder: {
    description:
      "CommandContextFactory creates the output folder (-o, default ./out) before the command runs, but only when " +
      "the run needs it (needsOutputFolder()): for the commands that write there, and for add, create, fix, view, " +
      "and edit when, without -i or --if, they look for projects there. For every other run, it leaves -o alone " +
      "and doesn't create ./out in the current folder; only ensureworld reads -o then, and creates it itself " +
      "when it's inside the input folder (see its entry). This effect lists the commands that need it with " +
      "default options, which have no -i. The folder isn't created when -o resolves to the input folder, or under --dry-run, which for these " +
      "runs fails instead where a real run couldn't create it, as when -o is a file. Without -i, cli/index.ts's " +
      "older project scan also creates it for world, create, add, and fix (ClUtils.getIsWriteCommand), which all " +
      "need it then anyway.",
    // Derived from the table, so it can't disagree with the entries' writesOutputFolder.
    get commands(): readonly CommandName[] {
      return (Object.keys(COMMAND_EFFECTS) as CommandName[]).filter((name) => needsOutputFolder(name));
    },
  },
  savesPasscodeFlags: {
    description:
      "--adminpc, --displaypc, --fullropc, or --updatepc on any command makes cli/index.ts rewrite envprefs.json " +
      "in the data folder, adding the default server domain and port, except under --dry-run. The passcodes " +
      "themselves stay in memory for that process only.",
    exceptCommands: SKIPS_SHARED_STARTUP,
  },
  setsVanillaContentRoot: {
    description:
      "Unless --isolated or --offline is given, cli/index.ts sets the content root to https://mctools.dev/, so " +
      "vanilla lookups in the main thread download from there. This happens for every command, including skills, " +
      "which does no lookups. Worker threads (validate, profileValidation) don't get this setting, and version " +
      "checks (raw.githubusercontent.com, registry.npmjs.org) ignore both flags.",
  },
  readsStdin: {
    description:
      "Unless --once is given, cli/index.ts reads stdin while the command runs: a line starting with exit or " +
      "stop runs its shutdown path, and other lines are meant for a running Bedrock Dedicated Server.",
    commands: ["serve", "dedicatedserve", "view", "edit"],
    unverified:
      "The shutdown path and the forwarding use cli/index.ts's own ServerManager, not the command's, and " +
      "whether either takes effect wasn't checked.",
  },
};

function never(details?: string, unverified?: string): ICommandEffect {
  return effect("never", details, unverified);
}

function sometimes(details: string, unverified?: string): ICommandEffect {
  return effect("sometimes", details, unverified);
}

function always(details: string, unverified?: string): ICommandEffect {
  return effect("always", details, unverified);
}

function effect(frequency: EffectFrequency, details?: string, unverified?: string): ICommandEffect {
  const result: { frequency: EffectFrequency; details?: string; unverified?: string } = { frequency };

  if (details !== undefined) {
    result.details = details;
  }

  if (unverified !== undefined) {
    result.unverified = unverified;
  }

  return result;
}

// Descriptions shared by several entries.
const EMPTY_FOLDERS_IN_PROJECT =
  "Doesn't change any file, but resolving references can create empty folders in the project (seen with " +
  "samplecontent/addon, for example altdiffs/aop_mobsrp/subpacks/ and textures/ballast/20/).";

const EMPTY_FOLDERS_UNTRACED = "Which references create folders wasn't traced.";

const VALIDATION_NETWORK =
  "Checks the latest Minecraft version at raw.githubusercontent.com and, for projects with @minecraft/* " +
  "dependencies, module versions at registry.npmjs.org, even with --offline.";

const PREPARES_PROJECT =
  "Before building, runs the script module updater and saves the project, so @minecraft/* dependencies in " +
  "manifest.json can move to the newest versions on npm. Projects with a scripts build also get a dist/scripts/ " +
  "folder (seen with samplecontent/addon).";

const PREPARES_PROJECT_UNVERIFIED = "The manifest update wasn't observed: the sandbox had no network access.";

const SCRIPT_MODULE_NETWORK =
  "For projects with @minecraft/* dependencies, looks up module versions at registry.npmjs.org, even with --offline.";

const EULA_FROM_ENVIRONMENT =
  "Saves EULA acceptance to envprefs.json when it isn't saved yet and " +
  "MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA=true.";

const BDS_PLATFORMS_UNVERIFIED = "Not run on Windows or Linux, where Bedrock Dedicated Server is supported.";

const BDS_PORTS =
  "Bedrock Dedicated Server listens for game connections on UDP port 19132 (32 higher for each slot after the " +
  "first) and on UDP port 19133 for IPv6. After it starts, mct itself listens on 127.0.0.1 at the first free TCP " +
  "port from 12 to 31 above the game port (19144 to 19163 for the first slot) for the script debugger connection.";

const BDS_DOWNLOAD =
  "On Windows and Linux, asks the Minecraft download service for the latest Bedrock Dedicated Server version " +
  "and downloads the server from minecraft.net when the copy in the data folder is older.";

const DOCS_NETWORK =
  "Vanilla content lookups go to mctools.dev unless --isolated or --offline; forms and vanilla metadata come " +
  "from files installed with the CLI.";

const DOCS_NETWORK_UNVERIFIED =
  "No request was seen in sandbox runs; which generators need vanilla content wasn't traced.";

const RENDER_SERVER =
  "A temporary HTTP server that serves the viewer to headless Chromium, on --port or a random port from " +
  "--port-start to --port-end (default 6200-6299).";

const HEADLESS_CHROMIUM = "Headless Chromium, through Playwright.";

const MCP_TOOLS_UNTRACED =
  "Tool effects come from MinecraftMcpServer.ts and weren't traced tool by tool; only createProject and " +
  "writeImageFileFromPixelArt were tried.";

const NO_EFFECTS_TO_SKIP = "Has no effects of its own to skip.";

const OPENS_BROWSER = "Opens the default browser (open, rundll32, or xdg-open) unless MCT_NO_OPEN_BROWSER is set.";

const SAVES_SERVER_DEFAULTS = "Saves envprefs.json with the default server domain and port on every start.";

// view and edit serve the input folder, but without -i the CLI first looks for projects in -o, as for add, create,
// and fix (detectsProjectsInOutputFolder), so it creates ./out for them then.
const LOOKS_FOR_PROJECTS_IN_OUTPUT_FOLDER =
  "Without -i, the CLI creates ./out before it runs, because it looks for projects there first " +
  "(detectsProjectsInOutputFolder), though it serves the input folder and never uses them. With -i, it doesn't.";

const CONTENT_SERVER = "An HTTP server on a random free port from 6136 to 6236.";

// With the all features (view, edit, and serve by default), the server proxies vanilla files from the content root.
const SERVER_VANILLA_FILES =
  "When a client asks for vanilla files under /res/latest/van/, such as textures, the server fetches them from " +
  "mctools.dev unless --isolated or --offline is given or a local copy is installed with the CLI.";

// /api/commands runs every tool command that doesn't limit its scopes, for clients with the updateState or admin
// passcode, in a context with no open project. Their effects aren't traced one by one, like the MCP tools.
const TOOL_COMMANDS_WRITE_FILES =
  "Through /api/commands, a client signed in with the updateState or admin passcode can run tool commands. No " +
  "project is open there, so deploy, export, remove, and rename fail; create writes a new project to the folder " +
  "its --output flag names or to Creator Tools' projects storage, and add first creates a new project there.";

const TOOL_COMMANDS_UNTRACED = "What the tool commands run through /api/commands do wasn't traced one by one.";

// serve's HTTP server also offers the MCP tools (see the mcp entry) at /mcp, so its entry includes what a client
// can do through those tools while the server is up. Other commands' HTTP servers answer /mcp with 404.
const MCP_CLIENT_CHANGES_FILES =
  "A local client can call the MCP tools at /mcp, which create and change files in projects (see the mcp entry).";

const MCP_CLIENT_WRITES =
  "Through /mcp, createProject creates a project in any folder the client passes once the EULA is accepted, and " +
  "image tools write where a .mct/mcp/prefs.json near the path allows it (see the mcp entry).";

// The MCP parts of the serve entry come from the mcp entry, so they share its uncertainty.
const MCP_ENDPOINT_UNTRACED = "What the MCP tools do wasn't traced tool by tool (see the mcp entry).";

const BDS_AND_MCP_UNVERIFIED = BDS_PLATFORMS_UNVERIFIED + " " + MCP_ENDPOINT_UNTRACED;

const MCP_CLIENT_SAVED_STATE =
  "MCP tools called through /mcp can also save EULA acceptance and download Bedrock Dedicated Server into the " +
  "data folder (see the mcp entry).";

const MCP_CLIENT_NETWORK =
  "The first /mcp request that passes the Host, Origin, and passcode checks starts the MCP tools, which set the " +
  "content root to https://mctools.dev/, even with --isolated or --offline, and MCP tools can download vanilla " +
  "content (see the mcp entry).";

const MCP_CLIENT_SERVERS = "MCP session tools called through /mcp can start more local servers (see the mcp entry).";

const MCP_CLIENT_PROCESSES =
  "MCP preview tools called through /mcp launch headless Chromium, and session tools can start Bedrock " +
  "Dedicated Server (see the mcp entry).";

export const COMMAND_EFFECTS: Readonly<Record<CommandName, ICommandEffects>> = {
  // Validate commands

  validate: {
    readsInput: always("Validates every project found in the input folder, in worker threads."),
    changesProject: sometimes(EMPTY_FOLDERS_IN_PROJECT, EMPTY_FOLDERS_UNTRACED),
    writesOutputFolder: always(
      "Per project: <name>.report.html, <name>.csv, and <name>.mcr.json (not with --ot noreports). With the " +
        "aggregate argument or --ot noreports, also mci/<name>.mci.json, mci/<name>.mci.json.zip, and " +
        "mch/<name>.mch.json. The aggregate argument adds all.csv, allprojects.csv, mci/index.json, and index/. " +
        "The all suite also writes <name>sharing.report.html and <name>sharing.csv, plus addon and " +
        "currentplatform versions when those suites apply, even with --ot noreports. No per-project files when " +
        "the output folder is the input folder."
    ),
    writesOtherLocations: never(),
    updatesSavedState: never(),
    usesNetwork: always(
      VALIDATION_NETWORK +
        " The worker threads don't download vanilla content; they use only what's installed with the CLI."
    ),
    startsLocalServer: never(),
    launchesProcesses: never("Validates in worker threads, not separate processes."),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
    notes: ["ICommandMetadata marks validate as read-only (isWriteCommand: false), but it writes report files."],
  },

  aggregatereports: {
    readsInput: always(
      "Reads validation reports (.json files with info and items, such as <name>.mcr.json) from the input " +
        "folder, and mci/<name>.mci.json for reports without an index."
    ),
    changesProject: never(),
    writesOutputFolder: sometimes(
      "When it finds reports: measures/_index.json, mci/_index.json, and the content index in index/ (not with " +
        "the noindex argument)."
    ),
    writesOtherLocations: never(),
    updatesSavedState: never(),
    usesNetwork: never(),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
  },

  search: {
    readsInput: always(
      "Reads a content index (citems.json and the files beside it, which validate's aggregate argument and " +
        "aggregatereports write to index/) from the input folder."
    ),
    changesProject: never(),
    writesOutputFolder: always("<term>.results.json and <term>.results.csv."),
    writesOtherLocations: never(),
    updatesSavedState: never(),
    usesNetwork: never(),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
    notes: ["ICommandMetadata marks search as read-only (isWriteCommand: false), but it writes result files."],
  },

  profileValidation: {
    readsInput: always("Validates each project in the input folder, like validate."),
    changesProject: sometimes(
      EMPTY_FOLDERS_IN_PROJECT,
      "Shares validate's code path but wasn't run against samplecontent/addon. " + EMPTY_FOLDERS_UNTRACED
    ),
    writesOutputFolder: always("The same per-project files as validate, with mci/ and mch/ always included."),
    writesOtherLocations: always(
      "Profiles in ./debugoutput/ under the current folder: a .cpuprofile, or for the memory and all modes a " +
        ".heapprofile, .memstats.json, and .heapsnapshot."
    ),
    updatesSavedState: never(),
    usesNetwork: always(VALIDATION_NETWORK),
    startsLocalServer: never(),
    launchesProcesses: never("Validates in a worker thread, not a separate process."),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
  },

  // Project commands

  info: {
    readsInput: always("Loads each project and runs the default validation in the main thread."),
    changesProject: sometimes(EMPTY_FOLDERS_IN_PROJECT, EMPTY_FOLDERS_UNTRACED),
    writesOutputFolder: never(),
    writesOtherLocations: never(),
    updatesSavedState: never(),
    usesNetwork: always(
      VALIDATION_NETWORK +
        " Vanilla lookups go to mctools.dev unless --isolated or --offline (seen with samplecontent/addon)."
    ),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "ignored", details: "Writes nothing to skip, apart from the empty folders noted above." },
  },

  create: {
    readsInput: always(
      "Checks that behavior_packs/<short name>/ and resource_packs/<short name>/ don't already exist in the " +
        "target folder."
    ),
    changesProject: sometimes(
      "With -i, copies the template into that folder, renames its pack folders, applies the creator name and " +
        "description, runs the project updaters, and saves."
    ),
    writesOutputFolder: always(
      "Without -i (the default), creates the project in the output folder (-o, default ./out), because it looks " +
        "for its target project there. With -i, it writes to that folder instead; see changesProject."
    ),
    writesOtherLocations: never(),
    updatesSavedState: sometimes(
      "Once the EULA is accepted, saves Creator Tools preferences to prefs/mctools.json in the data folder after " +
        "copying the template, even when the copy fails. " +
        EULA_FROM_ENVIRONMENT
    ),
    usesNetwork: sometimes(
      "Copies the template from the samples installed with the CLI, falling back to GitHub (api.github.com) " +
        "when they aren't installed. The project updaters can then check the latest Minecraft version and " +
        "script module versions.",
      "Whether the updaters reach the network for every template wasn't traced."
    ),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: sometimes(
      "Without --yes or --json, asks for the title, description, creator name, short name, and template when " +
        "they aren't passed as arguments. It asks only when stdin and stdout are both terminals; otherwise it " +
        "exits 1 instead, naming the missing input and the arguments, or --yes, that supply it. Piped input isn't " +
        "read as answers."
    ),
    dryRun: { support: "ignored" },
    notes: [
      "Reports 'Project created' even when copying the template fails, as seen with the network blocked.",
      "The folder-name prompt can't be reached: it runs only when context.inputFolder is empty, which it never is.",
    ],
  },

  add: {
    readsInput: always("Loads the target project; --list-types reads only the gallery."),
    changesProject: sometimes(
      "Copies the chosen gallery template's files into the project and saves it. Without -i, the project is " +
        "the output folder (./out)."
    ),
    writesOutputFolder: sometimes(
      "Without -i, the project is the output folder (./out), so the files described in changesProject land there."
    ),
    writesOtherLocations: never(),
    updatesSavedState: sometimes(EULA_FROM_ENVIRONMENT),
    usesNetwork: sometimes(
      "Vanilla templates, such as cow, come from mctools.dev unless --isolated or --offline. Sample templates " +
        "come from the samples installed with the CLI, falling back to mctools.dev."
    ),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: sometimes(
      "Without --yes or --json, asks for the item name, the content type, the template, and for single files " +
        "the file type. It asks only when stdin and stdout are both terminals; otherwise it exits 1 instead, " +
        "naming the missing input and how to supply it: after a template id, the name as the second argument or " +
        "--yes; otherwise, a gallery template id and a name. Piped input isn't read as answers. The type " +
        "shorthands (entity, block, item, and so on) always ask for a template, so they fail with --yes."
    ),
    dryRun: { support: "ignored" },
  },

  fix: {
    readsInput: always("Loads each project (not with --list)."),
    changesProject: sometimes(
      "randomizealluids rewrites manifest UUIDs and can update .vscode/launch.json; latestbetascriptversion " +
        "moves @minecraft/* module versions in manifest.json. setnewestminengineversion raises min_engine_version " +
        "in behavior and resource pack manifests, and setnewestformatversions raises base_game_version in world " +
        "template manifests, to the latest Minecraft version. Both keep comments but rewrite the manifest with " +
        "2-space indentation, never lower a version, and skip manifests without a header, including ones that " +
        "don't parse. Without -i, the project is the output folder (./out)."
    ),
    writesOutputFolder: sometimes(
      "Without -i, the project is the output folder (./out), so the changes described in changesProject land there."
    ),
    writesOtherLocations: never(),
    updatesSavedState: never(),
    usesNetwork: sometimes(
      "latestbetascriptversion looks up module versions at registry.npmjs.org; setnewestminengineversion and " +
        "setnewestformatversions check the latest Minecraft version at raw.githubusercontent.com and, when that " +
        "fails, use the older version bundled with the CLI. Both ignore --offline."
    ),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "honored", details: "Loads each project, then skips every fix." },
    notes: [
      "Without -i, fix works on the empty output folder (./out) instead of the current folder, and still reports " +
        "success. Run from a project folder, that's an empty out/ folder it creates inside the project.",
    ],
  },

  setup: {
    readsInput: always("Loads each project."),
    changesProject: always(
      "Creates or updates package.json, just.config.ts, eslint.config.mjs, .prettierrc.json, .env, and " +
        ".vscode/extensions.json, launch.json, settings.json, and tasks.json in the project."
    ),
    writesOutputFolder: never(),
    writesOtherLocations: never(),
    updatesSavedState: never(),
    usesNetwork: never(),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "honored", details: "Skips setup for every project." },
  },

  set: {
    readsInput: never("The command is disabled and exits with an error."),
    changesProject: never(),
    writesOutputFolder: never(),
    writesOtherLocations: never(),
    updatesSavedState: never(),
    usesNetwork: never(),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "ignored", details: NO_EFFECTS_TO_SKIP },
  },

  deploy: {
    readsInput: always(
      "Loads each project; `deploy env` also reads MINECRAFT_PRODUCT from .env in the input folder, or from --env-file."
    ),
    changesProject: sometimes(PREPARES_PROJECT, PREPARES_PROJECT_UNVERIFIED),
    writesOutputFolder: sometimes(
      "layout writes flat <name>_bp/ and <name>_rp/ folders to the output folder; folder and output write " +
        "development_behavior_packs/ and development_resource_packs/ there. With --test-world, these modes " +
        "write a generated world with the packs to minecraftWorlds/<world id>/ there instead."
    ),
    writesOtherLocations: sometimes(
      "retail and preview (and mcuwp, mcpreview, and env) copy the packs into Minecraft's com.mojang folder " +
        "under AppData\\Roaming in the home folder, a Windows path that deploy also creates on macOS and Linux. " +
        "server copies them into the --server-path folder, creating it if needed, and any other mode that names " +
        "an existing folder deploys there. With --test-world, the target gets a generated world with the packs " +
        "in minecraftWorlds/<world id>/ (or an existing worlds/ folder) instead."
    ),
    updatesSavedState: never(),
    usesNetwork: sometimes(SCRIPT_MODULE_NETWORK),
    startsLocalServer: never(),
    launchesProcesses: sometimes(
      "With --test-world and -l, --launch, opens the generated world in Minecraft through a minecraft://mode/?load= " +
        "link, handed to the system's URL handler (open on macOS). --launch without --test-world only warns."
    ),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
    notes: [
      "On macOS and Linux, retail and preview report success after writing to the Windows-style AppData path " +
        "in the home folder.",
      "Deploying can change the project itself; see changesProject.",
      "With --launch, prints 'Running minecraft://…' to stdout through console.log, even with --json.",
    ],
  },

  exportaddon: {
    readsInput: always("Loads each project."),
    changesProject: sometimes(PREPARES_PROJECT, PREPARES_PROJECT_UNVERIFIED),
    writesOutputFolder: always(
      "<project>.mcaddon when the project has both a behavior pack and a resource pack, otherwise " +
        "<project>.mcpack (--format overrides). With --of, writes to that file instead."
    ),
    writesOtherLocations: sometimes("--of <file> writes the package there."),
    updatesSavedState: never(),
    usesNetwork: sometimes(SCRIPT_MODULE_NETWORK),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "honored", details: "Loads each project, then skips building, packaging, and writing." },
    notes: ["Exporting can change the project itself; see changesProject."],
  },

  exportworld: {
    readsInput: always("Loads each project."),
    changesProject: sometimes(PREPARES_PROJECT, PREPARES_PROJECT_UNVERIFIED),
    writesOutputFolder: always(
      "<project>.mcworld, a flat GameTest world with the project's packs. With --of, writes to that file instead."
    ),
    writesOtherLocations: sometimes("--of <file> writes the world there."),
    updatesSavedState: never(),
    usesNetwork: sometimes(SCRIPT_MODULE_NETWORK),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
    notes: ["Exporting can change the project itself; see changesProject."],
  },

  // Server commands

  serve: {
    readsInput: sometimes("Passes the first project to Bedrock Dedicated Server when it starts one."),
    changesProject: sometimes(
      MCP_CLIENT_CHANGES_FILES + " Not with the dedicatedserver features, which don't start the HTTP server.",
      MCP_ENDPOINT_UNTRACED
    ),
    writesOutputFolder: never(),
    writesOtherLocations: sometimes(
      "--log-file <path> appends server output to that file. " + MCP_CLIENT_WRITES + " " + TOOL_COMMANDS_WRITE_FILES,
      MCP_ENDPOINT_UNTRACED + " " + TOOL_COMMANDS_UNTRACED
    ),
    updatesSavedState: always(
      "Saves envprefs.json on start, with the port (--port, or 6126) and the default server domain (not with " +
        "the dedicatedserver features). An admin accepting the EULA in the web UI saves that too. When it " +
        "starts Bedrock Dedicated Server, downloads it into the data folder and creates server folders there. " +
        MCP_CLIENT_SAVED_STATE,
      BDS_AND_MCP_UNVERIFIED
    ),
    usesNetwork: sometimes(
      "With the default all features: " +
        SERVER_VANILLA_FILES +
        " When it starts Bedrock Dedicated Server: " +
        BDS_DOWNLOAD +
        " " +
        MCP_CLIENT_NETWORK,
      BDS_AND_MCP_UNVERIFIED
    ),
    startsLocalServer: always(
      "An HTTP server on --port (default 6126) with the web UI and the MCP tools at /mcp (not with the " +
        "dedicatedserver features). /mcp checks Host and Origin before anything else: the Host must name this " +
        "server (localhost, 127.0.0.1, [::1], or the configured domain, on its port), except on remote " +
        "connections to a server bound to every interface, and an Origin, if sent, must be serve's own or a CORS " +
        "origin (http://localhost:6126 and http://127.0.0.1:6126 are always allowed, plus any configured ones). " +
        "Loopback requests that pass need no passcode unless --mcp-require-auth is given or the Origin is a CORS " +
        "origin rather than serve's own; remote requests must authenticate. " +
        MCP_CLIENT_SERVERS +
        " When it starts Bedrock Dedicated Server (see launchesProcesses): " +
        BDS_PORTS,
      BDS_AND_MCP_UNVERIFIED
    ),
    launchesProcesses: sometimes(
      "Bedrock Dedicated Server, when the EULA is saved as accepted and the features include it; Windows and " +
        "Linux only. " +
        MCP_CLIENT_PROCESSES,
      BDS_AND_MCP_UNVERIFIED
    ),
    promptsForInput: sometimes(
      "When stdout is a terminal and CI isn't set, and without --quiet or --once, shows an interactive console " +
        "that reads typed commands. It checks stdout only, not stdin."
    ),
    dryRun: { support: "ignored" },
    notes: ["Running serve without --port saves port 6126, replacing a port saved earlier."],
  },

  mcp: {
    readsInput: sometimes(
      "Tools read projects and files under the input folder (-i or --input, or the discovered project root) " +
        "when an MCP client calls them.",
      MCP_TOOLS_UNTRACED
    ),
    changesProject: sometimes(
      "Tools such as createProject, addItem, createMinecraftContent, designModel, and designStructure write files.",
      MCP_TOOLS_UNTRACED
    ),
    writesOutputFolder: never(),
    writesOtherLocations: sometimes(
      "createProject creates a project in any folder the client passes, once the EULA is accepted. Image tools " +
        "such as writeImageFile write only where a .mct/mcp/prefs.json in the target's folder, or up to 3 folders " +
        "above it, allows it. Previews write image files.",
      MCP_TOOLS_UNTRACED
    ),
    updatesSavedState: sometimes(
      "Saves EULA acceptance when MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA=true and a tool needs the " +
        "EULA. Session tools can download Bedrock Dedicated Server into the data folder.",
      MCP_TOOLS_UNTRACED
    ),
    usesNetwork: sometimes(
      "Sets the content root to https://mctools.dev/ at startup, even with --isolated or --offline, so tools " +
        "that need vanilla content download it.",
      MCP_TOOLS_UNTRACED
    ),
    startsLocalServer: sometimes(
      "Preview and Minecraft session tools start local HTTP servers, for example on port 6128 for sessions.",
      MCP_TOOLS_UNTRACED
    ),
    launchesProcesses: sometimes(
      "Preview tools launch headless Chromium; session tools can start Bedrock Dedicated Server.",
      MCP_TOOLS_UNTRACED
    ),
    promptsForInput: never("stdin carries the MCP protocol."),
    dryRun: { support: "ignored" },
    notes: [
      "--isolated and --offline have no effect: the MCP server always uses https://mctools.dev/ as its content root.",
    ],
  },

  dedicatedserve: {
    readsInput: sometimes("Passes the first project to Bedrock Dedicated Server."),
    changesProject: never(),
    writesOutputFolder: never(),
    writesOtherLocations: never(),
    updatesSavedState: sometimes(
      EULA_FROM_ENVIRONMENT +
        " On Windows and Linux, downloads Bedrock Dedicated Server into the data folder and creates server " +
        "folders there.",
      BDS_PLATFORMS_UNVERIFIED
    ),
    usesNetwork: sometimes(BDS_DOWNLOAD, BDS_PLATFORMS_UNVERIFIED),
    startsLocalServer: sometimes(
      "When it starts Bedrock Dedicated Server; Windows and Linux only. " + BDS_PORTS,
      BDS_PLATFORMS_UNVERIFIED
    ),
    launchesProcesses: sometimes(
      "Bedrock Dedicated Server; Windows and Linux only. On macOS it reports that dedicated servers aren't " +
        "supported, then fails.",
      BDS_PLATFORMS_UNVERIFIED
    ),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
    notes: ["On macOS it fails to start a server but exits with code 0."],
  },

  passcodes: {
    readsInput: never(),
    changesProject: never(),
    writesOutputFolder: never(),
    writesOtherLocations: never(),
    updatesSavedState: always(
      "Rewrites envprefs.json, adding the default server domain and port when they're missing."
    ),
    usesNetwork: never(),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
    notes: [
      "The passcodes it prints are generated for this process and aren't saved, so they don't match those of a " +
        "server running in another process.",
    ],
  },

  setserverprops: {
    readsInput: never(),
    changesProject: never(),
    writesOutputFolder: never(),
    writesOtherLocations: never(),
    updatesSavedState: always(
      "Saves envprefs.json on every run, including runs that only display the properties. Without --port, it " +
        "saves port 6126, replacing a port saved earlier."
    ),
    usesNetwork: never(),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
    notes: [
      "--domain, --title, and --motd are ignored: cli/index.ts reads them from positional arguments, which this " +
        "command doesn't define.",
    ],
  },

  minecrafteulaandprivacystatement: {
    readsInput: never(),
    changesProject: never(),
    writesOutputFolder: never(),
    writesOtherLocations: never(),
    updatesSavedState: sometimes(
      "Saves the answer to its prompt, accepted or declined, to envprefs.json. --accept and " +
        "MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA=true save acceptance without asking. --yes and --json " +
        "(which implies --yes) don't accept: without --status, --accept, or the environment variable, they leave " +
        "acceptance unchanged and exit 1, and so does a run that can't prompt because stdin or stdout isn't a " +
        "terminal. Piped input, such as from echo y, doesn't accept. --status only reads, even with --accept or " +
        "the environment variable."
    ),
    usesNetwork: never(),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: sometimes(
      "Asks for confirmation unless --status, --accept, --yes, --json, or the environment variable applies, and " +
        "only when stdin and stdout are both terminals. --yes and --json skip the prompt without accepting; " +
        "without a terminal, it exits 1 instead and says how to accept."
    ),
    dryRun: { support: "ignored" },
  },

  // Render commands

  rendermodel: {
    readsInput: always("Finds the .geo.json file, and a texture that belongs with it, in the project."),
    changesProject: never(),
    writesOutputFolder: never("Ignores -o."),
    writesOtherLocations: always("The PNG at the outputPath argument, or <geometry name>.png in the current folder."),
    updatesSavedState: never(),
    usesNetwork: sometimes(
      "Headless Chromium loads vanilla fallback textures from mctools.dev unless --no-vanilla, --isolated, or --offline."
    ),
    startsLocalServer: always(RENDER_SERVER),
    launchesProcesses: always(HEADLESS_CHROMIUM),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
  },

  renderbatch: {
    readsInput: always(
      "Reads the manifest file and the project; with --stdin, each line can name another project folder."
    ),
    changesProject: never(),
    writesOutputFolder: never("Ignores -o."),
    writesOtherLocations: always("A PNG at each outputPath in the manifest."),
    updatesSavedState: never(),
    usesNetwork: sometimes(
      "Headless Chromium loads vanilla fallback textures from mctools.dev unless --no-vanilla (or vanilla: false " +
        "on an entry), --isolated, or --offline."
    ),
    startsLocalServer: always(RENDER_SERVER + " With --stdin, it stays up until stdin closes."),
    launchesProcesses: always(HEADLESS_CHROMIUM + " One instance is reused for the whole batch."),
    promptsForInput: never("--stdin reads render requests from stdin; it doesn't prompt."),
    dryRun: { support: "ignored" },
  },

  rendervanilla: {
    readsInput: never("Doesn't use the project; with @file, reads the identifiers from that file."),
    changesProject: never(),
    writesOutputFolder: never("Ignores -o."),
    writesOtherLocations: always(
      "The PNG at the outputPath argument, or block-<id>.png, item-<id>.png, or mob-<id>.png in the current " +
        "folder. Several identifiers write one PNG each into outputPath, or ./output."
    ),
    updatesSavedState: never(),
    usesNetwork: sometimes(
      "Headless Chromium loads vanilla models and textures.",
      "Where the vanilla models and textures load from wasn't traced: the viewer URL doesn't set a content root."
    ),
    startsLocalServer: always("A temporary HTTP server on a random port from 6200 to 6299."),
    launchesProcesses: always(HEADLESS_CHROMIUM),
    promptsForInput: never(),
    dryRun: { support: "honored", details: "Returns before reading identifiers or starting the render server." },
    notes: ["Several identifiers go to ./output by default, not to the -o folder."],
  },

  renderstructure: {
    readsInput: always("Finds the .mcstructure file in the project."),
    changesProject: never(),
    writesOutputFolder: never("Ignores -o."),
    writesOtherLocations: always("The PNG at the outputPath argument, or <structure name>.png in the current folder."),
    updatesSavedState: never(),
    usesNetwork: sometimes(
      "Headless Chromium loads vanilla block textures from mctools.dev unless --isolated or --offline."
    ),
    startsLocalServer: always("A temporary HTTP server on a random port from 6500 to 6999."),
    launchesProcesses: always(HEADLESS_CHROMIUM),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
  },

  buildstructure: {
    readsInput: never("Reads the IBlockVolume JSON file named by the first argument, or stdin for -, instead of -i."),
    changesProject: never(),
    writesOutputFolder: never("Ignores -o."),
    writesOtherLocations: always(
      "The .mcstructure file at the outputPath argument, or <input name>.mcstructure (output.mcstructure for " +
        "stdin) in the current folder. It doesn't replace an existing file unless -f is given."
    ),
    updatesSavedState: never(),
    usesNetwork: never(),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never("With -, reads the JSON from stdin; it doesn't prompt."),
    dryRun: { support: "ignored" },
    notes: [
      "--overwrite is ignored, although the error message suggests it; only -f, --force replaces an existing file.",
      "--preview is accepted but never renders a preview.",
    ],
  },

  // Docs commands (internal)

  docsupdateformsource: {
    readsInput: sometimes(
      "With -i, copies that folder's form files into forms/ in the output folder first. It also reads JSON " +
        "schemas from vanilla metadata, or from --schemas."
    ),
    changesProject: never(),
    writesOutputFolder: always("Writes the updated form definitions into the output folder."),
    writesOtherLocations: never(),
    updatesSavedState: never(),
    usesNetwork: sometimes(DOCS_NETWORK, DOCS_NETWORK_UNVERIFIED),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
  },

  docsupdatemccat: {
    readsInput: never("Reads vanilla and sample content through the content database, not the input folder."),
    changesProject: never(),
    writesOutputFolder: always("mccat.json."),
    writesOtherLocations: never(),
    updatesSavedState: never(),
    usesNetwork: sometimes(DOCS_NETWORK, DOCS_NETWORK_UNVERIFIED),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
  },

  docsgenerateformjson: {
    readsInput: always("Reads the form sources in the input folder."),
    changesProject: never(),
    writesOutputFolder: always("The generated form JSON files."),
    writesOtherLocations: never(),
    updatesSavedState: never(),
    usesNetwork: sometimes(DOCS_NETWORK, DOCS_NETWORK_UNVERIFIED),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
  },

  docsgeneratemarkdown: {
    readsInput: always("Reads the form definitions in the input folder, and --reference-folder when given."),
    changesProject: never(),
    writesOutputFolder: always("Deletes everything in the output folder, then writes the Markdown reference there."),
    writesOtherLocations: never(),
    updatesSavedState: never(),
    usesNetwork: sometimes(DOCS_NETWORK, DOCS_NETWORK_UNVERIFIED),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
    notes: [
      "Deletes everything in the output folder before writing, so -o must name a folder that holds only generated docs.",
    ],
  },

  docsgeneratetypes: {
    readsInput: always("Reads the form definitions in the input folder."),
    changesProject: never(),
    writesOutputFolder: always(
      "Deletes everything in the output folder, then writes TypeScript type definitions there."
    ),
    writesOtherLocations: never(),
    updatesSavedState: never(),
    usesNetwork: sometimes(DOCS_NETWORK, DOCS_NETWORK_UNVERIFIED),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
    notes: [
      "Deletes everything in the output folder before writing, so -o must name a folder that holds only generated types.",
    ],
  },

  docsgeneratejsonschema: {
    readsInput: always("Reads the form definitions in the input folder."),
    changesProject: never(),
    writesOutputFolder: always("Deletes everything in the output folder, then writes JSON Schema files there."),
    writesOtherLocations: never(),
    updatesSavedState: never(),
    usesNetwork: sometimes(DOCS_NETWORK, DOCS_NETWORK_UNVERIFIED),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
    notes: [
      "Deletes everything in the output folder before writing, so -o must name a folder that holds only generated schemas.",
    ],
  },

  generateschemapackage: {
    readsInput: always(
      "Reads the form definitions in the input folder, and res/latest/van/preview/version.json two folders above it."
    ),
    changesProject: never(),
    writesOutputFolder: always(
      "schemas/, types/, forms/, package.json, catalog.json, settings-template.json, tsconfig.json, and .npmignore."
    ),
    writesOtherLocations: never(),
    updatesSavedState: never(),
    usesNetwork: never(),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
    notes: [
      "When the output folder is the input folder, it writes schemas/ and types/ there, then copies the input " +
        "folder into its own forms/ subfolder over and over until the path is too long.",
    ],
  },

  // World commands

  world: {
    readsInput: always("Looks for worlds among the project's items (see notes); set also lists the project folder."),
    changesProject: sometimes(
      "`world set` with --betaapis, --no-betaapis, --editor, or --no-editor saves a new world's level.dat, " +
        "level.dat_old, and levelname.txt when a setting changes, because existing worlds aren't found (see " +
        "notes; seen with samplecontent/world). It saves one world per project: in the project's worlds/ or " +
        "minecraftWorlds/ folder if it has one, and otherwise at the project root. When -o's path starts with the " +
        "input folder's path and the rest is longer than two characters, it saves the world at that rest inside " +
        "that folder instead (see writesOutputFolder and notes). When the input folder holds project folders " +
        "instead of being a project itself, each of those projects gets a world, so -o stays empty. Without set, " +
        "these flags change nothing."
    ),
    writesOutputFolder: sometimes(
      "`world set` with a setting that changes writes the new world's files into -o in two cases. One is when -o " +
        "is the input folder itself, as in `-i <project> -o <project>`, because every project is inside it. The other " +
        "is when -o is a subfolder of the input folder, other than a one-character folder directly inside it, " +
        "the input folder is a project itself, and either the project has no worlds/ or minecraftWorlds/ folder " +
        "or -o is that world folder itself. That includes running it from the project folder without -i or -o, " +
        "where the default ./out is inside the project."
    ),
    writesOtherLocations: never(),
    updatesSavedState: never(),
    usesNetwork: never(),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
    notes: [
      "It lists project items without first reading them from files, so worlds already in the project aren't found.",
      "Because -o is created before the command runs, it can create the world folder. `-o <project>/worlds` " +
        "creates worlds/, and the world lands in worlds/worlds, inside -o. `-o <project>/worlds/test` puts it in " +
        "worlds/worlds/test, so -o stays empty.",
      "Whether -o is inside the input folder is a plain string-prefix check. A sibling whose name starts with " +
        "the project's, such as `-o <project>-out`, counts as inside, so the world lands in <project>/-out/ and " +
        "-o stays empty. A one-character folder directly inside, such as `-o <project>/a`, counts as the project " +
        "root, so the world lands there.",
    ],
  },

  ensureworld: {
    readsInput: always("Lists the project's items to find a world."),
    changesProject: sometimes(
      "Saves no world files; the world exists only in memory. But when -o is inside the input folder, as when " +
        "it runs from a project folder without -i or -o, it creates the folder it picked for the world there, " +
        "empty: -o itself, or the same path under the project's worlds/ folder (see the world entry)."
    ),
    writesOutputFolder: never(
      "Uses -o only to choose a world subfolder when -o is inside the input folder (see changesProject). " +
        "Otherwise it doesn't create -o."
    ),
    writesOtherLocations: never(),
    updatesSavedState: never(),
    usesNetwork: never(),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "ignored", details: NO_EFFECTS_TO_SKIP },
    notes: ["Prints 'Created world at …' even though nothing is written."],
  },

  // Content commands

  version: {
    readsInput: never(),
    changesProject: never(),
    writesOutputFolder: never(),
    writesOtherLocations: never(),
    updatesSavedState: never(),
    usesNetwork: never(),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "ignored", details: NO_EFFECTS_TO_SKIP },
  },

  skills: {
    readsInput: never("Reads the skills bundled with the CLI, and ignores -i and -o."),
    changesProject: never(),
    writesOutputFolder: never(),
    writesOtherLocations: never(),
    updatesSavedState: never(),
    usesNetwork: never(),
    startsLocalServer: never(),
    launchesProcesses: never(),
    promptsForInput: never(),
    dryRun: { support: "ignored", details: NO_EFFECTS_TO_SKIP },
  },

  view: {
    readsInput: always("Serves the input folder, read-only, through a local web server."),
    changesProject: never(),
    writesOutputFolder: never(),
    writesOtherLocations: never(),
    updatesSavedState: always(SAVES_SERVER_DEFAULTS),
    usesNetwork: sometimes(SERVER_VANILLA_FILES),
    startsLocalServer: always(CONTENT_SERVER),
    launchesProcesses: sometimes(OPENS_BROWSER),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
    notes: [
      "The browser is signed in with the full read-only passcode, so it can't edit files, run tool commands, or " +
        "accept the EULA.",
      LOOKS_FOR_PROJECTS_IN_OUTPUT_FOLDER,
    ],
  },

  edit: {
    readsInput: always("Serves the input folder through a local web server in edit mode."),
    changesProject: sometimes("Files in the input folder change when a signed-in user edits them in the browser."),
    writesOutputFolder: never(),
    writesOtherLocations: sometimes(
      "The browser is signed in with the admin passcode, so it can run tool commands. " + TOOL_COMMANDS_WRITE_FILES,
      TOOL_COMMANDS_UNTRACED
    ),
    updatesSavedState: always(
      SAVES_SERVER_DEFAULTS +
        " The browser is signed in with the admin passcode, so accepting the EULA in the web UI saves that too. " +
        "Deploying to Bedrock Dedicated Server from the web UI downloads it into the data folder and creates " +
        "server folders there (Windows and Linux).",
      BDS_PLATFORMS_UNVERIFIED
    ),
    usesNetwork: sometimes(
      SERVER_VANILLA_FILES + " When the web UI deploys to Bedrock Dedicated Server: " + BDS_DOWNLOAD,
      BDS_PLATFORMS_UNVERIFIED + " " + TOOL_COMMANDS_UNTRACED
    ),
    startsLocalServer: always(
      CONTENT_SERVER + " When the web UI deploys to Bedrock Dedicated Server (see launchesProcesses): " + BDS_PORTS,
      BDS_PLATFORMS_UNVERIFIED
    ),
    launchesProcesses: sometimes(
      OPENS_BROWSER +
        " Bedrock Dedicated Server, when the web UI deploys to it or runs the server tool command; Windows and " +
        "Linux only.",
      BDS_PLATFORMS_UNVERIFIED + " " + TOOL_COMMANDS_UNTRACED
    ),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
    notes: [LOOKS_FOR_PROJECTS_IN_OUTPUT_FOLDER],
  },

  autotest: {
    readsInput: always("Loads each project and deploys its packs to Bedrock Dedicated Server."),
    changesProject: never(),
    writesOutputFolder: sometimes(
      "After each server run: <project>.csv and <project>.distill.csv; at the end, runs.csv."
    ),
    writesOtherLocations: never(),
    updatesSavedState: sometimes(
      "On Windows and Linux, downloads Bedrock Dedicated Server into the data folder and deploys the packs into " +
        "a server folder there.",
      BDS_PLATFORMS_UNVERIFIED
    ),
    usesNetwork: sometimes(BDS_DOWNLOAD, BDS_PLATFORMS_UNVERIFIED),
    startsLocalServer: sometimes(
      "While Bedrock Dedicated Server runs; Windows and Linux only. " + BDS_PORTS,
      BDS_PLATFORMS_UNVERIFIED
    ),
    launchesProcesses: sometimes(
      "Bedrock Dedicated Server, when the EULA is saved as accepted; Windows and Linux only.",
      BDS_PLATFORMS_UNVERIFIED
    ),
    promptsForInput: never(),
    dryRun: { support: "ignored" },
    notes: [
      "Unlike dedicatedserve, it doesn't accept the EULA from MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA; " +
        "acceptance must already be saved.",
    ],
  },
};

const COMMAND_NAMES_BY_LOWER_CASE: ReadonlyMap<string, CommandName> = new Map(
  (Object.keys(COMMAND_EFFECTS) as CommandName[]).map((name) => [name.toLowerCase(), name])
);

/** Returns the registered name for a command name in any letter case, or undefined for an unknown command. */
export function getCommandName(commandName: string): CommandName | undefined {
  return COMMAND_NAMES_BY_LOWER_CASE.get(commandName.toLowerCase());
}

/**
 * Returns the effects recorded for a command, looked up by its registered name (ICommandMetadata.name) in any
 * letter case. Aliases aren't recognized: resolve them through the CommandRegistry first.
 */
export function getCommandEffects(commandName: string): ICommandEffects | undefined {
  const name = getCommandName(commandName);

  return name === undefined ? undefined : COMMAND_EFFECTS[name];
}

/** Returns the startup effects that apply to a command, in STARTUP_EFFECTS order. */
export function getStartupEffectIds(commandName: string): StartupEffectId[] {
  const name = getCommandName(commandName);

  if (name === undefined) {
    return [];
  }

  return (Object.keys(STARTUP_EFFECTS) as StartupEffectId[]).filter((id) => appliesTo(STARTUP_EFFECTS[id], name));
}

/**
 * The parts of a run's options that decide whether it needs the output folder. CommandContextFactory passes its raw
 * options, and cli/index.ts passes Commander's.
 */
export interface IOutputFolderRun {
  /** -i, --input-folder: the folder the run's projects come from. */
  readonly inputFolder?: string;

  /** --if, --input-file: the package the run's project comes from. */
  readonly inputFile?: unknown;
}

/**
 * True when a run of the command needs the output folder (-o, default ./out), so the CLI creates it before the
 * command runs:
 * - add, create, fix, view, and edit (detectsProjectsInOutputFolder) need it exactly when they look for their
 *   projects there: without -i or --if, which name the projects instead. Their entries' writesOutputFolder records
 *   only changes to the project they find there, so with -i or --if they never use -o. view and edit serve the
 *   input folder, but without -i they still look for projects in -o first, so they still need it then.
 * - Every other command needs it when it writes there (its writesOutputFolder isn't "never"), whatever its input.
 * For every other run, the CLI leaves -o alone and doesn't create ./out in the current folder, though ensureworld
 * reads -o and creates it itself when it's inside the input folder. cli/index.ts's header names -o for runs that
 * need it and for commands that read it (ensureworld), except edit-in-place commands, which show only the input
 * folder. Without `run`, it answers for a run with default options, which have no -i. Looks names up like
 * getCommandEffects(), and is false for a name that isn't registered.
 */
export function needsOutputFolder(commandName: string, run: IOutputFolderRun = {}): boolean {
  const name = getCommandName(commandName);

  if (name === undefined) {
    return false;
  }

  if (appliesTo(STARTUP_EFFECTS.detectsProjectsInOutputFolder, name)) {
    return !run.inputFolder && !hasInputFileOption(run.inputFile);
  }

  return COMMAND_EFFECTS[name].writesOutputFolder.frequency !== "never";
}

function appliesTo(startupEffect: IStartupEffect, name: CommandName): boolean {
  if (startupEffect.commands !== undefined && !startupEffect.commands.includes(name)) {
    return false;
  }

  return !(startupEffect.exceptCommands ?? []).includes(name);
}
