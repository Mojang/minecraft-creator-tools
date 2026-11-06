/**
 * ManifestHeaderSyncTest - Checks that a project's title, description, and script entry point are copied
 * into its default pack manifests in every edit mode, so content made by `mct create`, the MCP server, and
 * the web UI's non-simplified modes gets them too. Projects live in in-memory (ZipStorage) folders.
 *
 * Covers:
 *   - ProjectUtilities.applyTitle / applyDescription update the default behavior and resource pack manifest
 *     headers in every edit mode, leave other packs alone, and keep creators' comments, including comments
 *     that only appear inside nested objects.
 *   - package.json is only touched in simplified (summarized) mode.
 *   - ProjectUtilities.applyScriptEntryPoint updates an existing script module in every mode, and only adds
 *     one in simplified mode.
 *   - Edits made straight to the file's text (as Raw Mode does) aren't overwritten by older loaded state, and
 *     text that doesn't parse, or parses without a header UUID or module list, is left alone.
 *   - Overlapping apply calls (as the property editor makes while typing) leave the newest value in every file.
 *   - randomizeAllUids and processNewProject write the new UUIDs and keep creators' comments; processNewProject
 *     also writes the title and description into the default pack manifests.
 */

import { assert } from "chai";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import ProjectUtilities from "../app/ProjectUtilities";
import { ProjectEditPreference } from "../app/IProjectData";
import BehaviorManifestDefinition from "../minecraft/BehaviorManifestDefinition";
import { GeneratedWithTools } from "../minecraft/ManifestGeneratedWith";
import ZipStorage from "../storage/ZipStorage";
import IFile from "../storage/IFile";
import TestPaths, { ITestEnvironment } from "./TestPaths";

let env: ITestEnvironment | undefined;

(async () => {
  env = await TestPaths.createTestEnvironment();
})();

const defaultBpUuid = "5c1f0d2e-7a8b-4c3d-9e1f-2a3b4c5d6e01";
const otherBpUuid = "5c1f0d2e-7a8b-4c3d-9e1f-2a3b4c5d6e02";
const defaultRpUuid = "5c1f0d2e-7a8b-4c3d-9e1f-2a3b4c5d6e03";

const rootComment = "// creator comment that must survive edits";
const nestedComment = "// nested creator comment that must survive edits";

function behaviorManifestText(uuid: string, options?: { withScriptModule?: boolean; nestedCommentOnly?: boolean }) {
  const scriptModule =
    options?.withScriptModule !== false
      ? `,
    { "type": "script", "language": "javascript", "uuid": "${uuid.slice(0, -2)}aa", "version": [1, 0, 0], "entry": "scripts/main.js" }`
      : "";

  return `{
  ${options?.nestedCommentOnly ? "" : rootComment}
  "format_version": 2,
  "header": {
    ${options?.nestedCommentOnly ? nestedComment : ""}
    "name": "Original BP",
    "description": "Original BP description",
    "uuid": "${uuid}",
    "version": [1, 0, 0],
    "min_engine_version": [1, 21, 0]
  },
  "modules": [
    { "type": "data", "uuid": "${uuid.slice(0, -2)}bb", "version": [1, 0, 0] }${scriptModule}
  ]
}`;
}

const resourceManifestText = `{
  "format_version": 2,
  "header": {
    ${nestedComment}
    "name": "Original RP",
    "description": "Original RP description",
    "uuid": "${defaultRpUuid}",
    "version": [1, 0, 0],
    "min_engine_version": [1, 21, 0]
  },
  "modules": [{ "type": "resources", "uuid": "5c1f0d2e-7a8b-4c3d-9e1f-2a3b4c5d6ecc", "version": [1, 0, 0] }]
}`;

const packageJsonText = JSON.stringify({ name: "original-package", description: "Original package description" });

interface ITestProject {
  project: Project;
  bpManifest: IFile;
  otherBpManifest?: IFile;
  rpManifest: IFile;
  packageJson?: IFile;
}

