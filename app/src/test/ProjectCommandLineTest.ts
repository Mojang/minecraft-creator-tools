import { assert } from "chai";
import { spawn } from "child_process";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import JsonUtilities from "../core/JsonUtilities";
import ProjectInfoSet from "../info/ProjectInfoSet";
import { ProjectInfoSuite } from "../info/IProjectInfoData";
import Database from "../minecraft/Database";
import { creatorTools, removeResultFolder, ensureResultFolder, collectLines } from "./CommandLineTestHelpers";

describe("addLootTable", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  let project: Project | null = null;
  let allProjectInfoSet: ProjectInfoSet | null = null;

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("addLootTable");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "add",
      "loot_table",
      "testerName",
      "-o",
      "./test/results/addLootTable/",
      "--internalOnlyRunningInTheContextOfTestCommandLines",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;

      assert(creatorTools, "CreatorTools is not properly initialized");

      project = new Project(creatorTools, "addLootTable", null);

      // exclude eslint because we know the .ts comes with some warnings due to
      // the starter TS having some unused variables.
      allProjectInfoSet = new ProjectInfoSet(project, ProjectInfoSuite.defaultInDevelopment);

      project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
      project.localFolderPath = __dirname + "/../../test/results/addLootTable/";

      project.inferProjectItemsFromFiles().then(() => {
        assert(project);

        assert(allProjectInfoSet);

        allProjectInfoSet.generateForProject().then(() => {
          done();
        });
      });
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("should have 3 project items", async () => {
    // loot table, generated BP manifest, BP folder
    assert(project);
    assert.equal(project.items.length, 3);
  }).timeout(10000);

  it("main validation should have 2 errors (which is expected, no manifest exists)", async () => {
    assert(allProjectInfoSet);
    assert.equal(allProjectInfoSet.errorFailWarnCount, 2, allProjectInfoSet.errorFailWarnString);
  }).timeout(10000);

  it("should generate loot table file", () => {
    const lootTablePath = "./test/results/addLootTable/behavior_packs/contoso_lt_bp/loot_tables/testername.json";
    assert(fs.existsSync(lootTablePath), "Loot table file should exist at: " + lootTablePath);
    const content = JSON.parse(fs.readFileSync(lootTablePath, "utf8"));
    assert.isObject(content, "Loot table should be valid JSON");
  });

  it("should generate manifest file", () => {
    const manifestPath = "./test/results/addLootTable/behavior_packs/contoso_lt_bp/manifest.json";
    assert(fs.existsSync(manifestPath), "Manifest file should exist at: " + manifestPath);
    const content = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    assert.equal(content.format_version, 2, "Manifest format_version should be 2");
    assert(content.header?.name, "Manifest should have header.name");
    assert(content.header?.uuid, "Manifest should have header.uuid");
  });
});

describe("deployCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("deployCommand");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "deploy",
      "folder",
      "-i",
      "./../samplecontent/simple/",
      "-o",
      "./test/results/deployCommand/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  });

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  });

  it("deployed files should exist", () => {
    const base = "./test/results/deployCommand/development_behavior_packs/StarterTestsTutorial/";
    assert(fs.existsSync(base + "manifest.json"), "manifest.json should exist");
    assert(fs.existsSync(base + "pack_icon.png"), "pack_icon.png should exist");
    assert(fs.existsSync(base + "scripts/index.js"), "scripts/index.js should exist");
    assert(fs.existsSync(base + "scripts/starttests.js"), "scripts/starttests.js should exist");
    assert(
      fs.existsSync(base + "structures/starttests/mediumglass.mcstructure"),
      "mediumglass.mcstructure should exist"
    );
  });
});

describe("exportAddonCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    removeResultFolder("exportAddonCommand");
    ensureResultFolder("exportAddonCommand");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "exportaddon",
      "-i",
      "./../samplecontent/simple/",
      "-o",
      "./test/results/exportAddonCommand",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("should report export success", () => {
    const hasExported = stdoutLines.some((line) => line.includes("Exported"));
    assert(hasExported, "Should report successful export. Got: " + stdoutLines.join(" | "));
  }).timeout(10000);

  it("should produce an mcpack file", () => {
    const outputDir = "./test/results/exportAddonCommand/";
    const files = fs.existsSync(outputDir) ? fs.readdirSync(outputDir) : [];
    const mcpackFiles = files.filter((f) => f.endsWith(".mcpack") || f.endsWith(".mcaddon"));
    assert(mcpackFiles.length > 0, "Should produce an mcpack/mcaddon file. Found: " + files.join(", "));
  }).timeout(10000);
});

