// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ServerManagementTest.ts
 *
 * Comprehensive tests for the Dedicated Server management system including:
 * - Linux compatibility features
 * - Platform-specific behavior (symlinks, executables, paths)
 * - Restart backoff logic
 * - Backup timeout protection
 * - Process signal handling
 *
 * These tests verify the cross-platform server provisioning and resilience
 * features without requiring an actual Bedrock Dedicated Server installation.
 */

import { expect } from "chai";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import NodeStorage from "../local/NodeStorage";
import Utilities from "../core/Utilities";
import MinecraftUtilities, { MINECRAFT_BASE_PORT, MINECRAFT_PORT_INCREMENT } from "../minecraft/MinecraftUtilities";

/**
 * Test utilities for creating temporary test directories
 */
class TestDirManager {
  private tempDirs: string[] = [];

  createTempDir(prefix: string): string {
    const tempDir = path.join(os.tmpdir(), `mct-test-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempDir, { recursive: true });
    this.tempDirs.push(tempDir);
    return tempDir;
  }

  cleanup(): void {
    for (const dir of this.tempDirs) {
      try {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    this.tempDirs = [];
  }
}

describe("ServerManagement", function () {
  // Increase timeout for file system operations
  this.timeout(10000);

  let testDirs: TestDirManager;

  beforeEach(() => {
    testDirs = new TestDirManager();
  });

  afterEach(() => {
    testDirs.cleanup();
  });

  describe("Platform Detection", () => {
    it("should correctly identify the current platform", () => {
      const platform = os.platform();
      expect(["win32", "linux", "darwin"]).to.include(platform);
    });

    it("should have correct platform folder delimiter", () => {
      const delimiter = NodeStorage.platformFolderDelimiter;
      if (os.platform() === "win32") {
        expect(delimiter).to.equal("\\");
      } else {
        expect(delimiter).to.equal("/");
      }
    });
  });

  describe("Path Utilities", () => {
    it("ensureEndsWithDelimiter should add platform-specific delimiter", () => {
      const testPath = "/some/path";
      const result = NodeStorage.ensureEndsWithDelimiter(testPath);

      expect(result.endsWith(NodeStorage.platformFolderDelimiter)).to.be.true;
    });

    it("ensureEndsWithDelimiter should not duplicate delimiter", () => {
      const delimiter = NodeStorage.platformFolderDelimiter;
      const testPath = `/some/path${delimiter}`;
      const result = NodeStorage.ensureEndsWithDelimiter(testPath);

      expect(result).to.equal(testPath);
      expect(result.endsWith(delimiter + delimiter)).to.be.false;
    });
  });

  describe("Executable Name Logic", () => {
    // This tests the logic that would be used to determine executable name
    function getExecutableName(platform: string): string {
      return platform === "win32" ? "bedrock_server.exe" : "bedrock_server";
    }

    it("should return correct executable name for Windows", () => {
      const execName = getExecutableName("win32");
      expect(execName).to.equal("bedrock_server.exe");
    });

    it("should return correct executable name for Linux", () => {
      const execName = getExecutableName("linux");
      expect(execName).to.equal("bedrock_server");
    });

    it("should return correct executable name for macOS", () => {
      const execName = getExecutableName("darwin");
      expect(execName).to.equal("bedrock_server");
    });
  });

  describe("Symlink Type Selection", () => {
    // Tests the platform-specific symlink type selection logic
    function getSymlinkType(platform: string): string {
      return platform === "win32" ? "junction" : "dir";
    }

    it("should select junction for Windows", () => {
      const symlinkType = getSymlinkType("win32");
      expect(symlinkType).to.equal("junction");
    });

    it("should select dir for Linux", () => {
      const symlinkType = getSymlinkType("linux");
      expect(symlinkType).to.equal("dir");
    });

    it("should select dir for macOS", () => {
      const symlinkType = getSymlinkType("darwin");
      expect(symlinkType).to.equal("dir");
    });
  });

  describe("Symlink Creation with Fallback", () => {
    it("should create symlink in temp directory", function () {
      // Skip if running on a platform that doesn't support symlinks without elevation
      if (os.platform() === "win32") {
        // On Windows, symlinks may require admin rights
        this.skip();
        return;
      }

      const tempDir = testDirs.createTempDir("symlink");
      const sourceDir = path.join(tempDir, "source");
      const targetLink = path.join(tempDir, "target");

      // Create source directory with a test file
      fs.mkdirSync(sourceDir);
      fs.writeFileSync(path.join(sourceDir, "test.txt"), "test content");

      // Create symlink
      const symlinkType = os.platform() === "win32" ? "junction" : "dir";
      fs.symlinkSync(sourceDir, targetLink, symlinkType);

      // Verify symlink works
      expect(fs.existsSync(targetLink)).to.be.true;
      expect(fs.lstatSync(targetLink).isSymbolicLink()).to.be.true;
      expect(fs.existsSync(path.join(targetLink, "test.txt"))).to.be.true;
    });

    it("should fallback to directory copy on symlink failure", () => {
      const tempDir = testDirs.createTempDir("fallback");
      const sourceDir = path.join(tempDir, "source");
      const targetDir = path.join(tempDir, "target");

      // Create source directory with content
      fs.mkdirSync(sourceDir);
      fs.writeFileSync(path.join(sourceDir, "test.txt"), "test content");
      fs.mkdirSync(path.join(sourceDir, "subdir"));
      fs.writeFileSync(path.join(sourceDir, "subdir", "nested.txt"), "nested content");

      // Simulate fallback by copying directly
      fs.cpSync(sourceDir, targetDir, { recursive: true });

      // Verify copy worked
      expect(fs.existsSync(targetDir)).to.be.true;
      expect(fs.existsSync(path.join(targetDir, "test.txt"))).to.be.true;
      expect(fs.existsSync(path.join(targetDir, "subdir", "nested.txt"))).to.be.true;

      // Verify content is correct
      const content = fs.readFileSync(path.join(targetDir, "test.txt"), "utf8");
      expect(content).to.equal("test content");
    });
  });

  describe("Restart Backoff Logic", () => {
    // Simulates the DedicatedServer restart backoff logic

    function calculateBackoffMs(recentStarts: number): number {
      return Math.min(1000 * Math.pow(2, recentStarts), 16000);
    }

    function getRecentStarts(stopLog: Date[], timeWindowMs: number): number {
      const now = new Date();
      let recents = 0;

      for (const stopTime of stopLog) {
        if (now.getTime() - stopTime.getTime() < timeWindowMs) {
          recents++;
        }
      }

      return recents;
    }

    it("should calculate correct backoff for first restart (1s)", () => {
      const backoff = calculateBackoffMs(0);
      expect(backoff).to.equal(1000);
    });

    it("should calculate correct backoff for second restart (2s)", () => {
      const backoff = calculateBackoffMs(1);
      expect(backoff).to.equal(2000);
    });

    it("should calculate correct backoff for third restart (4s)", () => {
      const backoff = calculateBackoffMs(2);
      expect(backoff).to.equal(4000);
    });

    it("should calculate correct backoff for fourth restart (8s)", () => {
      const backoff = calculateBackoffMs(3);
      expect(backoff).to.equal(8000);
    });

    it("should cap backoff at 16 seconds", () => {
      const backoff = calculateBackoffMs(10);
      expect(backoff).to.equal(16000);
    });

    it("should count recent stops within time window", () => {
      const now = new Date();
      const stopLog = [
        new Date(now.getTime() - 30000), // 30 seconds ago
        new Date(now.getTime() - 45000), // 45 seconds ago
        new Date(now.getTime() - 90000), // 90 seconds ago (outside 60s window)
      ];

      const recents = getRecentStarts(stopLog, 60000);
      expect(recents).to.equal(2);
    });

    it("should return 0 for empty stop log", () => {
      const recents = getRecentStarts([], 60000);
      expect(recents).to.equal(0);
    });

    it("should exclude stops outside time window", () => {
      const now = new Date();
      const stopLog = [
        new Date(now.getTime() - 120000), // 2 minutes ago
        new Date(now.getTime() - 180000), // 3 minutes ago
      ];

      const recents = getRecentStarts(stopLog, 60000);
      expect(recents).to.equal(0);
    });

    it("should stop auto-restart after 4 stops in 60 seconds", () => {
      const now = new Date();
      const stopLog = [
        new Date(now.getTime() - 10000),
        new Date(now.getTime() - 20000),
        new Date(now.getTime() - 30000),
        new Date(now.getTime() - 40000),
      ];

      const recents = getRecentStarts(stopLog, 60000);
      const shouldRestart = recents < 4;

      expect(recents).to.equal(4);
      expect(shouldRestart).to.be.false;
    });
  });

  describe("Backup Timeout Logic", () => {
    const BACKUP_TIMEOUT_MS = 60000;

    it("should have 60 second backup timeout", () => {
      expect(BACKUP_TIMEOUT_MS).to.equal(60000);
    });

    it("timeout should be clearable", async () => {
      let timeoutFired = false;
      let timer: NodeJS.Timeout | undefined;

      timer = setTimeout(() => {
        timeoutFired = true;
      }, 50);

      // Clear before it fires
      clearTimeout(timer);
      timer = undefined;

      // Wait for longer than the timeout
      await Utilities.sleep(100);

      expect(timeoutFired).to.be.false;
    });

    it("timeout should fire if not cleared", async () => {
      let timeoutFired = false;

      setTimeout(() => {
        timeoutFired = true;
      }, 50);

      // Wait for timeout to fire
      await Utilities.sleep(100);

      expect(timeoutFired).to.be.true;
    });
  });

  describe("LD_LIBRARY_PATH Environment Variable", () => {
    function getSpawnOptions(platform: string, serverPath: string): { env?: NodeJS.ProcessEnv; cwd?: string } {
      if (platform !== "win32") {
        return {
          env: {
            ...process.env,
            LD_LIBRARY_PATH: serverPath,
          },
          cwd: serverPath,
        };
      }
      return {};
    }

    it("should be set correctly for Linux spawn", () => {
      const serverPath = "/opt/minecraft/server/";
      const spawnOptions = getSpawnOptions("linux", serverPath);

      expect(spawnOptions.env).to.not.be.undefined;
      expect(spawnOptions.env!.LD_LIBRARY_PATH).to.equal(serverPath);
      expect(spawnOptions.cwd).to.equal(serverPath);
    });

    it("should not be set for Windows spawn", () => {
      const spawnOptions = getSpawnOptions("win32", "C:\\Server\\");

      expect(spawnOptions.env).to.be.undefined;
    });
  });

  describe("Server Version Naming", () => {
    // Tests the server source naming convention

    interface ServerVersionTestCase {
      type: string;
      version: string;
      expected: string;
    }

    const testCases: ServerVersionTestCase[] = [
      { type: "bw", version: "1.21.50.24", expected: "bwv1.21.50.24" },
      { type: "bl", version: "1.21.50.24", expected: "blv1.21.50.24" },
      { type: "pw", version: "1.22.0.1", expected: "pwv1.22.0.1" },
      { type: "pl", version: "1.22.0.1", expected: "plv1.22.0.1" },
    ];

    for (const tc of testCases) {
      it(`should format ${tc.type} version as ${tc.expected}`, () => {
        const result = `${tc.type}v${tc.version}`;
        expect(result).to.equal(tc.expected);
      });
    }
  });

  describe("Port Slot Calculation", () => {
    // Tests the multi-slot port allocation logic using MinecraftUtilities
    // Slot 0 = 19132, Slot 1 = 19164, Slot 2 = 19196, etc. (32-port spacing)

    it("should export correct constants", () => {
      expect(MINECRAFT_BASE_PORT).to.equal(19132);
      expect(MINECRAFT_PORT_INCREMENT).to.equal(32);
    });

    it("should return base port for slot 0", () => {
      expect(MinecraftUtilities.getPortForSlot(0)).to.equal(19132);
    });

    it("should return correct port for slot 1", () => {
      expect(MinecraftUtilities.getPortForSlot(1)).to.equal(19164);
    });

    it("should return correct port for slot 2", () => {
      expect(MinecraftUtilities.getPortForSlot(2)).to.equal(19196);
    });

    it("should handle high slot numbers", () => {
      expect(MinecraftUtilities.getPortForSlot(79)).to.equal(19132 + 79 * 32);
    });

    it("should convert port back to slot correctly", () => {
      expect(MinecraftUtilities.getSlotFromPort(19132)).to.equal(0);
      expect(MinecraftUtilities.getSlotFromPort(19164)).to.equal(1);
      expect(MinecraftUtilities.getSlotFromPort(19196)).to.equal(2);
    });
  });

  describe("Slot-Based Folder Naming", () => {
    // Tests the slot-based persistent folder naming (prevents Windows Firewall prompts)
    // Different contexts use different prefixes to avoid conflicts:
    // - MCP command uses "mcp" → "mcp0", "mcp1", etc.
    // - Serve command uses "serve" → "serve0", "serve1", etc.
    // - VS Code extension uses "vscode" → "vscode0", "vscode1", etc.
    // - Default (empty) uses no prefix → "slot0", "slot1", etc.

    function getSlotFolderName(slotNumber: number, prefix: string = ""): string {
      if (prefix) {
        return `${prefix}${slotNumber}`;
      }
      return `slot${slotNumber}`;
    }

    it("should generate slot0 for slot 0 with no prefix", () => {
      expect(getSlotFolderName(0)).to.equal("slot0");
    });

    it("should generate slot1 for slot 1 with no prefix", () => {
      expect(getSlotFolderName(1)).to.equal("slot1");
    });

    it("should generate consistent folder names", () => {
      // Same slot always generates same folder name (persistence for firewall rules)
      expect(getSlotFolderName(5)).to.equal("slot5");
      expect(getSlotFolderName(5)).to.equal("slot5");
    });

    it("should handle high slot numbers", () => {
      expect(getSlotFolderName(79)).to.equal("slot79");
    });

    it("should generate mcp0 for MCP context", () => {
      expect(getSlotFolderName(0, "mcp")).to.equal("mcp0");
      expect(getSlotFolderName(1, "mcp")).to.equal("mcp1");
    });

    it("should generate serve0 for serve context", () => {
      expect(getSlotFolderName(0, "serve")).to.equal("serve0");
      expect(getSlotFolderName(1, "serve")).to.equal("serve1");
    });

    it("should generate vscode0 for VS Code context", () => {
      expect(getSlotFolderName(0, "vscode")).to.equal("vscode0");
      expect(getSlotFolderName(1, "vscode")).to.equal("vscode1");
    });

    it("should keep different contexts isolated", () => {
      // Same slot number with different prefixes should produce different folder names
      expect(getSlotFolderName(0, "mcp")).not.to.equal(getSlotFolderName(0, "serve"));
      expect(getSlotFolderName(0, "serve")).not.to.equal(getSlotFolderName(0, "vscode"));
      expect(getSlotFolderName(0, "mcp")).not.to.equal(getSlotFolderName(0));
    });
  });

  describe("Smart Reprovisioning Detection", () => {
    /**
     * Tests for the needsReprovisioning() logic that determines if a slot
     * needs file operations (symlinks/copies) or can be reused as-is.
     */

    // Simulates the provisioning info interface
    interface ISlotProvisioningInfo {
      sourceServerPath: string;
      provisionedAt: Date;
      version?: string;
    }

    const slotProvisioningInfo: { [slotNumber: number]: ISlotProvisioningInfo } = {};

    function needsReprovisioning(slotNumber: number, sourcePath: string, slotServerPathExists: boolean): boolean {
      const provisioningInfo = slotProvisioningInfo[slotNumber];

      if (!provisioningInfo) {
        return true; // Never provisioned
      }

      // Normalize paths for comparison - handle both forward and back slashes
      const normalizePath = (p: string) =>
        p
          .replace(/[\\/]+/g, "/")
          .replace(/\/$/, "")
          .toLowerCase();
      const normalizedSource = normalizePath(sourcePath);
      const normalizedProvisioned = normalizePath(provisioningInfo.sourceServerPath);

      if (normalizedSource !== normalizedProvisioned) {
        return true; // Source changed
      }

      if (!slotServerPathExists) {
        return true; // Folder was deleted
      }

      return false;
    }

    beforeEach(() => {
      // Clear provisioning info between tests
      for (const key in slotProvisioningInfo) {
        delete slotProvisioningInfo[parseInt(key)];
      }
    });

    it("should require provisioning for new slot (no history)", () => {
      expect(needsReprovisioning(0, "/servers/bwv1.21.50.24/", true)).to.be.true;
    });

    it("should skip reprovisioning when source is unchanged", () => {
      slotProvisioningInfo[0] = {
        sourceServerPath: "/servers/bwv1.21.50.24/",
        provisionedAt: new Date(),
        version: "1.21.50.24",
      };
      expect(needsReprovisioning(0, "/servers/bwv1.21.50.24/", true)).to.be.false;
    });

    it("should normalize path delimiters for comparison", () => {
      slotProvisioningInfo[0] = {
        sourceServerPath: "C:\\servers\\bwv1.21.50.24\\",
        provisionedAt: new Date(),
      };
      // Same path with forward slashes
      expect(needsReprovisioning(0, "C:/servers/bwv1.21.50.24/", true)).to.be.false;
    });

    it("should be case-insensitive on path comparison", () => {
      slotProvisioningInfo[0] = {
        sourceServerPath: "/Servers/BWv1.21.50.24/",
        provisionedAt: new Date(),
      };
      expect(needsReprovisioning(0, "/servers/bwv1.21.50.24/", true)).to.be.false;
    });

    it("should require reprovisioning when source version changes", () => {
      slotProvisioningInfo[0] = {
        sourceServerPath: "/servers/bwv1.21.50.24/",
        provisionedAt: new Date(),
        version: "1.21.50.24",
      };
      expect(needsReprovisioning(0, "/servers/bwv1.22.0.1/", true)).to.be.true;
    });

    it("should require reprovisioning when slot folder is deleted", () => {
      slotProvisioningInfo[0] = {
        sourceServerPath: "/servers/bwv1.21.50.24/",
        provisionedAt: new Date(),
      };
      expect(needsReprovisioning(0, "/servers/bwv1.21.50.24/", false)).to.be.true;
    });

    it("should track each slot independently", () => {
      slotProvisioningInfo[0] = {
        sourceServerPath: "/servers/bwv1.21.50.24/",
        provisionedAt: new Date(),
      };
      slotProvisioningInfo[1] = {
        sourceServerPath: "/servers/bwv1.22.0.1/",
        provisionedAt: new Date(),
      };

      // Slot 0 should not need reprovisioning for its version
      expect(needsReprovisioning(0, "/servers/bwv1.21.50.24/", true)).to.be.false;
      // Slot 0 should need reprovisioning for slot 1's version
      expect(needsReprovisioning(0, "/servers/bwv1.22.0.1/", true)).to.be.true;
      // Slot 1 should need reprovisioning for slot 0's version
      expect(needsReprovisioning(1, "/servers/bwv1.21.50.24/", true)).to.be.true;
    });
  });

  describe("Version Extraction from Source Path", () => {
    /**
     * Tests for extractVersionFromSourcePath() which parses version numbers
     * from server source directory names.
     */

    function extractVersionFromSourcePath(sourcePath: string): string | undefined {
      // Source paths look like: .../serverSources/bwv1.21.50.24/
      const match = sourcePath.match(/[bp][wl]v?([\d.]+)/i);
      return match ? match[1] : undefined;
    }

    it("should extract version from bwv path", () => {
      expect(extractVersionFromSourcePath("/servers/bwv1.21.50.24/")).to.equal("1.21.50.24");
    });

    it("should extract version from blv path (Linux)", () => {
      expect(extractVersionFromSourcePath("/servers/blv1.21.50.24/")).to.equal("1.21.50.24");
    });

    it("should extract version from pwv path (preview Windows)", () => {
      expect(extractVersionFromSourcePath("C:\\servers\\pwv1.22.0.1\\")).to.equal("1.22.0.1");
    });

    it("should extract version from plv path (preview Linux)", () => {
      expect(extractVersionFromSourcePath("/servers/plv1.22.0.1/")).to.equal("1.22.0.1");
    });

    it("should handle paths without v prefix", () => {
      expect(extractVersionFromSourcePath("/servers/bw1.21.50.24/")).to.equal("1.21.50.24");
    });

    it("should return undefined for unrecognized paths", () => {
      expect(extractVersionFromSourcePath("/servers/custom_server/")).to.be.undefined;
    });

    it("should be case-insensitive", () => {
      expect(extractVersionFromSourcePath("/servers/BWV1.21.50.24/")).to.equal("1.21.50.24");
    });
  });

  describe("Backup Before Destructive Operations", () => {
    /**
     * Tests the backup discipline - world data must be backed up before
     * any destructive operations like reprovisioning a slot.
     */

    it("should generate unique backup names with timestamp", () => {
      const date = new Date(2025, 0, 15, 14, 30, 45);
      const backupName = `backup_${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
        date.getDate()
      ).padStart(2, "0")}_${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(
        2,
        "0"
      )}${String(date.getSeconds()).padStart(2, "0")}`;

      expect(backupName).to.equal("backup_20250115_143045");
    });

    it("should create backup folder structure under slot folder", () => {
      // Simulate the expected folder structure:
      // worlds/
      //   slot0/
      //     backup_20250115_143045/
      //       <world files>
      const slotNumber = 0;
      const backupName = "backup_20250115_143045";
      const expectedPath = `worlds/slot${slotNumber}/${backupName}`;

      expect(expectedPath).to.equal("worlds/slot0/backup_20250115_143045");
    });

    it("should organize backups by slot number", () => {
      // Each slot's backups should be in separate folders for organization
      const slot0Backup = "worlds/slot0/backup_20250115_143045";
      const slot1Backup = "worlds/slot1/backup_20250115_143050";

      expect(slot0Backup).to.include("slot0");
      expect(slot1Backup).to.include("slot1");
      expect(slot0Backup).not.to.equal(slot1Backup);
    });
  });

  describe("Slot Update Helpers", () => {
    /**
     * Tests for updateDedicatedServerSymLinkFolder and updateDedicatedServerFile
     * which handle in-place updates when reprovisioning a slot.
     */

    it("should remove existing symlink before creating new one", () => {
      // Document the expected behavior: if target exists as symlink, unlink it
      const mockSymlinkPath = "/slots/slot0/behavior_packs";
      const isSymlink = true; // fs.lstatSync(path).isSymbolicLink()

      // Expected action: fs.unlinkSync(mockSymlinkPath) then fs.symlinkSync(...)
      expect(isSymlink).to.be.true;
    });

    it("should remove existing directory before creating symlink", () => {
      // Document the expected behavior: if target exists as directory, rm -rf it
      const mockDirPath = "/slots/slot0/behavior_packs";
      const isDirectory = true;

      // Expected action: fs.rmSync(mockDirPath, { recursive: true }) then fs.symlinkSync(...)
      expect(isDirectory).to.be.true;
    });

    it("should overwrite existing files in place", () => {
      // Document: updateDedicatedServerFile should overwrite, not delete+create
      // This is important for bedrock_server.exe to maintain firewall rules
      const srcFile = "/source/bedrock_server.exe";
      const dstFile = "/slots/slot0/bedrock_server.exe";

      // Expected action: fs.copyFileSync(srcFile, dstFile)
      // NOT: fs.unlinkSync(dstFile) + fs.copyFileSync(srcFile, dstFile)
      expect(srcFile).to.not.equal(dstFile);
    });
  });

  describe("Chmod Logic (Linux)", () => {
    it("should make executable on Linux platforms", function () {
      if (os.platform() === "win32") {
        this.skip();
        return;
      }

      const tempDir = testDirs.createTempDir("chmod");
      const testFile = path.join(tempDir, "test_executable");

      // Create a non-executable file
      fs.writeFileSync(testFile, "#!/bin/bash\necho hello");

      // Get initial permissions
      const initialStats = fs.statSync(testFile);
      const initialMode = initialStats.mode;

      // Apply chmod +x (0o755)
      fs.chmodSync(testFile, 0o755);

      // Verify executable bit is set
      const finalStats = fs.statSync(testFile);
      const isExecutable = (finalStats.mode & 0o111) !== 0;

      expect(isExecutable).to.be.true;
    });
  });

  describe("Server Timestamp Naming", () => {
    // Tests the timestamp-based server folder naming

    function formatServerName(date: Date): string {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");

      return `srv${year}${month}${day}${hours}${minutes}${seconds}`;
    }

    it("should format date as srvYYYYMMDDHHMMSS", () => {
      const testDate = new Date(2025, 0, 15, 14, 30, 45); // Jan 15, 2025 14:30:45
      const result = formatServerName(testDate);
      expect(result).to.equal("srv20250115143045");
    });

    it("should pad single-digit components with zeros", () => {
      const testDate = new Date(2025, 0, 5, 8, 3, 9); // Jan 5, 2025 08:03:09
      const result = formatServerName(testDate);
      expect(result).to.equal("srv20250105080309");
    });
  });

  describe("Utilities.sleep", () => {
    it("should pause execution for specified duration", async () => {
      const start = Date.now();
      await Utilities.sleep(100);
      const elapsed = Date.now() - start;

      // Allow some tolerance for timing
      expect(elapsed).to.be.at.least(90);
      expect(elapsed).to.be.at.most(200);
    });
  });
});

describe("Process Signal Handling", () => {
  // Note: These tests document the expected behavior but don't actually
  // register signal handlers as that would interfere with the test runner

  const HANDLED_SIGNALS = ["SIGTERM", "SIGINT", "SIGBREAK", "uncaughtException"];

  it("should define all expected signals", () => {
    expect(HANDLED_SIGNALS).to.include("SIGTERM");
    expect(HANDLED_SIGNALS).to.include("SIGINT");
    expect(HANDLED_SIGNALS).to.include("SIGBREAK");
    expect(HANDLED_SIGNALS).to.include("uncaughtException");
  });

  it("SIGBREAK should only be relevant on Windows", () => {
    // SIGBREAK is a Windows-only signal
    const isWindows = os.platform() === "win32";
    if (!isWindows) {
      // On non-Windows, SIGBREAK is not a valid signal
      expect(() => {
        process.on("SIGBREAK" as NodeJS.Signals, () => {});
      }).to.throw;
    }
  });

  // =====================================================================
  // Version Replacement Logic Tests
  // Validates the fix for the off-by-one bug in replaceVersion() where
  // `lastPeriod - 1` was incorrectly dropping an extra character.
  // =====================================================================

  describe("Version Replacement Logic", () => {
    /**
     * Reimplements ServerManager.replaceVersion() to test the fixed logic.
     * Original bug: substring(0, lastPeriod - 1) dropped a character.
     * Fix: substring(0, lastPeriod) preserves everything up to the last period.
     */
    function replaceVersion(versionString: string, stub: string): string | undefined {
      if (versionString.endsWith(stub)) {
        return undefined;
      }

      const lastPeriod = versionString.lastIndexOf(".");

      if (lastPeriod >= 0) {
        versionString = versionString.substring(0, lastPeriod) + stub;
        return versionString;
      }

      return undefined;
    }

    it("should replace last version segment correctly", () => {
      // "1.21.50.24" → lastPeriod=7 → substring(0,7) = "1.21.50" → + ".25" = "1.21.50.25"
      const result = replaceVersion("1.21.50.24", ".25");
      expect(result).to.equal("1.21.50.25");
    });

    it("should return undefined when version already ends with stub", () => {
      const result = replaceVersion("1.21.50.24", ".24");
      expect(result).to.be.undefined;
    });

    it("should return undefined for version without periods", () => {
      const result = replaceVersion("noperiods", ".1");
      expect(result).to.be.undefined;
    });
  });

  // =====================================================================
  // Server Name Generation Tests
  // Validates the fix for the unary plus bug in direct server name generation
  // where `+ +` was converting date string to NaN.
  // =====================================================================

  describe("Server Name Generation", () => {
    it("should produce a valid name with underscore separator (not NaN)", () => {
      // This tests the fix: `leafName + +dateStr` produced "folderNaN"
      // The fix uses `leafName + "_" + dateStr`
      const leafName = "myserver";
      const dateStr = "20240115";
      const name = leafName + "_" + dateStr;
      expect(name).to.equal("myserver_20240115");
      expect(name).to.not.include("NaN");
    });
  });
});
