/**
 * GlobalOptions - Program-level (global) options for the `mct` CLI
 *
 * Every option registered on the root Commander program is declared here, once, together with
 * the help group it belongs to. Commander parses program options anywhere on the command line
 * (`mct validate -i ./proj` works), so registration is deliberately broader than relevance: most
 * of these options only mean something to a few commands.
 *
 * Groups are narrow on purpose, so help can list an option only on commands that read it:
 * - `process` options are applied by cli/index.ts before any command runs (logging, network,
 *   base path). Help lists them on every command.
 * - Every other group is listed under INHERITED FLAGS only for commands that name it in
 *   `ICommandMetadata.globalOptionGroups`. Pick groups by what the command reads from its
 *   context, not by what it seems related to.
 * - `root` options appear only in root help (`mct --help`).
 * - `unused` options still parse, so existing scripts keep working, but nothing reads them (for
 *   example, pack loading is disabled). They are hidden like `hidden` options, which keeps them
 *   out of every help surface: `mct` help, the generated agent CLI reference
 *   (CliReferenceGenerator), and Commander's option suggestions. `hidden` options are internal.
 *
 * Adding a new global option: add it to GLOBAL_OPTIONS with the group of the commands that read
 * it. CommandHelpTest fails if an option has no group or a group is listed by no command.
 *
 * RELATED FILES:
 * - cli/core/CliProgram.ts: calls configureGlobalOptions() while building the program
 * - cli/core/CliReferenceGenerator.ts: generates the creator-tools-cli skill's command reference
 * - cli/core/CommandHelpWriter.ts: renders options by group
 * - cli/core/ICommand.ts: ICommandMetadata.globalOptionGroups
 */

import { Command, Option } from "commander";

/**
 * Which part of the command surface a global option is meaningful for.
 */
export type GlobalOptionGroup =
  | "process"
  | "json"
  | "input"
  | "projects"
  | "outputFolder"
  | "outputFile"
  | "outputType"
  | "dryRun"
  | "force"
  | "prompts"
  | "threads"
  | "warnOnly"
  | "launch"
  | "betaApis"
  | "editor"
  | "server"
  | "passcodes"
  | "ssl"
  | "root"
  | "unused"
  | "hidden";

/** Groups that are not listed per command. */
export const IMPLICIT_GROUPS: readonly GlobalOptionGroup[] = ["process", "root", "unused", "hidden"];

interface IGlobalOptionSpec {
  flags: string;
  description: string;
  group: GlobalOptionGroup;
  defaultValue?: string | boolean;
  /** Only registered when the CLI runs with --debug. */
  debugOnly?: boolean;
}