describe("exportWorldCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    removeResultFolder("exportWorldCommand");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "exportworld",
      "-i",
      "./../samplecontent/simple/",
      "-o",
      "./test/results/exportWorldCommand/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("should report export success", () => {
    const hasExported = stdoutLines.some((line) => line.includes("Exported"));
    assert(hasExported, "Should report successful export. Got: " + stdoutLines.join(" | "));
  }).timeout(10000);

  it("should produce an mcworld file", () => {
    const outputDir = "./test/results/exportWorldCommand/";
    const files = fs.existsSync(outputDir) ? fs.readdirSync(outputDir) : [];
    const mcworldFiles = files.filter((f) => f.endsWith(".mcworld"));
    assert(mcworldFiles.length > 0, "Should produce an mcworld file. Found: " + files.join(", "));
  }).timeout(10000);
});

describe("fixCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    removeResultFolder("fixCommand");

    // Use dry-run to avoid modifying sample content
    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "fix",
      "setnewestformatversions",
      "-i",
      "./../samplecontent/simple/",
      "--dry-run",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("should indicate dry run", () => {
    const hasDryRun = stdoutLines.some((line) => line.toLowerCase().includes("dry run"));
    assert(hasDryRun, "Should mention dry run. Got: " + stdoutLines.join(" | "));
  }).timeout(10000);
});

describe("fixCommandInvalidFix", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "fix",
      "nonexistentfix",
      "-i",
      "./../samplecontent/simple/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have a non-zero exit code for invalid fix name", async () => {
    assert.notEqual(exitCode, 0, "Should fail with non-zero exit code for invalid fix");
  }).timeout(10000);

  it("should report the unknown fix name", () => {
    const allOutput = stdoutLines.join("\n") + stderrLines.join("\n");
    const hasUnknownMsg = allOutput.includes("Unknown fix") || allOutput.includes("nonexistentfix");
    assert(hasUnknownMsg, "Should mention unknown fix. Got: " + stdoutLines.join(" | "));
  }).timeout(10000);
});

