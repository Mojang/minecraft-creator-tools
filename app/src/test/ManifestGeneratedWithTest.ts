/**
 * ManifestGeneratedWithTest - Checks that Creator Tools records itself in each pack manifest's
 * `metadata.generated_with` map (the Bedrock field that tracks which tools made a pack).
 *
 * Covers:
 *   - ProjectUtilities.ensureGeneratedWith stamps behavior and resource pack manifests in every
 *     edit mode, keeps comments and existing metadata, and doesn't rewrite a manifest twice.
 *   - Each tool command scope maps to the right tool name.
 *   - The MCP createMinecraftContent manifest writer stamps `mctoolsmcp` and keeps existing metadata.
 */

import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import "../app/Project";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import ProjectUtilities from "../app/ProjectUtilities";
import { ProjectEditPreference } from "../app/IProjectData";
import { GeneratedWithTools } from "../minecraft/ManifestGeneratedWith";
import MinecraftMcpServer from "../local/MinecraftMcpServer";
import StorageUtilities from "../storage/StorageUtilities";
import { constants } from "../core/Constants";
import TestPaths, { ITestEnvironment } from "./TestPaths";

let env: ITestEnvironment | undefined;

(async () => {
  env = await TestPaths.createTestEnvironment();
})();

const debugOutputRoot = path.join(TestPaths.appRoot, "debugoutput", "manifest-generated-with");

const behaviorManifestText = `{
  // creator comment that must survive stamping
  "format_version": 2,
  "header": {
    "name": "Test BP",
    "description": "",
    "uuid": "0b6f2a6e-1c1d-4c55-9d55-2a8a4c7f8b01",
    "version": [1, 0, 0],
    "min_engine_version": [1, 21, 0]
  },
  "modules": [{ "type": "data", "uuid": "0b6f2a6e-1c1d-4c55-9d55-2a8a4c7f8b02", "version": [1, 0, 0] }],
  "metadata": { "authors": ["Test Author"], "generated_with": { "blockbench": ["4.8.0"] } }
}`;

const resourceManifestText = `{
  "format_version": 2,
  "header": {
    "name": "Test RP",
    "description": "",
    "uuid": "0b6f2a6e-1c1d-4c55-9d55-2a8a4c7f8b03",
    "version": [1, 0, 0],
    "min_engine_version": [1, 21, 0]
  },
  "modules": [{ "type": "resources", "uuid": "0b6f2a6e-1c1d-4c55-9d55-2a8a4c7f8b04", "version": [1, 0, 0] }]
}`;

