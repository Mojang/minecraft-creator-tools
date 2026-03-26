// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Unit tests for the Storage Watcher and Real-Time Sync subsystems.
 *
 * These tests verify the individual components of the file watcher notification pipeline:
 * 1. IStorageChangeEvent structure and types
 * 2. LevelDb incremental file parsing and chunk coordinate extraction
 * 3. MCWorld chunk update handlers
 * 4. WorldMap tile-to-chunk coordinate mapping
 *
 * Note: Full E2E testing of the file watcher pipeline requires actual file system operations
 * and WebSocket connections, which is beyond the scope of these unit tests. These tests focus
 * on verifying the logic of each subsystem in isolation.
 */

import { expect } from "chai";
import { StorageChangeType, IStorageChangeEvent } from "../storage/IStorageWatcher";
import DataUtilities from "../core/DataUtilities";

describe("Storage Watcher Tests", function () {
  describe("IStorageChangeEvent structure", function () {
    it("should create valid file update events", function () {
      const event: IStorageChangeEvent = {
        changeType: "modified",
        path: "/db/000123.ldb",
        isFile: true,
        timestamp: new Date(),
      };

      expect(event.changeType).to.equal("modified");
      expect(event.path).to.equal("/db/000123.ldb");
      expect(event.isFile).to.be.true;
      expect(event.timestamp).to.be.instanceOf(Date);
    });

    it("should create valid file added events", function () {
      const event: IStorageChangeEvent = {
        changeType: "added",
        path: "/db/000124.ldb",
        isFile: true,
        timestamp: new Date(),
      };

      expect(event.changeType).to.equal("added");
    });

    it("should create valid file removed events", function () {
      const event: IStorageChangeEvent = {
        changeType: "removed",
        path: "/db/000122.ldb",
        isFile: true,
        timestamp: new Date(),
      };

      expect(event.changeType).to.equal("removed");
    });

    it("should create valid folder events", function () {
      const addEvent: IStorageChangeEvent = {
        changeType: "added",
        path: "/db/",
        isFile: false,
        timestamp: new Date(),
      };

      const removeEvent: IStorageChangeEvent = {
        changeType: "removed",
        path: "/old/",
        isFile: false,
        timestamp: new Date(),
      };

      expect(addEvent.changeType).to.equal("added");
      expect(addEvent.isFile).to.be.false;
      expect(removeEvent.changeType).to.equal("removed");
    });

    it("should support source tracking", function () {
      const event: IStorageChangeEvent = {
        changeType: "modified",
        path: "/db/000125.ldb",
        isFile: true,
        timestamp: new Date(),
        source: "watcher-123",
      };

      expect(event.source).to.equal("watcher-123");
    });

    it("should support all change types", function () {
      const types: StorageChangeType[] = ["added", "modified", "removed", "renamed"];

      for (const changeType of types) {
        const event: IStorageChangeEvent = {
          changeType,
          path: "/test",
          isFile: true,
          timestamp: new Date(),
        };
        expect(event.changeType).to.equal(changeType);
      }
    });
  });

  describe("LevelDB key chunk coordinate extraction", function () {
    /**
     * LevelDB keys for chunk data are 9-14 bytes:
     * - Bytes 0-3: X coordinate (little-endian signed int32)
     * - Bytes 4-7: Z coordinate (little-endian signed int32)
     * - Bytes 8-11: Dimension (optional, little-endian signed int32)
     * - Byte 8 or 12: Key type
     * - Byte 9 or 13: Subchunk index (for subchunk keys)
     */

    it("should extract positive chunk coordinates from 9-byte key", function () {
      // Create a key for chunk (5, 10) in the Overworld (no dimension byte)
      // X = 5, Z = 10, key type = 47 (subchunk data)
      const keyBytes = new Uint8Array([
        5,
        0,
        0,
        0, // X = 5 (little-endian)
        10,
        0,
        0,
        0, // Z = 10 (little-endian)
        47, // Key type
      ]);

      const keyname = String.fromCharCode(...keyBytes);

      const x = DataUtilities.getSignedInteger(
        keyname.charCodeAt(0),
        keyname.charCodeAt(1),
        keyname.charCodeAt(2),
        keyname.charCodeAt(3),
        true
      );
      const z = DataUtilities.getSignedInteger(
        keyname.charCodeAt(4),
        keyname.charCodeAt(5),
        keyname.charCodeAt(6),
        keyname.charCodeAt(7),
        true
      );

      expect(x).to.equal(5);
      expect(z).to.equal(10);
    });

    it("should extract negative chunk coordinates from 9-byte key", function () {
      // Create a key for chunk (-100, -200) in the Overworld
      // Using two's complement for negative numbers
      const x = -100;
      const z = -200;

      // Convert to unsigned 32-bit representation (two's complement)
      const xUnsigned = x >>> 0;
      const zUnsigned = z >>> 0;

      const keyBytes = new Uint8Array([
        xUnsigned & 0xff,
        (xUnsigned >> 8) & 0xff,
        (xUnsigned >> 16) & 0xff,
        (xUnsigned >> 24) & 0xff,
        zUnsigned & 0xff,
        (zUnsigned >> 8) & 0xff,
        (zUnsigned >> 16) & 0xff,
        (zUnsigned >> 24) & 0xff,
        47, // Key type
      ]);

      const keyname = String.fromCharCode(...keyBytes);

      const extractedX = DataUtilities.getSignedInteger(
        keyname.charCodeAt(0),
        keyname.charCodeAt(1),
        keyname.charCodeAt(2),
        keyname.charCodeAt(3),
        true
      );
      const extractedZ = DataUtilities.getSignedInteger(
        keyname.charCodeAt(4),
        keyname.charCodeAt(5),
        keyname.charCodeAt(6),
        keyname.charCodeAt(7),
        true
      );

      expect(extractedX).to.equal(-100);
      expect(extractedZ).to.equal(-200);
    });

    it("should extract coordinates with dimension from 13-byte key", function () {
      // Create a key for chunk (15, 25) in The Nether (dimension 1)
      const x = 15;
      const z = 25;
      const dim = 1;

      const keyBytes = new Uint8Array([
        x & 0xff,
        (x >> 8) & 0xff,
        (x >> 16) & 0xff,
        (x >> 24) & 0xff,
        z & 0xff,
        (z >> 8) & 0xff,
        (z >> 16) & 0xff,
        (z >> 24) & 0xff,
        dim & 0xff,
        (dim >> 8) & 0xff,
        (dim >> 16) & 0xff,
        (dim >> 24) & 0xff,
        47, // Key type
      ]);

      const keyname = String.fromCharCode(...keyBytes);

      const extractedX = DataUtilities.getSignedInteger(
        keyname.charCodeAt(0),
        keyname.charCodeAt(1),
        keyname.charCodeAt(2),
        keyname.charCodeAt(3),
        true
      );
      const extractedZ = DataUtilities.getSignedInteger(
        keyname.charCodeAt(4),
        keyname.charCodeAt(5),
        keyname.charCodeAt(6),
        keyname.charCodeAt(7),
        true
      );
      const extractedDim = DataUtilities.getSignedInteger(
        keyname.charCodeAt(8),
        keyname.charCodeAt(9),
        keyname.charCodeAt(10),
        keyname.charCodeAt(11),
        true
      );

      expect(extractedX).to.equal(15);
      expect(extractedZ).to.equal(25);
      expect(extractedDim).to.equal(1);
    });

    it("should extract The End dimension (2) correctly", function () {
      const dim = 2; // The End

      const keyBytes = new Uint8Array([
        0,
        0,
        0,
        0, // X = 0
        0,
        0,
        0,
        0, // Z = 0
        dim & 0xff,
        0,
        0,
        0,
        47, // Key type
      ]);

      const keyname = String.fromCharCode(...keyBytes);

      const extractedDim = DataUtilities.getSignedInteger(
        keyname.charCodeAt(8),
        keyname.charCodeAt(9),
        keyname.charCodeAt(10),
        keyname.charCodeAt(11),
        true
      );

      expect(extractedDim).to.equal(2);
    });

    it("should handle large positive coordinates", function () {
      // Chunk at far positive corner (near world border)
      const x = 1875000; // About 30 million blocks
      const z = 1875000;

      const keyBytes = new Uint8Array([
        x & 0xff,
        (x >> 8) & 0xff,
        (x >> 16) & 0xff,
        (x >> 24) & 0xff,
        z & 0xff,
        (z >> 8) & 0xff,
        (z >> 16) & 0xff,
        (z >> 24) & 0xff,
        47,
      ]);

      const keyname = String.fromCharCode(...keyBytes);

      const extractedX = DataUtilities.getSignedInteger(
        keyname.charCodeAt(0),
        keyname.charCodeAt(1),
        keyname.charCodeAt(2),
        keyname.charCodeAt(3),
        true
      );
      const extractedZ = DataUtilities.getSignedInteger(
        keyname.charCodeAt(4),
        keyname.charCodeAt(5),
        keyname.charCodeAt(6),
        keyname.charCodeAt(7),
        true
      );

      expect(extractedX).to.equal(1875000);
      expect(extractedZ).to.equal(1875000);
    });
  });

  describe("WorldMap tile-to-chunk mapping", function () {
    /**
     * Tests for the tile coordinate to chunk coordinate mapping.
     * At different zoom levels, tiles cover different numbers of blocks/chunks.
     *
     * Tile size is always 256 pixels.
     * Zoom 3: 1 block/pixel → 256 blocks/tile → 16 chunks/tile
     * Zoom 4: 2 pixels/block → 128 blocks/tile → 8 chunks/tile
     * Zoom 5: 4 pixels/block → 64 blocks/tile → 4 chunks/tile
     * Zoom 6: 8 pixels/block → 32 blocks/tile → 2 chunks/tile
     * Zoom 7: 16 pixels/block → 16 blocks/tile → 1 chunk/tile
     */

    function getTileChunkRange(
      zoom: number,
      tileX: number,
      tileY: number
    ): { minX: number; maxX: number; minZ: number; maxZ: number } {
      const tileSize = 256;
      let blocksPerTile: number;

      if (zoom <= 3) {
        blocksPerTile = tileSize;
      } else if (zoom === 4) {
        blocksPerTile = tileSize / 2;
      } else if (zoom === 5) {
        blocksPerTile = tileSize / 4;
      } else if (zoom === 6) {
        blocksPerTile = tileSize / 8;
      } else {
        blocksPerTile = 16;
      }

      const blockX = tileX * blocksPerTile;
      const blockZ = tileY * blocksPerTile;

      const minChunkX = Math.floor(blockX / 16);
      const maxChunkX = Math.floor((blockX + blocksPerTile - 1) / 16);
      const minChunkZ = Math.floor(blockZ / 16);
      const maxChunkZ = Math.floor((blockZ + blocksPerTile - 1) / 16);

      return { minX: minChunkX, maxX: maxChunkX, minZ: minChunkZ, maxZ: maxChunkZ };
    }

    it("should map zoom 7 tiles to single chunks", function () {
      // At zoom 7, each tile covers exactly 1 chunk (16 blocks)
      const range = getTileChunkRange(7, 5, 10);

      expect(range.minX).to.equal(5);
      expect(range.maxX).to.equal(5);
      expect(range.minZ).to.equal(10);
      expect(range.maxZ).to.equal(10);
    });

    it("should map zoom 6 tiles to 2x2 chunks", function () {
      // At zoom 6, each tile covers 32 blocks = 2 chunks
      const range = getTileChunkRange(6, 0, 0);

      expect(range.minX).to.equal(0);
      expect(range.maxX).to.equal(1);
      expect(range.minZ).to.equal(0);
      expect(range.maxZ).to.equal(1);
    });

    it("should map zoom 5 tiles to 4x4 chunks", function () {
      // At zoom 5, each tile covers 64 blocks = 4 chunks
      const range = getTileChunkRange(5, 1, 1);

      // Tile 1 starts at block 64, which is chunk 4
      expect(range.minX).to.equal(4);
      expect(range.maxX).to.equal(7);
      expect(range.minZ).to.equal(4);
      expect(range.maxZ).to.equal(7);
    });

    it("should map zoom 4 tiles to 8x8 chunks", function () {
      // At zoom 4, each tile covers 128 blocks = 8 chunks
      const range = getTileChunkRange(4, 0, 0);

      expect(range.minX).to.equal(0);
      expect(range.maxX).to.equal(7);
      expect(range.minZ).to.equal(0);
      expect(range.maxZ).to.equal(7);
    });

    it("should map zoom 3 tiles to 16x16 chunks", function () {
      // At zoom 3, each tile covers 256 blocks = 16 chunks
      const range = getTileChunkRange(3, 0, 0);

      expect(range.minX).to.equal(0);
      expect(range.maxX).to.equal(15);
      expect(range.minZ).to.equal(0);
      expect(range.maxZ).to.equal(15);
    });

    it("should correctly map tiles at offset positions", function () {
      // Tile (2, 3) at zoom 7 should be chunk (2, 3)
      const range7 = getTileChunkRange(7, 2, 3);
      expect(range7.minX).to.equal(2);
      expect(range7.minZ).to.equal(3);

      // Tile (2, 3) at zoom 6 covers blocks 64-95 (X) and 96-127 (Z)
      // That's chunks 4-5 (X) and 6-7 (Z)
      const range6 = getTileChunkRange(6, 2, 3);
      expect(range6.minX).to.equal(4);
      expect(range6.maxX).to.equal(5);
      expect(range6.minZ).to.equal(6);
      expect(range6.maxZ).to.equal(7);
    });

    it("should check if chunk falls within tile range", function () {
      // Helper to test chunk containment
      function chunkInTile(chunkX: number, chunkZ: number, zoom: number, tileX: number, tileY: number): boolean {
        const range = getTileChunkRange(zoom, tileX, tileY);
        return chunkX >= range.minX && chunkX <= range.maxX && chunkZ >= range.minZ && chunkZ <= range.maxZ;
      }

      // Chunk (5, 10) should be in tile (5, 10) at zoom 7
      expect(chunkInTile(5, 10, 7, 5, 10)).to.be.true;

      // Chunk (5, 10) should NOT be in tile (4, 10) at zoom 7
      expect(chunkInTile(5, 10, 7, 4, 10)).to.be.false;

      // Chunk (5, 10) should be in tile (0, 0) at zoom 3 (covers chunks 0-15)
      expect(chunkInTile(5, 10, 3, 0, 0)).to.be.true;

      // Chunk (20, 10) should NOT be in tile (0, 0) at zoom 3
      expect(chunkInTile(20, 10, 3, 0, 0)).to.be.false;
    });
  });

  describe("Chunk update batching logic", function () {
    it("should deduplicate chunk coordinates", function () {
      // Simulate multiple keys for the same chunk
      const seenChunks = new Set<string>();
      const affectedChunks: Array<{ x: number; z: number; dimension: number }> = [];

      // Add chunk (5, 10, 0) multiple times
      const coords = [
        { x: 5, z: 10, dim: 0 },
        { x: 5, z: 10, dim: 0 }, // duplicate
        { x: 6, z: 10, dim: 0 },
        { x: 5, z: 10, dim: 0 }, // duplicate
        { x: 5, z: 11, dim: 0 },
      ];

      for (const coord of coords) {
        const chunkKey = `${coord.dim}_${coord.x}_${coord.z}`;
        if (!seenChunks.has(chunkKey)) {
          seenChunks.add(chunkKey);
          affectedChunks.push({ x: coord.x, z: coord.z, dimension: coord.dim });
        }
      }

      expect(affectedChunks.length).to.equal(3);
      expect(affectedChunks[0]).to.deep.equal({ x: 5, z: 10, dimension: 0 });
      expect(affectedChunks[1]).to.deep.equal({ x: 6, z: 10, dimension: 0 });
      expect(affectedChunks[2]).to.deep.equal({ x: 5, z: 11, dimension: 0 });
    });

    it("should handle chunks across dimensions", function () {
      const seenChunks = new Set<string>();
      const affectedChunks: Array<{ x: number; z: number; dimension: number }> = [];

      // Same X/Z but different dimensions should be separate chunks
      const coords = [
        { x: 0, z: 0, dim: 0 }, // Overworld
        { x: 0, z: 0, dim: 1 }, // Nether
        { x: 0, z: 0, dim: 2 }, // End
      ];

      for (const coord of coords) {
        const chunkKey = `${coord.dim}_${coord.x}_${coord.z}`;
        if (!seenChunks.has(chunkKey)) {
          seenChunks.add(chunkKey);
          affectedChunks.push({ x: coord.x, z: coord.z, dimension: coord.dim });
        }
      }

      expect(affectedChunks.length).to.equal(3);
    });

    it("should batch invalidation threshold decision", function () {
      // Test the threshold logic for batched vs full invalidation
      const BATCH_THRESHOLD = 50;

      function shouldFullInvalidate(chunkCount: number): boolean {
        return chunkCount > BATCH_THRESHOLD;
      }

      expect(shouldFullInvalidate(10)).to.be.false;
      expect(shouldFullInvalidate(50)).to.be.false;
      expect(shouldFullInvalidate(51)).to.be.true;
      expect(shouldFullInvalidate(1000)).to.be.true;
    });
  });

  describe("Path filtering for LevelDB files", function () {
    function isLevelDbFile(path: string): boolean {
      const pathLower = path.toLowerCase();
      return pathLower.includes("/db/") && (pathLower.endsWith(".ldb") || pathLower.endsWith(".log"));
    }

    it("should identify LDB files in db folder", function () {
      expect(isLevelDbFile("/db/000123.ldb")).to.be.true;
      expect(isLevelDbFile("/world/db/000456.ldb")).to.be.true;
      expect(isLevelDbFile("/some/path/db/CURRENT.log")).to.be.true;
    });

    it("should reject non-LDB files", function () {
      expect(isLevelDbFile("/db/MANIFEST-000001")).to.be.false;
      expect(isLevelDbFile("/db/CURRENT")).to.be.false;
      expect(isLevelDbFile("/db/LOCK")).to.be.false;
      expect(isLevelDbFile("/level.dat")).to.be.false;
    });

    it("should reject LDB files outside db folder", function () {
      expect(isLevelDbFile("/000123.ldb")).to.be.false;
      expect(isLevelDbFile("/backup/000123.ldb")).to.be.false;
    });

    it("should handle case insensitivity", function () {
      expect(isLevelDbFile("/DB/000123.LDB")).to.be.true;
      expect(isLevelDbFile("/Db/000123.Ldb")).to.be.true;
    });
  });

  describe("Named key filtering", function () {
    const namedKeyPrefixes = [
      "AutonomousEntities",
      "schedulerWT",
      "Overworld",
      "BiomeData",
      "digp",
      "actorprefix",
      "player",
      "portals",
    ];

    function isNamedKey(keyname: string): boolean {
      for (const prefix of namedKeyPrefixes) {
        if (keyname.startsWith(prefix)) {
          return true;
        }
      }
      return false;
    }

    it("should identify named keys to skip", function () {
      expect(isNamedKey("AutonomousEntities")).to.be.true;
      expect(isNamedKey("schedulerWT")).to.be.true;
      expect(isNamedKey("Overworld")).to.be.true;
      expect(isNamedKey("BiomeData")).to.be.true;
      expect(isNamedKey("digp")).to.be.true;
      expect(isNamedKey("actorprefix")).to.be.true;
      expect(isNamedKey("player_server_123")).to.be.true;
      expect(isNamedKey("portals")).to.be.true;
    });

    it("should allow chunk data keys", function () {
      // 9-byte keys starting with binary data should pass
      const chunkKey = String.fromCharCode(5, 0, 0, 0, 10, 0, 0, 0, 47);
      expect(isNamedKey(chunkKey)).to.be.false;
    });
  });
});