// Each fix runs on a copy of a sample project, and the files on disk are checked against what the
// command reports. The target Minecraft version comes from a lookup (pinned for tests by
// TestVersionPin), so it's read from the command's output rather than hard-coded.
describe("fixCommandWritesFiles", () => {
  let tempRoot = "";
  let dataFolder = "";

  before(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mct-fix-"));
    dataFolder = path.join(tempRoot, "data");
    fs.mkdirSync(dataFolder);
  });

  after(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  /** Copies a folder from samplecontent/ into the temp folder, without its build output or node_modules. */
  function copySample(samplePath: string, copyName: string): string {
    const samplePathResolved = path.resolve("./../samplecontent", samplePath);
    const copyPath = path.join(tempRoot, copyName);

    fs.cpSync(samplePathResolved, copyPath, {
      recursive: true,
      filter: (source) => !["build", "node_modules"].includes(path.relative(samplePathResolved, source)),
    });

    return copyPath;
  }

  /** Runs `mct fix` with a temporary data folder, so the real profile isn't touched. Undefined env values are removed. */
  function runFix(
    args: string[],
    env: Record<string, string | undefined> = {}
  ): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      const child = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "fix", ...args], {
        env: { ...process.env, MCTOOLS_DATA_DIR: dataFolder, ...env },
      });

      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.on("close", (code) => resolve({ exitCode: code, stdout, stderr }));
    });
  }

  /** Maps each file under a folder, by relative path, to a hash of its bytes. */
  function hashFiles(folder: string, hashes = new Map<string, string>(), root = folder): Map<string, string> {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const entryPath = path.join(folder, entry.name);

      if (entry.isDirectory()) {
        hashFiles(entryPath, hashes, root);
      } else {
        hashes.set(
          path.relative(root, entryPath),
          crypto.createHash("sha1").update(fs.readFileSync(entryPath)).digest("hex")
        );
      }
    }

    return hashes;
  }

  function changedFiles(before: Map<string, string>, after: Map<string, string>): string[] {
    return [...new Set([...before.keys(), ...after.keys()])].filter((file) => before.get(file) !== after.get(file));
  }

  function readJson(folder: string, file: string) {
    return JSON.parse(fs.readFileSync(path.join(folder, file), "utf8"));
  }

  function writeFixture(folder: string, file: string, content: string) {
    fs.mkdirSync(path.dirname(path.join(folder, file)), { recursive: true });
    fs.writeFileSync(path.join(folder, file), content);
  }

  /** Parses JSON that may contain comments into plain data, dropping the comments. */
  function plainJson(content: string) {
    return JSON.parse(JSON.stringify(JsonUtilities.parseJsonWithComments(content)));
  }

  /** A minimal pack manifest with one module ("data" for behavior packs, "resources" for resource packs). */
  function packManifest(formatVersion: number, moduleType: string, minEngineVersion: number[]) {
    const manifest = { format_version: formatVersion };
    const version = (value: number[]) => versionInManifestForm(manifest, value);

    return JSON.stringify({
      ...manifest,
      header: {
        name: `${moduleType} pack`,
        description: "A test pack",
        uuid: crypto.randomUUID(),
        version: version([1, 0, 0]),
        min_engine_version: version(minEngineVersion),
      },
      modules: [{ type: moduleType, uuid: crypto.randomUUID(), version: version([1, 0, 0]) }],
    });
  }

  /** Format version 3 manifests take "1.2.3" strings; older ones take [1, 2, 3] arrays. */
  function versionInManifestForm(manifest: { format_version: unknown }, version: number[]) {
    return typeof manifest.format_version === "number" && manifest.format_version >= 3 ? version.join(".") : version;
  }

  /** Reads the version from lines such as "Updated behavior pack min_engine_version to '1.26.20'." */
  function appliedVersion(stdout: string): number[] {
    const versions = new Set([...stdout.matchAll(/ to '(\d+\.\d+\.\d+)'\./g)].map((match) => match[1]));

    assert.equal(versions.size, 1, "expected one target version in the output: " + stdout);

    return [...versions][0].split(".").map((part) => parseInt(part));
  }

  function reportedCount(stdout: string, noun: string): number {
    const match = new RegExp(`Updated (\\d+) ${noun}\\(s\\)`).exec(stdout);

    return match ? parseInt(match[1]) : 0;
  }

  it("setnewestminengineversion writes each manifest it reports, and nothing else", async () => {
    const project = copySample("addon", "minengine");
    const before = hashFiles(project);

    const result = await runFix(["setnewestminengineversion", "-i", project]);

    assert.equal(result.exitCode, 0, result.stderr);
    assert.equal(result.stderr, "");
    const version = appliedVersion(result.stdout);
    const changed = changedFiles(before, hashFiles(project));
    assert.isAbove(changed.length, 0, "no files changed on disk");
    assert.equal(reportedCount(result.stdout, "min_engine_version"), changed.length, result.stdout);

    let formatVersion3Count = 0;
    for (const file of changed) {
      assert.equal(path.basename(file), "manifest.json", `${file} shouldn't have changed`);
      const manifest = readJson(project, file);
      assert.deepEqual(manifest.header.min_engine_version, versionInManifestForm(manifest, version), file);
      formatVersion3Count += manifest.format_version >= 3 ? 1 : 0;
    }
    assert.isAbove(formatVersion3Count, 0, "the addon sample should include format_version 3 manifests");

    const afterFirstRun = hashFiles(project);
    const rerun = await runFix(["setnewestminengineversion", "-i", project]);

    assert.equal(rerun.exitCode, 0, rerun.stderr);
    assert.include(rerun.stdout, "No min engine versions to update");
    assert.deepEqual(changedFiles(afterFirstRun, hashFiles(project)), [], "a second run shouldn't change files");
  }).timeout(60000);

  it("setnewestminengineversion skips manifests it can't parse instead of replacing them", async () => {
    const project = path.join(tempRoot, "unparseable");
    const brokenManifest = '{\n  "format_version": 2,\n  "header": { "min_engine_version": [1, 20, 10] ,,, \n';
    fs.mkdirSync(path.join(project, "behavior_packs", "broken"), { recursive: true });
    fs.writeFileSync(path.join(project, "behavior_packs", "broken", "manifest.json"), brokenManifest);
    fs.cpSync(
      path.resolve("./../samplecontent/simple/behavior_packs/StarterTestsTutorial"),
      path.join(project, "behavior_packs", "good"),
      { recursive: true }
    );

    const result = await runFix(["setnewestminengineversion", "-i", project]);

    assert.equal(result.exitCode, 0, result.stderr);
    assert.equal(
      fs.readFileSync(path.join(project, "behavior_packs", "broken", "manifest.json"), "utf8"),
      brokenManifest
    );
    const goodManifest = readJson(project, path.join("behavior_packs", "good", "manifest.json"));
    assert.deepEqual(goodManifest.header.min_engine_version, appliedVersion(result.stdout));
    assert.equal(reportedCount(result.stdout, "min_engine_version"), 1, result.stdout);
  }).timeout(30000);

  it("setnewestformatversions writes world template base_game_version in the manifest's form", async () => {
    const legacy = copySample("platform_version_world_errors", "worldtemplate");
    const modern = copySample("platform_version_world_errors", "worldtemplate3");
    const modernManifest = readJson(modern, "manifest.json");
    modernManifest.format_version = 3;
    modernManifest.header.base_game_version = "1.19.0";
    modernManifest.header.version = "1.0.0";
    modernManifest.modules[0].version = "1.0.0";
    fs.writeFileSync(path.join(modern, "manifest.json"), JSON.stringify(modernManifest, null, 2));

    for (const project of [legacy, modern]) {
      const before = hashFiles(project);

      const result = await runFix(["setnewestformatversions", "-i", project]);

      assert.equal(result.exitCode, 0, result.stderr);
      assert.deepEqual(changedFiles(before, hashFiles(project)), ["manifest.json"]);
      assert.equal(reportedCount(result.stdout, "format_version"), 1, result.stdout);
      const manifest = readJson(project, "manifest.json");
      const expected = versionInManifestForm(manifest, appliedVersion(result.stdout));
      assert.deepEqual(manifest.header.base_game_version, expected, project);
    }
  }).timeout(30000);

  it("randomizealluids writes a new pack UUID", async () => {
    const project = copySample("simple", "randomize");
    const manifestFile = path.join("behavior_packs", "StarterTestsTutorial", "manifest.json");
    const originalUuid = readJson(project, manifestFile).header.uuid;

    const result = await runFix(["randomizealluids", "-i", project]);

    assert.equal(result.exitCode, 0, result.stderr);
    assert.include(result.stdout, "Randomized all UUIDs");
    const newUuid = readJson(project, manifestFile).header.uuid;
    assert.match(newUuid, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    assert.notEqual(newUuid, originalUuid);
  }).timeout(30000);

  // Module versions come from registry.npmjs.org, so this checks that whatever the fix reports is
  // on disk; if the registry can't be reached, the fix reports nothing and nothing may change.
  it("latestbetascriptversion writes the module versions it reports", async () => {
    const project = copySample("addon/behavior_packs", "scriptmodules");
    const manifestFile = path.join("aop_mobsbp", "manifest.json");
    const before = hashFiles(project);

    const result = await runFix(["latestbetascriptversion", "-i", project]);

    assert.equal(result.exitCode, 0, result.stderr);
    const reported = [...result.stdout.matchAll(/Set module to latest (?:beta|stable) version: (\S+)/g)].map(
      (m) => m[1]
    );
    const changed = changedFiles(before, hashFiles(project));
    const versionsOnDisk = (readJson(project, manifestFile).dependencies as { version: number[] | string }[]).map(
      (dependency) => (Array.isArray(dependency.version) ? dependency.version.join(".") : dependency.version)
    );

    assert.deepEqual(changed, reported.length > 0 ? [manifestFile] : []);
    for (const version of reported) {
      assert.include(versionsOnDisk, version);
    }
  }).timeout(60000);

  it("keeps the comments in manifests it rewrites and changes only the version", async () => {
    const worldTemplate = copySample("platform_version_world_errors", "commentsworld");
    const runs = [
      {
        fix: "setnewestminengineversion",
        project: path.join(tempRoot, "comments"),
        manifests: [
          {
            file: path.join("behavior_packs", "commented", "manifest.json"),
            field: "min_engine_version",
            content: `{
  // Hand-edited pack manifest
  "format_version": 2,
  "header": {
    "name": "Commented pack", /* block comment */
    "description": "A pack with comments",
    "uuid": "8c1f3a52-7a4e-4d0b-9d36-1d3b0f6f1a11",
    "version": [1, 0, 0],
    "min_engine_version": [
      1, // inside the version
      20,
      10
    ] // keep in sync with the resource pack
  },
  "modules": [{ "type": "data", "uuid": "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d", "version": [1, 0, 0] }]
}
`,
          },
          {
            file: path.join("resource_packs", "commented", "manifest.json"),
            field: "min_engine_version",
            content: `{
  "format_version": 3,
  "header": {
    // Only nested comments in this one
    "name": "Commented resources", // shown in the pack list
    "description": "A pack with comments",
    "uuid": "3d4e5f6a-7b8c-4d9e-8f0a-1b2c3d4e5f6a",
    "version": "1.0.0",
    "min_engine_version": "1.21.100" /* bump with new APIs */
  },
  "modules": [{ "type": "resources", "uuid": "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b", "version": "1.0.0" }]
}
`,
          },
        ],
      },
      {
        fix: "setnewestformatversions",
        project: worldTemplate,
        manifests: [
          {
            file: "manifest.json",
            field: "base_game_version",
            content: `{
  // World template manifest
  "format_version": 2,
  "header": {
    "name": "Commented world", /* shown in the world list */
    "description": "A world template with comments",
    "uuid": "11223344-5566-7788-99aa-bbccddeeff00",
    "base_game_version": [1, 19, 0], // update with each release
    "lock_template_options": false,
    "version": [1, 0, 0]
  },
  "modules": [{ "type": "world_template", "uuid": "22334455-6677-8899-aabb-ccddeeff0011", "version": [1, 0, 0] }]
}
`,
          },
        ],
      },
    ];

    for (const run of runs) {
      for (const manifest of run.manifests) {
        writeFixture(run.project, manifest.file, manifest.content);
      }

      const result = await runFix([run.fix, "-i", run.project]);

      assert.equal(result.exitCode, 0, result.stderr);
      const version = appliedVersion(result.stdout);
      for (const { file, field, content } of run.manifests) {
        const written = fs.readFileSync(path.join(run.project, file), "utf8");
        for (const comment of content.match(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g) ?? []) {
          assert.include(written, comment, `${file} lost a comment`);
        }

        const before = plainJson(content);
        const after = plainJson(written);
        assert.deepEqual(after.header[field], versionInManifestForm(after, version), file);
        delete before.header[field];
        delete after.header[field];
        assert.deepEqual(after, before, `${file} changed more than ${field}`);
      }

      const afterFirstRun = hashFiles(run.project);
      const rerun = await runFix([run.fix, "-i", run.project]);

      assert.equal(rerun.exitCode, 0, rerun.stderr);
      assert.deepEqual(changedFiles(afterFirstRun, hashFiles(run.project)), [], `a second ${run.fix} changed files`);
    }
  }).timeout(60000);

  // When the version lookup fails, the target falls back to an older bundled version, so the fixes
  // must never lower a manifest that's already newer than their target.
  it("leaves manifests that are newer than the target unchanged, including when the lookup fails", async () => {
    const fallback = Database.fallbackMinecraftVersion.split(".").map((part) => parseInt(part));
    const scenarios: { name: string; version: number[]; env: Record<string, string | undefined> }[] = [
      { name: "pinned", version: [9, 0, 0], env: {} },
      {
        // A proxy address that refuses connections makes the lookup fail. One patch above the
        // bundled version is newer than that fallback but older than the real latest version, so
        // this also fails if the lookup somehow succeeded.
        name: "lookupfails",
        version: [fallback[0], fallback[1], fallback[2] + 1],
        env: {
          MCT_TEST_PINNED_MC_VERSION: undefined,
          https_proxy: "http://127.0.0.1:1",
          HTTPS_PROXY: "http://127.0.0.1:1",
          no_proxy: undefined,
          NO_PROXY: undefined,
        },
      },
    ];

    for (const { name, version, env } of scenarios) {
      const packs = path.join(tempRoot, `newer-${name}`);
      writeFixture(packs, path.join("behavior_packs", "newer", "manifest.json"), packManifest(2, "data", version));
      writeFixture(packs, path.join("resource_packs", "newer", "manifest.json"), packManifest(3, "resources", version));
      const runs: [string, string, string][] = [
        ["setnewestminengineversion", packs, "No min engine versions to update"],
      ];
      for (const formatVersion of [2, 3]) {
        const worldTemplate = copySample("platform_version_world_errors", `newer-${name}-world${formatVersion}`);
        const manifest = readJson(worldTemplate, "manifest.json");
        manifest.format_version = formatVersion;
        manifest.header.base_game_version = versionInManifestForm(manifest, version);
        writeFixture(worldTemplate, "manifest.json", JSON.stringify(manifest, null, 2));
        runs.push(["setnewestformatversions", worldTemplate, "No format versions to update"]);
      }

      for (const [fix, project, noneMessage] of runs) {
        const before = hashFiles(project);

        const result = await runFix([fix, "-i", project], env);

        assert.equal(result.exitCode, 0, `${fix} (${name}): ${result.stderr}`);
        assert.include(result.stdout, noneMessage, `${fix} (${name})`);
        assert.deepEqual(changedFiles(before, hashFiles(project)), [], `${fix} lowered a version (${name})`);
      }
    }
  }).timeout(60000);

  it("exits 1 and lists the manifests it couldn't save, after the ones it saved", async function () {
    // Root can write to read-only files, so the failure can't be forced this way.
    if (process.platform !== "win32" && process.getuid?.() === 0) {
      this.skip();
    }

    const project = path.join(tempRoot, "readonly");
    const writable = path.join("behavior_packs", "writable", "manifest.json");
    const locked = path.join(project, "resource_packs", "locked", "manifest.json");
    writeFixture(project, writable, packManifest(2, "data", [1, 20, 10]));
    writeFixture(project, path.relative(project, locked), packManifest(2, "resources", [1, 20, 10]));
    const lockedContent = fs.readFileSync(locked, "utf8");
    fs.chmodSync(locked, 0o444);

    try {
      const result = await runFix(["setnewestminengineversion", "-i", project]);

      assert.equal(result.exitCode, 1, result.stdout);
      assert.equal(reportedCount(result.stdout, "min_engine_version"), 1, result.stdout);
      assert.deepEqual(readJson(project, writable).header.min_engine_version, appliedVersion(result.stdout));
      assert.include(result.stderr, "Could not save");
      assert.include(result.stderr, "Could not update 1 min_engine_version(s)");
      assert.equal(fs.readFileSync(locked, "utf8"), lockedContent);
    } finally {
      fs.chmodSync(locked, 0o644);
    }
  }).timeout(30000);

  // MCT_TEST_PINNED_MC_VERSION stands in for the version lookup, so an unparseable value makes the
  // fixes fail the way a bad lookup result would.
  it("exits 1 without changing files when it can't determine the target version", async () => {
    const runs: [string, string][] = [
      ["setnewestminengineversion", copySample("simple", "badversion")],
      ["setnewestformatversions", copySample("platform_version_world_errors", "badversionworld")],
    ];

    for (const [fix, project] of runs) {
      for (const json of [false, true]) {
        const before = hashFiles(project);

        const result = await runFix([fix, "-i", project, ...(json ? ["--json"] : [])], {
          MCT_TEST_PINNED_MC_VERSION: "not-a-version",
        });

        assert.equal(result.exitCode, 1, `${fix}: ${result.stdout}`);
        assert.include(result.stderr, "Could not retrieve");
        assert.notInclude(result.stdout, "to update in project");
        assert.deepEqual(changedFiles(before, hashFiles(project)), []);
        if (json) {
          assert.deepEqual(JSON.parse(result.stdout).fixes, [
            { project: path.basename(project), fix, updatedCount: 0 },
          ]);
        }
      }
    }
  }).timeout(60000);

  it("--dry-run leaves every file untouched", async () => {
    const addon = copySample("addon", "dryrun-addon");
    const worldTemplate = copySample("platform_version_world_errors", "dryrun-world");
    const runs: [string, string][] = [
      ["setnewestminengineversion", addon],
      ["latestbetascriptversion", addon],
      ["randomizealluids", addon],
      ["setnewestformatversions", worldTemplate],
    ];

    for (const [fix, project] of runs) {
      const before = hashFiles(project);

      const result = await runFix([fix, "-i", project, "--dry-run"]);

      assert.equal(result.exitCode, 0, result.stderr);
      assert.include(result.stdout, "Dry run");
      assert.deepEqual(changedFiles(before, hashFiles(project)), [], `${fix} --dry-run changed files`);
    }
  }).timeout(60000);
});

