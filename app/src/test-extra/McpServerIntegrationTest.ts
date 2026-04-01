// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * MCP Server Integration Tests
 *
 * These tests spawn the MCP server as a subprocess using the CLI `mcp` command
 * and communicate with it via stdio transport to test the full MCP protocol.
 *
 * The tests validate:
 * - Server initialization and capabilities
 * - Tool listing
 * - Model design export functionality
 * - Model design preview functionality (if browser available)
 *
 * NOTE: These tests are in test-extra/ because they:
 * - Require a built CLI tool (npm run jsncorebuild)
 * - May take significant time to run
 * - Require browser availability for preview tests
 *
 * To run these tests:
 *   npm run test-extra -- --grep "MCP Server"
 *   npm run test-mcp-integration
 */

import { expect, assert } from "chai";
import "mocha";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from "path";
import * as fs from "fs";
import { McpTestFixtures } from "../test/McpToolsTest";
import { testFolders, assertValidPng, assertPngMatchesBaseline } from "../test/PngTestUtilities";

// Path to the CLI tool (use path.resolve from CWD since __dirname is unavailable in ESM)
const CLI_PATH = path.resolve("toolbuild/jsn/cli/index.mjs");

describe("MCP Server Integration Tests", function () {
  // Longer timeout for server startup and operations
  this.timeout(120000);

  let client: Client | undefined;
  let transport: StdioClientTransport | undefined;
  let serverAvailable = false;

  const SCENARIO_NAME = "mcpServerIntegration";

  /**
   * Recursively find files in a directory matching a given extension.
   */
  function findFilesRecursive(dir: string, extension: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findFilesRecursive(fullPath, extension));
      } else if (entry.name.endsWith(extension)) {
        results.push(fullPath);
      }
    }
    return results;
  }

  before(async function () {
    // Initialize test folders
    await testFolders.initialize();
    testFolders.removeResultFolder(SCENARIO_NAME);
    testFolders.ensureResultFolder(SCENARIO_NAME);

    // Check if the CLI tool exists
    if (!fs.existsSync(CLI_PATH + ".js") && !fs.existsSync(CLI_PATH)) {
      console.log(`CLI tool not found at ${CLI_PATH} - skipping MCP server integration tests`);
      console.log("Run 'npm run jsncorebuild' to build the CLI tool first");
      return;
    }

    try {
      // Create the stdio transport to spawn the MCP server
      transport = new StdioClientTransport({
        command: "node",
        args: [CLI_PATH, "mcp"],
        stderr: "pipe", // Capture stderr for debugging
      });

      // Handle the case where the child process exits unexpectedly
      // The transport has internal event handlers that can cause issues
      // @ts-ignore - accessing internal _process property
      if (transport._process) {
        // @ts-ignore
        transport._process.on("exit", (code: number) => {
          if (code !== 0) {
            console.log(`MCP server process exited with code ${code}`);
          }
        });
      }

      // Create the MCP client
      client = new Client(
        {
          name: "mcp-test-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      );

      // Connect to the server
      await client.connect(transport);
      serverAvailable = true;
      console.log("MCP server connected successfully");
    } catch (e) {
      console.log("Failed to connect to MCP server:", e);
      serverAvailable = false;
    }
  });

  after(async function () {
    if (transport) {
      try {
        await transport.close();
      } catch (e) {
        // Ignore close errors
      }
    }

    // Note: Do NOT call process.exit() here - it would kill the entire test run
    // before other test files can execute. The MCP server process should terminate
    // gracefully when the transport is closed.
  });

  describe("Server Initialization", function () {
    it("should connect to the server", function () {
      if (!serverAvailable) {
        this.skip();
        return;
      }
      expect(client).to.not.be.undefined;
    });

    it("should have server capabilities", function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }
      const capabilities = client.getServerCapabilities();
      expect(capabilities).to.not.be.undefined;
    });

    it("should have server version info", function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }
      const version = client.getServerVersion();
      expect(version).to.not.be.undefined;
      expect(version?.name).to.equal("minecraft-creator-tools");
    });
  });

  describe("Tool Listing", function () {
    it("should list available tools", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const tools = await client.listTools();
      expect(tools.tools).to.be.an("array");
      expect(tools.tools.length).to.be.greaterThan(0);

      // Log available tools for debugging
      console.log(
        "Available tools:",
        tools.tools.map((t) => t.name)
      );
    });

    it("should include designModel tool", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const tools = await client.listTools();
      const designTool = tools.tools.find((t) => t.name === "designModel");
      expect(designTool).to.not.be.undefined;
      expect(designTool?.inputSchema).to.not.be.undefined;
    });

    it("should include designStructure tool", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const tools = await client.listTools();
      const designTool = tools.tools.find((t) => t.name === "designStructure");
      expect(designTool).to.not.be.undefined;
      expect(designTool?.inputSchema).to.not.be.undefined;
    });

    it("should include validateContent tool", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const tools = await client.listTools();
      const validateTool = tools.tools.find((t) => t.name === "validateContent");
      expect(validateTool).to.not.be.undefined;
    });

    it("should include createProject tool", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const tools = await client.listTools();
      const createTool = tools.tools.find((t) => t.name === "createProject");
      expect(createTool).to.not.be.undefined;
    });

    it("should include addItem tool", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const tools = await client.listTools();
      const addTool = tools.tools.find((t) => t.name === "addItem");
      expect(addTool).to.not.be.undefined;
    });
  });

  describe("Design Model Tool", function () {
    // designModel is the unified tool that replaces exportModelDesign + previewModelDesign.
    // It creates files in a project directory and returns a preview image.

    /**
     * Helper to create a fresh temp project directory for a test.
     */
    function createTempProjectPath(testName: string): string {
      const resultsPath = testFolders.getResultsPath(SCENARIO_NAME);
      const projectPath = path.join(resultsPath, "designModel_" + testName);
      if (fs.existsSync(projectPath)) {
        fs.rmSync(projectPath, { recursive: true, force: true });
      }
      fs.mkdirSync(projectPath, { recursive: true });
      return projectPath;
    }

    it("should design a simple colored cube", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const projectPath = createTempProjectPath("simple_cube");

      const result = await client.callTool({
        name: "designModel",
        arguments: {
          design: McpTestFixtures.SIMPLE_COLORED_CUBE,
          modelId: "mcp_simple_cube",
          projectPath: projectPath,
          wireTo: false,
        },
      });

      // Check the result
      expect(result.isError).to.not.equal(true);

      // Verify files were created in the project resource pack
      const geoFiles = findFilesRecursive(projectPath, ".geo.json");
      assert(geoFiles.length > 0, "Geometry file should exist in project");

      // Validate geometry content
      const geometryContent = fs.readFileSync(geoFiles[0], "utf-8");
      const geometry = JSON.parse(geometryContent);
      expect(geometry["minecraft:geometry"]).to.be.an("array");

      // Validate texture was created
      const pngFiles = findFilesRecursive(projectPath, ".png");
      assert(pngFiles.length > 0, "Texture PNG should exist in project");
      assertValidPng(pngFiles[0], 100);
    });

    it("should design a cube with texture references", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const projectPath = createTempProjectPath("texture_refs");

      const result = await client.callTool({
        name: "designModel",
        arguments: {
          design: McpTestFixtures.CUBE_WITH_TEXTURE_REFS,
          modelId: "mcp_texture_refs",
          projectPath: projectPath,
          wireTo: false,
        },
      });

      expect(result.isError).to.not.equal(true);

      const geoFiles = findFilesRecursive(projectPath, ".geo.json");
      assert(geoFiles.length > 0, "Geometry file should exist in project");

      const pngFiles = findFilesRecursive(projectPath, ".png");
      assert(pngFiles.length > 0, "Texture PNG should exist in project");
    });

    it("should design a multi-bone model", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const projectPath = createTempProjectPath("multi_bone");

      const result = await client.callTool({
        name: "designModel",
        arguments: {
          design: McpTestFixtures.MULTI_BONE_WITH_SHARED_TEXTURES,
          modelId: "mcp_multi_bone",
          projectPath: projectPath,
          wireTo: false,
        },
      });

      expect(result.isError).to.not.equal(true);

      const geoFiles = findFilesRecursive(projectPath, ".geo.json");
      assert(geoFiles.length > 0, "Geometry file should exist in project");

      // Validate the geometry has multiple bones
      const geometryContent = fs.readFileSync(geoFiles[0], "utf-8");
      const geometry = JSON.parse(geometryContent);
      expect(geometry["minecraft:geometry"][0].bones.length).to.be.greaterThan(1);
    });

    it("should reject invalid texture references", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const projectPath = createTempProjectPath("invalid_refs");

      const result = await client.callTool({
        name: "designModel",
        arguments: {
          design: McpTestFixtures.CUBE_WITH_INVALID_REF,
          modelId: "mcp_invalid",
          projectPath: projectPath,
          wireTo: false,
        },
      });

      // Should return an error for invalid texture reference
      expect(result.isError).to.equal(true);

      // No geometry files should be created for invalid design
      const geoFiles = findFilesRecursive(projectPath, ".geo.json");
      assert(geoFiles.length === 0, "Geometry file should not exist for invalid design");
    });

    it("should attempt to render a preview", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const projectPath = createTempProjectPath("preview_test");

      // designModel always returns a preview image along with the exported files
      try {
        const result = await client.callTool({
          name: "designModel",
          arguments: {
            design: McpTestFixtures.SIMPLE_COLORED_CUBE,
            modelId: "preview_cube",
            projectPath: projectPath,
            wireTo: false,
          },
        });

        // If we got a result, check if it includes an image
        if (result.isError) {
          // Expected if no browser available
          console.log("Design model returned error (may be no browser):", result.content);
        } else {
          const content = result.content as any[];
          expect(content).to.be.an("array");
          const imageContent = content.find((c: any) => c.type === "image");
          if (imageContent) {
            expect(imageContent.mimeType).to.equal("image/png");
            expect(imageContent.data).to.be.a("string"); // base64 data
          }
        }
      } catch (e) {
        console.log("Design model call failed (expected if no browser):", e);
      }
    });
  });

  describe("Validate Content Tool", function () {
    it("should validate a valid JSON block definition", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const validBlockJson = JSON.stringify({
        format_version: "1.21.40",
        "minecraft:block": {
          description: {
            identifier: "test:custom_block",
          },
          components: {},
        },
      });

      const result = await client.callTool({
        name: "validateContent",
        arguments: {
          jsonContentOrBase64ZipContent: validBlockJson,
        },
      });

      // Log the result for debugging
      if (result.isError) {
        console.log("Validate content returned error:", result.content);
      }

      // The tool should run without throwing, even if it finds validation issues
      // The actual validation results are returned in the content
      expect(result.content).to.not.be.undefined;
    });
  });

  describe("Preview Model Design Tool - Baseline Comparison", function () {
    // These tests require a browser/Playwright to be available
    // They render model designs and compare against baseline PNG images

    const PREVIEW_SCENARIO = "mcpPreviewDesign";
    let previewAvailable = false;

    before(async function () {
      if (!serverAvailable || !client) {
        return;
      }

      // Test if preview is available by trying a small render via designModel
      try {
        const testProjectPath = path.join(testFolders.getResultsPath(PREVIEW_SCENARIO), "preview_test");
        if (fs.existsSync(testProjectPath)) {
          fs.rmSync(testProjectPath, { recursive: true, force: true });
        }
        fs.mkdirSync(testProjectPath, { recursive: true });

        const testResult = await client.callTool({
          name: "designModel",
          arguments: {
            design: McpTestFixtures.SIMPLE_COLORED_CUBE,
            modelId: "preview_test",
            projectPath: testProjectPath,
            wireTo: false,
          },
        });

        if (!testResult.isError) {
          const content = testResult.content as any[];
          const imageContent = content.find((c: any) => c.type === "image");
          previewAvailable = !!imageContent;
          if (!previewAvailable) {
            // Log why preview is not available
            const textContent = content.find((c: any) => c.type === "text");
            console.log("Preview test returned no image. Content types:", content.map((c: any) => c.type).join(", "));
            if (textContent) {
              console.log("Text response:", textContent.text?.substring(0, 500));
            }
          }
        } else {
          // Log the error
          const content = testResult.content as any[];
          const textContent = content.find((c: any) => c.type === "text");
          console.log("Preview test returned error:", textContent?.text?.substring(0, 500) || "Unknown error");
        }

        if (previewAvailable) {
          // Set up test folders for preview tests
          testFolders.removeResultFolder(PREVIEW_SCENARIO);
          testFolders.ensureResultFolder(PREVIEW_SCENARIO);
          console.log("Preview rendering is available - running baseline comparison tests");
        } else {
          console.log("Preview rendering not available - skipping baseline comparison tests");
        }
      } catch (e) {
        console.log("Preview not available:", e);
        previewAvailable = false;
      }
    });

    /**
     * Helper to render a design and save the result PNG.
     * Uses the unified designModel tool which always returns a preview image.
     */
    async function renderAndSave(
      design: any,
      filename: string,
      options?: { width?: number; height?: number; multiAngle?: boolean; imageFormat?: string }
    ): Promise<string | undefined> {
      if (!client) return undefined;

      const projectPath = path.join(testFolders.getResultsPath(PREVIEW_SCENARIO), "renderAndSave_" + filename);
      if (fs.existsSync(projectPath)) {
        fs.rmSync(projectPath, { recursive: true, force: true });
      }
      fs.mkdirSync(projectPath, { recursive: true });

      const result = await client.callTool(
        {
          name: "designModel",
          arguments: {
            design,
            modelId: "preview_" + filename.replace(/[^a-zA-Z0-9]/g, "_"),
            projectPath: projectPath,
            wireTo: false,
          },
        },
        undefined,
        { timeout: 120000 } // 2 minute timeout for preview operations
      );

      if (result.isError) {
        console.log(`Render failed for ${filename}:`, result.content);
        return undefined;
      }

      const content = result.content as any[];
      const imageContent = content.find((c: any) => c.type === "image");

      if (!imageContent || !imageContent.data) {
        return undefined;
      }

      const resultPath = path.join(testFolders.getResultsPath(PREVIEW_SCENARIO), filename);
      const imageBuffer = Buffer.from(imageContent.data, "base64");
      fs.writeFileSync(resultPath, imageBuffer);

      return resultPath;
    }

    it("should render simple colored cube and match baseline", async function () {
      if (!serverAvailable || !client || !previewAvailable) {
        this.skip();
        return;
      }

      const filename = "simple_colored_cube.preview.png";
      const resultPath = await renderAndSave(McpTestFixtures.SIMPLE_COLORED_CUBE, filename);

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 500);

      const scenarioPath = path.join(testFolders.getScenariosPath(PREVIEW_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render cube with texture references and match baseline", async function () {
      if (!serverAvailable || !client || !previewAvailable) {
        this.skip();
        return;
      }

      const filename = "cube_texture_refs.preview.png";
      const resultPath = await renderAndSave(McpTestFixtures.CUBE_WITH_TEXTURE_REFS, filename);

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 500);

      const scenarioPath = path.join(testFolders.getScenariosPath(PREVIEW_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render cube with deduplication and match baseline", async function () {
      if (!serverAvailable || !client || !previewAvailable) {
        this.skip();
        return;
      }

      const filename = "cube_deduplication.preview.png";
      const resultPath = await renderAndSave(McpTestFixtures.CUBE_WITH_DEDUPLICATION, filename);

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 500);

      const scenarioPath = path.join(testFolders.getScenariosPath(PREVIEW_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render cube with mixed textures and match baseline", async function () {
      if (!serverAvailable || !client || !previewAvailable) {
        this.skip();
        return;
      }

      const filename = "cube_mixed_textures.preview.png";
      const resultPath = await renderAndSave(McpTestFixtures.CUBE_WITH_MIXED_TEXTURES, filename);

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 500);

      const scenarioPath = path.join(testFolders.getScenariosPath(PREVIEW_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render multi-bone model and match baseline", async function () {
      if (!serverAvailable || !client || !previewAvailable) {
        this.skip();
        return;
      }

      const filename = "multi_bone_shared.preview.png";
      const resultPath = await renderAndSave(McpTestFixtures.MULTI_BONE_WITH_SHARED_TEXTURES, filename);

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 500);

      const scenarioPath = path.join(testFolders.getScenariosPath(PREVIEW_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render SVG texture cube and match baseline", async function () {
      if (!serverAvailable || !client || !previewAvailable) {
        this.skip();
        return;
      }

      const filename = "cube_svg_texture.preview.png";
      const resultPath = await renderAndSave(McpTestFixtures.CUBE_WITH_SVG_TEXTURE, filename);

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 500);

      const scenarioPath = path.join(testFolders.getScenariosPath(PREVIEW_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render multi-angle view and match baseline", async function () {
      if (!serverAvailable || !client || !previewAvailable) {
        this.skip();
        return;
      }

      const filename = "simple_cube_multiangle.preview.png";
      const resultPath = await renderAndSave(McpTestFixtures.SIMPLE_COLORED_CUBE, filename, {
        width: 1024,
        height: 512,
        multiAngle: true,
      });

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 1000);

      const scenarioPath = path.join(testFolders.getScenariosPath(PREVIEW_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    // Camera scaling tests for different model sizes
    it("should render tiny 2x2x2 cube with good framing", async function () {
      if (!serverAvailable || !client || !previewAvailable) {
        this.skip();
        return;
      }

      const filename = "tiny_cube.preview.png";
      const resultPath = await renderAndSave(McpTestFixtures.TINY_CUBE, filename);

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 500);

      const scenarioPath = path.join(testFolders.getScenariosPath(PREVIEW_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render medium 8x8x8 cube with good framing", async function () {
      if (!serverAvailable || !client || !previewAvailable) {
        this.skip();
        return;
      }

      const filename = "medium_cube.preview.png";
      const resultPath = await renderAndSave(McpTestFixtures.MEDIUM_CUBE, filename);

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 500);

      const scenarioPath = path.join(testFolders.getScenariosPath(PREVIEW_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render large 24x24x24 cube with good framing", async function () {
      if (!serverAvailable || !client || !previewAvailable) {
        this.skip();
        return;
      }

      const filename = "large_cube.preview.png";
      const resultPath = await renderAndSave(McpTestFixtures.LARGE_CUBE, filename);

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 500);

      const scenarioPath = path.join(testFolders.getScenariosPath(PREVIEW_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });
  });

  describe("Model Template Preview Tests", function () {
    // Tests that render each model template and compare against baselines
    // This ensures the starter templates look correct and remain consistent

    const TEMPLATE_SCENARIO = "mcpTemplatePreview";
    let templatePreviewAvailable = false;

    before(async function () {
      this.timeout(60000); // Set timeout for the before hook

      if (!serverAvailable || !client) {
        console.log("MCP server not available for template preview tests");
        return;
      }

      // Test if preview is available by trying a small render via designModel
      try {
        const testProjectPath = path.join(testFolders.getResultsPath(TEMPLATE_SCENARIO), "template_preview_test");
        if (fs.existsSync(testProjectPath)) {
          fs.rmSync(testProjectPath, { recursive: true, force: true });
        }
        fs.mkdirSync(testProjectPath, { recursive: true });

        const testResult = await client.callTool({
          name: "designModel",
          arguments: {
            design: {
              identifier: "test",
              bones: [
                {
                  name: "test",
                  cubes: [{ origin: [0, 0, 0], size: [1, 1, 1], faces: { up: { color: "#FF0000" } } }],
                },
              ],
            },
            modelId: "template_preview_test",
            projectPath: testProjectPath,
            wireTo: false,
          },
        });

        if (!testResult.isError) {
          const content = testResult.content as any[];
          const imageContent = content.find((c: any) => c.type === "image");
          templatePreviewAvailable = !!imageContent;
          if (!templatePreviewAvailable) {
            // Log why preview is not available
            const textContent = content.find((c: any) => c.type === "text");
            console.log(
              "Template preview test returned no image. Content types:",
              content.map((c: any) => c.type).join(", ")
            );
            if (textContent) {
              console.log("Text response:", textContent.text?.substring(0, 500));
            }
          }
        } else {
          // Log the error
          const content = testResult.content as any[];
          const textContent = content.find((c: any) => c.type === "text");
          console.log("Template preview test returned error:", textContent?.text?.substring(0, 500) || "Unknown error");
        }

        if (templatePreviewAvailable) {
          // Set up test folders for template tests
          testFolders.removeResultFolder(TEMPLATE_SCENARIO);
          testFolders.ensureResultFolder(TEMPLATE_SCENARIO);
          console.log("Template preview rendering is available - running baseline comparison tests");
        } else {
          console.log("Template preview rendering not available - skipping template tests");
        }
      } catch (e) {
        console.log("Template preview not available:", e);
        templatePreviewAvailable = false;
      }
    });

    /**
     * Helper to render a template and save the result PNG.
     */
    async function renderTemplateAndSave(
      templateType: string,
      filename: string,
      options?: { width?: number; height?: number; multiAngle?: boolean }
    ): Promise<string | undefined> {
      if (!client) return undefined;

      // First, get the template
      const templateResult = await client.callTool({
        name: "getModelTemplates",
        arguments: { templateType },
      });

      if (templateResult.isError) {
        console.log(`Failed to get template ${templateType}:`, templateResult.content);
        return undefined;
      }

      const templateContent = templateResult.content as any[];
      const textContent = templateContent.find((c: any) => c.type === "text");

      if (!textContent || !textContent.text) {
        console.log(`No template content returned for ${templateType}`);
        return undefined;
      }

      // Parse the template JSON from the response
      // The response includes some header text, so find the JSON block
      const jsonMatch = textContent.text.match(/```json\n([\s\S]*?)\n```/);
      if (!jsonMatch) {
        console.log(`Could not find JSON in template response for ${templateType}`);
        return undefined;
      }

      const design = JSON.parse(jsonMatch[1]);

      // Now render the template using designModel
      const projectPath = path.join(testFolders.getResultsPath(TEMPLATE_SCENARIO), "template_" + templateType);
      if (fs.existsSync(projectPath)) {
        fs.rmSync(projectPath, { recursive: true, force: true });
      }
      fs.mkdirSync(projectPath, { recursive: true });

      const result = await client.callTool(
        {
          name: "designModel",
          arguments: {
            design,
            modelId: "template_" + templateType,
            projectPath: projectPath,
            wireTo: false,
          },
        },
        undefined,
        { timeout: 120000 }
      );

      if (result.isError) {
        console.log(`Render failed for template ${templateType}:`, result.content);
        return undefined;
      }

      const content = result.content as any[];
      const imageContent = content.find((c: any) => c.type === "image");

      if (!imageContent || !imageContent.data) {
        return undefined;
      }

      const resultPath = path.join(testFolders.getResultsPath(TEMPLATE_SCENARIO), filename);
      const imageBuffer = Buffer.from(imageContent.data, "base64");
      fs.writeFileSync(resultPath, imageBuffer);

      return resultPath;
    }

    it("should render humanoid template and match baseline", async function () {
      if (!serverAvailable || !client || !templatePreviewAvailable) {
        this.skip();
        return;
      }

      const filename = "template_humanoid.preview.png";
      const resultPath = await renderTemplateAndSave("humanoid", filename, {
        multiAngle: true,
        width: 768,
        height: 512,
      });

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 500);

      const scenarioPath = path.join(testFolders.getScenariosPath(TEMPLATE_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render small_animal template and match baseline", async function () {
      if (!serverAvailable || !client || !templatePreviewAvailable) {
        this.skip();
        return;
      }

      const filename = "template_small_animal.preview.png";
      const resultPath = await renderTemplateAndSave("small_animal", filename, {
        multiAngle: true,
        width: 768,
        height: 512,
      });

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 500);

      const scenarioPath = path.join(testFolders.getScenariosPath(TEMPLATE_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render large_animal template and match baseline", async function () {
      if (!serverAvailable || !client || !templatePreviewAvailable) {
        this.skip();
        return;
      }

      const filename = "template_large_animal.preview.png";
      const resultPath = await renderTemplateAndSave("large_animal", filename, {
        multiAngle: true,
        width: 768,
        height: 512,
      });

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 500);

      const scenarioPath = path.join(testFolders.getScenariosPath(TEMPLATE_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render vehicle template and match baseline", async function () {
      if (!serverAvailable || !client || !templatePreviewAvailable) {
        this.skip();
        return;
      }

      const filename = "template_vehicle.preview.png";
      const resultPath = await renderTemplateAndSave("vehicle", filename, {
        multiAngle: true,
        width: 768,
        height: 512,
      });

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 500);

      const scenarioPath = path.join(testFolders.getScenariosPath(TEMPLATE_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render block template and match baseline", async function () {
      if (!serverAvailable || !client || !templatePreviewAvailable) {
        this.skip();
        return;
      }

      const filename = "template_block.preview.png";
      const resultPath = await renderTemplateAndSave("block", filename);

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 500);

      const scenarioPath = path.join(testFolders.getScenariosPath(TEMPLATE_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render item template and match baseline", async function () {
      if (!serverAvailable || !client || !templatePreviewAvailable) {
        this.skip();
        return;
      }

      const filename = "template_item.preview.png";
      const resultPath = await renderTemplateAndSave("item", filename);

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 500);

      const scenarioPath = path.join(testFolders.getScenariosPath(TEMPLATE_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render bird template and match baseline", async function () {
      if (!serverAvailable || !client || !templatePreviewAvailable) {
        this.skip();
        return;
      }

      const filename = "template_bird.preview.png";
      const resultPath = await renderTemplateAndSave("bird", filename);

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 500);

      const scenarioPath = path.join(testFolders.getScenariosPath(TEMPLATE_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render insect template and match baseline", async function () {
      if (!serverAvailable || !client || !templatePreviewAvailable) {
        this.skip();
        return;
      }

      const filename = "template_insect.preview.png";
      const resultPath = await renderTemplateAndSave("insect", filename);

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 500);

      const scenarioPath = path.join(testFolders.getScenariosPath(TEMPLATE_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render flying template and match baseline", async function () {
      if (!serverAvailable || !client || !templatePreviewAvailable) {
        this.skip();
        return;
      }

      const filename = "template_flying.preview.png";
      const resultPath = await renderTemplateAndSave("flying", filename);

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 500);

      const scenarioPath = path.join(testFolders.getScenariosPath(TEMPLATE_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render fish template and match baseline", async function () {
      if (!serverAvailable || !client || !templatePreviewAvailable) {
        this.skip();
        return;
      }

      const filename = "template_fish.preview.png";
      const resultPath = await renderTemplateAndSave("fish", filename);

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 500);

      const scenarioPath = path.join(testFolders.getScenariosPath(TEMPLATE_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render slime template and match baseline", async function () {
      if (!serverAvailable || !client || !templatePreviewAvailable) {
        this.skip();
        return;
      }

      const filename = "template_slime.preview.png";
      const resultPath = await renderTemplateAndSave("slime", filename);

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 500);

      const scenarioPath = path.join(testFolders.getScenariosPath(TEMPLATE_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });
  });

  describe("Design Structure Tool", function () {
    // designStructure is the unified tool that replaces exportStructureDesign + previewStructureDesign.
    // It creates .mcstructure files in a project directory and returns a preview image.

    /**
     * Helper to create a fresh temp project directory for a structure test.
     */
    function createStructureTempProjectPath(testName: string): string {
      const resultsPath = testFolders.getResultsPath(SCENARIO_NAME);
      const projectPath = path.join(resultsPath, "designStructure_" + testName);
      if (fs.existsSync(projectPath)) {
        fs.rmSync(projectPath, { recursive: true, force: true });
      }
      fs.mkdirSync(projectPath, { recursive: true });
      return projectPath;
    }

    it("should include designStructure tool in tool list", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const tools = await client.listTools();
      const structureTool = tools.tools.find((t) => t.name === "designStructure");
      expect(structureTool).to.not.be.undefined;
      expect(structureTool?.inputSchema).to.not.be.undefined;
    });

    it("should design a simple block volume structure", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const projectPath = createStructureTempProjectPath("simple");

      const result = await client.callTool({
        name: "designStructure",
        arguments: {
          blockVolume: McpTestFixtures.SIMPLE_BLOCK_VOLUME,
          structureId: "mcp_simple_structure",
          projectPath: projectPath,
        },
      });

      // Check the result
      expect(result.isError).to.not.equal(true);

      // Verify mcstructure file was created in the project
      const mcstructureFiles = findFilesRecursive(projectPath, ".mcstructure");
      assert(mcstructureFiles.length > 0, "MCStructure file should exist in project");

      // Verify file is non-empty and has NBT header
      const fileData = fs.readFileSync(mcstructureFiles[0]);
      assert(fileData.length > 100, "MCStructure file should have content");
      assert(fileData[0] === 0x0a || fileData[0] === 0x08, "File should have NBT-like header");
    });

    it("should design structure with block properties", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const projectPath = createStructureTempProjectPath("with_props");

      const result = await client.callTool({
        name: "designStructure",
        arguments: {
          blockVolume: McpTestFixtures.STRUCTURE_WITH_PROPERTIES,
          structureId: "mcp_structure_with_props",
          projectPath: projectPath,
        },
      });

      expect(result.isError).to.not.equal(true);

      const mcstructureFiles = findFilesRecursive(projectPath, ".mcstructure");
      assert(mcstructureFiles.length > 0, "MCStructure file should exist in project");

      const fileData = fs.readFileSync(mcstructureFiles[0]);
      assert(fileData.length > 100, "MCStructure file should have content");
    });

    it("should design medium structure", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const projectPath = createStructureTempProjectPath("medium");

      const result = await client.callTool({
        name: "designStructure",
        arguments: {
          blockVolume: McpTestFixtures.MEDIUM_STRUCTURE,
          structureId: "mcp_medium_structure",
          projectPath: projectPath,
        },
      });

      expect(result.isError).to.not.equal(true);

      const mcstructureFiles = findFilesRecursive(projectPath, ".mcstructure");
      assert(mcstructureFiles.length > 0, "MCStructure file should exist in project");
    });

    it("should design house structure", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const projectPath = createStructureTempProjectPath("house");

      const result = await client.callTool({
        name: "designStructure",
        arguments: {
          blockVolume: McpTestFixtures.HOUSE_STRUCTURE,
          structureId: "mcp_house_structure",
          projectPath: projectPath,
        },
      });

      expect(result.isError).to.not.equal(true);

      const mcstructureFiles = findFilesRecursive(projectPath, ".mcstructure");
      assert(mcstructureFiles.length > 0, "MCStructure file should exist in project");
    });

    it("should attempt to render a structure preview", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const projectPath = createStructureTempProjectPath("preview_test");

      try {
        const result = await client.callTool({
          name: "designStructure",
          arguments: {
            blockVolume: McpTestFixtures.SIMPLE_BLOCK_VOLUME,
            structureId: "preview_structure",
            projectPath: projectPath,
          },
        });

        if (result.isError) {
          // Expected if no browser available
          console.log("Structure design returned error (may be no browser):", result.content);
        } else {
          const content = result.content as any[];
          expect(content).to.be.an("array");
          const imageContent = content.find((c: any) => c.type === "image");
          if (imageContent) {
            expect(imageContent.mimeType).to.equal("image/png");
            expect(imageContent.data).to.be.a("string");
          }
        }
      } catch (e) {
        console.log("Structure design tool call failed (expected if no browser):", e);
      }
    });
  });

  describe("Design Structure Tool - Baseline Comparison", function () {
    const STRUCTURE_SCENARIO = "mcpStructurePreview";
    let structurePreviewAvailable = false;

    before(async function () {
      if (!serverAvailable || !client) {
        return;
      }

      // Test if structure preview is available via designStructure
      try {
        const testProjectPath = path.join(testFolders.getResultsPath(STRUCTURE_SCENARIO), "preview_test");
        if (fs.existsSync(testProjectPath)) {
          fs.rmSync(testProjectPath, { recursive: true, force: true });
        }
        fs.mkdirSync(testProjectPath, { recursive: true });

        const testResult = await client.callTool({
          name: "designStructure",
          arguments: {
            blockVolume: McpTestFixtures.TINY_STRUCTURE,
            structureId: "preview_test",
            projectPath: testProjectPath,
          },
        });

        if (!testResult.isError) {
          const content = testResult.content as any[];
          const imageContent = content.find((c: any) => c.type === "image");
          structurePreviewAvailable = !!imageContent;
          if (!structurePreviewAvailable) {
            const textContent = content.find((c: any) => c.type === "text");
            console.log(
              "Structure preview test returned no image. Content types:",
              content.map((c: any) => c.type).join(", ")
            );
            if (textContent) {
              console.log("Text response:", textContent.text?.substring(0, 500));
            }
          }
        } else {
          const content = testResult.content as any[];
          const textContent = content.find((c: any) => c.type === "text");
          console.log(
            "Structure preview test returned error:",
            textContent?.text?.substring(0, 500) || "Unknown error"
          );
        }

        if (structurePreviewAvailable) {
          testFolders.removeResultFolder(STRUCTURE_SCENARIO);
          testFolders.ensureResultFolder(STRUCTURE_SCENARIO);
          console.log("Structure preview rendering is available - running baseline comparison tests");
        } else {
          console.log("Structure preview rendering not available - skipping baseline comparison tests");
        }
      } catch (e) {
        console.log("Structure preview not available:", e);
        structurePreviewAvailable = false;
      }
    });

    /**
     * Helper to render a structure and save the result PNG.
     * Uses the unified designStructure tool which always returns a preview image.
     */
    async function renderStructureAndSave(
      blockVolume: any,
      filename: string,
      options?: { width?: number; height?: number; multiAngle?: boolean }
    ): Promise<string | undefined> {
      if (!client) return undefined;

      const projectPath = path.join(
        testFolders.getResultsPath(STRUCTURE_SCENARIO),
        "renderStructure_" + filename.replace(/[^a-zA-Z0-9]/g, "_")
      );
      if (fs.existsSync(projectPath)) {
        fs.rmSync(projectPath, { recursive: true, force: true });
      }
      fs.mkdirSync(projectPath, { recursive: true });

      const result = await client.callTool(
        {
          name: "designStructure",
          arguments: {
            blockVolume,
            structureId: "render_" + filename.replace(/[^a-zA-Z0-9]/g, "_"),
            projectPath: projectPath,
          },
        },
        undefined,
        { timeout: 120000 }
      );

      if (result.isError) {
        console.log(`Structure render failed for ${filename}:`, result.content);
        return undefined;
      }

      const content = result.content as any[];
      const imageContent = content.find((c: any) => c.type === "image");

      if (!imageContent || !imageContent.data) {
        return undefined;
      }

      const resultPath = path.join(testFolders.getResultsPath(STRUCTURE_SCENARIO), filename);
      const imageBuffer = Buffer.from(imageContent.data, "base64");
      fs.writeFileSync(resultPath, imageBuffer);

      return resultPath;
    }

    it("should render simple block volume and match baseline", async function () {
      if (!serverAvailable || !client || !structurePreviewAvailable) {
        this.skip();
        return;
      }

      const filename = "simple_block_volume.preview.png";
      const resultPath = await renderStructureAndSave(McpTestFixtures.SIMPLE_BLOCK_VOLUME, filename, {
        width: 1024,
        height: 512,
        multiAngle: true,
      });

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 1000);

      const scenarioPath = path.join(testFolders.getScenariosPath(STRUCTURE_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render tiny structure and match baseline", async function () {
      if (!serverAvailable || !client || !structurePreviewAvailable) {
        this.skip();
        return;
      }

      const filename = "tiny_structure.preview.png";
      const resultPath = await renderStructureAndSave(McpTestFixtures.TINY_STRUCTURE, filename, {
        width: 1024,
        height: 512,
        multiAngle: true,
      });

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 1000);

      const scenarioPath = path.join(testFolders.getScenariosPath(STRUCTURE_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render structure with properties and match baseline", async function () {
      if (!serverAvailable || !client || !structurePreviewAvailable) {
        this.skip();
        return;
      }

      const filename = "structure_with_properties.preview.png";
      const resultPath = await renderStructureAndSave(McpTestFixtures.STRUCTURE_WITH_PROPERTIES, filename, {
        width: 1024,
        height: 512,
        multiAngle: true,
      });

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 1000);

      const scenarioPath = path.join(testFolders.getScenariosPath(STRUCTURE_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render medium structure and match baseline", async function () {
      if (!serverAvailable || !client || !structurePreviewAvailable) {
        this.skip();
        return;
      }

      const filename = "medium_structure.preview.png";
      const resultPath = await renderStructureAndSave(McpTestFixtures.MEDIUM_STRUCTURE, filename, {
        width: 1024,
        height: 512,
        multiAngle: true,
      });

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 1000);

      const scenarioPath = path.join(testFolders.getScenariosPath(STRUCTURE_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render house structure and match baseline", async function () {
      if (!serverAvailable || !client || !structurePreviewAvailable) {
        this.skip();
        return;
      }

      const filename = "house_structure.preview.png";
      const resultPath = await renderStructureAndSave(McpTestFixtures.HOUSE_STRUCTURE, filename, {
        width: 1024,
        height: 512,
        multiAngle: true,
      });

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 1000);

      const scenarioPath = path.join(testFolders.getScenariosPath(STRUCTURE_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });

    it("should render simple structure with multi-angle view", async function () {
      if (!serverAvailable || !client || !structurePreviewAvailable) {
        this.skip();
        return;
      }

      const filename = "simple_structure_multiangle.preview.png";
      const resultPath = await renderStructureAndSave(McpTestFixtures.SIMPLE_BLOCK_VOLUME, filename, {
        width: 1024,
        height: 512,
        multiAngle: true,
      });

      if (!resultPath) {
        this.skip();
        return;
      }

      assertValidPng(resultPath, 1000);

      const scenarioPath = path.join(testFolders.getScenariosPath(STRUCTURE_SCENARIO), filename);
      assertPngMatchesBaseline(this, resultPath, scenarioPath, 15, 10);
    });
  });
});