function freshFolder(name: string): string {
  const folder = path.join(debugOutputRoot, name);
  fs.rmSync(folder, { recursive: true, force: true });
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

function writeTestPacks(root: string) {
  const bpFolder = path.join(root, "behavior_packs", "test_bp");
  const rpFolder = path.join(root, "resource_packs", "test_rp");
  fs.mkdirSync(bpFolder, { recursive: true });
  fs.mkdirSync(rpFolder, { recursive: true });
  fs.writeFileSync(path.join(bpFolder, "manifest.json"), behaviorManifestText, "utf-8");
  fs.writeFileSync(path.join(rpFolder, "manifest.json"), resourceManifestText, "utf-8");
  return { bpManifest: path.join(bpFolder, "manifest.json"), rpManifest: path.join(rpFolder, "manifest.json") };
}

async function openProject(root: string, editPreference: ProjectEditPreference) {
  assert(env, "Test environment should be initialized");
  const project = new Project(env.creatorTools, path.basename(root), null);
  project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
  project.localFolderPath = StorageUtilities.ensureEndsWithDelimiter(root);
  project.editPreference = editPreference;
  await project.inferProjectItemsFromFiles();
  return project;
}

function readJsonWithComments(filePath: string) {
  const text = fs.readFileSync(filePath, "utf-8");
  return { text, json: JSON.parse(text.replace(/^\s*\/\/.*$/gm, "")) };
}

describe("ProjectUtilities.ensureGeneratedWith", function () {
  this.timeout(30000);

  const editPreferences: { name: string; value: ProjectEditPreference }[] = [
    { name: "default", value: ProjectEditPreference.default },
    { name: "summarized", value: ProjectEditPreference.summarized },
    { name: "editors", value: ProjectEditPreference.editors },
    { name: "raw", value: ProjectEditPreference.raw },
  ];

  for (const { name, value } of editPreferences) {
    it(`stamps behavior and resource pack manifests in ${name} edit mode`, async () => {
      const root = freshFolder("editmode-" + name);
      const { bpManifest, rpManifest } = writeTestPacks(root);

      const project = await openProject(root, value);
      await ProjectUtilities.ensureGeneratedWith(project, GeneratedWithTools.cli);
      await project.save();

      const bp = readJsonWithComments(bpManifest);
      assert.deepEqual(bp.json.metadata.generated_with, {
        blockbench: ["4.8.0"],
        mctoolscli: [constants.version],
      });
      assert.deepEqual(bp.json.metadata.authors, ["Test Author"]);
      assert.include(bp.text, "creator comment that must survive stamping");

      const rp = readJsonWithComments(rpManifest);
      assert.deepEqual(rp.json.metadata.generated_with, { mctoolscli: [constants.version] });
    });
  }

  it("stamps a default behavior pack manifest that was just created", async () => {
    const root = freshFolder("new-default-pack");

    const project = await openProject(root, ProjectEditPreference.default);
    const bpFolder = await project.ensureDefaultBehaviorPackFolder();
    await ProjectUtilities.ensureGeneratedWith(project, GeneratedWithTools.cli);
    await project.save();

    const manifestPath = path.join(root, "behavior_packs", bpFolder.name, "manifest.json");
    assert(fs.existsSync(manifestPath), "Expected a manifest at " + manifestPath);
    assert.deepEqual(readJsonWithComments(manifestPath).json.metadata.generated_with, {
      mctoolscli: [constants.version],
    });
  });

  it("doesn't change a manifest that already records this version", async () => {
    const root = freshFolder("idempotent");
    const { bpManifest } = writeTestPacks(root);

    const first = await openProject(root, ProjectEditPreference.default);
    await ProjectUtilities.ensureGeneratedWith(first, GeneratedWithTools.mcp);
    await first.save();
    const afterFirst = fs.readFileSync(bpManifest, "utf-8");

    const second = await openProject(root, ProjectEditPreference.default);
    await ProjectUtilities.ensureGeneratedWith(second, GeneratedWithTools.mcp);
    await second.save();

    assert.equal(fs.readFileSync(bpManifest, "utf-8"), afterFirst);
    assert.deepEqual(readJsonWithComments(bpManifest).json.metadata.generated_with.mctoolsmcp, [constants.version]);
  });

  const nestedCommentManifest = (moduleType: string, uuidSuffix: string) => `{
  "format_version": 2,
  "header": {
    // header comment that must survive stamping
    "name": "Nested",
    "description": "",
    "uuid": "0b6f2a6e-1c1d-4c55-9d55-2a8a4c7f8c${uuidSuffix}1",
    "version": [1, 0, 0],
    "min_engine_version": [1, 21, 0]
  },
  "modules": [
    {
      // module comment that must survive stamping
      "type": "${moduleType}",
      "uuid": "0b6f2a6e-1c1d-4c55-9d55-2a8a4c7f8c${uuidSuffix}2",
      "version": [1, 0, 0]
    }
  ]
}`;

  it("keeps comments that only appear inside nested objects, and doesn't rewrite them on a second run", async () => {
    const root = freshFolder("nested-comments");
    const bpManifest = path.join(root, "behavior_packs", "test_bp", "manifest.json");
    const rpManifest = path.join(root, "resource_packs", "test_rp", "manifest.json");
    fs.mkdirSync(path.dirname(bpManifest), { recursive: true });
    fs.mkdirSync(path.dirname(rpManifest), { recursive: true });
    fs.writeFileSync(bpManifest, nestedCommentManifest("data", "0"), "utf-8");
    fs.writeFileSync(rpManifest, nestedCommentManifest("resources", "1"), "utf-8");

    const first = await openProject(root, ProjectEditPreference.default);
    await ProjectUtilities.ensureGeneratedWith(first, GeneratedWithTools.cli);
    await first.save();

    const afterFirst: string[] = [];

    for (const manifestPath of [bpManifest, rpManifest]) {
      const manifest = readJsonWithComments(manifestPath);
      assert.deepEqual(manifest.json.metadata.generated_with, { mctoolscli: [constants.version] }, manifestPath);
      assert.include(manifest.text, "header comment that must survive stamping", manifestPath);
      assert.include(manifest.text, "module comment that must survive stamping", manifestPath);
      afterFirst.push(manifest.text);
    }

    const second = await openProject(root, ProjectEditPreference.default);
    await ProjectUtilities.ensureGeneratedWith(second, GeneratedWithTools.cli);
    await second.save();

    assert.equal(fs.readFileSync(bpManifest, "utf-8"), afterFirst[0]);
    assert.equal(fs.readFileSync(rpManifest, "utf-8"), afterFirst[1]);
  });

  const malformedMetadataCases: { name: string; metadata: string }[] = [
    { name: "a string", metadata: `"broken"` },
    { name: "an array", metadata: `["broken"]` },
  ];

  for (const { name, metadata } of malformedMetadataCases) {
    it(`replaces metadata that is ${name} with a stamped object`, async () => {
      const root = freshFolder("malformed-metadata-" + name.replace(/\s/g, "-"));
      const { bpManifest, rpManifest } = writeTestPacks(root);

      for (const manifestPath of [bpManifest, rpManifest]) {
        const manifest = readJsonWithComments(manifestPath).json;
        delete manifest.metadata;
        const text = JSON.stringify(manifest, null, 2);
        fs.writeFileSync(manifestPath, text.replace(/\n}$/, `,\n  "metadata": ${metadata}\n}`), "utf-8");
      }

      const project = await openProject(root, ProjectEditPreference.default);
      await ProjectUtilities.ensureGeneratedWith(project, GeneratedWithTools.cli);
      await project.save();

      for (const manifestPath of [bpManifest, rpManifest]) {
        assert.deepEqual(
          readJsonWithComments(manifestPath).json.metadata,
          { generated_with: { mctoolscli: [constants.version] } },
          manifestPath
        );
      }
    });
  }
});

