// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import NodeStorage from "./NodeStorage";
import IStorage from "./../storage/IStorage";
import ILocalUtilities, { Platform } from "../core/ILocalUtilities";
import Log from "../core/Log";
import IConversionSettings from "../core/IConversionSettings";
import ImageCodecNode from "./ImageCodecNode";

/**
 * Ports that should never be used for MCTools HTTP servers.
 *
 * This list includes:
 * 1. Browser-blocked ports - Chrome/Firefox/Safari block these for security (ERR_UNSAFE_PORT)
 *    See: https://chromium.googlesource.com/chromium/src.git/+/refs/heads/main/net/base/port_util.cc
 *
 * 2. Security-sensitive service ports - commonly targeted for attacks or conflicts:
 *    - Database ports (Redis, etc.) - targeted for data theft
 *    - IRC ports - used by botnets and C&C servers
 *    - Other commonly exploited services
 */
export const UNSAFE_PORTS: ReadonlySet<number> = new Set([
  // === Browser-blocked ports (Chrome/Firefox/Safari) ===
  1, // tcpmux
  7, // echo
  9, // discard
  11, // systat
  13, // daytime
  15, // netstat
  17, // qotd
  19, // chargen
  20, // ftp data
  21, // ftp access
  22, // ssh
  23, // telnet
  25, // smtp
  37, // time
  42, // name
  43, // nicname
  53, // domain
  69, // tftp
  77, // priv-rjs
  79, // finger
  87, // ttylink
  95, // supdup
  101, // hostriame
  102, // iso-tsap
  103, // gppitnp
  104, // acr-nema
  109, // pop2
  110, // pop3
  111, // sunrpc
  113, // auth
  115, // sftp
  117, // uucp-path
  119, // nntp
  123, // NTP
  135, // loc-srv / epmap
  137, // netbios
  139, // netbios
  143, // imap2
  161, // snmp
  179, // BGP
  389, // ldap
  427, // SLP (Also used by determine.exe)
  465, // smtp+ssl
  512, // print / exec
  513, // login
  514, // shell
  515, // printer
  526, // tempo
  530, // courier
  531, // chat
  532, // netnews
  540, // uucp
  548, // AFP (Apple Filing Protocol)
  554, // rtsp
  556, // remotefs
  563, // nntp+ssl
  587, // smtp (submission)
  601, // syslog-conn
  636, // ldap+ssl
  989, // ftps-data
  990, // ftps
  993, // ldap+ssl
  995, // pop3+ssl
  1719, // h323gatestat
  1720, // h323hostcall
  1723, // pptp
  2049, // nfs
  3659, // apple-sasl / PasswordServer
  4045, // lockd
  5060, // sip
  5061, // sips
  6000, // X11
  6566, // sane-port
  6665, // Alternate IRC (browser-blocked + botnet target)
  6666, // Alternate IRC (browser-blocked + botnet target)
  6667, // Standard IRC (browser-blocked + botnet target)
  6668, // Alternate IRC (browser-blocked + botnet target)
  6669, // Alternate IRC (browser-blocked + botnet target)
  6697, // IRC + TLS (browser-blocked + botnet target)
  10080, // Amanda

  // === Security-sensitive service ports (not browser-blocked but should be avoided) ===
  6379, // Redis
]);

export default class LocalUtilities implements ILocalUtilities {
  #productNameSeed = "mctools";

  #basePathAdjust: string | undefined = undefined;

  static #bedrockSchemasRoot: string | undefined = undefined;

  /**
   * Resolves the root directory of the @minecraft/bedrock-schemas package.
   * Forms and schemas are served directly from this package at runtime
   * rather than being copied into the build output.
   */
  static get bedrockSchemasRoot(): string | undefined {
    if (LocalUtilities.#bedrockSchemasRoot !== undefined) {
      return LocalUtilities.#bedrockSchemasRoot;
    }

    try {
      // catalog.json is in the package exports map, so require.resolve works
      const catalogPath = require.resolve("@minecraft/bedrock-schemas/catalog.json");
      LocalUtilities.#bedrockSchemasRoot = path.dirname(catalogPath);
    } catch {
      LocalUtilities.#bedrockSchemasRoot = "";
    }

    return LocalUtilities.#bedrockSchemasRoot || undefined;
  }

