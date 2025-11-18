import { EventDispatcher } from "ste-events";
import IFile from "../storage/IFile";
import IFolder from "../storage/IFolder";
import ZipStorage from "../storage/ZipStorage";
import { ProjectItemErrorStatus, ProjectItemStorageType, ProjectItemType } from "./IProjectItemData";
import IProjectItemVariant, { ProjectItemVariantType } from "./IProjectItemVariant";
import ProjectItem from "./ProjectItem";
import ProjectVariant from "./ProjectVariant";
import Log from "../core/Log";
import MCWorld from "../minecraft/MCWorld";
import { StorageErrorStatus } from "../storage/IStorage";
import { PackType } from "../minecraft/Pack";
import ResourceManifestDefinition from "../minecraft/ResourceManifestDefinition";

export default class ProjectItemVariant {
  private _item: ProjectItem;
  private _data: IProjectItemVariant;
  private _file: IFile | null = null;
  private _folder: IFolder | null = null;
  private _projectVariant: ProjectVariant;
  private _isFileContentProcessed = false;
  private _isLoaded = false;
  private _onFileRetrieved = new EventDispatcher<ProjectItemVariant, IFile>();
  private _onFolderRetrieved = new EventDispatcher<ProjectItemVariant, IFolder>();
  private _onLoaded = new EventDispatcher<ProjectItemVariant, ProjectItemVariant>();

  private _isDefault: boolean;

  constructor(parentItem: ProjectItem, data: IProjectItemVariant, projectVariant: ProjectVariant) {
    this._item = parentItem;
    this._data = data;
    this._projectVariant = projectVariant;

    this._isDefault = this._data.label === "";
  }

  get projectVariant() {
    return this._projectVariant;
  }

  get errorMessage() {
    return this._data.errorMessage;
  }

  set errorMessage(newErrorMessage: string | undefined) {
    this._data.errorMessage = newErrorMessage;
  }

  public get isLoaded() {
    return this._isLoaded;
  }

  public get onLoaded() {
    return this._onLoaded.asEvent();
  }

  public get onFileRetrieved() {
    return this._onFileRetrieved.asEvent();
  }

  public get onFolderRetrieved() {
    return this._onFolderRetrieved.asEvent();
  }

  get label() {
    return this._data.label;
  }

  get variantType() {
    return this._data.variantType;
  }

  get file() {
    if (this._isDefault) {
      return this._item.defaultFile;
    }

    return this._file;
  }

  setFile(file: IFile | null) {
    this._file = file;
  }

  get itemType() {
    return this._item.itemType;
  }

  get projectPath() {
    return this._data.projectPath;
  }

  set variantType(newVariantType: ProjectItemVariantType) {
    this._data.variantType = newVariantType;
  }

  set projectPath(newProjectPath: string | undefined) {
    this._data.projectPath = newProjectPath;
  }

  get folder() {
    if (this._isDefault) {
      return this._item.defaultFolder;
    }

    return this._folder;
  }

  setFolder(file: IFolder | null) {
    this._folder = file;
  }

  _handleMCWorldLoaded(world: MCWorld, worldA: MCWorld) {
    this._fireLoadedEvent();
  }

  _fireLoadedEvent() {
    if (this._onLoaded && this.isLoaded) {
      this._onLoaded.dispatch(this, this);
    }
  }

  get errorStatus() {
    return this._data.errorStatus;
  }

  set errorStatus(errorStatus: ProjectItemErrorStatus | undefined) {
    this._data.errorStatus = errorStatus;
  }

  async ensureFileStorage() {
    if (
      this._item.storageType === ProjectItemStorageType.singleFile &&
      this._file === null &&
      this.projectPath !== null &&
      this.projectPath !== undefined &&
      this.projectPath.startsWith("/") &&
      this._item.project.projectFolder !== null &&
      this._item.project.projectFolder !== undefined
    ) {
      const prefixPaths = this.projectPath.split("#");

      if (prefixPaths.length > 1) {
        let folderToLoadFrom: IFolder | undefined = this._item.project.projectFolder;

        for (let i = 0; i < prefixPaths.length - 1; i++) {
          if (folderToLoadFrom) {
            const zipFile: IFile = await folderToLoadFrom.ensureFileFromRelativePath(prefixPaths[i]);

            await zipFile.loadContent();

            if (zipFile.content && zipFile.content instanceof Uint8Array) {
              if (!zipFile.fileContainerStorage) {
                const zipStorage = new ZipStorage();

                zipStorage.storagePath = zipFile.storageRelativePath + "#";

                await zipStorage.loadFromUint8Array(zipFile.content, zipFile.name);

                zipStorage.containerFile = zipFile;
                zipFile.fileContainerStorage = zipStorage;
              }

              folderToLoadFrom = zipFile.fileContainerStorage.rootFolder;
            } else {
              folderToLoadFrom = undefined;
            }
          }
        }

        if (folderToLoadFrom) {
          this._file = await folderToLoadFrom.ensureFileFromRelativePath(prefixPaths[prefixPaths.length - 1]);
          this._isFileContentProcessed = false;
        } else {
          Log.debugAlert("Unable to parse a containerized file path of '" + this.projectPath + "'");
          return null;
        }
      } else {
        this._file = await this._item.project.projectFolder.ensureFileFromRelativePath(this.projectPath);
        this._isFileContentProcessed = false;
      }
    } else if (
      this._item.storageType === ProjectItemStorageType.singleFile &&
      this._file === null &&
      (this.projectPath === null || this.projectPath === undefined) &&
      (!this.variantType || this.variantType === ProjectItemVariantType.subPack) &&
      this._item.project.projectFolder !== null &&
      this._item.project.projectFolder !== undefined
    ) {
      await this._item.project.ensurePacksAsync();

      const pack = await this._item.getPack();

      if (pack && pack.packType === PackType.resource && this._item.projectPath) {
        const manifest = (await pack.ensureManifest()) as ResourceManifestDefinition | undefined;
        const folder = pack.folder;

        if (manifest && folder) {
          const subpack = manifest.getSubpackByFolderName(this.label);

          if (subpack) {
            const path = this._item.projectPath;

            const resourcePacksRel = path.indexOf("/resource_packs/");

            if (resourcePacksRel > -1) {
              const file = await folder.getFileFromRelativePath(path.substring(resourcePacksRel + 15));

              if (file) {
                this._file = file;
              }
            }
          }
        }
      }
    }

    return this._file;
  }

