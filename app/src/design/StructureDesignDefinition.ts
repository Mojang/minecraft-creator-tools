// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ARCHITECTURE DOCUMENTATION: StructureDesignDefinition
 * ======================================================
 *
 * This class persists structure design data as an accessory file alongside the
 * generated .mcstructure file. It enables:
 * 1. Design iteration - update existing structures without creating duplicates
 * 2. Context restoration - AI can reload the design spec to understand/modify it
 * 3. Preview regeneration - re-render from saved design on demand
 *
 * ## Accessory Folder Pattern
 *
 * For a structure file at:
 *   behavior_packs/my_pack/structures/wizard_tower.mcstructure
 *
 * The accessory folder is at:
 *   design_pack/project_item_data/behavior_packs/my_pack/structures/wizard_tower_mcstructure/
 *
 * And contains:
 *   - structure_design.json: How the structure was made. Either the IBlockVolume
 *     specification (`design`), or the build program (`program`) plus any edit
 *     programs applied since (`edits`). See StructureProgramRunner.
 *   - preview.png: Last rendered preview image
 *   - generation_meta.json: Timestamp, model used, etc.
 *
 * ## Related Files
 * - src/design/ModelDesignDefinition.ts - Similar pattern for model designs
 * - src/design/ImageEditsDefinition.ts - Original accessory pattern implementation
 * - src/app/ProjectItem.ts - ensureAccessoryFolder() implementation
 * - src/local/MinecraftMcpServer.ts - buildStructure tool that uses this
 */

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import Log from "../core/Log";

/**
 * Block volume design - the structure specification.
 * Matches the blockVolume format used by the designStructure MCP tool.
 */
export interface IBlockVolumeDesign {
  /** The world position of the south-west-bottom corner of the structure */
  southWestBottom: { x: number; y: number; z: number };
  /** Optional dimensions - inferred from data if not provided */
  size?: { x: number; y: number; z: number };
  /** Y layers from bottom to top */
  blockLayersBottomToTop: string[][];
  /** Map single characters to block types */
  key: Record<string, { typeId: string; properties?: Record<string, string | number | boolean> }>;
  /** Entities within the structure */
  entities?: Array<{
    typeId: string;
    locationWithinVolume: { x: number; y: number; z: number };
  }>;
}

/**
 * A build program run recorded for a structure. Replaying the generate program
 * and then each edit program, in order and with the same seeds, reproduces the
 * saved .mcstructure.
 */
export interface IStructureProgramRecord {
  /** JavaScript source that defines `function build(api)`. */
  code: string;
  /** Seed for `api.random`/`api.pick`. */
  seed: number;
  /** When the program was run. */
  ranAt: string;
}

/**
 * Metadata about when/how the structure was generated.
 */
export interface IStructureGenerationMeta {
  /** When the structure was last generated */
  generatedAt: string;
  /** The AI model/tool that generated it (if known) */
  generatorModel?: string;
  /** The prompt or request that led to generation (if known) */
  prompt?: string;
  /**
   * Version of the design schema. 1.1.0 adds `program`/`edits` and makes
   * `design` optional; 1.0.0 files always have `design`.
   */
  schemaVersion: "1.0.0" | "1.1.0";
}

/**
 * The complete persisted structure design data.
 */
export interface IStructureDesignData {
  /** The block volume specification, when the structure came from a blockVolume. */
  design?: IBlockVolumeDesign;
  /** The build program that generated the structure, when it came from a program. */
  program?: IStructureProgramRecord;
  /**
   * Edit programs applied, in order, on top of `design` or `program`. Capped at
   * MAX_RECORDED_EDITS; `editsTruncated` is set once older edits were dropped.
   */
  edits?: IStructureProgramRecord[];
  /**
   * True when the history does not replay exactly: older edits were dropped, or
   * the first recorded edit applied to a structure with no recorded source.
   */
  editsTruncated?: boolean;
  /** Generation metadata */
  meta: IStructureGenerationMeta;
  /** What feature rule this structure was wired to (if any) */
  wiredTo?: string;
}

const MAX_RECORDED_EDITS = 20;

/**
 * Manages persistence of structure design data in accessory folders.
 * Follows the same pattern as ModelDesignDefinition and ImageEditsDefinition.
 */