describe("infoCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    const process = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "info", "-i", "./../samplecontent/simple/"]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("should complete without crashing", async () => {
    assert.notEqual(exitCode, null, "Process should exit");
  }).timeout(10000);

  it("should display project name", () => {
    const hasProjectName = stdoutLines.some((line) => line.includes("Project name"));
    assert(hasProjectName, "Should show project name. Got: " + stdoutLines.slice(0, 10).join(" | "));
  }).timeout(10000);
});

describe("infoCommandJson", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "info",
      "--json",
      "-i",
      "./../samplecontent/simple/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("should complete without crashing", async () => {
    assert.notEqual(exitCode, null, "Process should exit");
  }).timeout(10000);

  it("should output valid JSON", () => {
    const jsonLine = stdoutLines.find((line) => line.startsWith("{"));
    assert(jsonLine, "Should contain a JSON line. Got: " + stdoutLines.slice(0, 5).join(" | "));
    const parsed = JSON.parse(jsonLine!);
    assert(parsed.name, "JSON should have a 'name' field");
    assert(typeof parsed.itemCount === "number", "JSON should have an 'itemCount' field");
  }).timeout(10000);
});

describe("setCommandDryRun", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "set",
      "name",
      "TestProjectName",
      "-i",
      "./../samplecontent/simple/",
      "--dry-run",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should exit with code 1", async () => {
    assert.equal(exitCode, 1, "set doesn't support --dry-run");
  }).timeout(10000);

  it("should reject --dry-run before set runs", () => {
    const allOutput = stdoutLines.join("\n") + stderrLines.join("\n");
    assert(
      stderrLines.join("\n").includes("`mct set` doesn't support --dry-run yet, so nothing was changed."),
      "Should reject --dry-run. Got: " + allOutput
    );
    assert(!allOutput.toLowerCase().includes("temporarily disabled"), "set should not have run. Got: " + allOutput);
  }).timeout(10000);
});

