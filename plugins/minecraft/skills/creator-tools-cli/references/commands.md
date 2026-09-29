<!-- Generated from the mct command definitions by CliReferenceGenerator. Don't edit by hand: run `npm run update-cli-skill-reference` in app/. -->

# mct command reference

Run commands as `npx -y @minecraft/creator-tools@latest <command> [arguments] [options]`, or `mct <command>` when Minecraft Creator Tools is installed globally. `<command> --help` prints the same details.

## Global options

These work with every command, though each command only uses the ones that apply to it.

- `-i, --input-folder [path to folder]`: Path to the input folder. If not specified, the current working directory is used.
- `--if, --input-file [path to file]`: Path to the input MCWorld, MCTemplate, MCPack, MCAddon or other zip file.
- `-o, --output-folder <path to folder>`: Path to the output project folder. If not specified, the current working directory + 'out' is used. Default: `out`.
- `--psw, --project-starts-with <starter term>`: Only process a project if it starts with the starter term; this can be used to subdivide processing.
- `--bp, --base-path <path to folder>`: Path, relative to the current working folder, where common data files and folders are found.
- `--afs, --additional-files [path to file]`: Comma-separated list of additional files to add to projects.
- `--of, --output-file [path to file]`: Path to the export file, if applicable for the command you are using.
- `--ot, --output-type [output type]`: Type of output, if applicable for the command you are using.
- `--updatepc, --update-passcode [update passcode]`: Sets update passcode.
- `--adminpc, --admin-passcode [admin passcode]`: Sets admin passcode.
- `--displaypc, --display-passcode [display passcode]`: Sets display passcode.
- `--fullropc, --full-readonly-passcode [full read only passcode]`: Sets full read only passcode.
- `-l, --launch`: Launches the final product in Minecraft when done.
- `--ew, --ensure-world`: Ensures that a flat GameTest world is synchronized with the project.
- `--isolated`: Do not load vanilla Minecraft resources (e.g., textures, ground blocks) from the web.
- `--offline`: Alias for --isolated. Skip loading vanilla Minecraft web resources (textures, ground blocks); useful for CI environments where network is unreliable. Note: some other code paths (e.g. latest-version checks) may still attempt network requests.
- `--bpu, --behavior-pack <behavior pack uuid>`: Adds a set of behavior pack UUIDs as references for any worlds that are updated.
- `--rpu, --resource-pack <resource pack uuid>`: Adds a set of resources pack UUIDs as references for any worlds that are updated.
- `--betaapis, --beta-apis`: Ensures that the Beta APIs experiment is set for any worlds that are updated.
- `--no-betaapis, --no-beta-apis`: Removes the Beta APIs experiment if set.
- `-f, --force`: Force any updates.
- `--single`: When pointed at a folder via -i, force that folder to be processed as a single project.
- `--editor`: Ensures that the world is an Editor world.
- `--once`: When running as a server, only process one request and then shutdown.
- `--no-editor`: Removes the editor setting from the world.
- `--threads [thread count]`: Targeted number of threads to use.
- `-n, --dry-run`: Show what would be done without making changes or writing files.
- `-d, --debug`: Add debug logging, options, and even more experimental commands.
- `--mct, --mctemplate <path to a .mctemplate or a .zip world template>`: When using a world, uses a .mctemplate file for that world.
- `--preview-server`: Specifies whether to use a preview server.
- `--pack, --mcpack <path to .mcpack, .mcaddon, or .zip pack>`: When using a world, uses and adds pack references for that world.
- `--verbose`: Show verbose log messages.
- `-q, --quiet`: Suppress non-essential output. Only show errors and final results.
- `--warn-only`: Report validation errors as warnings without setting a failure exit code.
- `--json`: Output results in JSON format for machine parsing.
- `-y, --yes`: Auto-accept defaults for all interactive prompts (CI / non-interactive use).
- `--experimental-ssl-cert <path>`: (Experimental) Path to SSL certificate file in PEM format. Use with --experimental-ssl-key. This enables HTTPS. Use EITHER cert+key OR --experimental-ssl-pfx, not both.
- `--experimental-ssl-key <path>`: (Experimental) Path to SSL private key file in PEM format. Required when using --experimental-ssl-cert. Keep this file secure and never share it.
- `--experimental-ssl-pfx <path>`: (Experimental) Path to PKCS12/PFX certificate bundle containing both cert and key. Common on Windows. Use EITHER pfx OR --experimental-ssl-cert + --experimental-ssl-key, not both.
- `--experimental-ssl-pfx-passphrase <passphrase>`: (Experimental) Passphrase to decrypt the PFX file. Required only if your PFX is password-protected.
- `--experimental-ssl-ca <path>`: (Experimental) Path to CA certificate chain file (PEM format). Needed when using certificates from a Certificate Authority (e.g., Let's Encrypt, DigiCert) to provide the full trust chain. Not needed for self-signed certificates.
- `--experimental-ssl-port <port>`: (Experimental) Port for HTTPS server. Defaults to 443. Use a port > 1024 to avoid requiring admin privileges.
- `--experimental-ssl-only`: (Experimental) Only start HTTPS server, do not start HTTP. Use this for production to ensure all traffic is encrypted.
- `--unsafe-skip-signature-validation`: UNSAFE: Skip digital signature verification of Bedrock Dedicated Server executable. Only use this if you trust the server binary and understand the security implications.

## Commands

### Content

#### `view`

View Minecraft content in the browser (read-only)

#### `edit`

Edit Minecraft content in the browser (read-write)

#### `autotest`

Run auto-tests by deploying projects to BDS.

### Information

#### `info`

Aliases: `i`

Displays information about the current project.

#### `version`

Aliases: `ver`, `v`

Display version information.

#### `skills [name] [file]`

Aliases: `skill`

List agent skills: step-by-step guides that show AI agents how to do common add-on tasks. Name one to print it.

Arguments:

- `[name]`: Skill to print. Leave out to list every skill.
- `[file]`: A file inside the skill, such as references/behaviors.md. Defaults to SKILL.md.

### Project

#### `create [name] [template] [creator] [description]`

Aliases: `c`

Creates a new Minecraft project.

Arguments:

- `[name]`: Desired project name.
- `[template]`: Template name.
- `[creator]`: Creator name.
- `[description]`: Project description.

#### `add [type] [name]`

Aliases: `a`

Adds new content into this Minecraft project.

Arguments:

- `[type]`: Type of item to add: entity, block, item, spawnLootRecipes, worldGen, visuals, singleFiles, or a gallery template ID.
- `[name]`: Desired item namespace/name.

Options:

- `--list-types`: List the available content type categories and gallery template ids, then exit.

#### `fix [fix]`

Fixes or updates the project with a set of desired fixes.

Arguments:

- `[fix]`: Desired fix name: latestbetascriptversion - Update @minecraft script module dependencies to the latest beta versions randomizealluids - Regenerate all UUIDs in manifest files (use when cloning projects to avoid conflicts) setnewestformatversions - Update format_version fields across all definition files to the newest supported version setnewestminengineversion - Update min_engine_version in manifests to the newest supported version. One of: `latestbetascriptversion`, `randomizealluids`, `setnewestformatversions`, `setnewestminengineversion`.

Options:

- `--list`: List all available fixes with safety/reversibility metadata, then exit.

#### `setup`

Ensures project configuration files are up to date and healthy.

#### `set [propertyName] [propertyValue]`

Temporarily disabled in CLI.

Arguments:

- `[propertyName]`: Property name to set. Valid: name, title, description, bpscriptentrypoint, bpuuid, rpuuid.
- `[propertyValue]`: Property value to set.

#### `deploy <mode>`

Aliases: `dp`

Deploys Minecraft project packs to a destination. Use 'retail' or 'preview' for local Minecraft GDK folders, 'layout' for a flat pack layout to a custom folder.

Arguments:

- `<mode>`: Deployment target: 'retail' (Minecraft GDK), 'preview' (Minecraft Preview GDK), 'env' (reads MINECRAFT_PRODUCT from .env), 'layout' (flat packs to -o folder), 'server' (dedicated server, use --server-path), 'folder'/'output' (dev packs to -o folder), 'mcuwp'/'mcpreview' (legacy aliases), or a custom path.

Options:

- `--test-world`: Deploy as a generated test world containing the project packs.
- `--launch`: Launch the world in Minecraft after deployment (requires --test-world)
- `--env-file <path>`: Custom .env file path for `deploy env` mode. Default: <project>/.env. Useful when the .env lives elsewhere (CI runners, monorepos).

#### `exportaddon`

Packages the specified project into an addon file. Produces .mcaddon when both a behavior and resource pack are present, .mcpack for single-pack projects.

Options:

- `--format <format>`: Output format: 'auto' (default — picks mcaddon for BP+RP, mcpack otherwise), 'mcpack', or 'mcaddon'. Default: `auto`.

#### `exportworld`

Exports a flat GameTest world for the behavior packs in the project folder.

### Render

#### `rendermodel <geometryPath> [outputPath]`

Aliases: `rm`

Renders a model geometry file from the project to a PNG image. Automatically finds related textures via project item relationships.

Arguments:

- `<geometryPath>`: Path to the .geo.json file within the project to render.
- `[outputPath]`: Path to save the rendered PNG image. Defaults to <geometryName>.png.

Options:

- `--vanilla`: Load vanilla Minecraft resources from mctools.dev for fallback textures.
- `--no-vanilla`: Skip the vanilla Minecraft texture fallback. Useful when the project ships its own textures; renders faster and avoids the mctools.dev network fetch.
- `--port <port>`: Use a specific localhost port for the temporary render server.
- `--port-start <port>`: First port in the random temporary render server range. Default: `6200`.
- `--port-end <port>`: Last port in the random temporary render server range. Default: `6299`.
- `--width <pixels>`: Rendered image width in pixels. Default: `512`.
- `--height <pixels>`: Rendered image height in pixels. Default: `512`.
- `--gpu`: Prefer hardware GPU rendering instead of SwiftShader software WebGL.
- `--render-wait-ms <milliseconds>`: Milliseconds to wait after loading the model before capture.
- `--canvas-timeout-ms <milliseconds>`: Milliseconds to wait for the viewer canvas. Default: `15000`.

#### `renderbatch <manifestPath>`

Aliases: `rb`

Renders many model geometry files in one process, reusing a headless Chromium instance for the entire batch. Much faster than calling rendermodel once per geometry.

Arguments:

- `<manifestPath>`: Path to a JSON manifest describing the renders to perform.

Options:

- `--vanilla`: Default to loading vanilla Minecraft resources from mctools.dev for fallback textures.
- `--no-vanilla`: Default to skipping the vanilla Minecraft texture fallback. Per-entry `vanilla` in the manifest overrides this.
- `--port <port>`: Use a specific localhost port for the temporary render server.
- `--port-start <port>`: First port in the random temporary render server range. Default: `6200`.
- `--port-end <port>`: Last port in the random temporary render server range. Default: `6299`.
- `--width <pixels>`: Default rendered image width in pixels. Default: `512`.
- `--height <pixels>`: Default rendered image height in pixels. Default: `512`.
- `--gpu`: Prefer hardware GPU rendering instead of SwiftShader software WebGL.
- `--stdin`: Keep the process alive and read render requests from stdin. Each line is <manifestPath> or <projectDir>|<manifestPath>.
- `--render-wait-ms <milliseconds>`: Default milliseconds to wait after loading each model before capture.
- `--canvas-timeout-ms <milliseconds>`: Milliseconds to wait for the viewer canvas to become visible. Default: `15000`.

#### `rendervanilla <type> <identifier> [outputPath]`

Aliases: `rv`

Renders vanilla Minecraft block(s) or mob(s) to PNG image(s). Use comma-separated identifiers or @filename for batch mode.

Arguments:

- `<type>`: Type of vanilla content to render (block, mob, entity, item, attachable) One of: `block`, `mob`, `entity`, `item`, `attachable`.
- `<identifier>`: Identifier(s) to render (e.g., 'oak_stairs', 'pig,cow,sheep', '@blocks.txt')
- `[outputPath]`: Output path: file for single item, directory for batch.

#### `renderstructure <structureName> [outputPath]`

Aliases: `renstruct`, `renderst`

Render a .mcstructure file to a PNG image.

Arguments:

- `<structureName>`: Name of the .mcstructure file to render.
- `[outputPath]`: Path to save the output PNG.

Options:

- `--isolated`: Use isolated mode (skip vanilla resources)

#### `buildstructure <inputPath> [outputPath]`

Aliases: `buildstruct`

Build an .mcstructure file from IBlockVolume JSON.

Arguments:

- `<inputPath>`: Path to IBlockVolume JSON file, or '-' to read from stdin.
- `[outputPath]`: Path to save the .mcstructure file.

Options:

- `--preview <path>`: Also render a PNG preview image to the specified path.
- `--overwrite`: Overwrite existing files without prompting.
- `--isolated`: Use isolated mode for preview (skip vanilla resources)

### Server

#### `serve [features]`

Aliases: `server`

Start web server with Bedrock Dedicated Server support.

Arguments:

- `[features]`: Server features: all, allwebservices, basicwebservices, dedicatedserver.

Options:

- `--port <port>`: Server port (default: 6126)
- `--adminpc <passcode>`: Admin passcode.
- `--displaypc <passcode>`: Display read-only passcode.
- `--fullropc <passcode>`: Full read-only passcode.
- `--updatepc <passcode>`: Update state passcode.
- `--source-server-path <path>`: Path to source BDS installation.
- `--direct-server-path <path>`: Path to run BDS directly.
- `--gametest`: Enable GameTest framework.
- `--slot <slot>`: Server slot to use (default: 0)
- `--timeout <seconds>`: Auto-exit after N seconds (for testing)
- `--force-ink`: Force Ink UI even if not a TTY (for testing)
- `--mcp-require-auth`: Require authentication for MCP endpoint even from localhost.
- `--log-file <path>`: Write all server output to a log file continuously.

#### `mcp`

Run this command line as a local MCP server.

Options:

- `-i, --input <folder>`: Working folder for MCP operations (default: current directory)

#### `dedicatedserve`

Aliases: `bds`, `dedicated`

Start only the Bedrock Dedicated Server (no web UI)

Options:

- `--source-server-path <path>`: Path to source BDS installation.
- `--direct-server-path <path>`: Path to run BDS directly.
- `--gametest`: Enable GameTest framework.
- `--slot <slot>`: Server slot to use (default: 0)

#### `passcodes`

Aliases: `pc`

Shows active pass codes for web server validation.

#### `setserverprops`

Aliases: `serverprops`

Display or set server properties.

Options:

- `--domain <name>`: Server domain name.
- `--port <port>`: Server port.
- `--title <title>`: Server title.
- `--motd <message>`: Server message of the day.

#### `minecrafteulaandprivacystatement`

Aliases: `eula`

See the Minecraft End User License Agreement.

Options:

- `--accept`: Accept the EULA + Privacy Statement non-interactively (no prompt). Equivalent to setting MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA=true.
- `--status`: Print current EULA acceptance state and exit. Honours --json.

### Validation

#### `validate [suite] [exclusions] [aggregateReports]`

Aliases: `val`

Validate the current project.

Arguments:

- `[suite]`: Specifies the type of validation suite to run: 'main' (default, most common checks), 'addon' (add-on packaging and structure checks), 'currentplatform' (platform-specific compatibility checks), 'all' (every available validator), 'default' (alias for main) One of: `all`, `default`, `addon`, `currentplatform`, `main`. Default: `main`.
- `[exclusions]`: Specifies a comma-separated list of tests to exclude, e.g., PATHLENGTH,PACKSIZE.
- `[aggregateReports]`: Specify 'aggregate' to aggregate reports across projects at the end of the run. One of: `aggregatenoindex`, `aggregate`, `true`, `false`, `1`, `0`.

#### `aggregatereports [buildContentIndex]`

Aliases: `aggr`

Aggregates exported metadata about projects.

Arguments:

- `[buildContentIndex]`: Whether to build a content index. One of: `index`, `noindex`, `true`, `false`, `1`, `0`.

#### `search <search> [annotationCategory]`

Aliases: `s`

Uses a content index to perform a search.

Arguments:

- `<search>`: Search term to use.
- `[annotationCategory]`: Annotation category to search for.

### World

#### `world [mode]`

Display or set world settings.

Arguments:

- `[mode]`: Use 'set' to modify world settings.

Options:

- `--betaApis <value>`: Set beta APIs experiment (true/false)
- `--editor <value>`: Set is created in editor (true/false)
- `--dataDrivenItems <value>`: Set data driven items experiment (true/false)
- `-b, --behaviorPack <pack>`: Behavior pack to associate.
- `-r, --resourcePack <pack>`: Resource pack to associate.

#### `ensureworld`

Create/ensure a flat GameTest world for a project.
