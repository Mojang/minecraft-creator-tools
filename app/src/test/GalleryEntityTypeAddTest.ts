// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Regression tests for the mob templates on the "From a Mob" gallery tab (public issue #80).
 *
 * A mob template copies the vanilla behavior and resource files listed in gallery.json into the
 * project and renames the mob throughout. The copy is only useful if the renamed client entity still
 * resolves everything it refers to: every geometry, texture, render controller and animation it names
 * must exist in the project (or stay a vanilla reference that the game resolves itself), and the
 * material names must survive untouched because they refer to the game's material definitions, not
 * to the mob. A mob that fails any of these renders invisible in game with content log errors.
 *
 * Historical symptoms, all from untouched cow and creeper templates:
 * - Material "<name>_cold" not defined: fixed earlier by MATERIAL_NAMES_TO_FIXUP in ProjectCreateManager.
 * - Material "<name>" not defined (the "default" material was renamed with the mob): fixed here by
 *   restoring the client entity's materials from the source file after renaming.
 * - "child 'animation_controllers' not valid here": the vanilla creeper carries the pre-1.10.0
 *   animation_controllers list next to its animations map. Fixed here by folding it into the map.
 * - Cow geometry not found: the cow client entity moved to controller.render.cow.v3 and a baby
 *   geometry, while the gallery still listed the v2 render controller. Fixed here in gallery.json.
 */

import { assert, expect } from "chai";
import * as fs from "fs";
import CreatorTools from "../app/CreatorTools";
import CreatorToolsHost from "../app/CreatorToolsHost";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import IFolder from "../storage/IFolder";
import IFile from "../storage/IFile";
import StorageUtilities from "../storage/StorageUtilities";
import TestPaths, { ITestEnvironment } from "./TestPaths";
import IGalleryItem, { GalleryItemType } from "../app/IGalleryItem";
import ProjectCreateManager from "../app/ProjectCreateManager";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";

let creatorTools: CreatorTools | undefined = undefined;
let resultsFolder: IFolder | undefined = undefined;

const RESULT_FOLDER_NAME = "galleryEntityTypeAdd";

const vanillaResourcePackPath = TestPaths.publicRoot + "res/latest/van/release/resource_pack/";

(async () => {
  const env: ITestEnvironment = await TestPaths.createTestEnvironment();
  creatorTools = env.creatorTools;
  resultsFolder = env.resultsFolder;
})();

function must<T>(value: T | undefined | null, message: string): T {
  if (value === undefined || value === null) {
    assert.fail(message);
  }

  return value;
}

async function getGalleryItem(id: string): Promise<IGalleryItem> {
  // Load through CreatorTools so the <BPE>/<RPE> path tokens in gallery.json are expanded as in the app.
  const item = await must(creatorTools, "creatorTools").getGalleryProjectById(id);

  return must(item, `gallery.json should list '${id}'`);
}

function removeResultFolder(folderName: string) {
  if (resultsFolder) {
    const path =
      StorageUtilities.ensureEndsWithDelimiter(resultsFolder.fullPath) +
      StorageUtilities.ensureEndsWithDelimiter(folderName);

    if (fs.existsSync(path) && !StorageUtilities.isPathRiskyForDelete(path)) {
      fs.rmSync(path, { recursive: true });
    }
  }
}

async function createEmptyProject(folderName: string) {
  if (!creatorTools || !resultsFolder) {
    assert.fail("Not properly initialized");
  }

  removeResultFolder(folderName);

  const projectFolder = resultsFolder.ensureFolder(folderName);
  await projectFolder.ensureExists();

  const project = new Project(creatorTools, folderName, null);

  project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
  project.localFolderPath = StorageUtilities.ensureEndsWithDelimiter(projectFolder.fullPath);

  await project.ensureProjectFolder();
  await project.ensureDefaultBehaviorPackFolder();
  await project.ensureDefaultResourcePackFolder();

  return project;
}