interface ITestProjectOptions {
  withScriptModule?: boolean;
  nestedCommentOnly?: boolean;
  newProject?: boolean;
  otherBpNestedCommentOnly?: boolean;
}

async function createTestProject(editPreference: ProjectEditPreference, options?: ITestProjectOptions) {
  assert(env, "Test environment should be initialized");

  const storage = new ZipStorage();

  const write = async (relativePath: string, content: string) => {
    const file = await storage.rootFolder.ensureFileFromRelativePath(relativePath);
    file.setContent(content);
    await file.saveContent();
    return file;
  };

  const bpManifest = await write(
    "/behavior_packs/default_bp/manifest.json",
    behaviorManifestText(defaultBpUuid, options)
  );
  const rpManifest = await write("/resource_packs/default_rp/manifest.json", resourceManifestText);
  const otherBpManifest = options?.newProject
    ? undefined
    : await write(
        "/behavior_packs/other_bp/manifest.json",
        behaviorManifestText(otherBpUuid, { nestedCommentOnly: options?.otherBpNestedCommentOnly })
      );
  const packageJson = options?.newProject ? undefined : await write("/package.json", packageJsonText);

  const project = new Project(env.creatorTools, "manifest-header-sync", null);
  project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
  project.setProjectFolder(storage.rootFolder);
  project.editPreference = editPreference;

  if (!options?.newProject) {
    await project.inferProjectItemsFromFiles();

    // inference picks whichever behavior pack it scans last; pin the default so "other_bp" is a bystander
    project.defaultBehaviorPackUniqueId = defaultBpUuid;
    project.defaultResourcePackUniqueId = defaultRpUuid;
  }

  const result: ITestProject = { project, bpManifest, otherBpManifest, rpManifest, packageJson };
  return result;
}

function readJson(file: IFile | undefined) {
  assert(file, "Expected a file");
  const text = file.content as string;
  return { text, json: JSON.parse(text.replace(/^\s*\/\/.*$/gm, "")) };
}

/**
 * Makes the first loadFileContent call on the project item for `file` wait until the returned function is
 * called, so a test can hold one sync mid-flight while others start.
 */
