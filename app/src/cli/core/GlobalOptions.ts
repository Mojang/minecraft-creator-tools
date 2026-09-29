import { Command } from "commander";

/**
 * Adds the global options that every `mct` command accepts.
 *
 * Kept out of cli/index.ts so the generated command reference (CliReferenceGenerator), which the
 * creator-tools-cli agent skill ships, lists exactly the options the CLI accepts. Debug-only options
 * are still added in cli/index.ts.
 */
export function configureGlobalOptions(program: Command): Command {
  return program
    .option(
      "-i, --input-folder [path to folder]",
      "Path to the input folder. If not specified, the current working directory is used."
    )
    .option(
      "--if, --input-file [path to file]",
      "Path to the input MCWorld, MCTemplate, MCPack, MCAddon or other zip file."
    )
    .option(
      "-o, --output-folder <path to folder>",
      "Path to the output project folder. If not specified, the current working directory + 'out' is used.",
      "out"
    )
    .option(
      "--psw, --project-starts-with <starter term>",
      "Only process a project if it starts with the starter term; this can be used to subdivide processing."
    )
    .option(
      "--bp, --base-path <path to folder>",
      "Path, relative to the current working folder, where common data files and folders are found."
    )
    .option("--afs, --additional-files [path to file]", "Comma-separated list of additional files to add to projects.")
    .option(
      "--of, --output-file [path to file]",
      "Path to the export file, if applicable for the command you are using."
    )
    .option("--ot, --output-type [output type]", "Type of output, if applicable for the command you are using.")
    .option("--updatepc, --update-passcode [update passcode]", "Sets update passcode.")
    .option("--adminpc, --admin-passcode [admin passcode]", "Sets admin passcode.")
    .option("--displaypc, --display-passcode [display passcode]", "Sets display passcode.")
    .option("--fullropc, --full-readonly-passcode [full read only passcode]", "Sets full read only passcode.")
    .option("-l, --launch", "Launches the final product in Minecraft when done.", false)
    .option("--ew, --ensure-world", "Ensures that a flat GameTest world is synchronized with the project.")
    .option("--isolated", "Do not load vanilla Minecraft resources (e.g., textures, ground blocks) from the web")
    .option(
      "--offline",
      "Alias for --isolated. Skip loading vanilla Minecraft web resources (textures, ground blocks); useful for CI environments where network is unreliable. Note: some other code paths (e.g. latest-version checks) may still attempt network requests."
    )
    .option(
      "--bpu, --behavior-pack <behavior pack uuid>",
      "Adds a set of behavior pack UUIDs as references for any worlds that are updated."
    )
    .option(
      "--rpu, --resource-pack <resource pack uuid>",
      "Adds a set of resources pack UUIDs as references for any worlds that are updated."
    )
    .option("--betaapis, --beta-apis", "Ensures that the Beta APIs experiment is set for any worlds that are updated.")
    .option("--no-betaapis, --no-beta-apis", "Removes the Beta APIs experiment if set.")
    .option("-f, --force", "Force any updates.")
    .option("--single", "When pointed at a folder via -i, force that folder to be processed as a single project.")
    .option("--editor", "Ensures that the world is an Editor world.")
    .option("--once", "When running as a server, only process one request and then shutdown.", false)
    .option("--no-editor", "Removes the editor setting from the world.")
    .option("--threads [thread count]", "Targeted number of threads to use.")
    .option("-n, --dry-run", "Show what would be done without making changes or writing files.")
    .option("-d, --debug", "Add debug logging, options, and even more experimental commands.")
    .option(
      "--mct, --mctemplate <path to a .mctemplate or a .zip world template>",
      "When using a world, uses a .mctemplate file for that world"
    )
    .option("--preview-server", "Specifies whether to use a preview server.")
    .option(
      "--pack, --mcpack <path to .mcpack, .mcaddon, or .zip pack>",
      "When using a world, uses and adds pack references for that world"
    )
    .option("--verbose", "Show verbose log messages.")
    .option("-q, --quiet", "Suppress non-essential output. Only show errors and final results.")
    .option("--warn-only", "Report validation errors as warnings without setting a failure exit code.")
    .option("--json", "Output results in JSON format for machine parsing.")
    .option("-y, --yes", "Auto-accept defaults for all interactive prompts (CI / non-interactive use).")
    .option(
      "--experimental-ssl-cert <path>",
      "(Experimental) Path to SSL certificate file in PEM format. Use with --experimental-ssl-key. " +
        "This enables HTTPS. Use EITHER cert+key OR --experimental-ssl-pfx, not both."
    )
    .option(
      "--experimental-ssl-key <path>",
      "(Experimental) Path to SSL private key file in PEM format. Required when using --experimental-ssl-cert. " +
        "Keep this file secure and never share it."
    )
    .option(
      "--experimental-ssl-pfx <path>",
      "(Experimental) Path to PKCS12/PFX certificate bundle containing both cert and key. " +
        "Common on Windows. Use EITHER pfx OR --experimental-ssl-cert + --experimental-ssl-key, not both."
    )
    .option(
      "--experimental-ssl-pfx-passphrase <passphrase>",
      "(Experimental) Passphrase to decrypt the PFX file. Required only if your PFX is password-protected."
    )
    .option(
      "--experimental-ssl-ca <path>",
      "(Experimental) Path to CA certificate chain file (PEM format). Needed when using certificates from " +
        "a Certificate Authority (e.g., Let's Encrypt, DigiCert) to provide the full trust chain. " +
        "Not needed for self-signed certificates."
    )
    .option(
      "--experimental-ssl-port <port>",
      "(Experimental) Port for HTTPS server. Defaults to 443. Use a port > 1024 to avoid requiring admin privileges."
    )
    .option(
      "--experimental-ssl-only",
      "(Experimental) Only start HTTPS server, do not start HTTP. Use this for production to ensure all traffic is encrypted."
    )
    .option(
      "--unsafe-skip-signature-validation",
      "UNSAFE: Skip digital signature verification of Bedrock Dedicated Server executable. " +
        "Only use this if you trust the server binary and understand the security implications."
    )
    .option(
      "--internalOnlyRunningInTheContextOfTestCommandLines",
      "Do not use. For internal self-testing use only functionality."
    );
}