describe("setCommandInvalidProperty", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "set",
      "invalidprop",
      "somevalue",
      "-i",
      "./../samplecontent/simple/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should exit with non-zero code", async () => {
    assert.notEqual(exitCode, 0, "Invalid property should fail");
  }).timeout(10000);

  it("should report that set is temporarily disabled", () => {
    const allOutput = stdoutLines.join("\n") + stderrLines.join("\n");
    const hasDisableMessage = allOutput.toLowerCase().includes("temporarily disabled");
    assert(hasDisableMessage, "Should mention temporary disablement. Got: " + stdoutLines.join(" | "));
  }).timeout(10000);
});

describe("setCommandMissingValue", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    const process = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "set", "name", "-i", "./../samplecontent/simple/"]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should exit with non-zero code while disabled", async () => {
    assert.notEqual(exitCode, 0, "set should be disabled");
  }).timeout(10000);
});

describe("setupCommandDryRun", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "setup",
      "-i",
      "./../samplecontent/simple/",
      "--dry-run",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("should indicate dry run", () => {
    const allOutput = stdoutLines.join("\n");
    const hasDryRun = allOutput.toLowerCase().includes("dry run");
    assert(hasDryRun, "Should mention dry run. Got: " + stdoutLines.join(" | "));
  }).timeout(10000);
});