async function readJson(folder: IFolder, relativePath: string) {
  const file = must(await folder.getFileFromRelativePath(relativePath), `Expected '${relativePath}'`);

  if (!file.isContentLoaded) {
    await file.loadContent();
  }

  return must(StorageUtilities.getJsonObject(file), `Expected '${relativePath}' to be JSON`);
}

function readVanillaJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(vanillaResourcePackPath + relativePath, "utf8"));
}

async function collectFiles(folder: IFolder, extension: string, into: IFile[] = []) {
  await folder.load();

  for (const fileName in folder.files) {
    const file = folder.files[fileName];

    if (file && fileName.toLowerCase().endsWith(extension)) {
      into.push(file);
    }
  }

  for (const folderName in folder.folders) {
    const childFolder = folder.folders[folderName];

    if (childFolder) {
      await collectFiles(childFolder, extension, into);
    }
  }

  return into;
}

/** The ids declared by every JSON file of a kind in a folder: geometry, render controller, or animation ids. */
async function collectDeclaredIds(folder: IFolder, subFolder: string, collect: (json: any, into: Set<string>) => void) {
  const ids = new Set<string>();
  const target = folder.folders[subFolder];

  if (!target) {
    return ids;
  }

  for (const file of await collectFiles(target, ".json")) {
    if (!file.isContentLoaded) {
      await file.loadContent();
    }

    const json = StorageUtilities.getJsonObject(file);

    if (json) {
      collect(json, ids);
    }
  }

  return ids;
}

function collectGeometryIds(json: any, into: Set<string>) {
  if (Array.isArray(json["minecraft:geometry"])) {
    for (const geometry of json["minecraft:geometry"]) {
      if (geometry?.description?.identifier) {
        into.add(String(geometry.description.identifier).toLowerCase());
      }
    }
  }

  for (const key in json) {
    if (key.startsWith("geometry.")) {
      into.add(key.toLowerCase());
    }
  }
}

function collectKeysOf(property: string) {
  return (json: any, into: Set<string>) => {
    if (json[property] && typeof json[property] === "object") {
      for (const key in json[property]) {
        into.add(key.toLowerCase());
      }
    }
  };
}

function vanillaIds(subFolder: string, collect: (json: any, into: Set<string>) => void) {
  const ids = new Set<string>();
  const root = vanillaResourcePackPath + subFolder;

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = dir + "/" + entry.name;

      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (entry.name.endsWith(".json") && entry.name !== "index.json") {
        try {
          collect(JSON.parse(fs.readFileSync(entryPath, "utf8")), ids);
        } catch (e) {
          // Vanilla files that do not parse are not what the templates reference.
        }
      }
    }
  };

  walk(root);

  return ids;
}

interface IAddedMob {
  project: Project;
  name: string;
  bpFolder: IFolder;
  rpFolder: IFolder;
  behavior: any;
  client: any;
  description: any;
  sourceDescription: any;
}

async function addMob(galleryId: string, name: string): Promise<IAddedMob> {
  const project = await createEmptyProject(RESULT_FOLDER_NAME + "_" + name);
  const galleryItem = await getGalleryItem(galleryId);

  expect(galleryItem.type).to.equal(GalleryItemType.entityType);

  const canLoad = await ProjectCreateManager.canLoadGalleryTemplateFiles(galleryItem);
  expect(canLoad, `the '${galleryId}' template files should load from the local vanilla packs`).to.equal(true);

  await ProjectCreateManager.addEntityTypeFromGallery(project, galleryItem, name);

  const bpFolder = must(await project.ensureDefaultBehaviorPackFolder(), "behavior pack");
  const rpFolder = must(await project.ensureDefaultResourcePackFolder(), "resource pack");

  const behavior = await readJson(bpFolder, "/entities/" + name + ".json");
  const client = await readJson(rpFolder, "/entity/" + name + ".entity.json");
  const description = must(client["minecraft:client_entity"]?.description, "client entity description");
  const sourceDescription = readVanillaJson("entity/" + galleryId + ".entity.json")["minecraft:client_entity"]
    .description;

  return { project, name, bpFolder, rpFolder, behavior, client, description, sourceDescription };
}