  /**
   * Get the data directory override from MCTOOLS_DATA_DIR environment variable.
   * This is primarily used for Docker containers where data should be stored
   * in a volume-mounted directory like /data.
   */
  static get dataDirectoryOverride(): string | undefined {
    return process.env.MCTOOLS_DATA_DIR;
  }

  /**
   * Check if MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA environment variable is set to "true".
   * Used for non-interactive EULA acceptance in Docker containers.
   * The long name is intentional to ensure users explicitly acknowledge the EULA.
   */
  static get eulaAcceptedViaEnvironment(): boolean {
    const value = process.env.MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA;
    return value?.toLowerCase() === "true";
  }

  get basePathAdjust() {
    return this.#basePathAdjust;
  }

  set basePathAdjust(pathAdjust: string | undefined) {
    this.#basePathAdjust = pathAdjust;
  }

  get platform() {
    switch (os.platform()) {
      case "win32":
        return Platform.windows;
      case "darwin":
        return Platform.macOS;
      case "linux":
        return Platform.linux;
      default:
        return Platform.unsupported;
    }
  }

  get productNameSeed() {
    return this.#productNameSeed;
  }

  setProductNameSeed(newSeed: string) {
    this.#productNameSeed = newSeed;
  }

  get userDataPath() {
    return os.homedir();
  }

  get localAppDataPath() {
    if (this.platform === Platform.windows) {
      return (
        this.userDataPath +
        NodeStorage.platformFolderDelimiter +
        "AppData" +
        NodeStorage.platformFolderDelimiter +
        "Local" +
        NodeStorage.platformFolderDelimiter
      );
    } else {
      return this.userDataPath;
    }
  }

  get roamingAppDataPath() {
    if (this.platform === Platform.windows) {
      return (
        this.userDataPath +
        NodeStorage.platformFolderDelimiter +
        "AppData" +
        NodeStorage.platformFolderDelimiter +
        "Roaming" +
        NodeStorage.platformFolderDelimiter
      );
    } else {
      return this.userDataPath;
    }
  }

  get localReleaseServerLogPath() {
    if (this.platform === Platform.windows) {
      return (
        this.userDataPath +
        NodeStorage.platformFolderDelimiter +
        "AppData" +
        NodeStorage.platformFolderDelimiter +
        "Roaming" +
        NodeStorage.platformFolderDelimiter +
        "Minecraft Bedrock" +
        NodeStorage.platformFolderDelimiter +
        "logs" +
        NodeStorage.platformFolderDelimiter
      );
    } else {
      return "." + NodeStorage.platformFolderDelimiter;
    }
  }

  get localPreviewServerLogPath() {
    if (this.platform === Platform.windows) {
      return (
        this.userDataPath +
        NodeStorage.platformFolderDelimiter +
        "AppData" +
        NodeStorage.platformFolderDelimiter +
        "Roaming" +
        NodeStorage.platformFolderDelimiter +
        "Minecraft Bedrock Preview" +
        NodeStorage.platformFolderDelimiter +
        "logs" +
        NodeStorage.platformFolderDelimiter
      );
    } else {
      return "." + NodeStorage.platformFolderDelimiter;
    }
  }

  get minecraftPath() {
    return (
      this.userDataPath +
      NodeStorage.platformFolderDelimiter +
      "AppData" +
      NodeStorage.platformFolderDelimiter +
      "Roaming" +
      NodeStorage.platformFolderDelimiter +
      "Microsoft Bedrock" +
      NodeStorage.platformFolderDelimiter +
      "Users" +
      NodeStorage.platformFolderDelimiter +
      "Shared" +
      NodeStorage.platformFolderDelimiter +
      "games" +
      NodeStorage.platformFolderDelimiter +
      "com.mojang" +
      NodeStorage.platformFolderDelimiter
    );
  }