describe("ProjectUtilities.getGeneratedWithToolForScope", () => {
  const cases: { scope: "ui" | "mcp" | "serveTerminal" | "serverApi" | "cli"; expected: string }[] = [
    { scope: "ui", expected: "mctoolsweb" },
    { scope: "mcp", expected: "mctoolsmcp" },
    { scope: "cli", expected: "mctoolscli" },
    { scope: "serveTerminal", expected: "mctoolscli" },
    { scope: "serverApi", expected: "mctoolscli" },
  ];

  for (const { scope, expected } of cases) {
    it(`${scope} records ${expected}`, () => {
      assert.equal(ProjectUtilities.getGeneratedWithToolForScope(scope), expected);
    });
  }
});

describe("MinecraftMcpServer._writeManifestPreservingUuids", () => {
  // TypeScript-private; reach into it for targeted testing.
  const writeManifest = (packBasePath: string, content: object) => {
    const filesWritten: string[] = [];
    (MinecraftMcpServer as any)._writeManifestPreservingUuids(
      packBasePath,
      { path: "manifest.json", pack: "behavior", type: "json", content },
      filesWritten
    );
    return JSON.parse(fs.readFileSync(path.join(packBasePath, "manifest.json"), "utf-8"));
  };

  const generatedManifest = () => ({
    format_version: 2,
    header: { name: "Gen", uuid: "new-header-uuid", version: [1, 0, 0] },
    modules: [{ type: "data", uuid: "new-module-uuid", version: [1, 0, 0] }],
  });

  it("stamps mctoolsmcp on a new manifest", () => {
    const folder = freshFolder("mcp-new");
    const written = writeManifest(folder, generatedManifest());
    assert.deepEqual(written.metadata, { generated_with: { mctoolsmcp: [constants.version] } });
  });

  it("keeps existing metadata and adds mctoolsmcp", () => {
    const folder = freshFolder("mcp-existing");
    fs.writeFileSync(
      path.join(folder, "manifest.json"),
      JSON.stringify({
        format_version: 2,
        header: { name: "Old", uuid: "old-header-uuid", version: [1, 2, 3] },
        modules: [{ type: "data", uuid: "old-module-uuid", version: [1, 0, 0] }],
        metadata: { authors: ["Test Author"], generated_with: { mctoolscli: ["0.0.1"] } },
      }),
      "utf-8"
    );

    const written = writeManifest(folder, generatedManifest());
    assert.equal(written.header.uuid, "old-header-uuid");
    assert.equal(written.modules[0].uuid, "old-module-uuid");
    assert.deepEqual(written.metadata.authors, ["Test Author"]);
    assert.deepEqual(written.metadata.generated_with, {
      mctoolscli: ["0.0.1"],
      mctoolsmcp: [constants.version],
    });
  });

  it("reads an existing manifest that has comments and keeps its identifiers and metadata", () => {
    const folder = freshFolder("mcp-existing-commented");
    fs.writeFileSync(
      path.join(folder, "manifest.json"),
      `{
  // root comment
  "format_version": 2,
  "header": {
    // header comment
    "name": "Old",
    "uuid": "old-header-uuid",
    "version": [1, 2, 3]
  },
  "modules": [{ "type": "data", "uuid": "old-module-uuid", "version": [1, 0, 0] }],
  "metadata": {
    /* metadata comment */
    "authors": ["Test Author"],
    "license": "MIT",
    "generated_with": { "blockbench": ["4.8.0"] },
  }
}`,
      "utf-8"
    );

    const written = writeManifest(folder, generatedManifest());
    assert.equal(written.header.uuid, "old-header-uuid");
    assert.deepEqual(written.header.version, [1, 2, 3]);
    assert.equal(written.modules[0].uuid, "old-module-uuid");
    assert.deepEqual(written.metadata, {
      authors: ["Test Author"],
      license: "MIT",
      generated_with: { blockbench: ["4.8.0"], mctoolsmcp: [constants.version] },
    });
  });

  it("writes a fresh stamped manifest when the existing one isn't valid JSON", () => {
    const folder = freshFolder("mcp-existing-malformed");
    fs.writeFileSync(path.join(folder, "manifest.json"), `{ "header": { "uuid": `, "utf-8");

    const written = writeManifest(folder, generatedManifest());
    assert.equal(written.header.uuid, "new-header-uuid");
    assert.deepEqual(written.metadata, { generated_with: { mctoolsmcp: [constants.version] } });
  });
});