function expectNoDanglingReference(kind: string, id: string, declared: Set<string>, vanilla: Set<string>) {
  const idLower = id.toLowerCase();

  expect(
    declared.has(idLower) || vanilla.has(idLower),
    `${kind} '${id}' is referenced by the client entity but is defined neither in the project nor in vanilla`
  ).to.equal(true);
}

async function assertMobIsComplete(mob: IAddedMob, vanillaId: string) {
  const { project, name, bpFolder, rpFolder, behavior, description, sourceDescription } = mob;
  const expectedId = project.effectiveDefaultNamespace + ":" + name;

  // Behavior and client entity agree on the identity, and the mob keeps vanilla behavior.
  const behaviorDescription = must(behavior["minecraft:entity"]?.description, "behavior description");
  expect(behaviorDescription.identifier).to.equal(expectedId);
  expect(behaviorDescription.runtime_identifier).to.equal("minecraft:" + vanillaId);
  expect(description.identifier).to.equal(expectedId);

  // Spawn rules and loot tables follow the mob.
  const spawnRules = await readJson(bpFolder, "/spawn_rules/" + name + ".json");
  expect(spawnRules["minecraft:spawn_rules"]?.description?.identifier).to.equal(expectedId);

  const lootPaths: string[] = [];
  const collectLoot = (components: any) => {
    const table = components?.["minecraft:loot"]?.table;

    if (typeof table === "string") {
      lootPaths.push(table);
    }
  };

  collectLoot(behavior["minecraft:entity"]?.components);

  for (const groupId in behavior["minecraft:entity"]?.component_groups ?? {}) {
    collectLoot(behavior["minecraft:entity"].component_groups[groupId]);
  }

  expect(lootPaths, "the behavior should keep its loot table").to.not.be.empty;

  for (const lootPath of lootPaths) {
    expect(
      await bpFolder.getFileFromRelativePath("/" + lootPath),
      `loot table '${lootPath}' should be copied`
    ).to.not.equal(undefined);
  }

  // Material names refer to the game's material definitions, so renaming them breaks rendering.
  expect(description.materials).to.deep.equal(sourceDescription.materials);

  // Every geometry, texture, render controller and animation the client entity names resolves.
  const geometryIds = await collectDeclaredIds(rpFolder, "models", collectGeometryIds);
  const vanillaGeometryIds = vanillaIds("models", collectGeometryIds);

  for (const key in description.geometry) {
    const geometryId = description.geometry[key];

    expect(geometryId, `geometry '${key}' should be renamed with the mob`).to.include(name);
    expectNoDanglingReference("Geometry", geometryId, geometryIds, vanillaGeometryIds);
  }

  for (const key in description.textures) {
    const texturePath = description.textures[key];
    const textureFile = await rpFolder.getFileFromRelativePath("/" + texturePath + ".png");

    expect(textureFile, `texture '${texturePath}' should be copied into the project`).to.not.equal(undefined);
  }

  const renderControllerIds = await collectDeclaredIds(
    rpFolder,
    "render_controllers",
    collectKeysOf("render_controllers")
  );

  for (const renderController of description.render_controllers) {
    const ids = typeof renderController === "string" ? [renderController] : Object.keys(renderController);

    for (const id of ids) {
      expect(id, "render controllers should be renamed with the mob").to.include(name);
      expect(renderControllerIds.has(id.toLowerCase()), `render controller '${id}' should be copied`).to.equal(true);
    }
  }

  const animationIds = await collectDeclaredIds(rpFolder, "animations", collectKeysOf("animations"));
  const animationControllerIds = await collectDeclaredIds(
    rpFolder,
    "animation_controllers",
    collectKeysOf("animation_controllers")
  );
  const vanillaAnimationIds = vanillaIds("animations", collectKeysOf("animations"));
  const vanillaAnimationControllerIds = vanillaIds("animation_controllers", collectKeysOf("animation_controllers"));

  for (const key in description.animations) {
    const id = description.animations[key];

    if (id.startsWith("controller.")) {
      expectNoDanglingReference("Animation controller", id, animationControllerIds, vanillaAnimationControllerIds);
    } else {
      expectNoDanglingReference("Animation", id, animationIds, vanillaAnimationIds);
    }
  }

  // Everything in scripts.animate is a key of the animations map.
  const animate = description.scripts?.animate ?? [];

  for (const entry of animate) {
    const keys = typeof entry === "string" ? [entry] : Object.keys(entry);

    for (const key of keys) {
      expect(description.animations, `scripts.animate names '${key}'`).to.have.property(key);
    }
  }

  // The pre-1.10.0 animation_controllers list is not valid next to an animations map.
  const formatVersion = MinecraftUtilities.getVersionArrayFrom(mob.client.format_version);

  if (formatVersion && (formatVersion[0] > 1 || (formatVersion[0] === 1 && formatVersion[1] >= 10))) {
    expect(description, "format 1.10.0+ client entities animate through scripts.animate").to.not.have.property(
      "animation_controllers"
    );
  }

  // The spawn egg survives.
  expect(description.spawn_egg, "the mob should keep a spawn egg").to.be.an("object");
}