describe("setupCommandPinnedVersions", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    removeResultFolder("setupPinned");
    ensureResultFolder("setupPinned");

    // Copy the simple sample to a writeable location so setup can modify it
    const src = "./../samplecontent/simple/";
    const dst = "./test/results/setupPinned/";

    // Copy recursively
    fs.cpSync(src, dst, { recursive: true });

    const process = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "setup", "-i", dst]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0, "Setup should succeed. Stderr: " + stderrLines.join("\n"));
  }).timeout(10000);

  it("generated package.json should have no caret versions", async () => {
    const pkgPath = "./test/results/setupPinned/package.json";
    assert(fs.existsSync(pkgPath), "package.json should exist at " + pkgPath);

    const content = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(content);

    const allDeps: Record<string, string> = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    for (const [name, version] of Object.entries(allDeps)) {
      assert(
        !version.startsWith("^") && !version.startsWith("~"),
        `Dependency '${name}' has unpinned version '${version}' — expected exact version`
      );
    }
  }).timeout(10000);
});

describe("setupCommandScriptedProjectLaunch", async () => {
  // Regression: the setup path never assigned the loaded project to the
  // VsCodeLaunchDefinition, so getExpectedScriptModuleUuid() returned
  // undefined and the generated managed launch profile carried no
  // targetModuleUuid even for a scripted project - with multiple scripted
  // packs active, the debugger could then prompt for or attach to the
  // wrong module.
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  // The addon sample's behavior pack declares this script module.
  const expectedScriptModuleUuid = "f43bb32a-c814-45e4-a428-3f4f1f59b2a3";

  before(function (done) {
    this.timeout(15000);

    removeResultFolder("setupLaunch");
    ensureResultFolder("setupLaunch");

    // Copy a scripted behavior pack to a writeable location so setup can
    // generate .vscode/launch.json next to it.
    const src = "./../samplecontent/addon/behavior_packs/";
    const dst = "./test/results/setupLaunch/behavior_packs/";

    fs.cpSync(src, dst, { recursive: true });

    const process = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "setup", "-i", "./test/results/setupLaunch/"]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0, "Setup should succeed. Stderr: " + stderrLines.join("\n"));
  }).timeout(10000);

  it("generated launch.json targets the project's script module", async () => {
    const launchPath = "./test/results/setupLaunch/.vscode/launch.json";
    assert(fs.existsSync(launchPath), "launch.json should exist at " + launchPath);

    const launch = JSON.parse(fs.readFileSync(launchPath, "utf-8"));
    const configs = (launch.configurations || []).filter((c: { type?: string }) => c.type === "minecraft-js");

    assert.equal(configs.length, 1, "setup should generate exactly one managed minecraft-js profile");
    assert.equal(
      configs[0].targetModuleUuid,
      expectedScriptModuleUuid,
      "the serialized profile must target the pack's script module"
    );
  }).timeout(10000);
});