  get minecraftPreviewPath() {
    return (
      this.userDataPath +
      NodeStorage.platformFolderDelimiter +
      "AppData" +
      NodeStorage.platformFolderDelimiter +
      "Roaming" +
      NodeStorage.platformFolderDelimiter +
      "Microsoft Bedrock Preview" +
      NodeStorage.platformFolderDelimiter +
      "Users" +
      NodeStorage.platformFolderDelimiter +
      "Shared" +
      NodeStorage.platformFolderDelimiter +
      "games" +
      NodeStorage.platformFolderDelimiter +
      "com.mojang" +
      NodeStorage.platformFolderDelimiter
    );
  }

  get minecraftUwpPath() {
    return (
      this.localAppDataPath +
      "Packages" +
      NodeStorage.platformFolderDelimiter +
      "Microsoft.MinecraftUWP_8wekyb3d8bbwe" +
      NodeStorage.platformFolderDelimiter +
      "LocalState" +
      NodeStorage.platformFolderDelimiter +
      "games" +
      NodeStorage.platformFolderDelimiter +
      "com.mojang" +
      NodeStorage.platformFolderDelimiter
    );
  }

  get minecraftPreviewUwpPath() {
    return (
      this.localAppDataPath +
      "Packages" +
      NodeStorage.platformFolderDelimiter +
      "Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe" +
      NodeStorage.platformFolderDelimiter +
      "LocalState" +
      NodeStorage.platformFolderDelimiter +
      "games" +
      NodeStorage.platformFolderDelimiter +
      "com.mojang" +
      NodeStorage.platformFolderDelimiter
    );
  }

  get testWorkingPath() {
    // If MCTOOLS_DATA_DIR is set (e.g., in Docker), use it
    const dataDir = LocalUtilities.dataDirectoryOverride;
    if (dataDir) {
      return NodeStorage.ensureEndsWithDelimiter(dataDir) + "test" + NodeStorage.platformFolderDelimiter;
    }

    let path = this.localAppDataPath;

    if (this.platform === Platform.windows) {
      path =
        NodeStorage.ensureEndsWithDelimiter(path) +
        this.#productNameSeed +
        "_test" +
        NodeStorage.platformFolderDelimiter;
    } else {
      // Linux/macOS: Use ~/.mctools/test/ structure
      path =
        NodeStorage.ensureEndsWithDelimiter(path) +
        "." +
        this.#productNameSeed +
        NodeStorage.platformFolderDelimiter +
        "test" +
        NodeStorage.platformFolderDelimiter;
    }

    return path;
  }

  get cliWorkingPath() {
    // If MCTOOLS_DATA_DIR is set (e.g., in Docker), use it
    const dataDir = LocalUtilities.dataDirectoryOverride;
    if (dataDir) {
      return NodeStorage.ensureEndsWithDelimiter(dataDir) + "cli" + NodeStorage.platformFolderDelimiter;
    }

    let path = this.localAppDataPath;

    if (this.platform === Platform.windows) {
      path =
        NodeStorage.ensureEndsWithDelimiter(path) +
        this.#productNameSeed +
        "_cli" +
        NodeStorage.platformFolderDelimiter;
    } else {
      // Linux/macOS: Use ~/.mctools/cli/ structure
      path =
        NodeStorage.ensureEndsWithDelimiter(path) +
        "." +
        this.#productNameSeed +
        NodeStorage.platformFolderDelimiter +
        "cli" +
        NodeStorage.platformFolderDelimiter;
    }

    return path;
  }

  get serverWorkingPath() {
    // If MCTOOLS_DATA_DIR is set (e.g., in Docker), use it
    const dataDir = LocalUtilities.dataDirectoryOverride;
    if (dataDir) {
      return NodeStorage.ensureEndsWithDelimiter(dataDir) + "server" + NodeStorage.platformFolderDelimiter;
    }

    let path = this.localAppDataPath;

    if (this.platform === Platform.windows) {
      path =
        NodeStorage.ensureEndsWithDelimiter(path) +
        this.#productNameSeed +
        "_server" +
        NodeStorage.platformFolderDelimiter;
    } else {
      // Linux/macOS: Use ~/.mctools/server/ structure
      path =
        NodeStorage.ensureEndsWithDelimiter(path) +
        "." +
        this.#productNameSeed +
        NodeStorage.platformFolderDelimiter +
        "server" +
        NodeStorage.platformFolderDelimiter;
    }

    return path;
  }

