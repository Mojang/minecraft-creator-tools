import CreatorTools from "../../app/CreatorTools";
import { ProjectItemCreationType, ProjectItemStorageType, ProjectItemType } from "../../app/IProjectItemData";
import Project, { FolderContext } from "../../app/Project";
import ProjectExporter from "../../app/ProjectExporter";
import ProjectItem from "../../app/ProjectItem";
import ProjectItemUtilities from "../../app/ProjectItemUtilities";
import ProjectUtilities from "../../app/ProjectUtilities";
import Utilities from "../../core/Utilities";
import BlockbenchModel from "../../integrations/BlockbenchModel";
import MinecraftDefinitions from "../../minecraft/MinecraftDefinitions";
import MinecraftUtilities from "../../minecraft/MinecraftUtilities";
import { PackType } from "../../minecraft/Pack";
import FileSystemFolder from "../../storage/FileSystemFolder";
import FileSystemStorage from "../../storage/FileSystemStorage";
import IFolder from "../../storage/IFolder";
import StorageUtilities from "../../storage/StorageUtilities";
import ZipStorage from "../../storage/ZipStorage";
import telemetryService from "../../analytics/Telemetry";
import { TelemetryEvents, TelemetryProperties, WorldDownloadProperties } from "../../analytics/TelemetryConstants";
import { ProjectEditPreference } from "../../app/IProjectData";

export const MaxModeActions = 7;

export enum ProjectEditorItemAction {
  downloadBlockbenchModel,
  deleteItem,
  renameItem,
  viewAsJson,
  viewInEditor,
  viewOnMap,
  download,
  focus,
  unfocus,
  viewIssues,
}

export enum ProjectItemEditorView {
  singleFileEditor = 0,
  diff = 1,
  singleFileRaw = 2,
  map = 3,
  validationWithJson = 4,
  singleFileEditorForced = 5, // Explicit "Open in Editor" action - overrides raw preference
}

/**
 * Returns true when an item with the given active editor view is currently
 * being rendered in the raw text/JSON editor (not a structured form editor).
 *
 * The default `singleFileEditor` view defers to the project's edit preference:
 * in Raw Mode it renders as text; otherwise it renders the structured form.
 * `singleFileRaw`, `validationWithJson`, and `diff` always render as text;
 * `singleFileEditorForced` always renders the structured form (overriding Raw).
 *
 * Used by `getItemMenuItems` to decide whether the JSON toggle should read
 * "Open in Visual Editor" (when currently in text) or "Open in Text Editor"
 * (when currently in the structured editor). Keep in sync with the
 * `showRaw` / `showValidation` computation in
 * `ProjectItemEditor.render()` — if a new view is added that renders as raw
 * text, list it here too.
 */
export function isItemViewShowingTextEditor(
  itemView: ProjectItemEditorView | undefined,
  editPreference: ProjectEditPreference | undefined
): boolean {
  if (
    itemView === ProjectItemEditorView.singleFileRaw ||
    itemView === ProjectItemEditorView.validationWithJson ||
    itemView === ProjectItemEditorView.diff
  ) {
    return true;
  }

  if (itemView === ProjectItemEditorView.singleFileEditorForced) {
    return false;
  }

  // `singleFileEditor` (or undefined) — defer to the project preference.
  return editPreference === ProjectEditPreference.raw;
}

/**
 * Returns true for project item types that have a specialized form-based editor
 * distinct from the raw Monaco JSON view. Used to decide whether to show the
 * per-item Form/Raw toggle.
 *
 * Keep in sync with the specialized-editor if/else chain in
 * `ProjectItemEditor.render()` (see files that import specialized editors like
 * BehaviorPackManifestJsonEditor, EntityTypeEditor, etc.). If an item type is
 * not listed here, the user-visible Form toggle is hidden so we don't promise
 * a form UI that doesn't exist.
 */
