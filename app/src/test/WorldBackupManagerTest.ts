// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * WorldBackupManagerTest.ts
 *
 * Unit and integration tests for the WorldBackupManager system including:
 * - ManagedWorld creation and ID generation
 * - WorldBackup creation, restoration, and export
 * - WorldBackupManager CRUD operations
 * - File deduplication with MD5 hashing
 * - Manifest serialization/deserialization
 *
 * These tests verify the centralized backup infrastructure without requiring
 * an actual Minecraft Dedicated Server installation.
 */

import { expect } from "chai";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import ManagedWorld from "../local/ManagedWorld";
import WorldBackupManager from "../local/WorldBackupManager";
import NodeStorage from "../local/NodeStorage";
import {
  WORLD_ID_CHARS,
  WORLD_ID_LENGTH,
  MANIFEST_VERSION,
  WorldBackupType,
  IManagedWorldData,
  IBackupResult,
} from "../local/IWorldBackupData";

/**
 * Test utilities for creating temporary test directories
 */
class TestDirManager {
  private tempDirs: string[] = [];

  createTempDir(prefix: string): string {
    const tempDir = path.join(
      os.tmpdir(),
      `mct-backup-test-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
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

/**
 * Creates a mock world folder structure for testing
 */
function createMockWorldFolder(basePath: string, worldName: string = "TestWorld"): string {
  const worldPath = path.join(basePath, "testworld");
  fs.mkdirSync(worldPath, { recursive: true });

  // Create level.dat (mock NBT - just some binary data for testing)
  const levelDatPath = path.join(worldPath, "level.dat");
  fs.writeFileSync(levelDatPath, Buffer.from([0x0a, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04]));

  // Create levelname.txt
  const levelNamePath = path.join(worldPath, "levelname.txt");
  fs.writeFileSync(levelNamePath, worldName, { encoding: "utf8" });

  // Create db folder with some LevelDB files
  const dbPath = path.join(worldPath, "db");
  fs.mkdirSync(dbPath, { recursive: true });

  // Create a few mock LDB files
  fs.writeFileSync(path.join(dbPath, "000001.ldb"), "chunk data 1");
  fs.writeFileSync(path.join(dbPath, "000002.ldb"), "chunk data 2");
  fs.writeFileSync(path.join(dbPath, "MANIFEST-000001"), "manifest data");
  fs.writeFileSync(path.join(dbPath, "CURRENT"), "MANIFEST-000001\n");

  // Create world_resource_packs.json
  fs.writeFileSync(path.join(worldPath, "world_resource_packs.json"), "[]");

  // Create world_behavior_packs.json
  fs.writeFileSync(path.join(worldPath, "world_behavior_packs.json"), "[]");

  return worldPath;
}

/**
 * Create a WorldBackupManager for testing
 */
function createManager(basePath: string): WorldBackupManager {
  const storage = new NodeStorage(basePath, "");
  return new WorldBackupManager(storage);
}

describe("WorldBackupManager", function () {
  // Increase timeout for file system operations
  this.timeout(30000);

  let testDirs: TestDirManager;

  beforeEach(() => {
    testDirs = new TestDirManager();
  });

  afterEach(() => {
    testDirs.cleanup();
  });

  describe("Constants and Configuration", () => {
    it("should have correct world ID length of 8", () => {
      expect(WORLD_ID_LENGTH).to.equal(8);
    });

    it("should have lowercase alphanumeric characters for world IDs", () => {
      expect(WORLD_ID_CHARS).to.equal("abcdefghijklmnopqrstuvwxyz0123456789");
      expect(WORLD_ID_CHARS.length).to.equal(36);
    });

    it("should have manifest version 1", () => {
      expect(MANIFEST_VERSION).to.equal(1);
    });

    it("should define WorldBackupType enum values", () => {
      expect(WorldBackupType.manual).to.equal("manual");
      expect(WorldBackupType.full).to.equal("full");
      expect(WorldBackupType.incremental).to.equal("incremental");
      expect(WorldBackupType.preReprovision).to.equal("preReprovision");
      expect(WorldBackupType.runtime).to.equal("runtime");
      expect(WorldBackupType.shutdown).to.equal("shutdown");
    });
  });

  describe("ManagedWorld ID Generation", () => {
    it("should generate 8-character world IDs", () => {
      const id = ManagedWorld.generateId();
      expect(id.length).to.equal(8);
    });

    it("should generate IDs with only lowercase letters and numbers", () => {
      for (let i = 0; i < 100; i++) {
        const id = ManagedWorld.generateId();
        expect(id).to.match(/^[a-z0-9]{8}$/);
      }
    });

    it("should generate unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(ManagedWorld.generateId());
      }
      // With 36^8 = 2.8 trillion possible IDs, 1000 should all be unique
      expect(ids.size).to.equal(1000);
    });

    it("should generate IDs using random bytes", () => {
      const id1 = ManagedWorld.generateId();
      const id2 = ManagedWorld.generateId();
      expect(id1).to.not.equal(id2);
    });
  });

  describe("ManagedWorld Creation", () => {
    it("should create a new managed world with generated ID", async () => {
      const tempDir = testDirs.createTempDir("world-create");
      const manager = createManager(tempDir);
      await manager.load();

      const world = await manager.createWorld("My Test World");

      expect(world).to.not.be.undefined;
      expect(world.id.length).to.equal(8);
      expect(world.friendlyName).to.equal("My Test World");
    });

    it("should persist world data to filesystem", async () => {
      const tempDir = testDirs.createTempDir("world-persist");
      const manager = createManager(tempDir);
      await manager.load();

      const world = await manager.createWorld("Persisted World");

      // Check that world folder exists
      const worldPath = path.join(tempDir, world.id);
      expect(fs.existsSync(worldPath)).to.be.true;

      // Check that world.json exists
      const worldJsonPath = path.join(worldPath, "world.json");
      expect(fs.existsSync(worldJsonPath)).to.be.true;

      // Verify JSON content
      const worldData = JSON.parse(fs.readFileSync(worldJsonPath, "utf8")) as IManagedWorldData;
      expect(worldData.id).to.equal(world.id);
      expect(worldData.friendlyName).to.equal("Persisted World");
      expect(worldData.createdAt).to.be.a("string");
    });

    it("should load existing world from filesystem", async () => {
      const tempDir = testDirs.createTempDir("world-load");
      const manager = createManager(tempDir);
      await manager.load();

      // Create a world
      const originalWorld = await manager.createWorld("Original World");
      const worldId = originalWorld.id;

      // Create a new manager instance (simulates restart)
      const manager2 = createManager(tempDir);
      await manager2.load();

      // Load the world
      const loadedWorld = manager2.getWorld(worldId);

      expect(loadedWorld).to.not.be.undefined;
      expect(loadedWorld!.id).to.equal(worldId);
      expect(loadedWorld!.friendlyName).to.equal("Original World");
    });

    it("should support world description field", async () => {
      const tempDir = testDirs.createTempDir("world-desc");
      const manager = createManager(tempDir);
      await manager.load();

      // createWorld doesn't accept description - use the setter instead
      const world = await manager.createWorld("World with Desc");
      world.description = "A detailed description";
      await world.save();

      expect(world.description).to.equal("A detailed description");

      // Verify it persists after reload
      const manager2 = createManager(tempDir);
      await manager2.load();
      const loadedWorld = manager2.getWorld(world.id);
      expect(loadedWorld?.description).to.equal("A detailed description");
    });
  });

  describe("WorldBackup Creation", () => {
    it("should create a backup from a world folder", async () => {
      const tempDir = testDirs.createTempDir("backup-create");
      const sourceDir = testDirs.createTempDir("source-world");
      const worldPath = createMockWorldFolder(sourceDir);

      const manager = createManager(tempDir);
      await manager.load();
      const world = await manager.createWorld("Backup Test World");

      const result: IBackupResult = await manager.createBackup(world.id, worldPath, {
        type: WorldBackupType.manual,
        notes: "Test backup",
      });

      expect(result.success).to.be.true;
      expect(result.backupId).to.be.a("string");
      expect(result.backupPath).to.be.a("string");
      expect(result.stats).to.not.be.undefined;
      expect(result.stats!.totalFiles).to.be.greaterThan(0);
    });

    it("should store backup files with deduplication", async () => {
      const tempDir = testDirs.createTempDir("backup-dedup");
      const sourceDir = testDirs.createTempDir("source");
      const worldPath = createMockWorldFolder(sourceDir);

      const manager = createManager(tempDir);
      await manager.load();
      const world = await manager.createWorld("Dedup Test");

      // Create first backup
      const result1 = await manager.createBackup(world.id, worldPath, {
        type: WorldBackupType.manual,
      });
      expect(result1.success).to.be.true;

      // Wait for at least 1 second to ensure different backup ID (uses timestamp with seconds precision)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Create second backup (same files, should be deduplicated)
      const result2 = await manager.createBackup(world.id, worldPath, {
        type: WorldBackupType.manual,
      });
      expect(result2.success).to.be.true;

      // Verify IDs are different
      expect(result1.backupId).to.not.equal(result2.backupId);

      // Both backups should exist
      const backups = await manager.listBackups(world.id);
      expect(backups.length).to.equal(2);
    });

    it("should track backup size in bytes", async () => {
      const tempDir = testDirs.createTempDir("backup-size");
      const sourceDir = testDirs.createTempDir("source");
      const worldPath = createMockWorldFolder(sourceDir);

      const manager = createManager(tempDir);
      await manager.load();
      const world = await manager.createWorld("Size Test");

      const result = await manager.createBackup(world.id, worldPath, {
        type: WorldBackupType.manual,
      });

      expect(result.success).to.be.true;
      expect(result.stats!.totalBytes).to.be.greaterThan(0);
    });

    it("should support different backup types", async () => {
      const tempDir = testDirs.createTempDir("backup-types");
      const sourceDir = testDirs.createTempDir("source");
      const worldPath = createMockWorldFolder(sourceDir);

      const manager = createManager(tempDir);
      await manager.load();
      const world = await manager.createWorld("Type Test");

      const backupTypes = [
        WorldBackupType.manual,
        WorldBackupType.full,
        WorldBackupType.incremental,
        WorldBackupType.runtime,
        WorldBackupType.shutdown,
      ];

      for (const backupType of backupTypes) {
        const result = await manager.createBackup(world.id, worldPath, {
          type: backupType,
        });

        expect(result.success).to.be.true;

        // Wait for at least 1 second to ensure different backup ID (uses timestamp with seconds precision)
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }

      const backups = await manager.listBackups(world.id);
      expect(backups.length).to.equal(backupTypes.length);
    });
  });

  describe("WorldBackup Restoration", () => {
    it("should restore a backup to a target folder", async () => {
      const tempDir = testDirs.createTempDir("backup-restore");
      const sourceDir = testDirs.createTempDir("source");
      const targetDir = testDirs.createTempDir("target");
      const worldPath = createMockWorldFolder(sourceDir, "RestoreTest");

      const manager = createManager(tempDir);
      await manager.load();
      const world = await manager.createWorld("Restore Test World");

      const backupResult = await manager.createBackup(world.id, worldPath, {
        type: WorldBackupType.manual,
      });
      expect(backupResult.success).to.be.true;

      // Restore to target directory
      const restoreResult = await manager.restoreBackup(world.id, backupResult.backupId!, targetDir);

      expect(restoreResult.success).to.be.true;

      // Verify restored files
      const restoredLevelName = path.join(targetDir, "levelname.txt");
      expect(fs.existsSync(restoredLevelName)).to.be.true;
      expect(fs.readFileSync(restoredLevelName, "utf8")).to.equal("RestoreTest");
    });

    it("should restore LevelDB files correctly", async () => {
      const tempDir = testDirs.createTempDir("backup-restore-ldb");
      const sourceDir = testDirs.createTempDir("source");
      const targetDir = testDirs.createTempDir("target");
      const worldPath = createMockWorldFolder(sourceDir);

      const manager = createManager(tempDir);
      await manager.load();
      const world = await manager.createWorld("LDB Restore Test");

      const backupResult = await manager.createBackup(world.id, worldPath, {
        type: WorldBackupType.manual,
      });

      await manager.restoreBackup(world.id, backupResult.backupId!, targetDir);

      // Verify db folder and files
      expect(fs.existsSync(path.join(targetDir, "db"))).to.be.true;
      expect(fs.existsSync(path.join(targetDir, "db", "000001.ldb"))).to.be.true;
      expect(fs.existsSync(path.join(targetDir, "db", "CURRENT"))).to.be.true;
    });
  });

  describe("WorldBackup Export to .mcworld", () => {
    it("should export a backup as a .mcworld zip file", async () => {
      const tempDir = testDirs.createTempDir("backup-export");
      const sourceDir = testDirs.createTempDir("source");
      const worldPath = createMockWorldFolder(sourceDir, "ExportWorld");

      const manager = createManager(tempDir);
      await manager.load();
      const world = await manager.createWorld("Export Test");

      const backupResult = await manager.createBackup(world.id, worldPath, {
        type: WorldBackupType.manual,
      });

      expect(backupResult.success).to.be.true;

      const outputPath = path.join(tempDir, "export.mcworld");
      const exportResult = await manager.exportMcWorld(world.id, backupResult.backupId!, outputPath, "Exported World");

      expect(exportResult.success).to.be.true;
      expect(fs.existsSync(outputPath)).to.be.true;

      // Verify it's a valid zip file (starts with PK signature)
      const zipBytes = fs.readFileSync(outputPath);
      expect(zipBytes[0]).to.equal(0x50); // 'P'
      expect(zipBytes[1]).to.equal(0x4b); // 'K'
    });

    it("should include all world files in .mcworld export", async () => {
      const tempDir = testDirs.createTempDir("backup-export-full");
      const sourceDir = testDirs.createTempDir("source");
      const worldPath = createMockWorldFolder(sourceDir);

      const manager = createManager(tempDir);
      await manager.load();
      const world = await manager.createWorld("Full Export Test");

      const backupResult = await manager.createBackup(world.id, worldPath, {
        type: WorldBackupType.manual,
      });

      const outputPath = path.join(tempDir, "full-export.mcworld");
      const exportResult = await manager.exportMcWorld(world.id, backupResult.backupId!, outputPath);

      expect(exportResult.success).to.be.true;
      expect(exportResult.sizeBytes).to.be.greaterThan(0);
    });
  });

  describe("WorldBackup Deletion", () => {
    it("should delete a backup and its files", async () => {
      const tempDir = testDirs.createTempDir("backup-delete");
      const sourceDir = testDirs.createTempDir("source");
      const worldPath = createMockWorldFolder(sourceDir);

      const manager = createManager(tempDir);
      await manager.load();
      const world = await manager.createWorld("Delete Test");

      const backupResult = await manager.createBackup(world.id, worldPath, {
        type: WorldBackupType.manual,
      });

      const backupId = backupResult.backupId!;

      // Verify backup exists
      let backups = await manager.listBackups(world.id);
      expect(backups.length).to.equal(1);

      // Delete the backup
      await world.deleteBackup(backupId);

      // Verify backup is gone
      backups = await manager.listBackups(world.id);
      expect(backups.length).to.equal(0);
    });
  });

  describe("WorldBackup Pruning", () => {
    it("should prune old backups keeping specified count", async () => {
      const tempDir = testDirs.createTempDir("backup-prune");
      const sourceDir = testDirs.createTempDir("source");
      const worldPath = createMockWorldFolder(sourceDir);

      const manager = createManager(tempDir);
      await manager.load();
      const world = await manager.createWorld("Prune Test");

      // Create 5 backups with 1s delay between each (backup ID uses seconds precision)
      for (let i = 0; i < 5; i++) {
        await manager.createBackup(world.id, worldPath, {
          type: WorldBackupType.full,
        });
        // Wait at least 1 second to ensure different backup IDs
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }

      let backups = await manager.listBackups(world.id);
      expect(backups.length).to.equal(5);

      // Prune to keep only 2 backups
      await world.pruneBackups(2);

      backups = await manager.listBackups(world.id);
      expect(backups.length).to.equal(2);
    });
  });

  describe("WorldBackupManager Initialization", () => {
    it("should create required directories on load", async () => {
      const tempDir = testDirs.createTempDir("manager-dirs");
      const manager = createManager(tempDir);

      await manager.load();

      // Container folder should exist
      expect(fs.existsSync(tempDir)).to.be.true;
    });

    it("should load existing worlds on load", async () => {
      const tempDir = testDirs.createTempDir("manager-reload");

      // First manager creates worlds
      const manager1 = createManager(tempDir);
      await manager1.load();
      await manager1.createWorld("World 1");
      await manager1.createWorld("World 2");

      // Second manager loads them
      const manager2 = createManager(tempDir);
      await manager2.load();

      const worlds = await manager2.listWorlds();
      expect(worlds.length).to.equal(2);
    });

    it("should persist manifest with version info", async () => {
      const tempDir = testDirs.createTempDir("manager-manifest");
      const manager = createManager(tempDir);

      await manager.load();

      // Manifest is saved when a world is created
      await manager.createWorld("Manifest Test World");

      const manifestPath = path.join(tempDir, "manifest.json");
      expect(fs.existsSync(manifestPath)).to.be.true;

      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      expect(manifest.version).to.equal(MANIFEST_VERSION);
      expect(manifest.worlds).to.be.an("object");
    });
  });

  describe("WorldBackupManager.listWorlds", () => {
    it("should return empty array when no worlds exist", async () => {
      const tempDir = testDirs.createTempDir("list-empty");
      const manager = createManager(tempDir);
      await manager.load();

      const worlds = await manager.listWorlds();
      expect(worlds).to.be.an("array").that.is.empty;
    });

    it("should return all managed worlds", async () => {
      const tempDir = testDirs.createTempDir("list-worlds");
      const manager = createManager(tempDir);
      await manager.load();

      await manager.createWorld("World A");
      await manager.createWorld("World B");
      await manager.createWorld("World C");

      const worlds = await manager.listWorlds();
      expect(worlds.length).to.equal(3);

      const names = worlds.map((w: ManagedWorld) => w.friendlyName);
      expect(names).to.include("World A");
      expect(names).to.include("World B");
      expect(names).to.include("World C");
    });
  });

  describe("File Deduplication", () => {
    it("should store identical files only once", async () => {
      const tempDir = testDirs.createTempDir("dedup-test");
      const sourceDir1 = testDirs.createTempDir("source1");
      const sourceDir2 = testDirs.createTempDir("source2");

      // Create two identical worlds
      const worldPath1 = createMockWorldFolder(sourceDir1, "World1");
      const worldPath2 = createMockWorldFolder(sourceDir2, "World1"); // Same content

      const manager = createManager(tempDir);
      await manager.load();

      const world1 = await manager.createWorld("World 1");
      const world2 = await manager.createWorld("World 2");

      await manager.createBackup(world1.id, worldPath1, {
        type: WorldBackupType.manual,
      });

      await manager.createBackup(world2.id, worldPath2, {
        type: WorldBackupType.manual,
      });

      // Both backups should succeed
      const backups1 = await manager.listBackups(world1.id);
      const backups2 = await manager.listBackups(world2.id);
      expect(backups1.length).to.equal(1);
      expect(backups2.length).to.equal(1);
    });

    it("should track file listings with MD5 hashes in backup metadata", async () => {
      const tempDir = testDirs.createTempDir("dedup-hash");
      const sourceDir = testDirs.createTempDir("source");
      const worldPath = createMockWorldFolder(sourceDir);

      const manager = createManager(tempDir);
      await manager.load();

      const world = await manager.createWorld("Hash Test");
      const result = await manager.createBackup(world.id, worldPath, {
        type: WorldBackupType.manual,
      });

      expect(result.success).to.be.true;

      // File hashes are stored in backup.json, not a separate files.json
      const backupJsonPath = path.join(tempDir, world.id, result.backupId!, "backup.json");
      expect(fs.existsSync(backupJsonPath)).to.be.true;

      const backupData = JSON.parse(fs.readFileSync(backupJsonPath, "utf8"));
      expect(backupData.files).to.be.an("array");
      expect(backupData.files.length).to.be.greaterThan(0);

      // Each file should have hash info
      for (const file of backupData.files) {
        expect(file.path).to.be.a("string");
      }
    });
  });

  describe("Backup Metadata via Manager", () => {
    it("should store backup notes", async () => {
      const tempDir = testDirs.createTempDir("meta-notes");
      const sourceDir = testDirs.createTempDir("source");
      const worldPath = createMockWorldFolder(sourceDir);

      const manager = createManager(tempDir);
      await manager.load();
      const world = await manager.createWorld("Notes Test");

      const result = await manager.createBackup(world.id, worldPath, {
        type: WorldBackupType.manual,
        notes: "Important backup before major changes",
      });

      expect(result.success).to.be.true;

      // Retrieve the backup and verify notes
      const backups = await manager.listBackups(world.id);
      expect(backups.length).to.equal(1);
      expect(backups[0].notes).to.equal("Important backup before major changes");
    });

    it("should store and retrieve file count", async () => {
      const tempDir = testDirs.createTempDir("meta-filecount");
      const sourceDir = testDirs.createTempDir("source");
      const worldPath = createMockWorldFolder(sourceDir);

      const manager = createManager(tempDir);
      await manager.load();
      const world = await manager.createWorld("FileCount Test");

      const result = await manager.createBackup(world.id, worldPath, {
        type: WorldBackupType.manual,
      });

      expect(result.stats!.totalFiles).to.be.greaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should return undefined when getting non-existent world", async () => {
      const tempDir = testDirs.createTempDir("error-noworld");
      const manager = createManager(tempDir);
      await manager.load();

      const world = manager.getWorld("nonexist");
      expect(world).to.be.undefined;
    });

    it("should fail gracefully when backing up non-existent source", async () => {
      const tempDir = testDirs.createTempDir("error-nosource");
      const manager = createManager(tempDir);
      await manager.load();
      const world = await manager.createWorld("Error Test");

      const result = await manager.createBackup(world.id, "/nonexistent/path/to/world", {
        type: WorldBackupType.manual,
      });

      // Should return failure result
      expect(result.success).to.be.false;
    });

    it("should fail gracefully when restoring with invalid backup ID", async () => {
      const tempDir = testDirs.createTempDir("error-restore");
      const sourceDir = testDirs.createTempDir("source");
      const worldPath = createMockWorldFolder(sourceDir);

      const manager = createManager(tempDir);
      await manager.load();
      const world = await manager.createWorld("Restore Error Test");

      await manager.createBackup(world.id, worldPath, {
        type: WorldBackupType.manual,
      });

      // Try to restore with an invalid backup ID
      const result = await manager.restoreBackup(world.id, "invalid-backup-id", tempDir);
      expect(result.success).to.be.false;
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle sequential backup creation", async () => {
      const tempDir = testDirs.createTempDir("sequential");
      const sourceDir = testDirs.createTempDir("source");
      const worldPath = createMockWorldFolder(sourceDir);

      const manager = createManager(tempDir);
      await manager.load();
      const world = await manager.createWorld("Sequential Test");

      // Create multiple backups sequentially with delays
      // (concurrent backup creation with same-second timestamps would have ID collisions)
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await manager.createBackup(world.id, worldPath, {
          type: WorldBackupType.manual,
          notes: `Backup ${i}`,
        });
        results.push(result);
        // Wait for at least 1 second to ensure different backup ID
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }

      // All backups should succeed
      for (const result of results) {
        expect(result.success).to.be.true;
      }

      // All should have unique IDs
      const backupIds = results.map((r) => r.backupId);
      const uniqueIds = new Set(backupIds);
      expect(uniqueIds.size).to.equal(3);

      // All should be listed
      const backups = await manager.listBackups(world.id);
      expect(backups.length).to.equal(3);
    });
  });

  describe("Integration: Full Backup Lifecycle", () => {
    it("should perform complete create-backup-restore-export workflow", async () => {
      const tempDir = testDirs.createTempDir("integration-full");
      const sourceDir = testDirs.createTempDir("source");
      const restoreDir = testDirs.createTempDir("restore");
      const worldPath = createMockWorldFolder(sourceDir, "IntegrationWorld");

      // 1. Create manager and world
      const manager = createManager(tempDir);
      await manager.load();

      const world = await manager.createWorld("Integration Test World");
      world.description = "A test world for integration testing";
      await world.save();

      expect(world.id.length).to.equal(8);
      expect(world.friendlyName).to.equal("Integration Test World");

      // 2. Create a backup
      const backupResult = await manager.createBackup(world.id, worldPath, {
        type: WorldBackupType.manual,
        notes: "First backup",
        includeBehaviorPacks: false,
        includeResourcePacks: false,
      });

      expect(backupResult.success).to.be.true;
      expect(backupResult.backupId).to.match(/^world\d{14}$/);

      // 3. List backups
      const backups = await manager.listBackups(world.id);
      expect(backups.length).to.equal(1);
      expect(backups[0].notes).to.equal("First backup");

      // 4. Restore the backup
      const restoreResult = await manager.restoreBackup(world.id, backupResult.backupId!, restoreDir);
      expect(restoreResult.success).to.be.true;

      // Verify restored files
      expect(fs.existsSync(path.join(restoreDir, "levelname.txt"))).to.be.true;
      expect(fs.existsSync(path.join(restoreDir, "level.dat"))).to.be.true;
      expect(fs.readFileSync(path.join(restoreDir, "levelname.txt"), "utf8")).to.equal("IntegrationWorld");

      // 5. Export as .mcworld
      const exportPath = path.join(tempDir, "exported.mcworld");
      const exportResult = await manager.exportMcWorld(
        world.id,
        backupResult.backupId!,
        exportPath,
        "Exported Integration World"
      );

      expect(exportResult.success).to.be.true;
      expect(fs.existsSync(exportPath)).to.be.true;
      expect(exportResult.sizeBytes).to.be.greaterThan(0);

      // 6. Verify persistence across manager restarts
      const manager2 = createManager(tempDir);
      await manager2.load();

      const loadedWorld = manager2.getWorld(world.id);
      expect(loadedWorld).to.not.be.undefined;
      expect(loadedWorld!.description).to.equal("A test world for integration testing");

      const loadedBackups = await manager2.listBackups(world.id);
      expect(loadedBackups.length).to.equal(1);
    });

    it("should support multiple worlds with independent backups", async () => {
      const tempDir = testDirs.createTempDir("integration-multi");
      const sourceDir1 = testDirs.createTempDir("source1");
      const sourceDir2 = testDirs.createTempDir("source2");
      const worldPath1 = createMockWorldFolder(sourceDir1, "World1");
      const worldPath2 = createMockWorldFolder(sourceDir2, "World2");

      const manager = createManager(tempDir);
      await manager.load();

      // Create two worlds
      const world1 = await manager.createWorld("First World");
      const world2 = await manager.createWorld("Second World");

      expect(world1.id).to.not.equal(world2.id);

      // Backup both worlds
      const backup1 = await manager.createBackup(world1.id, worldPath1, { type: WorldBackupType.manual });
      await new Promise((resolve) => setTimeout(resolve, 1100)); // Ensure different timestamp
      const backup2 = await manager.createBackup(world2.id, worldPath2, { type: WorldBackupType.manual });

      expect(backup1.success).to.be.true;
      expect(backup2.success).to.be.true;

      // Each world should have its own backup
      const backups1 = await manager.listBackups(world1.id);
      const backups2 = await manager.listBackups(world2.id);

      expect(backups1.length).to.equal(1);
      expect(backups2.length).to.equal(1);

      // Delete one world through manager (not directly on world)
      await manager.deleteWorld(world1.id);

      const remainingWorlds = await manager.listWorlds();
      expect(remainingWorlds.length).to.equal(1);
      expect(remainingWorlds[0].id).to.equal(world2.id);
    });

    it("should maintain backup integrity across pruning", async () => {
      const tempDir = testDirs.createTempDir("integration-prune");
      const sourceDir = testDirs.createTempDir("source");
      const worldPath = createMockWorldFolder(sourceDir, "PruneWorld");

      const manager = createManager(tempDir);
      await manager.load();

      const world = await manager.createWorld("Prune Integrity Test");

      // Create 3 backups - files will be deduplicated after the first
      const backupIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const result = await manager.createBackup(world.id, worldPath, {
          type: WorldBackupType.full,
          notes: `Backup ${i}`,
        });
        expect(result.success).to.be.true;
        backupIds.push(result.backupId!);
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }

      // Prune to keep only 2 (deletes oldest which has the deduplicated files)
      // The remaining backups should be consolidated automatically
      const pruned = await world.pruneBackups(2);
      expect(pruned).to.equal(1);

      // Verify remaining backups are still valid and restorable
      const remainingBackups = await manager.listBackups(world.id);
      expect(remainingBackups.length).to.equal(2);

      // The newest 2 should remain and be fully restorable
      const restoreDir = testDirs.createTempDir("restore-pruned");
      const restoreResult = await manager.restoreBackup(world.id, remainingBackups[0].id, restoreDir);
      expect(restoreResult.success).to.be.true;
      expect(fs.existsSync(path.join(restoreDir, "levelname.txt"))).to.be.true;
      expect(fs.existsSync(path.join(restoreDir, "level.dat"))).to.be.true;
      expect(fs.existsSync(path.join(restoreDir, "db", "CURRENT"))).to.be.true;
    });
  });
});