function holdFirstLoad(project: Project, file: IFile) {
  const item = project.getItemsCopy().find((pi) => pi.primaryFile === file);
  assert(item, "Expected a project item for " + file.fullPath);

  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  const loadFileContent = item.loadFileContent.bind(item);
  let held = false;

  item.loadFileContent = async () => {
    if (!held) {
      held = true;
      await gate;
    }

    return loadFileContent();
  };

  return release;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const editPreferences: { name: string; value: ProjectEditPreference }[] = [
  { name: "default", value: ProjectEditPreference.default },
  { name: "summarized", value: ProjectEditPreference.summarized },
  { name: "editors", value: ProjectEditPreference.editors },
  { name: "raw", value: ProjectEditPreference.raw },
];

describe("ProjectUtilities manifest header sync", function () {
  this.timeout(30000);

  const headerCases: {
    name: string;
    apply: (project: Project, value: string) => Promise<void>;
    headerField: "name" | "description";
    packageField: "name" | "description";
    originalPackageValue: string;
  }[] = [
    {
      name: "applyTitle",
      apply: ProjectUtilities.applyTitle,
      headerField: "name",
      packageField: "name",
      originalPackageValue: "original-package",
    },
    {
      name: "applyDescription",
      apply: ProjectUtilities.applyDescription,
      headerField: "description",
      packageField: "description",
      originalPackageValue: "Original package description",
    },
  ];

  for (const headerCase of headerCases) {
    for (const editPreference of editPreferences) {
      it(`${headerCase.name} updates default pack manifests in ${editPreference.name} edit mode`, async () => {
        const test = await createTestProject(editPreference.value);
        const newValue = `New ${headerCase.headerField} (${editPreference.name})`;

        await headerCase.apply(test.project, newValue);

        const bp = readJson(test.bpManifest);
        assert.equal(bp.json.header[headerCase.headerField], newValue);
        assert.include(bp.text, rootComment);

        assert.equal(readJson(test.rpManifest).json.header[headerCase.headerField], newValue);

        const otherBp = readJson(test.otherBpManifest);
        assert.equal(otherBp.json.header.name, "Original BP");
        assert.equal(otherBp.json.header.description, "Original BP description");

        const expectedPackageValue =
          editPreference.value === ProjectEditPreference.summarized ? newValue : headerCase.originalPackageValue;
        assert.equal(readJson(test.packageJson).json[headerCase.packageField], expectedPackageValue);
      });
    }
  }

  for (const editPreference of editPreferences) {
    it(`applyScriptEntryPoint updates an existing script module in ${editPreference.name} edit mode`, async () => {
      const test = await createTestProject(editPreference.value);

      await ProjectUtilities.applyScriptEntryPoint(test.project, "scripts/newMain.js");

      const scriptModules = readJson(test.bpManifest).json.modules.filter((m: any) => m.type === "script");
      assert.lengthOf(scriptModules, 1);
      assert.equal(scriptModules[0].entry, "scripts/newMain.js");

      const otherScript = readJson(test.otherBpManifest).json.modules.find((m: any) => m.type === "script");
      assert.equal(otherScript.entry, "scripts/main.js");
    });

    const addsModule = editPreference.value === ProjectEditPreference.summarized;

    it(`applyScriptEntryPoint ${addsModule ? "adds" : "doesn't add"} a script module in ${
      editPreference.name
    } edit mode`, async () => {
      const test = await createTestProject(editPreference.value, { withScriptModule: false });
      const before = test.bpManifest.content;

      await ProjectUtilities.applyScriptEntryPoint(test.project, "scripts/newMain.js");

      const scriptModules = readJson(test.bpManifest).json.modules.filter((m: any) => m.type === "script");

      if (addsModule) {
        assert.lengthOf(scriptModules, 1);
        assert.equal(scriptModules[0].entry, "scripts/newMain.js");
      } else {
        assert.lengthOf(scriptModules, 0);
        assert.equal(test.bpManifest.content, before, "manifest shouldn't be rewritten");
      }
    });
  }

  it("doesn't rewrite a manifest whose header already matches", async () => {
    const test = await createTestProject(ProjectEditPreference.editors);
    const before = test.bpManifest.content;

    await ProjectUtilities.applyTitle(test.project, "Original BP");

    assert.equal(test.bpManifest.content, before);
  });

  const editCases: { name: string; apply: (project: Project) => Promise<void>; check: (json: any) => void }[] = [
    {
      name: "applyTitle",
      apply: (project) => ProjectUtilities.applyTitle(project, "Raw Title"),
      check: (json) => assert.equal(json.header.name, "Raw Title"),
    },
    {
      name: "applyDescription",
      apply: (project) => ProjectUtilities.applyDescription(project, "Raw description"),
      check: (json) => assert.equal(json.header.description, "Raw description"),
    },
    {
      name: "applyScriptEntryPoint",
      apply: (project) => ProjectUtilities.applyScriptEntryPoint(project, "scripts/rawMain.js"),
      check: (json) => assert.equal(json.modules.find((m: any) => m.type === "script").entry, "scripts/rawMain.js"),
    },
  ];

  for (const editCase of editCases) {
    it(`${editCase.name} keeps a comment that only appears inside a nested object`, async () => {
      const test = await createTestProject(ProjectEditPreference.editors, { nestedCommentOnly: true });

      await editCase.apply(test.project);

      const bp = readJson(test.bpManifest);
      editCase.check(bp.json);
      assert.include(bp.text, nestedComment);
    });

    it(`${editCase.name} keeps edits made to the file's text after the manifest was loaded`, async () => {
      const test = await createTestProject(ProjectEditPreference.raw);

      // load the manifest manager, then change the file's text directly, as Raw Mode does
      await BehaviorManifestDefinition.ensureOnFile(test.bpManifest);
      const rawEdited = behaviorManifestText(defaultBpUuid).replace(
        '"format_version": 2,',
        '"format_version": 2,\n  "raw_edit_marker": "kept",'
      );
      test.bpManifest.setContent(rawEdited);

      await editCase.apply(test.project);

      const bp = readJson(test.bpManifest);
      editCase.check(bp.json);
      assert.equal(bp.json.raw_edit_marker, "kept");
      assert.include(bp.text, rootComment);
    });

    it(`${editCase.name} leaves text that doesn't parse alone`, async () => {
      const test = await createTestProject(ProjectEditPreference.raw);

      await BehaviorManifestDefinition.ensureOnFile(test.bpManifest);
      const invalidText = behaviorManifestText(defaultBpUuid).replace('"format_version": 2,', '"format_version": ');
      test.bpManifest.setContent(invalidText);

      await editCase.apply(test.project);

      assert.equal(test.bpManifest.content, invalidText);
    });
  }

  const incompleteManifests: { name: string; text: string }[] = [
    { name: "has no header", text: `{ "format_version": 2, "modules": [] }` },
    { name: "has a header with no UUID", text: `{ "format_version": 2, "header": { "name": "No UUID" } }` },
    { name: "has a number for its header UUID", text: `{ "format_version": 2, "header": { "uuid": 5 } }` },
    { name: "is an array", text: `[]` },
  ];

  for (const incomplete of incompleteManifests) {
    for (const editCase of editCases) {
      it(`${editCase.name} leaves a manifest that ${incomplete.name} alone`, async () => {
        const test = await createTestProject(ProjectEditPreference.editors);

        await BehaviorManifestDefinition.ensureOnFile(test.bpManifest);
        test.bpManifest.setContent(incomplete.text);

        await editCase.apply(test.project);

        assert.equal(test.bpManifest.content, incomplete.text);
      });
    }
  }

  const moduleListCases: { name: string; modules?: string; editPreference: ProjectEditPreference; adds: boolean }[] = [
    { name: "a missing module list in editors", editPreference: ProjectEditPreference.editors, adds: false },
    { name: "a missing module list in raw", editPreference: ProjectEditPreference.raw, adds: false },
    { name: "a missing module list in summarized", editPreference: ProjectEditPreference.summarized, adds: true },
    {
      name: "a module list that isn't an array in editors",
      modules: `{ "type": "script" }`,
      editPreference: ProjectEditPreference.editors,
      adds: false,
    },
    {
      name: "a module list that isn't an array in summarized",
      modules: `{ "type": "script" }`,
      editPreference: ProjectEditPreference.summarized,
      adds: false,
    },
  ];

  for (const moduleListCase of moduleListCases) {
    it(`applyScriptEntryPoint ${moduleListCase.adds ? "adds a script module to" : "leaves"} ${
      moduleListCase.name
    } edit mode`, async () => {
      const test = await createTestProject(moduleListCase.editPreference);
      const modules = moduleListCase.modules ? `,\n  "modules": ${moduleListCase.modules}` : "";
      const text = `{\n  "format_version": 2,\n  "header": { "name": "BP", "uuid": "${defaultBpUuid}" }${modules}\n}`;

      await BehaviorManifestDefinition.ensureOnFile(test.bpManifest);
      test.bpManifest.setContent(text);

      await ProjectUtilities.applyScriptEntryPoint(test.project, "scripts/newMain.js");

      if (moduleListCase.adds) {
        const scriptModules = readJson(test.bpManifest).json.modules.filter((m: any) => m.type === "script");
        assert.lengthOf(scriptModules, 1);
        assert.equal(scriptModules[0].entry, "scripts/newMain.js");
      } else {
        assert.equal(test.bpManifest.content, text);
      }
    });
  }

  for (const editPreference of [ProjectEditPreference.editors, ProjectEditPreference.summarized]) {
    const modeName = editPreferences.find((p) => p.value === editPreference)?.name;

    it(`overlapping applyTitle calls leave the newest title everywhere in ${modeName} edit mode`, async () => {
      const test = await createTestProject(editPreference);
      const release = holdFirstLoad(test.project, test.bpManifest);

      const older = ProjectUtilities.applyTitle(test.project, "Older Title");
      const newer = ProjectUtilities.applyTitle(test.project, "Newer Title");

      // the newer call gets every chance to finish while the older one is held
      await settle();
      release();
      await Promise.all([older, newer]);

      assert.equal(test.project.title, "Newer Title");
      assert.equal(readJson(test.bpManifest).json.header.name, "Newer Title");
      assert.equal(readJson(test.rpManifest).json.header.name, "Newer Title");

      const expectedPackageName =
        editPreference === ProjectEditPreference.summarized ? "Newer Title" : "original-package";
      assert.equal(readJson(test.packageJson).json.name, expectedPackageName);
    });
  }

  it("overlapping applyTitle and applyDescription calls keep both values", async () => {
    const test = await createTestProject(ProjectEditPreference.editors);
    const release = holdFirstLoad(test.project, test.bpManifest);

    const title = ProjectUtilities.applyTitle(test.project, "Overlapping Title");
    const description = ProjectUtilities.applyDescription(test.project, "Overlapping description");

    await settle();
    release();
    await Promise.all([title, description]);

    for (const file of [test.bpManifest, test.rpManifest]) {
      const header = readJson(file).json.header;
      assert.equal(header.name, "Overlapping Title");
      assert.equal(header.description, "Overlapping description");
    }
  });

  it("randomizeAllUids saves new UUIDs and keeps comments in every pack manifest", async () => {
    const test = await createTestProject(ProjectEditPreference.editors, { otherBpNestedCommentOnly: true });

    await ProjectUtilities.randomizeAllUids(test.project);

    const bp = readJson(test.bpManifest);
    const otherBp = readJson(test.otherBpManifest);
    const rp = readJson(test.rpManifest);

    assert.notEqual(bp.json.header.uuid, defaultBpUuid);
    assert.notEqual(otherBp.json.header.uuid, otherBpUuid);
    assert.notEqual(rp.json.header.uuid, defaultRpUuid);
    assert.notEqual(bp.json.header.uuid, otherBp.json.header.uuid);

    assert.include(bp.text, rootComment);
    assert.include(otherBp.text, nestedComment, "a comment only inside a nested object should survive");
    assert.include(rp.text, nestedComment, "a comment only inside a nested object should survive");
  });

  for (const editPreference of editPreferences) {
    it(`processNewProject writes title and description into the new pack manifests in ${editPreference.name} edit mode`, async () => {
      const test = await createTestProject(editPreference.value, { newProject: true });

      await ProjectUtilities.processNewProject(
        test.project,
        "Fresh Title",
        "Fresh description",
        undefined,
        GeneratedWithTools.cli
      );

      const bp = readJson(test.bpManifest).json;
      const rp = readJson(test.rpManifest).json;

      assert.include(test.bpManifest.content as string, rootComment);
      assert.include(test.rpManifest.content as string, nestedComment);

      assert.equal(bp.header.name, "Fresh Title");
      assert.equal(bp.header.description, "Fresh description");
      assert.equal(rp.header.name, "Fresh Title");
      assert.equal(rp.header.description, "Fresh description");

      // UUIDs are randomized for new projects; the manifests must keep the new ones
      assert.notEqual(bp.header.uuid, defaultBpUuid);
      assert.notEqual(rp.header.uuid, defaultRpUuid);
      assert.equal(bp.header.uuid, test.project.defaultBehaviorPackUniqueId);
      assert.equal(rp.header.uuid, test.project.defaultResourcePackUniqueId);
      assert.notInclude(
        bp.modules.map((m: any) => m.uuid),
        defaultBpUuid.slice(0, -2) + "bb",
        "module UUIDs should be randomized too"
      );
    });
  }
});