export function hasSpecializedFormEditor(itemType: ProjectItemType): boolean {
  switch (itemType) {
    case ProjectItemType.entityTypeBehavior:
    case ProjectItemType.blockTypeBehavior:
    case ProjectItemType.itemTypeBehavior:
    case ProjectItemType.recipeBehavior:
    case ProjectItemType.actionSet:
    case ProjectItemType.modelGeometryJson:
    case ProjectItemType.worldTest:
    case ProjectItemType.scriptTypesJson:
    case ProjectItemType.packageJson:
    case ProjectItemType.behaviorPackManifestJson:
    case ProjectItemType.spawnRuleBehavior:
    case ProjectItemType.tradingBehaviorJson:
    case ProjectItemType.lootTableBehavior:
    case ProjectItemType.entityTypeResource:
    case ProjectItemType.attachableResourceJson:
    case ProjectItemType.biomeBehavior:
    case ProjectItemType.biomeResource:
    case ProjectItemType.featureBehavior:
    case ProjectItemType.featureRuleBehavior:
    case ProjectItemType.voxelShapeBehavior:
    case ProjectItemType.commandSetDefinitionJson:
    case ProjectItemType.contentIndexJson:
    case ProjectItemType.contentReportJson:
    case ProjectItemType.dataForm:
      return true;
    default:
      return false;
  }
}

export enum ProjectEditorMode {
  properties,
  inspector,
  minecraftToolSettings,
  activeItem,
  cartoSettings,
  minecraft,
  actions,
  map,
}

export enum ProjectEditorAction {
  worldPropertiesDialog,
  projectListUp,
  projectListDown,
  projectListCommit,
}