export default class StructureDesignDefinition {
  private _file?: IFile;
  private _previewFile?: IFile;
  private _isLoaded: boolean = false;

  public data?: IStructureDesignData;
  public project?: Project;

  private _onLoaded = new EventDispatcher<StructureDesignDefinition, StructureDesignDefinition>();

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

  public get design(): IBlockVolumeDesign | undefined {
    return this.data?.design;
  }

  public get program(): IStructureProgramRecord | undefined {
    return this.data?.program;
  }

  public get edits(): IStructureProgramRecord[] {
    return this.data?.edits ?? [];
  }

  public get wiredTo(): string | undefined {
    return this.data?.wiredTo;
  }

  /**
   * Records a build program run and persists it. A generate run replaces any
   * previous design, program, and edits; an edit run is appended to the history.
   */
  async recordProgram(
    mode: "generate" | "edit",
    code: string,
    seed: number,
    options?: { generatorModel?: string; prompt?: string }
  ): Promise<void> {
    const now = new Date().toISOString();
    const record: IStructureProgramRecord = { code, seed, ranAt: now };
    const previous = this.data;
    const meta: IStructureGenerationMeta = {
      generatedAt: now,
      generatorModel: options?.generatorModel,
      prompt: options?.prompt,
      schemaVersion: "1.1.0",
    };

    if (mode === "generate" || !previous) {
      this.data = {
        program: mode === "generate" ? record : undefined,
        edits: mode === "edit" ? [record] : undefined,
        // An edit with no recorded history starts from an unknown base.
        editsTruncated: mode === "edit" ? true : undefined,
        meta,
        wiredTo: previous?.wiredTo,
      };
    } else {
      const edits = [...(previous.edits ?? []), record];
      const truncated = edits.length > MAX_RECORDED_EDITS;
      this.data = {
        ...previous,
        edits: truncated ? edits.slice(edits.length - MAX_RECORDED_EDITS) : edits,
        editsTruncated: truncated || previous.editsTruncated || undefined,
        meta,
      };
    }

    await this.save();
  }

  /**
   * Updates the design data and persists it.
   */
  async updateDesign(
    design: IBlockVolumeDesign,
    options?: {
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
      wiredTo: options?.wiredTo,
    };

    await this.save();
  }

  /**
   * Saves a preview image to the accessory folder.
   */
  async savePreview(imageData: Uint8Array): Promise<void> {
    if (!this._file || !this._file.parentFolder) {
      Log.debug("StructureDesignDefinition: Cannot save preview - no file set");
      return;
    }

    this._previewFile = this._file.parentFolder.ensureFile("preview.png");
    this._previewFile.setContent(imageData);
    await this._previewFile.saveContent(false);

    Log.debug(`StructureDesignDefinition: Saved preview to ${this._previewFile.storageRelativePath}`);
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
   * Creates or gets a StructureDesignDefinition for a ProjectItem's accessory folder.
   * Use this when you have the ProjectItem for the .mcstructure file.
   */
  static async ensureAsAccessoryOnProjectItem(
    projectItem: ProjectItem
  ): Promise<StructureDesignDefinition | undefined> {
    const accessoryFolder = await projectItem.ensureAccessoryFolder();
    const designFile = accessoryFolder.ensureFile("structure_design.json");

    return await StructureDesignDefinition.ensureOnFile(designFile, projectItem.project);
  }

  /**
   * Creates or gets a StructureDesignDefinition attached to a file.
   */
  static async ensureOnFile(
    file: IFile,
    project: Project,
    loadHandler?: IEventHandler<StructureDesignDefinition, StructureDesignDefinition>
  ): Promise<StructureDesignDefinition | undefined> {
    let structureDesign: StructureDesignDefinition | undefined;

    if (file.manager === undefined) {
      structureDesign = new StructureDesignDefinition();
      structureDesign.project = project;
      structureDesign.file = file;
      file.manager = structureDesign;
    }

    if (file.manager !== undefined && file.manager instanceof StructureDesignDefinition) {
      structureDesign = file.manager as StructureDesignDefinition;

      if (!structureDesign.isLoaded && loadHandler) {
        structureDesign.onLoaded.subscribe(loadHandler);
      }

      await structureDesign.load();

      return structureDesign;
    }

    return structureDesign;
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
