// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * MCP Client Integration Tests
 *
 * These tests validate the MCP model design fixtures and schema compliance. They also start the
 * built CLI's MCP server (`mct mcp`, from toolbuild/jsn/cli/index.mjs) as a subprocess and talk to
 * it over stdio, to check that stdout carries only protocol messages. Run `npm run jsncorebuild`
 * first. Tool-level protocol tests are in src/test-extra/McpServerIntegrationTest.ts.
 */

import { expect } from "chai";
import "mocha";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { JSONRPCMessageSchema, LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { McpTestFixtures } from "./McpToolsTest";
import ModelDesignUtilities from "../minecraft/ModelDesignUtilities";
import MinecraftMcpServer from "../local/MinecraftMcpServer";
import { applyTestDataDir } from "./TestDataDir";

// The MCP servers these tests start keep their saved state in a temporary folder, not the real profile.
applyTestDataDir();

const CLI_PATH = path.resolve("toolbuild/jsn/cli/index.mjs");

/** What an MCP server process wrote, collected exactly as written. */
interface IStdioOutput {
  stdout: string;
  stderr: string;
}

/** The complete stdout lines that parse as JSON. The stdout purity test reports any others. */
function jsonLines(stdout: string): any[] {
  const messages: any[] = [];

  for (const line of stdout.split("\n").slice(0, -1)) {
    try {
      messages.push(JSON.parse(line));
    } catch {
      // Not JSON.
    }
  }

  return messages;
}

/** Resolves true if `promise` settles within `ms` milliseconds, or false otherwise. */
async function settlesWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<boolean>((resolve) => (timer = setTimeout(() => resolve(false), ms)));

  try {
    return await Promise.race([promise.then(() => true), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Starts `mct <args>` in `cwd`, runs the MCP initialize exchange and a ping over stdio, and then
 * stops the server. SIGTERM comes first, so the server's shutdown logging runs too.
 */
async function runInitializeExchange(args: string[], cwd: string): Promise<IStdioOutput> {
  const proc = spawn(process.execPath, [CLI_PATH, ...args], { cwd });
  const output: IStdioOutput = { stdout: "", stderr: "" };
  const closed = new Promise<void>((resolve) => proc.on("close", () => resolve()));

  proc.stdout.setEncoding("utf8");
  proc.stderr.setEncoding("utf8");
  proc.stdout.on("data", (chunk: string) => (output.stdout += chunk));
  proc.stderr.on("data", (chunk: string) => (output.stderr += chunk));
  // If the server exits early, writes to it fail with EPIPE; waitForResponse reports that instead.
  proc.stdin.on("error", () => {});

  const send = (message: object) => proc.stdin.write(JSON.stringify(message) + "\n");

  const waitForResponse = async (id: number) => {
    const deadline = Date.now() + 30000;

    while (!jsonLines(output.stdout).some((message) => message.id === id)) {
      if (proc.exitCode !== null || proc.signalCode !== null || Date.now() > deadline) {
        throw new Error(`The MCP server didn't answer request ${id}. stderr:\n${output.stderr}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };

  try {
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "mct-stdio-test", version: "1.0.0" },
      },
    });
    await waitForResponse(1);

    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: 2, method: "ping" });
    await waitForResponse(2);
  } finally {
    proc.kill("SIGTERM");

    if (!(await settlesWithin(closed, 5000))) {
      proc.stdin.end();

      if (!(await settlesWithin(closed, 5000))) {
        proc.kill("SIGKILL");
        await closed;
      }
    }
  }

  return output;
}

// These tests validate the MCP model design fixtures
describe("MCP Client Integration Tests", function () {
  // Increase timeout for integration tests
  this.timeout(30000);

  describe("Model Design Schema Validation", function () {
    // These tests verify that the Zod schemas correctly validate input

    it("should accept valid design with texture references", function () {
      // Test that the fixture is valid JSON that matches our schema
      const design = McpTestFixtures.CUBE_WITH_TEXTURE_REFS;

      expect(design.textures).to.not.be.undefined;
      expect(design.textures!["wood_side"]).to.have.property("background");
      expect(design.bones[0].cubes[0].faces.north).to.have.property("textureId");
    });

    it("should handle design with mixed inline and texture references", function () {
      const design = McpTestFixtures.CUBE_WITH_MIXED_TEXTURES;

      // Check mixed texture usage
      expect(design.textures).to.not.be.undefined;
      expect(design.bones[0].cubes[0].faces.north?.textureId).to.equal("wood");
      // Modern format uses background with type:solid instead of inline color
      expect(design.bones[0].cubes[0].faces.east?.background?.type).to.equal("solid");
      expect(design.bones[0].cubes[0].faces.east?.background?.colors[0]).to.equal("#FF0000");
      expect(design.bones[0].cubes[0].faces.up?.svg).to.include("<svg");
    });

    it("should serialize and deserialize design correctly", function () {
      const design = McpTestFixtures.CUBE_WITH_TEXTURE_REFS;

      // Simulate what happens when the design goes through JSON serialization
      const serialized = JSON.stringify(design);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.identifier).to.equal(design.identifier);
      expect(deserialized.textures).to.deep.equal(design.textures);
      expect(deserialized.bones[0].cubes[0].faces.north.textureId).to.equal("bark");
    });
  });

  describe("Design Fixture Validation", function () {
    // Validate all test fixtures are well-formed

    const fixtures = [
      { name: "SIMPLE_COLORED_CUBE", fixture: McpTestFixtures.SIMPLE_COLORED_CUBE },
      { name: "CUBE_WITH_TEXTURE_REFS", fixture: McpTestFixtures.CUBE_WITH_TEXTURE_REFS },
      { name: "CUBE_WITH_DEDUPLICATION", fixture: McpTestFixtures.CUBE_WITH_DEDUPLICATION },
      { name: "CUBE_WITH_MIXED_TEXTURES", fixture: McpTestFixtures.CUBE_WITH_MIXED_TEXTURES },
      { name: "MULTI_BONE_WITH_SHARED_TEXTURES", fixture: McpTestFixtures.MULTI_BONE_WITH_SHARED_TEXTURES },
      { name: "CUBE_WITH_SVG_TEXTURE", fixture: McpTestFixtures.CUBE_WITH_SVG_TEXTURE },
    ];

    for (const { name, fixture } of fixtures) {
      it(`${name} should be valid for conversion`, function () {
        // Should have required fields
        expect(fixture.identifier).to.be.a("string");
        expect(fixture.bones).to.be.an("array");
        expect(fixture.bones.length).to.be.greaterThan(0);

        // Should have at least one cube
        expect(fixture.bones[0].cubes).to.be.an("array");
        expect(fixture.bones[0].cubes.length).to.be.greaterThan(0);

        // Should have faces
        expect(fixture.bones[0].cubes[0].faces).to.be.an("object");

        // Should convert without throwing
        const result = ModelDesignUtilities.convertToGeometry(fixture);
        expect(result.geometry).to.not.be.undefined;
      });
    }
  });

  describe("Error Fixture Validation", function () {
    // Validate that error fixtures produce expected errors

    it("CUBE_WITH_INVALID_REF should produce validation errors", function () {
      const errors = ModelDesignUtilities.validateDesign(McpTestFixtures.CUBE_WITH_INVALID_REF);
      expect(errors.length).to.be.greaterThan(0);
    });

    it("CUBE_WITH_REF_NO_DICT should produce validation errors", function () {
      const errors = ModelDesignUtilities.validateDesign(McpTestFixtures.CUBE_WITH_REF_NO_DICT);
      expect(errors.length).to.be.greaterThan(0);
    });

    it("TEXTURE_WITHOUT_CONTENT should produce validation errors", function () {
      const errors = ModelDesignUtilities.validateDesign(McpTestFixtures.TEXTURE_WITHOUT_CONTENT);
      expect(errors.length).to.be.greaterThan(0);
    });
  });

  // Regression: designModel produced models with the default
  // visible_bounds_width/height of 1, which caused the renderer to cull
  // larger models (e.g. the 2.5-block-long boat) so they appeared invisible.
  // When visibleBoundsSize is omitted, bounds must be auto-computed from cube
  // extents.
  describe("auto-computed visible bounds", function () {
    it("should auto-compute bounds large enough for a 2.5-block-long boat-sized model", function () {
      const design = {
        identifier: "boat_like",
        textureSize: [64, 64] as [number, number],
        pixelsPerUnit: 2,
        textures: {
          hull: { background: { type: "solid", colors: ["#1E90FF"] } },
        },
        bones: [
          {
            name: "hull",
            pivot: [0, 0, 0] as [number, number, number],
            cubes: [
              {
                // 20 wide × 6 tall × 40 long = 1.25 × 0.375 × 2.5 blocks
                origin: [-10, 0, -20] as [number, number, number],
                size: [20, 6, 40] as [number, number, number],
                faces: { up: { textureId: "hull" } },
              },
            ],
          },
        ],
      } as any;

      const result = ModelDesignUtilities.convertToGeometry(design);
      const desc = result.geometry["minecraft:geometry"][0].description;
      expect(desc.visible_bounds_width, "width must cover the longest horizontal extent").to.be.at.least(3);
      expect(desc.visible_bounds_height).to.be.at.least(1);
    });

    it("should respect explicit visibleBoundsSize when provided", function () {
      const design = {
        identifier: "explicit_bounds",
        textureSize: [16, 16] as [number, number],
        pixelsPerUnit: 1,
        textures: { t: { background: { type: "solid", colors: ["#ffffff"] } } },
        bones: [
          {
            name: "b",
            pivot: [0, 0, 0] as [number, number, number],
            cubes: [
              {
                origin: [-100, 0, -100] as [number, number, number],
                size: [200, 200, 200] as [number, number, number],
                faces: { up: { textureId: "t" } },
              },
            ],
          },
        ],
        visibleBoundsSize: [7, 4, 7] as [number, number, number],
      } as any;

      const result = ModelDesignUtilities.convertToGeometry(design);
      const desc = result.geometry["minecraft:geometry"][0].description;
      expect(desc.visible_bounds_width).to.equal(7);
      expect(desc.visible_bounds_height).to.equal(4);
    });
  });

  // Regression: `designModel` was always nesting a new
  // `resource_packs/<auto>/` inside whatever projectPath the caller supplied,
  // so passing a path that already IS a resource pack produced files at
  // `…/<rp>/resource_packs/contoso_*/models/…` and the entity rendered as a
  // generic cube.
  describe("_isResourcePackFolder detection", function () {
    let tmpRoot: string;

    beforeEach(function () {
      tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mct-rpdetect-"));
    });

    afterEach(function () {
      try {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    });

    it("returns true for a folder containing a manifest.json with a resources module", function () {
      fs.writeFileSync(
        path.join(tmpRoot, "manifest.json"),
        JSON.stringify({
          format_version: 2,
          header: { name: "rp", uuid: "00000000-0000-0000-0000-000000000001", version: [1, 0, 0] },
          modules: [{ type: "resources", uuid: "00000000-0000-0000-0000-000000000002", version: [1, 0, 0] }],
        })
      );
      expect((MinecraftMcpServer as any)._isResourcePackFolder(tmpRoot)).to.equal(true);
    });

    it("returns false for a folder containing a behavior-pack manifest", function () {
      fs.writeFileSync(
        path.join(tmpRoot, "manifest.json"),
        JSON.stringify({
          format_version: 2,
          header: { name: "bp", uuid: "00000000-0000-0000-0000-000000000003", version: [1, 0, 0] },
          modules: [{ type: "data", uuid: "00000000-0000-0000-0000-000000000004", version: [1, 0, 0] }],
        })
      );
      expect((MinecraftMcpServer as any)._isResourcePackFolder(tmpRoot)).to.equal(false);
    });

    it("returns false for a folder with no manifest.json", function () {
      expect((MinecraftMcpServer as any)._isResourcePackFolder(tmpRoot)).to.equal(false);
    });

    it("returns false for a folder with malformed manifest.json", function () {
      fs.writeFileSync(path.join(tmpRoot, "manifest.json"), "{ not valid json");
      expect((MinecraftMcpServer as any)._isResourcePackFolder(tmpRoot)).to.equal(false);
    });
  });

  // `mct mcp` speaks MCP over stdio, so stdout must hold only JSON-RPC messages, from the first
  // byte to the last. The CLI's debug and verbose messages, at startup and at shutdown, go to stderr.
  describe("stdio server stdout", function () {
    this.timeout(60000);

    const launches = [
      { name: "mct --debug mcp", args: ["--debug", "mcp"] },
      { name: "mct --debug --verbose mcp", args: ["--debug", "--verbose", "mcp"] },
    ];

    for (const launch of launches) {
      describe(launch.name, function () {
        let tmpRoot: string;
        let output: IStdioOutput;

        before(async function () {
          // Start in a subfolder of a project, so --verbose also logs the project root it finds.
          tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mct-mcp-stdio-"));
          fs.writeFileSync(path.join(tmpRoot, "package.json"), "{}");
          fs.mkdirSync(path.join(tmpRoot, "subfolder"));

          output = await runInitializeExchange(launch.args, path.join(tmpRoot, "subfolder"));
        });

        after(function () {
          try {
            fs.rmSync(tmpRoot, { recursive: true, force: true });
          } catch {
            /* best-effort */
          }
        });

        it("should answer initialize", function () {
          const response = jsonLines(output.stdout).find((message) => message.id === 1);
          expect(response?.result?.serverInfo?.name, "the initialize result should name the server").to.be.a("string");
        });

        it("should write only JSON-RPC messages to stdout", function () {
          const lines = output.stdout.split("\n");
          expect(lines.pop(), "stdout should end with a complete line").to.equal("");
          expect(lines.length, "stdout should hold at least the two responses").to.be.at.least(2);

          for (const line of lines) {
            let message: unknown;

            try {
              message = JSON.parse(line);
            } catch {
              expect.fail(`stdout line isn't JSON: ${line.slice(0, 200)}`);
            }

            expect(
              JSONRPCMessageSchema.safeParse(message).success,
              `stdout line isn't a JSON-RPC message: ${line.slice(0, 200)}`
            ).to.equal(true);
          }
        });
      });
    }
  });
});