describe("Gallery mob templates", () => {
  let fullLocalStorage = false;

  before(() => {
    // Read the vanilla packs from public/res/latest instead of mctools.dev.
    fullLocalStorage = CreatorToolsHost.fullLocalStorage;
    CreatorToolsHost.fullLocalStorage = true;
  });

  after(() => {
    CreatorToolsHost.fullLocalStorage = fullLocalStorage;
  });

  it("creates a complete cow", async () => {
    const mob = await addMob("cow", "mycow");

    await assertMobIsComplete(mob, "cow");

    // The cow's climate variants (and their baby forms) all have their geometry and textures.
    expect(Object.keys(mob.description.geometry)).to.have.members(["default", "warm", "cold", "baby"]);
    expect(Object.keys(mob.description.textures)).to.have.members([
      "default",
      "warm",
      "cold",
      "baby_default",
      "baby_cold",
      "baby_warm",
    ]);
  }).timeout(15000);

  it("creates a complete creeper", async () => {
    const mob = await addMob("creeper", "mycreeper");

    await assertMobIsComplete(mob, "creeper");

    // The creeper's three animation controllers stay wired through the animations map.
    const controllers = Object.values(mob.description.animations as Record<string, string>).filter((id) =>
      id.startsWith("controller.animation.")
    );
    expect(controllers).to.have.length(3);
  }).timeout(15000);

  it("renames the mob in every copied file but never in material names", async () => {
    const mob = await addMob("creeper", "boomer");
    const rpFiles = await collectFiles(mob.rpFolder, ".json");

    for (const file of rpFiles) {
      if (!file.isContentLoaded) {
        await file.loadContent();
      }

      const content = file.content;

      if (typeof content === "string") {
        expect(content, `${file.storageRelativePath} should not keep a vanilla creeper id`).to.not.match(
          /"(minecraft:creeper|geometry\.creeper[^"]*|controller\.(render|animation)\.creeper[^"]*|animation\.creeper[^"]*)"/
        );
      }
    }

    expect(mob.description.materials).to.deep.equal({ default: "creeper", charged: "charged_creeper" });
  }).timeout(15000);
});

