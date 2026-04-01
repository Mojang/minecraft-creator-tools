// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ARCHITECTURE DOCUMENTATION: ModelDesignDefinition
 * ==================================================
 *
 * This class persists model design data as an accessory file alongside the
 * generated geometry file. It enables:
 * 1. Design iteration - update existing models without creating duplicates
 * 2. Context restoration - AI can reload the design spec to understand/modify it
 * 3. Preview regeneration - re-render from saved design on demand
 *
 * ## Accessory Folder Pattern
 *
 * For a geometry file at:
 *   resource_packs/my_pack/models/entity/disco_pig.geo.json
 *
 * The accessory folder is at:
 *   design_pack/project_item_data/resource_packs/my_pack/models/entity/disco_pig_geo_json/
 *
 * And contains:
 *   - model_design.json: The IMcpModelDesign specification
 *   - preview.png: Last rendered preview image
 *   - generation_meta.json: Timestamp, model used, etc.
 *
 * ## Related Files
 * - src/design/ImageEditsDefinition.ts - Similar pattern for image edits
 * - src/app/ProjectItem.ts - ensureAccessoryFolder() implementation
 * - src/local/MinecraftMcpServer.ts - createModel tool that uses this
 */

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import Log from "../core/Log";
import { IMcpModelDesign } from "../minecraft/IMcpModelDesign";

/**
 * Metadata about when/how the model was generated.
 */
export interface IModelGenerationMeta {
  /** When the model was last generated */
  generatedAt: string;
  /** The AI model/tool that generated it (if known) */
  generatorModel?: string;
  /** The prompt or request that led to generation (if known) */
  prompt?: string;
  /** Version of the design schema */
  schemaVersion: "1.0.0";
}

/**
 * The complete persisted model design data.
 */
export interface IModelDesignData {
  /** The model design specification */
  design: IMcpModelDesign;
  /** Generation metadata */
  meta: IModelGenerationMeta;
  /** The usage context (entity, block, item) */
  usage?: "entity" | "block" | "item";
  /** What this model was wired to (if any) */
  wiredTo?: string;
}

/**
 * Manages persistence of model design data in accessory folders.
 * Follows the same pattern as ImageEditsDefinition.
 */
export default class ModelDesignDefinition {
  private _file?: IFile;
  private _previewFile?: IFile;
  private _isLoaded: boolean = false;

  public data?: IModelDesignData;
  public project?: Project;

  private _onLoaded = new EventDispatcher<ModelDesignDefinition, ModelDesignDefinition>();

  public get isLoaded() {
    return this._isLoaded;
  }

  public get file() {
    return this._file;
  }

  public set file(newFile: IFile | undefined) {
    this._file = newFile;
  }

  public get onLoaded() {
    return this._onLoaded.asEvent();
  }

  public get design(): IMcpModelDesign | undefined {
    return this.data?.design;
  }

  public get usage(): "entity" | "block" | "item" | undefined {
    return this.data?.usage;
  }

  public get wiredTo(): string | undefined {
    return this.data?.wiredTo;
  }

  /**
   * Updates the design data and persists it.
   */
  async updateDesign(
    design: IMcpModelDesign,
    options?: {
      usage?: "entity" | "block" | "item";
      wiredTo?: string;
      generatorModel?: string;
      prompt?: string;
    }
  ): Promise<void> {
    this.data = {
      design,
      meta: {
        generatedAt: new Date().toISOString(),
        generatorModel: options?.generatorModel,
        prompt: options?.prompt,
        schemaVersion: "1.0.0",
      },
      usage: options?.usage,
      wiredTo: options?.wiredTo,
    };

    await this.save();
  }

  /**
   * Saves a preview image to the accessory folder.
   */
  async savePreview(imageData: Uint8Array): Promise<void> {
    if (!this._file || !this._file.parentFolder) {
      Log.debug("ModelDesignDefinition: Cannot save preview - no file set");
      return;
    }

    this._previewFile = this._file.parentFolder.ensureFile("preview.png");
    this._previewFile.setContent(imageData);
    await this._previewFile.saveContent(false);

    Log.debug(`ModelDesignDefinition: Saved preview to ${this._previewFile.storageRelativePath}`);
  }

  /**
   * Gets the preview image data if it exists.
   */
  async getPreview(): Promise<Uint8Array | undefined> {
    if (!this._file || !this._file.parentFolder) {
      return undefined;
    }

    const previewFile = this._file.parentFolder.ensureFile("preview.png");

    if (!(await previewFile.exists())) {
      return undefined;
    }

    if (!previewFile.isContentLoaded) {
      await previewFile.loadContent();
    }

    if (previewFile.content instanceof Uint8Array) {
      return previewFile.content;
    }

    return undefined;
  }

  /**
   * Creates or gets a ModelDesignDefinition for a ProjectItem's accessory folder.
   * Use this when you have the ProjectItem for the geometry file.
   */
  static async ensureAsAccessoryOnProjectItem(projectItem: ProjectItem): Promise<ModelDesignDefinition | undefined> {
    const accessoryFolder = await projectItem.ensureAccessoryFolder();
    const designFile = accessoryFolder.ensureFile("model_design.json");

    return await ModelDesignDefinition.ensureOnFile(designFile, projectItem.project);
  }

  /**
   * Creates or gets a ModelDesignDefinition attached to a file.
   */
  static async ensureOnFile(
    file: IFile,
    project: Project,
    loadHandler?: IEventHandler<ModelDesignDefinition, ModelDesignDefinition>
  ): Promise<ModelDesignDefinition | undefined> {
    let modelDesign: ModelDesignDefinition | undefined;

    if (file.manager === undefined) {
      modelDesign = new ModelDesignDefinition();
      modelDesign.project = project;
      modelDesign.file = file;
      file.manager = modelDesign;
    }

    if (file.manager !== undefined && file.manager instanceof ModelDesignDefinition) {
      modelDesign = file.manager as ModelDesignDefinition;

      if (!modelDesign.isLoaded && loadHandler) {
        modelDesign.onLoaded.subscribe(loadHandler);
      }

      await modelDesign.load();

      return modelDesign;
    }

    return modelDesign;
  }

  /**
   * Persists the design data to file (only if semantically different).
   */
  async persist(): Promise<boolean> {
    if (this._file === undefined) {
      return false;
    }

    return this._file.setObjectContentIfSemanticallyDifferent(this.data);
  }

  /**
   * Saves the design data to file.
   */
  async save(): Promise<void> {
    if (this._file === undefined) {
      return;
    }

    await this.persist();
    await this._file.saveContent(false);
  }

  /**
   * Loads the design data from file.
   */
  async load(): Promise<void> {
    if (this._file === undefined || this._isLoaded) {
      return;
    }

    if (!this._file.isContentLoaded) {
      await this._file.loadContent();
    }

    if (this._file.content === null || this._file.content instanceof Uint8Array) {
      return;
    }

    this.data = StorageUtilities.getJsonObject(this._file);
    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }
}