export default class ProjectEditorUtilities {
  static convertStoragePathToBrowserSafe(path: string) {
    path = path.replace(/#/gi, "|");

    return path;
  }

  static convertStoragePathFromBrowserSafe(path: string) {
    path = path.replace(/\|/gi, "#");
    path = decodeURI(path);

    return path;
  }

  static getProjectEditorModeString(mode: ProjectEditorMode) {
    switch (mode) {
      case ProjectEditorMode.activeItem:
        return "activeitem";
      case ProjectEditorMode.properties:
        return "properties";
      case ProjectEditorMode.inspector:
        return "inspector";
      case ProjectEditorMode.actions:
        return "actions";
      case ProjectEditorMode.cartoSettings:
        return "appsettings";
      case ProjectEditorMode.minecraft:
        return "minecraft";
      case ProjectEditorMode.minecraftToolSettings:
        return "minecrafttoolsettings";
      case ProjectEditorMode.map:
        return "map";
    }
  }

  static getProjectEditorFromString(modeString: string) {
    switch (modeString.toLowerCase().trim()) {
      case "activeitem":
        return ProjectEditorMode.activeItem;
      case "properties":
        return ProjectEditorMode.properties;
      case "inspector":
        return ProjectEditorMode.inspector;
      case "actions":
        return ProjectEditorMode.actions;
      case "appsettings":
        return ProjectEditorMode.cartoSettings;
      case "minecraft":
        return ProjectEditorMode.minecraft;
      case "minecrafttoolsettings":
        return ProjectEditorMode.minecraftToolSettings;

      default:
        return undefined;
    }
  }

  static getItemMenuItems(
    projectItem: ProjectItem,
    focusFilterPath: string | undefined,
    issueCount?: number,
    /**
     * True when the targeted item is *currently* being viewed in the raw text
     * editor (either the explicit raw view, the validation+JSON split, or the
     * default editor showing as raw because the project's edit preference is
     * Raw and the user hasn't forced the structured view). When true, the JSON
     * toggle entry reads "Open in Visual Editor" (action: viewInEditor); when
     * false it reads "Open in Text Editor" (action: viewAsJson). Callers that
     * cannot determine this (e.g. a context menu on a non-active item) should
     * fall back to the project's edit preference.
     */
    isCurrentlyShowingTextEditor?: boolean,
    /**
     * When false, the Focus / Clear focus entry is omitted. Set this to
     * false in callers (like the main toolbar's Item Actions button) that
     * have no way to route the focus intent back to the ProjectItemList's
     * internal focus state. Defaults to true for backward compatibility
     * with the project tree's right-click menu.
     */
    includeFocus: boolean = true,
    /**
     * When false, the "View on map" entry is omitted. Focused (summarized)
     * mode hides the project map view, so surfacing the entry from context
     * menus is a dead end — callers pass false there.
     */
    includeViewOnMap: boolean = true
  ) {
    let path = "";

    if (projectItem.projectPath !== null && projectItem.projectPath !== undefined) {
      path = projectItem.projectPath;
    }

    const itemMenu: any[] = [];

    if (includeFocus) {
      itemMenu.push({
        key: "focusMenu|" + path,
        content: focusFilterPath === projectItem.projectPath ? "Clear focus" : "Focus on this item",
        tag: {
          path: projectItem.projectPath,
          action:
            focusFilterPath === projectItem.projectPath
              ? ProjectEditorItemAction.unfocus
              : ProjectEditorItemAction.focus,
        },
      });
      itemMenu.push({
        key: "nav-divider|" + path,
        kind: "divider",
      });
    }

    itemMenu.push(
      {
        key: "download|" + path,
        content: "Download",
        tag: { path: projectItem.projectPath, action: ProjectEditorItemAction.download },
      },
      {
        key: "rename|" + path,
        content: "Rename",
        tag: { path: projectItem.projectPath, action: ProjectEditorItemAction.renameItem },
      }
    );

    // Add "View Issues" menu item if there are issues
    if (issueCount !== undefined && issueCount > 0) {
      itemMenu.unshift({
        key: "viewIssues|" + path,
        content: "View Issues (" + issueCount + ")",
        tag: { path: projectItem.projectPath, action: ProjectEditorItemAction.viewIssues },
      });
    }

    if (projectItem.itemType === ProjectItemType.modelGeometryJson) {
      itemMenu.push({
        key: "downloadBbmodel|" + path,
        content: "Download Blockbench Model",
        tag: { path: projectItem.projectPath, action: ProjectEditorItemAction.downloadBlockbenchModel },
      });
    }

    if (StorageUtilities.getTypeFromName(path) === "json") {
      // When the item is currently being shown in the text/raw editor, the
      // toggle should offer "Open in Visual Editor" to switch into the
      // structured form view. Otherwise, offer "Open in Text Editor" to
      // switch into the raw JSON view. This keeps the menu honest about the
      // *current* state of the item — not just the global edit preference —
      // so users who temporarily flipped one file into text mode see the
      // inverse action on both the per-item ... menu and the toolbar's
      // Item Actions menu.
      if (isCurrentlyShowingTextEditor) {
        itemMenu.push({
          key: "viewInEditor|" + path,
          content: "Open in Visual Editor",
          tag: { path: projectItem.projectPath, action: ProjectEditorItemAction.viewInEditor },
        });
      } else {
        itemMenu.push({
          key: "viewAsJson|" + path,
          content: "Open in Text Editor",
          tag: { path: projectItem.projectPath, action: ProjectEditorItemAction.viewAsJson },
        });
      }
    }

    if (includeViewOnMap) {
      itemMenu.push({
        key: "viewAsMap|" + path,
        content: "View on map",
        tag: { path: projectItem.projectPath, action: ProjectEditorItemAction.viewOnMap },
      });
    }

    itemMenu.push({ key: "delete-divider|" + path, kind: "divider" });
    itemMenu.push({
      key: "delete|" + path,
      content: "Delete",
      tag: { path: projectItem.projectPath, action: ProjectEditorItemAction.deleteItem },
      destructive: true,
    });

    return itemMenu;
  }

  static getIsLinkShareable(proj: Project) {
    if (
      !(
        (proj.gitHubOwner && proj.gitHubRepoName) ||
        (proj.originalGitHubOwner !== undefined && proj.originalGitHubRepoName !== undefined)
      )
    ) {
      return false;
    }

    if (proj.projectCabinetFile) {
      return false;
    }

    for (let projectItem of proj.items) {
      if (projectItem.isFileContainerStorageItem) {
        return false;
      }
    }

    return true;
  }

  public static async launchFlatWorldWithPacksDownload(creatorTools: CreatorTools, project: Project) {
    const operId = await creatorTools.notifyOperationStarted("Starting export of flat world with packs.");

    const projName = await project.loc.getTokenValue(project.name);

    const nameCore = Utilities.getFileFriendlySummarySeconds(new Date()) + "-" + projName;

    const name = nameCore + " Flat";
    const fileName = nameCore + "-flatpack.mcworld";

    await creatorTools.notifyStatusUpdate("Packing " + fileName);

    const newBytes = await ProjectExporter.generateFlatBetaApisWorldWithPacksZipBytes(creatorTools, project, name);

    if (!newBytes) {
      await creatorTools.notifyOperationEnded(operId);
      return;
    }

    await creatorTools.notifyStatusUpdate("Now downloading " + fileName);

    if (newBytes !== undefined) {
      saveAs(new Blob([newBytes as BlobPart], { type: "application/octet-stream" }), fileName);
    }

    await creatorTools.notifyOperationEnded(operId, "Done with save " + fileName);
  }

  public static async launchWorldWithPacksDownload(creatorTools: CreatorTools, project: Project) {
    const name = Utilities.getFileFriendlySummarySeconds(new Date()) + "-" + project.name;

    const fileName = name + ".mcworld";

    const mcworld = await ProjectExporter.generateWorldWithPacks(creatorTools, project, project.ensureWorldSettings());

    if (mcworld === undefined) {
      return;
    }

    const newBytes = await mcworld.getBytes();

    if (newBytes !== undefined) {
      saveAs(new Blob([newBytes as BlobPart], { type: "application/octet-stream" }), fileName);
    }

    await creatorTools.notifyStatusUpdate("Downloading mcworld with packs embedded '" + project.name + "'.");
  }

  /**
   * Extracts the contents of a zip-based file (mcworld, mcaddon, mcpack, mctemplate, mcproject, zip)
   * directly to the project root folder, rather than saving the zip file as-is.
   */
  static async extractZipContentsToProject(project: Project, file: File) {
    if (!project.projectFolder) {
      return;
    }

    if (!StorageUtilities.isContainerFile(file.name)) {
      return;
    }

    const operId = await project.creatorTools.notifyOperationStarted(
      "Extracting '" + file.name + "' contents to project"
    );

    const buffer = await file.arrayBuffer();

    // Load the zip contents
    const zipStorage = new ZipStorage();
    await zipStorage.loadFromUint8Array(new Uint8Array(buffer), file.name);

    // Extract contents to project root folder
    await StorageUtilities.syncFolderTo(
      zipStorage.rootFolder,
      project.projectFolder,
      true, // forceFolders
      true, // forceFileUpdates
      false // removeOnTarget - don't remove existing files
    );

    // Re-infer project items from the extracted contents
    await project.inferProjectItemsFromFilesRootFolder(true);

    await project.creatorTools.notifyOperationEnded(operId, "'" + file.name + "' contents extracted to project");
  }

  static getIntegrateBrowserFileDefaultActionDescription(
    project: Project,
    path: string,
    file: File,
    content?: string | Uint8Array | undefined
  ) {
    if (!project.projectFolder) {
      return undefined;
    }

    const fileName = file.name.toLowerCase();
    const extension = StorageUtilities.getTypeFromName(file.name);

    if (
      fileName === "level.dat" ||
      extension === "db" ||
      fileName === "current" ||
      fileName.startsWith("manifest-") ||
      fileName === "level.dat_old" ||
      fileName === "levelname.txt" ||
      fileName.startsWith("world_")
    ) {
      return "Add as new world";
    } else if (extension === "snbt") {
      return "Add '" + file.name + "' as new structure";
    } else if (extension === "mcworld") {
      return "Extract '" + file.name + "' contents to project";
    } else if (extension === "mcproject") {
      return "Extract '" + file.name + "' contents to project";
    } else if (extension === "mctemplate") {
      return "Extract '" + file.name + "' contents to project";
    } else if (extension === "mcaddon") {
      return "Extract '" + file.name + "' contents to project";
    } else if (extension === "zip") {
      return "Extract '" + file.name + "' contents to project";
    } else if (extension === "mcpack") {
      return "Extract '" + file.name + "' contents to project";
    } else if (extension === "ogg" || extension === "mp3" || extension === "wav") {
      return "Add '" + file.name + "' as new sound";
    } else if (extension === "mcstructure") {
      return "Add '" + file.name + "' as new structure";
    } else if (extension === "bbmodel") {
      let descrip = "Integrate '" + file.name + "' as a model ";

      if (content && typeof content === "string") {
        const bd = BlockbenchModel.ensureFromContent(content);

        if (bd.id) {
          descrip += "(" + bd.id + ")";
        }

        if (bd.data?.animations) {
          descrip += ", animations ";

          if (bd.data && bd.data.animations) {
            const name = MinecraftUtilities.removeSubTypeExtensionFromName(bd.data.name);

            descrip += "(" + name + ".animation.json";
            descrip += ") ";
          }
        }

        descrip += "and textures";

        if (bd.data && bd.data.textures) {
          descrip += " (";
          let first = true;

          for (const texture of bd.data.textures) {
            if (!first) {
              descrip += ", ";
            }

            descrip += texture.name;
            first = false;
          }

          descrip += ")";
        }
      } else {
        descrip += "and textures";
      }

      return descrip;
    } else if (extension === "json") {
      if (content && typeof content === "string") {
        const typeInfo = ProjectItemUtilities.inferTypeFromJsonContent(content, fileName);

        let packType = typeInfo.packType;

        if (packType === undefined) {
          packType = PackType.behavior;
        }

        const typeDescriptor = ProjectItemUtilities.getDescriptionForType(typeInfo.itemType);

        return "Add '" + file.name + "' as new " + typeDescriptor;
      } else {
        return "Add '" + file.name + "' as new  data file";
      }
    }

    return undefined;
  }

  static async integrateBrowserFileDefaultAction(project: Project, path: string, file: File) {
    if (!project.projectFolder) {
      return;
    }

    const pathCanon = path.toLowerCase();
    const fileName = file.name.toLowerCase();
    const extension = StorageUtilities.getTypeFromName(file.name);

    if (
      fileName === "level.dat" ||
      extension === "db" ||
      fileName === "current" ||
      fileName.startsWith("manifest-") ||
      fileName === "level.dat_old" ||
      fileName === "levelname.txt" ||
      fileName.startsWith("world_")
    ) {
      if (path.length < 2) {
        path = "/default";
      }

      if (pathCanon.indexOf("worlds") < 0) {
        path = StorageUtilities.joinPath("worlds", path);
      }

      path = StorageUtilities.ensureEndsWithDelimiter(StorageUtilities.absolutize(path));

      const folder = await project.projectFolder.ensureFolderFromRelativePath(path);

      if (fileName === "level.dat") {
        project.ensureItemByProjectPath(
          path,
          ProjectItemStorageType.folder,
          folder.name,
          ProjectItemType.worldFolder,
          FolderContext.world,
          undefined,
          ProjectItemCreationType.normal
        );
      }

      const buffer = await file.arrayBuffer();

      const contentFile = folder.ensureFile(file.name);

      if (contentFile.setContentIfSemanticallyDifferent(new Uint8Array(buffer))) {
        await contentFile.saveContent();
      }
    } else if (extension === "snbt") {
      const operId = await project.creatorTools.notifyOperationStarted(
        "Saving new SNBT structure file '" + file.name + "'"
      );

      const text = await file.text();

      const folder = project.projectFolder.ensureFolder("packs");
      const contentFile = folder.ensureFile(file.name);

      if (contentFile.setContentIfSemanticallyDifferent(text)) {
        await contentFile.saveContent();
      }

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          file.name,
          ProjectItemType.structure,
          FolderContext.behaviorPack,
          undefined,
          ProjectItemCreationType.normal
        );
      }

      await project.creatorTools.notifyOperationEnded(operId, "New SNBT structure file '" + file.name + "' added");
    } else if (extension === "mcworld") {
      const operId = await project.creatorTools.notifyOperationStarted("Saving new MCWorld file '" + file.name + "'");

      const buffer = await file.arrayBuffer();

      const folder = project.projectFolder.ensureFolder("worlds");

      const contentFile = folder.ensureFile(file.name);

      contentFile.setContent(new Uint8Array(buffer));

      contentFile.saveContent();

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          file.name,
          ProjectItemType.MCWorld,
          FolderContext.world,
          undefined,
          ProjectItemCreationType.normal
        );