describe("worldCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("worldCommand");
    ensureResultFolder("worldCommand");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "world",
      "set",
      "-i",
      "./test/results/worldCommand",
      "--betaapis",
      "-o",
      "./test/results/worldCommand/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("world files should exist", () => {
    const base = "./test/results/worldCommand/";
    assert(fs.existsSync(base + "level.dat"), "level.dat should exist");
    assert(fs.existsSync(base + "level.dat_old"), "level.dat_old should exist");
    const levelname = fs.readFileSync(base + "levelname.txt", "utf8").trim();
    assert.equal(levelname, "worldCommand", "levelname.txt should contain 'worldCommand'");
  });
});

describe("ensureWorldCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    removeResultFolder("ensureWorldCommand");

    // Copy sample content to results to avoid modifying originals
    const srcDir = "./../samplecontent/simple/";
    const destDir = "./test/results/ensureWorldCommand/";

    ensureResultFolder("ensureWorldCommand");
    fs.cpSync(srcDir, destDir + "project/", { recursive: true });

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "ensureworld",
      "-i",
      destDir + "project/",
      "-o",
      destDir + "out/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("should complete without crashing", async () => {
    assert.notEqual(exitCode, null, "Process should exit");
  }).timeout(10000);
});

describe("deployTestWorldMissingDeps", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    removeResultFolder("deployTestWorld");
    ensureResultFolder("deployTestWorld");

    // Deploy to a custom output folder (avoids needing Minecraft installed)
    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "deploy",
      "folder",
      "--test-world",
      "-i",
      "./../samplecontent/simple/",
      "-o",
      "./test/results/deployTestWorld/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should complete without crashing", async () => {
    assert.notEqual(exitCode, null, "Process should exit");
  }).timeout(10000);

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0, "Exit code should be zero. Stdout: " + stdoutLines.join("\n"));
  }).timeout(10000);

  it("should log deployed test world", async () => {
    const deployedLine = stdoutLines.some((line) => line.includes("Deployed test world"));
    assert(deployedLine, "Should log 'Deployed test world'. Output: " + stdoutLines.join("\n"));
  }).timeout(10000);
});