  get worldsWorkingPath() {
    // If MCTOOLS_DATA_DIR is set (e.g., in Docker), use it
    const dataDir = LocalUtilities.dataDirectoryOverride;
    if (dataDir) {
      return NodeStorage.ensureEndsWithDelimiter(dataDir) + "worlds" + NodeStorage.platformFolderDelimiter;
    }

    let path = this.localAppDataPath;

    if (this.platform === Platform.windows) {
      path =
        NodeStorage.ensureEndsWithDelimiter(path) +
        this.#productNameSeed +
        "_worlds" +
        NodeStorage.platformFolderDelimiter;
    } else {
      // Linux/macOS: Use ~/.mctools/worlds/ structure
      path =
        NodeStorage.ensureEndsWithDelimiter(path) +
        "." +
        this.#productNameSeed +
        NodeStorage.platformFolderDelimiter +
        "worlds" +
        NodeStorage.platformFolderDelimiter;
    }

    return path;
  }

  get serversPath() {
    let path = this.serverWorkingPath;

    path = NodeStorage.ensureEndsWithDelimiter(path) + "servers" + NodeStorage.platformFolderDelimiter;

    return path;
  }

  get sourceServersPath() {
    let path = this.serverWorkingPath;

    path = NodeStorage.ensureEndsWithDelimiter(path) + "serverSources" + NodeStorage.platformFolderDelimiter;

    return path;
  }

  get packCachePath() {
    let path = this.serverWorkingPath;

    path = NodeStorage.ensureEndsWithDelimiter(path) + "packCache" + NodeStorage.platformFolderDelimiter;

    return path;
  }

  get envPrefsPath() {
    let path = this.serverWorkingPath;

    path = NodeStorage.ensureEndsWithDelimiter(path) + "envprefs" + NodeStorage.platformFolderDelimiter;

    return path;
  }

  generateCryptoRandomNumber(toVal: number) {
    // Use rejection sampling to avoid modulo bias when generating random numbers
    // from a cryptographically secure source
    const maxUint32 = 0xffffffff;
    const limit = maxUint32 - (maxUint32 % toVal);
    let randomValue: number;
    do {
      randomValue = new Uint32Array(crypto.randomBytes(4).buffer)[0];
    } while (randomValue >= limit);
    return randomValue % toVal;
  }

  generateUuid(): string {
    return uuidv4();
  }

  validateFolderPath(path: string) {
    // banned character combos
    if (path.indexOf("..") >= 0 || path.indexOf("\\\\") >= 0 || path.indexOf("//") >= 0) {
      throw new Error("Unsupported path combinations: " + path);
    }

    if (path.lastIndexOf(":") >= 3) {
      throw new Error("Unsupported drive location: " + path);
    }

    const count = this.countChar(path, "\\") + this.countChar(path, "/");

    if (count < 3) {
      throw new Error("Unsupported base path: " + path);
    }
  }

  countChar(source: string, find: string) {
    let count = 0;

    let index = source.indexOf(find);

    while (index >= 0) {
      count++;

      index = source.indexOf(find, index + find.length);
    }

    return count;
  }

  ensureStartsWithSlash(pathSegment: string) {
    if (!pathSegment.startsWith("/")) {
      pathSegment = "/" + pathSegment;
    }

    return pathSegment;
  }

  ensureEndsWithSlash(pathSegment: string) {
    if (!pathSegment.endsWith("/")) {
      pathSegment += "/";
    }

    return pathSegment;
  }

  ensureStartsWithBackSlash(pathSegment: string) {
    if (!pathSegment.startsWith("\\")) {
      pathSegment = "\\" + pathSegment;
    }

    return pathSegment;
  }