describe("ProjectCreateManager.fixupCopiedClientEntity", () => {
  const source = {
    format_version: "1.10.0",
    "minecraft:client_entity": {
      description: {
        identifier: "minecraft:sheep",
        materials: { default: "sheep", wool: "sheep_wool", sheared: "sheep_sheared", baby: "sheep_baby" },
        textures: { default: "textures/entity/sheep/sheep" },
        geometry: { default: "geometry.sheep.v1.8" },
        animations: { walk: "animation.sheep.walk", eat_controller: "controller.animation.sheep.eat" },
        scripts: { animate: ["walk", "eat_controller"] },
        animation_controllers: [
          { eat: "controller.animation.sheep.eat" },
          { graze: "controller.animation.sheep.graze" },
        ],
        render_controllers: ["controller.render.sheep"],
      },
    },
  };

  function renamedCopy() {
    const copy = JSON.parse(JSON.stringify(source));
    const description = copy["minecraft:client_entity"].description;

    description.identifier = "demo:lamb";
    description.materials = { default: "lamb", wool: "lamb_wool", sheared: "lamb_sheared", baby: "lamb_baby" };
    description.animations = { walk: "animation.lamb.walk", eat_controller: "controller.animation.lamb.eat" };
    description.animation_controllers = [
      { eat: "controller.animation.lamb.eat" },
      { graze: "controller.animation.lamb.graze" },
    ];
    description.render_controllers = ["controller.render.lamb"];

    return copy;
  }

  function fixed(sourceEntity: object, copy: object) {
    return JSON.parse(ProjectCreateManager.fixupCopiedClientEntity(JSON.stringify(sourceEntity), JSON.stringify(copy)));
  }

  it("restores the material names from the source entity", () => {
    const description = fixed(source, renamedCopy())["minecraft:client_entity"].description;

    expect(description.materials).to.deep.equal(source["minecraft:client_entity"].description.materials);
    expect(description.identifier, "the rename itself is kept").to.equal("demo:lamb");
    expect(description.render_controllers).to.deep.equal(["controller.render.lamb"]);
  });

  it("folds the legacy animation_controllers list into the animations map", () => {
    const description = fixed(source, renamedCopy())["minecraft:client_entity"].description;

    expect(description).to.not.have.property("animation_controllers");
    // The eat controller was already animated through the map; the graze controller was not.
    expect(description.animations).to.deep.equal({
      walk: "animation.lamb.walk",
      eat_controller: "controller.animation.lamb.eat",
      graze: "controller.animation.lamb.graze",
    });
    expect(description.scripts.animate).to.deep.equal(["walk", "eat_controller", "graze"]);
  });

  it("gives a legacy entry an alias that is really unused when key and key_controller are both taken", () => {
    const copy = renamedCopy();
    const description = copy["minecraft:client_entity"].description;

    description.animations = {
      walk: "animation.lamb.walk",
      walk_controller: "controller.animation.lamb.walk",
      eat_controller: "controller.animation.lamb.eat",
    };
    description.scripts = { animate: ["walk", "walk_controller", "eat_controller"] };
    description.animation_controllers = [{ walk: "controller.animation.lamb.extra" }];

    const fixedDescription = fixed(source, copy)["minecraft:client_entity"].description;

    // Both original mappings survive untouched, so the existing scripts.animate entries still run the same controllers.
    expect(fixedDescription.animations).to.deep.equal({
      walk: "animation.lamb.walk",
      walk_controller: "controller.animation.lamb.walk",
      eat_controller: "controller.animation.lamb.eat",
      walk_controller2: "controller.animation.lamb.extra",
    });
    expect(fixedDescription.scripts.animate).to.deep.equal([
      "walk",
      "walk_controller",
      "eat_controller",
      "walk_controller2",
    ]);
    expect(fixedDescription).to.not.have.property("animation_controllers");
  });

  it("leaves the animation_controllers list of a pre-1.10.0 entity alone", () => {
    const oldSource = JSON.parse(JSON.stringify(source));
    oldSource.format_version = "1.8.0";
    const oldCopy = renamedCopy();
    oldCopy.format_version = "1.8.0";

    expect(fixed(oldSource, oldCopy)["minecraft:client_entity"].description.animation_controllers).to.have.length(2);
  });

  it("returns the content unchanged when it is not a client entity", () => {
    expect(ProjectCreateManager.fixupCopiedClientEntity("{ not json", "{ not json")).to.equal("{ not json");
    expect(ProjectCreateManager.fixupCopiedClientEntity('{"a":1}', '{"b":2}')).to.equal('{"b":2}');
  });
});