        await project.inferProjectItemsFromZipFile(relPath, contentFile, false);
      }

      await project.creatorTools.notifyOperationEnded(operId, "New MCWorld file '" + file.name + "' added");
    } else if (extension === "mcproject") {
      const operId = await project.creatorTools.notifyOperationStarted("Saving new MCProject file '" + file.name + "'");

      const buffer = await file.arrayBuffer();

      const folder = project.projectFolder.ensureFolder("editorworlds");

      const contentFile = folder.ensureFile(file.name);

      contentFile.setContent(new Uint8Array(buffer));

      contentFile.saveContent();

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          file.name,
          ProjectItemType.MCProject,
          FolderContext.world,
          undefined,
          ProjectItemCreationType.normal
        );

        await project.inferProjectItemsFromZipFile(relPath, contentFile, false);
      }

      await project.creatorTools.notifyOperationEnded(operId, "New MCProject file '" + file.name + "' added");
    } else if (extension === "mctemplate") {
      const operId = await project.creatorTools.notifyOperationStarted(
        "Saving new MCTemplate file '" + file.name + "'"
      );

      const buffer = await file.arrayBuffer();

      const folder = project.projectFolder.ensureFolder("templates");

      const contentFile = folder.ensureFile(file.name);

      contentFile.setContent(new Uint8Array(buffer));

      contentFile.saveContent();

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          file.name,
          ProjectItemType.MCTemplate,
          FolderContext.world,
          undefined,
          ProjectItemCreationType.normal
        );

        await project.inferProjectItemsFromZipFile(relPath, contentFile, false);
      }

      await project.creatorTools.notifyOperationEnded(operId, "New MCTemplate file '" + file.name + "' added");
    } else if (extension === "mcaddon") {
      const operId = await project.creatorTools.notifyOperationStarted("Saving new MCAddon file '" + file.name + "'");

      const buffer = await file.arrayBuffer();

      const folder = project.projectFolder.ensureFolder("addons");

      const contentFile = folder.ensureFile(file.name);

      contentFile.setContent(new Uint8Array(buffer));

      contentFile.saveContent();

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          file.name,
          ProjectItemType.MCAddon,
          FolderContext.unknown,
          undefined,
          ProjectItemCreationType.normal
        );

        await project.inferProjectItemsFromZipFile(relPath, contentFile, false);
      }

      await project.creatorTools.notifyOperationEnded(operId, "New MCAddon file '" + file.name + "' added");
    } else if (extension === "zip") {
      const operId = await project.creatorTools.notifyOperationStarted("Saving new zip file '" + file.name + "'");

      const buffer = await file.arrayBuffer();

      const folder = project.projectFolder.ensureFolder("zips");

      const contentFile = folder.ensureFile(file.name);

      contentFile.setContent(new Uint8Array(buffer));

      contentFile.saveContent();

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          file.name,
          ProjectItemType.zip,
          FolderContext.unknown,
          undefined,
          ProjectItemCreationType.normal
        );

        await project.inferProjectItemsFromZipFile(relPath, contentFile, false);
      }

      await project.creatorTools.notifyOperationEnded(operId, "New zip file '" + file.name + "' added");
    } else if (extension === "mcpack") {
      const operId = await project.creatorTools.notifyOperationStarted("Saving new MCPack file '" + file.name + "'");

      const buffer = await file.arrayBuffer();

      const folder = project.projectFolder.ensureFolder("packs");

      const contentFile = folder.ensureFile(file.name);

      contentFile.setContent(new Uint8Array(buffer));

      contentFile.saveContent();

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          file.name,
          ProjectItemType.MCPack,
          FolderContext.unknown,
          undefined,
          ProjectItemCreationType.normal
        );

        await project.inferProjectItemsFromZipFile(relPath, contentFile, false);
      }

      await project.creatorTools.notifyOperationEnded(operId, "New MCPack file '" + file.name + "' added");
    } else if (extension === "mcstructure") {
      const operId = await project.creatorTools.notifyOperationStarted("Saving new structure file '" + file.name + "'");

      const buffer = await file.arrayBuffer();

      const bpFolder = await project.ensureDefaultBehaviorPackFolder();

      const folder = bpFolder.ensureFolder("structures");

      const contentFile = folder.ensureFile(file.name);
      contentFile.setContent(new Uint8Array(buffer));
      contentFile.saveContent();

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          file.name,
          ProjectItemType.structure,
          FolderContext.behaviorPack,
          undefined,
          ProjectItemCreationType.normal
        );
      }

      await project.creatorTools.notifyOperationEnded(operId, "New structure file '" + file.name + "' added");
    } else if (extension === "mp3" || extension === "ogg" || extension === "flac" || extension === "wav") {
      const operId = await project.creatorTools.notifyOperationStarted("Saving new audio file '" + file.name + "'");

      const buffer = await file.arrayBuffer();

      const rpFolder = await project.ensureDefaultResourcePackFolder();

      const folder = rpFolder.ensureFolder("sounds");

      const contentFile = folder.ensureFile(file.name);
      contentFile.setContent(new Uint8Array(buffer));
      contentFile.saveContent();

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        const item = project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          file.name,
          ProjectItemType.audio,
          FolderContext.resourcePack,
          undefined,
          ProjectItemCreationType.normal
        );

        await MinecraftDefinitions.ensureFoundationalDependencies(item);
      }

      await project.creatorTools.notifyOperationEnded(operId, "New audio file '" + file.name + "' added");
    } else if (extension === "json") {
      const operId = await project.creatorTools.notifyOperationStarted("Saving new JSON file '" + file.name + "'");

      const jsonContentStr = await file.text();

      const item = await ProjectUtilities.ensureJsonItem(project, jsonContentStr, fileName);

      let description = "";

      if (item) {
        description = " as " + ProjectItemUtilities.getDescriptionForType(item.itemType) + " to " + item.projectPath;
      }

      await project.creatorTools.notifyOperationEnded(operId, "New JSON file '" + file.name + "' added" + description);
    } else if (extension === "bbmodel") {
      const operId = await project.creatorTools.notifyOperationStarted("Integrating bbmodel file '" + file.name + "'");

      const jsonContentStr = await file.text();

      const bbm = BlockbenchModel.ensureFromContent(jsonContentStr);

      bbm.integrateIntoProject(project);

      await project.creatorTools.notifyOperationEnded(operId, "Integrated bbmodel '" + file.name + "'.");
    } else if (extension === "png" || extension === "jpg" || extension === "jpeg" || extension === "tga") {
      const operId = await project.creatorTools.notifyOperationStarted("Saving new texture file '" + file.name + "'");

      const buffer = await file.arrayBuffer();

      const rpFolder = await project.ensureDefaultResourcePackFolder();

      let folder: IFolder;
      let targetFileName = file.name;

      // Check if path contains a vanilla override path (e.g., "/resource_pack/textures/entity/skeleton.png")
      if (path && path.length > 1 && path.includes("/textures/")) {
        // Use the vanilla path structure within the resource pack
        let vanillaPath = StorageUtilities.ensureStartsWithDelimiter(path);

        // Strip leading pack folder prefixes (e.g., "/resource_pack/" or "/behavior_pack/")
        // since we're already placing the file in the resource pack folder
        vanillaPath = vanillaPath.replace(/^\/(resource_pack|behavior_pack)\//i, "/");

        const folderPath = StorageUtilities.getFolderPath(vanillaPath);
        targetFileName = StorageUtilities.getLeafName(vanillaPath);

        // Ensure the folder path exists (e.g., "textures/entity")
        folder = await rpFolder.ensureFolderFromRelativePath(folderPath);
      } else {
        // Default: just put in textures folder
        folder = rpFolder.ensureFolder("textures");
      }

      const contentFile = folder.ensureFile(targetFileName);
      contentFile.setContent(new Uint8Array(buffer));
      await contentFile.saveContent();

      const relPath = contentFile.getFolderRelativePath(project.projectFolder as IFolder);

      if (relPath !== undefined) {
        project.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          targetFileName,
          ProjectItemType.texture,
          FolderContext.resourcePack,
          undefined,
          ProjectItemCreationType.normal
        );
      }

      await project.creatorTools.notifyOperationEnded(
        operId,
        "New texture file '" + targetFileName + "' added" + (path && path.length > 1 ? " at " + path : "")
      );
    }
  }

  public static async launchEditorWorldWithPacksDownload(creatorTools: CreatorTools, project: Project) {
    const name = Utilities.getFileFriendlySummarySeconds(new Date()) + "-" + project.name;

    const fileName = name + ".mcproject";

    const mcworld = await ProjectExporter.generateWorldWithPacks(
      creatorTools,
      project,
      project.ensureEditorWorldSettings()
    );

    if (mcworld === undefined) {
      return;
    }

    const newBytes = await mcworld.getBytes();

    if (newBytes !== undefined) {
      saveAs(new Blob([newBytes as any], { type: "application/octet-stream" }), fileName);

      const properties: WorldDownloadProperties = {};

      const additionalPackCount = (mcworld.worldBehaviorPacks?.length || 0) + (mcworld.worldResourcePacks?.length || 0);

      properties[TelemetryProperties.ADDITIONAL_PACKS_ADDED] =
        additionalPackCount > 0 ? additionalPackCount : undefined;

      const behaviorPackUuids = mcworld.worldBehaviorPacks?.map((pack) => pack.pack_id).join(";");

      properties[TelemetryProperties.BEHAVIOR_PACKS] =
        behaviorPackUuids && behaviorPackUuids.length > 0 ? behaviorPackUuids : undefined;

      const resourcePackUuids = mcworld.worldResourcePacks?.map((pack) => pack.pack_id).join(";");

      properties[TelemetryProperties.RESOURCE_PACKS] =
        resourcePackUuids && resourcePackUuids.length > 0 ? resourcePackUuids : undefined;

      telemetryService.trackEvent({
        name: TelemetryEvents.EDITOR_PROJECT_DOWNLOADED,
        properties,
      });
    }

    await creatorTools.notifyStatusUpdate("Downloading mcworld with packs embedded '" + project.name + "'.");
  }

  public static async launchLocalExport(creatorTools: CreatorTools, project: Project) {
    if (project === null || project.projectFolder === null) {
      return;
    }
    let operId: number | undefined;
    try {
      const result = (await window.showDirectoryPicker({
        mode: "readwrite",
      })) as FileSystemDirectoryHandle | undefined;

      if (result) {
        const storage = new FileSystemStorage(result);

        operId = await creatorTools.notifyOperationStarted("Exporting project to  '" + result.name + "'");

        const safeMessage = await (storage.rootFolder as FileSystemFolder).getFirstUnsafeError();

        if (safeMessage) {
          await creatorTools.notifyOperationEnded(
            operId,
            "Could not export to a folder on your device: " + safeMessage,
            undefined,
            true
          );
        } else {
          await StorageUtilities.syncFolderTo(
            project.projectFolder,
            storage.rootFolder,
            true,
            true,
            false,
            [],
            undefined,
            async (message: string) => {
              await creatorTools.notifyStatusUpdate(message);
            },
            true
          );

          await creatorTools.notifyStatusUpdate("Saving all files to '" + result.name + "'.");
          await storage.rootFolder.saveAll();
          await creatorTools.notifyOperationEnded(operId, "Export completed.");

          telemetryService.trackEvent({
            name: TelemetryEvents.PROJECT_EXPORTED,
            properties: {
              [TelemetryProperties.EXPORT_FORMAT]: "folder",
            },
          });
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      if (operId !== undefined) {
        await creatorTools.notifyOperationEnded(operId, "Export to folder failed: " + message, undefined, true);
      } else {
        await creatorTools.notifyStatusUpdate("Export to folder failed: " + message);
      }
    }
  }

  public static async launchZipExport(creatorTools: CreatorTools, project: Project) {
    if (project == null) {
      return;
    }
    const projName = await project.loc.getTokenValue(project.name);

    const operId = await creatorTools.notifyOperationStarted("Exporting '" + projName + "' as zip.");

    try {
      const zipStorage = new ZipStorage();

      const projectFolder = await project.ensureLoadedProjectFolder();

      await StorageUtilities.syncFolderTo(projectFolder, zipStorage.rootFolder, true, true, false);

      await zipStorage.rootFolder.saveAll();

      const zipBinary = await zipStorage.generateBlobAsync();

      await creatorTools.notifyOperationEnded(operId, "Export zip of '" + projName + "' created; downloading.");

      saveAs(zipBinary, projName + ".zip");

      telemetryService.trackEvent({
        name: TelemetryEvents.PROJECT_EXPORTED,
        properties: {
          [TelemetryProperties.EXPORT_FORMAT]: "zip",
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await creatorTools.notifyOperationEnded(operId, "Export zip failed: " + message, undefined, true);
      throw e;
    }
  }
}