  ensureEndsWithBackSlash(pathSegment: string) {
    if (!pathSegment.endsWith("\\")) {
      pathSegment += "\\";
    }

    return pathSegment;
  }

  getFullPath(relativePath: string) {
    // Redirect forms and schemas to @minecraft/bedrock-schemas package
    const pkgRoot = LocalUtilities.bedrockSchemasRoot;
    if (pkgRoot) {
      if (relativePath.startsWith("data/forms/") || relativePath.startsWith("data\\forms\\")) {
        const subPath = relativePath.substring("data/forms/".length);
        return path.join(pkgRoot, "forms", subPath);
      }
      const schemasPrefix = relativePath.startsWith("/schemas/")
        ? "/schemas/"
        : relativePath.startsWith("schemas/")
          ? "schemas/"
          : relativePath.startsWith("\\schemas\\")
            ? "\\schemas\\"
            : undefined;
      if (schemasPrefix) {
        const subPath = relativePath.substring(schemasPrefix.length);
        return path.join(pkgRoot, "schemas", subPath);
      }
    }

    let fullPath: string;

    if (this.#basePathAdjust) {
      // When basePathAdjust is set (via --base-path CLI option),
      // resolve it relative to process.cwd() (where the command was run)
      // This allows users to specify paths relative to their working directory
      fullPath = path.resolve(process.cwd(), this.#basePathAdjust);
      fullPath = NodeStorage.ensureEndsWithDelimiter(fullPath);
    } else {
      // Fall back to __dirname-based resolution for backwards compatibility
      fullPath = __dirname;

      const lastSlash = Math.max(
        fullPath.lastIndexOf("\\", fullPath.length - 2),
        fullPath.lastIndexOf("/", fullPath.length - 2)
      );

      if (lastSlash >= 0) {
        fullPath = fullPath.substring(0, lastSlash + 1);
      }
    }

    if (this.platform === Platform.windows) {
      fullPath += relativePath.replace(/\//g, "\\");
    } else {
      fullPath += relativePath.replace(/\\/g, NodeStorage.platformFolderDelimiter);
    }

    return fullPath;
  }

  createStorage(path: string): IStorage | null {
    const fullPath = this.getFullPath(path);

    return new NodeStorage(fullPath, "");
  }

  async readJsonFile(path: string): Promise<object | null> {
    const fs = require("fs");

    const fullPath = this.getFullPath(path);

    try {
      if (!fs.existsSync(fullPath)) {
        return null;
      }

      const rawData = fs.readFileSync(fullPath);

      if (!rawData) {
        return null;
      }

      const jsonData = JSON.parse(rawData);

      return jsonData;
    } catch (e: any) {
      // Silently return null for parse errors - the caller can handle missing data
      // This is common for malformed JSON files in vanilla/sample content
      return null;
    }
  }

  async processConversion(conversionSettings: IConversionSettings): Promise<boolean> {
    // Placeholder for future conversion logic
    return true;
  }

  /**
   * Check if a port is available for use.
   * @param port The port number to check
   * @param host The host to check (default: localhost)
   * @returns Promise that resolves to true if the port is available, false otherwise
   */
  static isPortAvailable(port: number, host: string = "localhost"): Promise<boolean> {
    const net = require("net");

    return new Promise((resolve) => {
      const server = net.createServer();

      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          resolve(false);
        } else {
          // Other errors - treat as unavailable
          resolve(false);
        }
      });

      server.once("listening", () => {
        server.close();
        resolve(true);
      });

      server.listen(port, host);
    });
  }

  /**
   * Find an available port within a given range.
   * @param startPort The starting port of the range (inclusive)
   * @param endPort The ending port of the range (inclusive)
   * @param host The host to check (default: localhost)
   * @returns Promise that resolves to an available port, or undefined if none found
   */
  static async findAvailablePort(
    startPort: number,
    endPort: number,
    host: string = "localhost"
  ): Promise<number | undefined> {
    // Create an array of ports in the range, excluding unsafe ports
    const ports: number[] = [];
    for (let port = startPort; port <= endPort; port++) {
      if (!UNSAFE_PORTS.has(port)) {
        ports.push(port);
      }
    }

    // Fisher-Yates shuffle for random port selection
    for (let i = ports.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ports[i], ports[j]] = [ports[j], ports[i]];
    }

    // Try each port until we find an available one
    for (const port of ports) {
      const available = await LocalUtilities.isPortAvailable(port, host);
      if (available) {
        return port;
      }
    }

    return undefined;
  }

  /**
   * Get a random port within a range, excluding browser-unsafe ports.
   * This is a synchronous function that doesn't check if the port is available.
   * Use findAvailablePort() if you need to verify the port is not in use.
   *
   * @param startPort The starting port of the range (inclusive)
   * @param endPort The ending port of the range (inclusive)
   * @returns A random port in the range that is not in the UNSAFE_PORTS list
   */
  static getRandomSafePort(startPort: number, endPort: number): number {
    // Build array of safe ports in range
    const safePorts: number[] = [];
    for (let port = startPort; port <= endPort; port++) {
      if (!UNSAFE_PORTS.has(port)) {
        safePorts.push(port);
      }
    }

    if (safePorts.length === 0) {
      // Fallback: if no safe ports in range, just return startPort
      // This shouldn't happen with reasonable port ranges
      Log.debugAlert(`No safe ports available in range ${startPort}-${endPort}, using ${startPort}`);
      return startPort;
    }

    return safePorts[Math.floor(Math.random() * safePorts.length)];
  }

  /**
   * Verifies the Authenticode digital signature of a Windows executable.
   * Uses PowerShell's Get-AuthenticodeSignature cmdlet, which is built into
   * every modern Windows and requires no native Node.js addons.
   *
   * @param exePath Absolute path to the executable to verify
   * @returns Promise with verification result including validity, signer, and Microsoft check
   */
  static async verifyAuthenticodeSignature(exePath: string): Promise<{
    isValid: boolean;
    status: string;
    signer?: string;
    error?: string;
    isMicrosoftSigned?: boolean;
  }> {
    // Only works on Windows
    if (os.platform() !== "win32") {
      return {
        isValid: false,
        status: "UnsupportedPlatform",
        error: "Authenticode signature verification is only supported on Windows",
      };
    }

    // Validate the path exists
    const fs = await import("fs");
    if (!fs.existsSync(exePath)) {
      return {
        isValid: false,
        status: "FileNotFound",
        error: `File not found: ${exePath}`,
      };
    }

    try {
      const { execFile } = await import("child_process");
      const { existsSync: execExistsSync } = await import("fs");

      // Use PowerShell's Get-AuthenticodeSignature which wraps the Windows
      // WinVerifyTrust API. This avoids the need for native Node.js addons
      // (win-verify-signature) which require platform-specific compiled binaries
      // that are fragile across Node.js versions and packaging scenarios.
      //
      // We use -EncodedCommand with a base64-encoded UTF-16LE script to avoid
      // all command-line escaping issues between Node.js and PowerShell.
      //
      // We prefer pwsh.exe (PowerShell 7+) because it has more reliable module
      // auto-loading. PowerShell 5.1 (powershell.exe) can fail on some machines
      // due to type data conflicts in the Security module. We try both.

      // SECURITY: Instead of interpolating the file path into the PowerShell script
      // (which risks command injection via newlines, backticks, or other control
      // characters in the path), we pass the path via an environment variable.
      // The script reads $env:MCT_SIG_VERIFY_PATH, so the path never enters
      // the script text and cannot break out of string boundaries.

      // Defense-in-depth: reject paths with characters that have no business
      // in a Windows file path. This guards against exotic injection even if
      // the env-var approach were somehow bypassed.
      if (/[\x00-\x1f\x7f`${}]/.test(exePath)) {
        return {
          isValid: false,
          status: "InvalidPath",
          error: "File path contains invalid characters",
        };
      }

      const psScript = [
        `$sig = Get-AuthenticodeSignature -LiteralPath $env:MCT_SIG_VERIFY_PATH`,
        `$r = @{ Status = $sig.Status.ToString(); SignerCN = ''; SignerSubject = '' }`,
        `if ($sig.SignerCertificate) {`,
        `  $r.SignerSubject = $sig.SignerCertificate.Subject`,
        `  if ($sig.SignerCertificate.Subject -match 'CN=([^,]+)') { $r.SignerCN = $Matches[1].Trim('"') }`,
        `}`,
        `$r | ConvertTo-Json -Compress`,
      ].join("\n");

      // Encode as UTF-16LE base64 for PowerShell's -EncodedCommand
      const encoded = Buffer.from(psScript, "utf16le").toString("base64");

      // Build ordered list of PowerShell executables to try.
      // pwsh.exe (PowerShell 7+) is preferred for reliability.
      const candidates: string[] = [];
      const pwsh7Path = "C:\\Program Files\\PowerShell\\7\\pwsh.exe";
      if (execExistsSync(pwsh7Path)) {
        candidates.push(pwsh7Path);
      }
      candidates.push("pwsh.exe", "powershell.exe");

      const runPowerShell = (psExe: string): Promise<string> =>
        new Promise((resolve, reject) => {
          execFile(
            psExe,
            ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
            {
              timeout: 15000,
              // Pass the file path via environment variable instead of
              // interpolating it into the script. This prevents injection.
              env: { ...process.env, MCT_SIG_VERIFY_PATH: exePath },
            },
            (error, stdout, stderr) => {
              if (error) {
                reject(new Error(`${psExe} failed: ${error.message}`));
                return;
              }
              const trimmed = stdout.trim();
              if (!trimmed) {
                reject(new Error(`${psExe} returned empty output${stderr ? ": " + stderr.substring(0, 200) : ""}`));
                return;
              }
              resolve(trimmed);
            }
          );
        });

      // Try each candidate until one succeeds
      let psResult: string | undefined;
      let lastError: Error | undefined;
      for (const psExe of candidates) {
        try {
          psResult = await runPowerShell(psExe);
          break;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
        }
      }

      if (!psResult) {
        return {
          isValid: false,
          status: "VerificationError",
          error: `No working PowerShell found. Install PowerShell 7+ (https://aka.ms/powershell) or use --unsafe-skip-signature-validation. Last error: ${lastError?.message}`,
        };
      }

      const parsed = JSON.parse(psResult) as {
        Status: string;
        SignerCN: string;
        SignerSubject: string;
      };

      const isValid = parsed.Status === "Valid";
      const signerSubject = parsed.SignerSubject || undefined;
      const signerCN = parsed.SignerCN || "";

      // Microsoft Corporation is the expected signer for Minecraft Dedicated Server
      // We also accept Mojang (owned by Microsoft) for legacy compatibility
      const isMicrosoftSigned =
        isValid &&
        (signerCN === "Microsoft Corporation" ||
          signerCN === "Mojang" ||
          (signerSubject !== undefined &&
            (signerSubject.includes("Microsoft Corporation") || signerSubject.includes("Mojang"))));

      return {
        isValid,
        status: isValid ? "Valid" : parsed.Status,
        signer: signerSubject,
        isMicrosoftSigned,
        error: isValid ? undefined : `Signature status: ${parsed.Status}`,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        isValid: false,
        status: "VerificationError",
        error: `Failed to verify signature: ${errorMessage}`,
      };
    }
  }

  // ============================================================================
  // IMAGE CODEC METHODS (Node.js specific)
  // ============================================================================

  /**
   * Decode PNG image data using pngjs.
   * This is a Node.js-specific implementation that uses native modules.
   */
  decodePng(data: Uint8Array): { width: number; height: number; pixels: Uint8Array } | undefined {
    return ImageCodecNode.decodePng(data);
  }

  /**
   * Encode RGBA pixel data to PNG format using pngjs.
   * This is a Node.js-specific implementation that uses native modules.
   */
  encodeToPng(pixels: Uint8Array, width: number, height: number): Uint8Array | undefined {
    return ImageCodecNode.encodeToPng(pixels, width, height);
  }
}