const GLOBAL_OPTIONS: IGlobalOptionSpec[] = [
  {
    flags: "-i, --input-folder [path]",
    description: "Path to the input folder. If not specified, the current working directory is used.",
    group: "input",
  },
  {
    flags: "--if, --input-file <path>",
    description: "Path to the input MCWorld, MCTemplate, MCPack, MCAddon or other zip file.",
    group: "projects",
  },
  {
    flags: "--single",
    description: "When pointed at a folder via -i, force that folder to be processed as a single project.",
    group: "projects",
  },
  {
    flags: "-o, --output-folder <path>",
    description: "Path to the output project folder. If not specified, the current working directory + 'out' is used.",
    group: "outputFolder",
    defaultValue: "out",
  },
  {
    flags: "--psw, --project-starts-with <prefix>",
    description: "Only process a project if it starts with the starter term; this can be used to subdivide processing.",
    group: "projects",
  },
  {
    flags: "--afs, --additional-files [paths]",
    description: "Comma-separated list of additional files to add to projects.",
    group: "projects",
  },
  {
    flags: "--bp, --base-path <path>",
    description: "Path, relative to the current working folder, where common data files and folders are found.",
    group: "process",
  },
  {
    flags: "--of, --output-file [path]",
    description: "Path to the export file, if applicable for the command you are using.",
    group: "outputFile",
  },
  {
    flags: "--ot, --output-type [type]",
    description: "Type of output, if applicable for the command you are using.",
    group: "outputType",
  },
  { flags: "--updatepc, --update-passcode [passcode]", description: "Sets update passcode.", group: "passcodes" },
  { flags: "--adminpc, --admin-passcode [passcode]", description: "Sets admin passcode.", group: "passcodes" },
  { flags: "--displaypc, --display-passcode [passcode]", description: "Sets display passcode.", group: "passcodes" },
  {
    flags: "--fullropc, --full-readonly-passcode [passcode]",
    description: "Sets full read only passcode.",
    group: "passcodes",
  },
  {
    flags: "-l, --launch",
    description: "Launches the final product in Minecraft when done.",
    group: "launch",
    defaultValue: false,
  },
  {
    flags: "--ew, --ensure-world",
    description: "Ensures that a flat GameTest world is synchronized with the project.",
    group: "unused",
  },
  {
    flags: "--isolated",
    description: "Do not load vanilla Minecraft resources (e.g., textures, ground blocks) from the web",
    group: "process",
  },
  {
    flags: "--offline",
    description:
      "Same as --isolated. Useful in CI where the network is unreliable; some checks (e.g. latest version) may still use the network.",
    group: "process",
  },
  {
    flags: "--bpu, --behavior-pack <uuid>",
    description: "Adds a set of behavior pack UUIDs as references for any worlds that are updated.",
    group: "unused",
  },
  {
    flags: "--rpu, --resource-pack <uuid>",
    description: "Adds a set of resources pack UUIDs as references for any worlds that are updated.",
    group: "unused",
  },
  {
    flags: "--betaapis, --beta-apis",
    description: "Ensures that the Beta APIs experiment is set for any worlds that are updated.",
    group: "betaApis",
  },
  {
    flags: "--no-betaapis, --no-beta-apis",
    description: "Removes the Beta APIs experiment if set.",
    group: "betaApis",
  },
  { flags: "-f, --force", description: "Force any updates.", group: "force" },
  { flags: "--editor", description: "Ensures that the world is an Editor world.", group: "editor" },
  {
    flags: "--once",
    description: "When running as a server, only process one request and then shutdown.",
    group: "server",
    defaultValue: false,
  },
  { flags: "--no-editor", description: "Removes the editor setting from the world.", group: "editor" },
  { flags: "--threads [count]", description: "Targeted number of threads to use.", group: "threads" },
  {
    flags: "-n, --dry-run",
    description:
      "Show what would be done without making changes or writing files. Commands that don't support it exit " +
      "with an error before doing anything.",
    group: "dryRun",
  },
  {
    flags: "-d, --debug",
    description: "Add debug logging, options, and even more experimental commands.",
    group: "process",
  },
  {
    flags: "--mct, --mctemplate <path>",
    description: "When using a world, uses a .mctemplate file (or a .zip world template) for that world.",
    group: "unused",
  },
  { flags: "--preview-server", description: "Specifies whether to use a preview server.", group: "unused" },
  {
    flags: "--pack, --mcpack <path>",
    description: "When using a world, uses and adds pack references (.mcpack, .mcaddon, or .zip) for that world.",
    group: "unused",
  },
  { flags: "--verbose", description: "Show verbose log messages.", group: "process" },
  {
    flags: "-q, --quiet",
    description: "Suppress non-essential output. Only show errors and final results.",
    group: "process",
  },
  {
    flags: "--warn-only",
    description: "Report validation errors as warnings without setting a failure exit code.",
    group: "warnOnly",
  },
  { flags: "--json", description: "Output results in JSON format for machine parsing.", group: "json" },
  {
    flags: "-y, --yes",
    description: "Auto-accept defaults for all interactive prompts (CI / non-interactive use).",
    group: "prompts",
  },
  {
    flags: "--experimental-ssl-cert <path>",
    description:
      "(Experimental) Path to SSL certificate file in PEM format. Use with --experimental-ssl-key. " +
      "This enables HTTPS. Use EITHER cert+key OR --experimental-ssl-pfx, not both.",
    group: "ssl",
  },
  {
    flags: "--experimental-ssl-key <path>",
    description:
      "(Experimental) Path to SSL private key file in PEM format. Required when using --experimental-ssl-cert. " +
      "Keep this file secure and never share it.",
    group: "ssl",
  },
  {
    flags: "--experimental-ssl-pfx <path>",
    description:
      "(Experimental) Path to PKCS12/PFX certificate bundle containing both cert and key. " +
      "Common on Windows. Use EITHER pfx OR --experimental-ssl-cert + --experimental-ssl-key, not both.",
    group: "ssl",
  },
  {
    flags: "--experimental-ssl-pfx-passphrase <passphrase>",
    description: "(Experimental) Passphrase to decrypt the PFX file. Required only if your PFX is password-protected.",
    group: "ssl",
  },
  {
    flags: "--experimental-ssl-ca <path>",
    description:
      "(Experimental) Path to CA certificate chain file (PEM format). Needed when using certificates from " +
      "a Certificate Authority (e.g., Let's Encrypt, DigiCert) to provide the full trust chain. " +
      "Not needed for self-signed certificates.",
    group: "ssl",
  },
  {
    flags: "--experimental-ssl-port <port>",
    description:
      "(Experimental) Port for HTTPS server. Defaults to 443. Use a port > 1024 to avoid requiring admin privileges.",
    group: "ssl",
  },
  {
    flags: "--experimental-ssl-only",
    description:
      "(Experimental) Only start HTTPS server, do not start HTTP. Use this for production to ensure all traffic is encrypted.",
    group: "ssl",
  },
  {
    flags: "--unsafe-skip-signature-validation",
    description:
      "UNSAFE: Skip digital signature verification of Bedrock Dedicated Server executable. " +
      "Only use this if you trust the server binary and understand the security implications.",
    group: "unused",
  },
  {
    flags: "--internalOnlyRunningInTheContextOfTestCommandLines",
    description: "Do not use. For internal self-testing use only functionality.",
    group: "hidden",
  },
  {
    flags: "--all-commands",
    description: "Show all commands, including content-production tools.",
    group: "root",
  },
  {
    flags: "--ssp, --source-server-path [path]",
    description:
      "Source path to use for instances Bedrock Dedicated Server. You can download this from https://www.minecraft.net/download/server/bedrock.  If not specified, this tool will manage downloads of Minecraft Dedicated Server itself.",
    group: "unused",
    debugOnly: true,
  },
  {
    flags: "--dsp, --direct-server-path [path]",
    description: "If specified, dedicated servers are run directly from a particular folder.",
    group: "unused",
    debugOnly: true,
  },
  {
    flags: "--difficulty [difficulty]",
    description: "For the world, a difficulty level. Options include peaceful, easy, normal, and hard",
    group: "unused",
    defaultValue: "peaceful",
    debugOnly: true,
  },
  {
    flags: "--gametype [gametype]",
    description: "For the world, a game type. Options include survival, creative, and adventure.",
    group: "unused",
    defaultValue: "survival",
    debugOnly: true,
  },
  {
    flags: "--generator [generator]",
    description: "For the world, a world generator type. Options old, infinite, and flat.",
    group: "unused",
    defaultValue: "infinite",
    debugOnly: true,
  },
  { flags: "--seed [seed]", description: "For the world, a random seed to use.", group: "unused", debugOnly: true },
  {
    flags: "--create",
    description: "For the world, will force the creation of a new world.",
    group: "unused",
    debugOnly: true,
  },
  {
    flags: "--op, --operator <playerId>",
    description: "A list of player IDs to make operator when the server starts",
    group: "unused",
    debugOnly: true,
  },
  {
    flags: "--cmd, --commands <commands>",
    description: "Commands to run, if running a dedicated server.",
    group: "unused",
    defaultValue: "out",
    debugOnly: true,
  },
  {
    flags: "--gt, --gametest <name>",
    description: "Game Test to run on the command line.",
    group: "unused",
    debugOnly: true,
  },
];