  async loadFileStorage() {
    if (!this._isFileContentProcessed && this._file) {
      /*if (this._data.creationType === ProjectItemCreationType.generated) {
        await ProjectAutogeneration.updateItemAutogeneration(this, true);
      } else {*/
      await this._file.loadContent();

      // }

      //await ProjectAutogeneration.updateItemAutogeneratedSideFiles(this);

      this._isFileContentProcessed = true;

      this._onFileRetrieved.dispatch(this, this._file);

      if (this.itemType === ProjectItemType.MCWorld || this.itemType === ProjectItemType.MCTemplate) {
        const mcworld = await MCWorld.ensureOnFile(this._file, this._item.project, this._handleMCWorldLoaded);

        if (mcworld) {
          this.errorMessage = mcworld.storageErrorMessage;

          if (mcworld.storageErrorStatus === StorageErrorStatus.unprocessable) {
            this.errorStatus = ProjectItemErrorStatus.unprocessable;
          } else {
            this.errorStatus = ProjectItemErrorStatus.none;
          }
        }
      } else {
        this._fireLoadedEvent();
      }
    }
  }

  async ensureAndLoadFileStorage() {
    await this.ensureFileStorage();

    await this.loadFileStorage();

    return this._file;
  }

  async ensureFolderStorage() {
    if (this._item.storageType === ProjectItemStorageType.folder) {
      if (
        this._folder === null &&
        this.projectPath !== null &&
        this.projectPath !== undefined &&
        this.projectPath.startsWith("/") &&
        this._item.project.projectFolder !== null &&
        this._item.project.projectFolder !== undefined
      ) {
        const prefixPaths = this.projectPath.split("#");

        if (prefixPaths.length > 1) {
          let folderToLoadFrom: IFolder | undefined = this._item.project.projectFolder;

          for (let i = 0; i < prefixPaths.length - 1; i++) {
            if (folderToLoadFrom) {
              const zipFile: IFile = await folderToLoadFrom.ensureFileFromRelativePath(prefixPaths[i]);

              await zipFile.loadContent();

              if (zipFile.content && zipFile.content instanceof Uint8Array) {
                if (!zipFile.fileContainerStorage) {
                  const zipStorage = new ZipStorage();

                  zipStorage.storagePath = zipFile.storageRelativePath + "#";

                  await zipStorage.loadFromUint8Array(zipFile.content, zipFile.name);

                  zipStorage.containerFile = zipFile;
                  zipFile.fileContainerStorage = zipStorage;
                }

                folderToLoadFrom = zipFile.fileContainerStorage.rootFolder;
              } else {
                folderToLoadFrom = undefined;
              }
            }
          }

          if (folderToLoadFrom) {
            this._folder = await folderToLoadFrom.ensureFolderFromRelativePath(prefixPaths[prefixPaths.length - 1]);
          } else {
            // Log.debugAlert("Unable to parse a containerized file path of '" + this.storagePath + "'");
            return null;
          }
        } else {
          this._folder = await this._item.project.projectFolder.ensureFolderFromRelativePath(this.projectPath);
        }

        await this._folder.load();

        this._onFolderRetrieved.dispatch(this, this._folder);

        if (this.itemType === ProjectItemType.worldFolder) {
          const mcworld = await MCWorld.ensureMCWorldOnFolder(
            this._folder,
            this._item.project,
            this._handleMCWorldLoaded
          );

          if (mcworld) {
            this.errorMessage = mcworld.storageErrorMessage;

            if (mcworld.storageErrorStatus === StorageErrorStatus.unprocessable) {
              this.errorStatus = ProjectItemErrorStatus.unprocessable;
            } else {
              this.errorStatus = ProjectItemErrorStatus.none;
            }
          }
        } else {
          this._fireLoadedEvent();
        }
      }

      return this._folder;
    }

    return undefined;
  }
}