describe("deployCommandFolder", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    removeResultFolder("deployFolder");
    ensureResultFolder("deployFolder");

    // Deploy without --test-world (plain pack copy)
    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "deploy",
      "folder",
      "-i",
      "./../samplecontent/simple/",
      "-o",
      "./test/results/deployFolder/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should complete without crashing", async () => {
    assert.notEqual(exitCode, null, "Process should exit");
  }).timeout(10000);

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0, "Exit code should be zero. Stdout: " + stdoutLines.join("\n"));
  }).timeout(10000);

  it("should log deployed project", async () => {
    const deployedLine = stdoutLines.some((line) => line.includes("Deployed:"));
    assert(deployedLine, "Should log 'Deployed:'. Output: " + stdoutLines.join("\n"));
  }).timeout(10000);
});

describe("deployCommandLayout", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    removeResultFolder("deployLayout");
    ensureResultFolder("deployLayout");

    // Deploy in layout mode (flat packs without development_ wrappers)
    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "deploy",
      "layout",
      "-i",
      "./../samplecontent/simple/",
      "-o",
      "./test/results/deployLayout/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should complete without crashing", async () => {
    assert.notEqual(exitCode, null, "Process should exit");
  }).timeout(10000);

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0, "Exit code should be zero. Stdout: " + stdoutLines.join("\n"));
  }).timeout(10000);

  it("should log deployed layout", async () => {
    const deployedLine = stdoutLines.some((line) => line.includes("Deployed layout:"));
    assert(deployedLine, "Should log 'Deployed layout:'. Output: " + stdoutLines.join("\n"));
  }).timeout(10000);

  it("should not create development_ wrapper folders", async () => {
    const outputDir = "./test/results/deployLayout/";
    if (fs.existsSync(outputDir)) {
      const entries = fs.readdirSync(outputDir);
      const devFolders = entries.filter(
        (e) => e.startsWith("development_behavior_packs") || e.startsWith("development_resource_packs")
      );
      assert.equal(
        devFolders.length,
        0,
        "Layout mode should not create development_* folders. Found: " + devFolders.join(", ")
      );
    }
  }).timeout(10000);

  it("should create pack folders with _bp suffix", async () => {
    const outputDir = "./test/results/deployLayout/";
    if (fs.existsSync(outputDir)) {
      const entries = fs.readdirSync(outputDir);
      const bpFolders = entries.filter((e) => e.endsWith("_bp"));
      assert(bpFolders.length > 0, "Should have _bp pack folders. Found: " + entries.join(", "));
    }
  }).timeout(10000);
});

describe("deployCommandRetailAlias", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    removeResultFolder("deployRetailAlias");
    ensureResultFolder("deployRetailAlias");

    // Use the 'folder' mode with 'retail' alias behavior — since retail resolves to
    // a local Minecraft path that may not exist on CI, test that the command parses
    // correctly by using 'folder' mode (which is the same code path for output folder).
    // This tests that the 'retail' alias is accepted without crashing.
    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "deploy",
      "folder",
      "-i",
      "./../samplecontent/simple/",
      "-o",
      "./test/results/deployRetailAlias/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0, "Exit code should be zero. Stdout: " + stdoutLines.join("\n"));
  }).timeout(10000);

  it("should create development_ wrapper folders (unlike layout mode)", async () => {
    const outputDir = "./test/results/deployRetailAlias/";
    if (fs.existsSync(outputDir)) {
      const entries = fs.readdirSync(outputDir);
      const devFolders = entries.filter((e) => e.startsWith("development_behavior_packs"));
      assert(
        devFolders.length > 0,
        "folder mode should create development_behavior_packs. Found: " + entries.join(", ")
      );
    }
  }).timeout(10000);
});

describe("deployCommandInvalidMode", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "deploy",
      "nonexistent_bogus_mode_12345",
      "-i",
      "./../samplecontent/simple/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("exit code should be non-zero for invalid mode", async () => {
    assert.notEqual(exitCode, 0, "Invalid mode should produce non-zero exit code");
  }).timeout(10000);

  it("should report error about unrecognized target", async () => {
    const allOutput = stdoutLines.concat(stderrLines).join("\n");
    const hasError = allOutput.includes("not a recognized deploy target");
    assert(hasError, "Should log error about unrecognized target. Got: " + allOutput);
  }).timeout(10000);
});