/** Options Commander registers itself (help, version), keyed by long flag. */
const BUILT_IN_OPTION_GROUPS: Record<string, GlobalOptionGroup> = {
  "--help": "root",
  "--version": "root",
};

const groupsByLongFlag = new Map<string, GlobalOptionGroup>();

for (const spec of GLOBAL_OPTIONS) {
  const long = new Option(spec.flags).long;
  if (long) {
    groupsByLongFlag.set(long, spec.group);
  }
}

for (const long of Object.keys(BUILT_IN_OPTION_GROUPS)) {
  groupsByLongFlag.set(long, BUILT_IN_OPTION_GROUPS[long]);
}

/**
 * Registers every global option on the root program. Also used by CliReferenceGenerator, so the
 * generated command reference lists exactly the options the CLI accepts.
 * @param includeDebugOptions Whether to register options that only exist in --debug mode.
 */
export function configureGlobalOptions(program: Command, options: { includeDebugOptions?: boolean } = {}): Command {
  for (const spec of GLOBAL_OPTIONS) {
    if (spec.debugOnly && !options.includeDebugOptions) {
      continue;
    }

    const option = new Option(spec.flags, spec.description);

    if (spec.defaultValue !== undefined) {
      option.default(spec.defaultValue);
    }

    if (spec.group === "hidden" || spec.group === "unused") {
      option.hideHelp();
    }

    program.addOption(option);
  }

  return program;
}

/**
 * Returns the help group for a root-level option, or undefined when the option is not a
 * known global option.
 */
export function getGlobalOptionGroup(option: Option): GlobalOptionGroup | undefined {
  return option.long ? groupsByLongFlag.get(option.long) : undefined;
}
