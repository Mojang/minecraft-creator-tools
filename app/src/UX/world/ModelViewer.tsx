import React, { Component } from "react";
import IFile from "../../storage/IFile";
import "./ModelViewer.css";
import VolumeEditor, { VolumeEditorViewMode } from "./VolumeEditor";
import BlockVolume from "../../minecraft/BlockVolume";
import IBlockVolumeBounds from "../../minecraft/IBlockVolumeBounds";
import Block from "../../minecraft/Block";
import CreatorTools from "../../app/CreatorTools";
import BlockEditor from "./BlockEditor";
import EntityPropertyEditor from "./EntityPropertyEditor";
import { Button, FormControl, IconButton, MenuItem, Select, SelectChangeEvent, Stack, Tooltip } from "@mui/material";
import Utilities from "../../core/Utilities";
import Log from "../../core/Log";
import { VideoLabel } from "../../UX/shared/components/feedback/labels/Labels";
import BlockbenchModel from "../../integrations/BlockbenchModel";
import StorageUtilities from "../../storage/StorageUtilities";
import { saveAs } from "file-saver";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCube, faUpload } from "@fortawesome/free-solid-svg-icons";
import Entity from "../../minecraft/Entity";
import WebUtilities from "../../UX/utils/WebUtilities";
import Project from "../../app/Project";
import ProjectItem from "../../app/ProjectItem";
import ModelGeometryDefinition from "../../minecraft/ModelGeometryDefinition";
import { ProjectItemType } from "../../app/IProjectItemData";
import ProjectItemUtilities from "../../app/ProjectItemUtilities";
import Location from "../../minecraft/Location";
import VanillaProjectManager from "../../minecraft/VanillaProjectManager";
import EntityTypeResourceDefinition from "../../minecraft/EntityTypeResourceDefinition";
import CreatorToolsHost from "../../app/CreatorToolsHost";
import IProjectTheme from "../../UX/types/IProjectTheme";

interface IModelViewerProps {
  creatorTools?: CreatorTools;
  heightOffset: number;
  theme?: IProjectTheme;
  readOnly?: boolean;
  project?: Project;
  projectItem?: ProjectItem;
  textureItem?: ProjectItem; // Optional: explicit texture item for the model (used by block viewer)
  entityTypeId?: string; // Optional: load vanilla entity by type ID (e.g., "pig" or "minecraft:pig")
  attachableTypeId?: string; // Optional: load vanilla attachable by type ID (e.g., "diamond_chestplate")

  // Direct content loading options - for headless rendering and external content
  geometryUrl?: string; // URL to load geometry JSON from
  textureUrl?: string; // URL to load texture from
  geometryData?: object; // Direct geometry JSON data
  textureData?: Uint8Array; // Direct texture binary data
  geometryId?: string; // Specific geometry identifier to use from the geometry file
  skipVanillaResources?: boolean; // When true, skip loading vanilla resources (default for URL/direct data loading)

  // Camera position for multi-angle rendering
  cameraX?: number;
  cameraY?: number;
  cameraZ?: number;

  // When true, use 100% height/width to fit within the parent container instead of viewport
  // Use this for embedded previews like sidebars. Default: false (use viewport sizing in readOnly mode)
  fitToContainer?: boolean;
}

interface IModelViewerState {
  blockVolume?: BlockVolume | undefined;
  model?: ModelGeometryDefinition | undefined;
  textureData?: Uint8Array | undefined;
  textureUrl?: string | undefined;
  selectedBlocks?: Block[] | undefined;
  selectedEntity?: Entity | undefined;
  entityTypeId?: string;
  skipVanillaResources?: boolean; // True when loading from URLs/direct data (headless mode)
  loadError?: string | undefined; // Error message if loading fails
  textureVariants?: string[]; // Available texture variant keys for multi-variant entities (e.g., cat)
  selectedTextureVariant?: string; // Currently selected texture variant key
  entityResourceDef?: EntityTypeResourceDefinition; // Kept for variant switching
  /** Base humanoid model for armor attachables (rendered underneath armor overlay) */
  baseModel?: ModelGeometryDefinition | undefined;
  baseTextureData?: Uint8Array | undefined;
  baseTextureUrl?: string | undefined;
  /** Optional tint color for entities with colored overlays (e.g., sheep wool). RGBA 0-1 range. */
  tintColor?: { r: number; g: number; b: number; a: number };
  /** When true, render texture as fully opaque (ignore alpha channel). */
  ignoreAlpha?: boolean;
}

export default class ModelViewer extends Component<IModelViewerProps, IModelViewerState> {
  _lastFile: IFile | undefined;
  _volumeEditor: VolumeEditor | undefined;
  _lastEntityTypeId: string | undefined;
  _lastAttachableTypeId: string | undefined;
  /** Generation counter to prevent stale async _update() calls from overwriting current state. */
  private _updateGeneration = 0;

  constructor(props: IModelViewerProps) {
    super(props);

    this._update = this._update.bind(this);
    this.loadFromModelItem = this.loadFromModelItem.bind(this);
    this.loadFromEntityTypeId = this.loadFromEntityTypeId.bind(this);
    this.loadFromAttachableTypeId = this.loadFromAttachableTypeId.bind(this);
    this._setVolumeEditor = this._setVolumeEditor.bind(this);
    this._resetViewClick = this._resetViewClick.bind(this);
    this._handleSelectedBlocksChanged = this._handleSelectedBlocksChanged.bind(this);
    this._handleEntitySelect = this._handleEntitySelect.bind(this);
    this.loadFromDirectData = this.loadFromDirectData.bind(this);
    this.loadFromUrls = this.loadFromUrls.bind(this);
    this._handleOpenInBlockbench = this._handleOpenInBlockbench.bind(this);
    this._handleUploadBbmodel = this._handleUploadBbmodel.bind(this);
    this._handleTextureVariantChange = this._handleTextureVariantChange.bind(this);

    this.state = {};
  }

  componentDidMount(): void {
    this._update();
  }

  componentDidUpdate(prevProps: IModelViewerProps): void {
    if (
      prevProps.entityTypeId !== this.props.entityTypeId ||
      prevProps.attachableTypeId !== this.props.attachableTypeId ||
      prevProps.geometryUrl !== this.props.geometryUrl ||
      prevProps.textureUrl !== this.props.textureUrl ||
      prevProps.geometryData !== this.props.geometryData ||
      prevProps.textureData !== this.props.textureData ||
      prevProps.projectItem !== this.props.projectItem
    ) {
      this._update();
    }
  }

  async _update() {
    // Increment generation so any prior in-flight _update() calls become stale.
    // This prevents a race condition where ComponentDidMount's async load finishes
    // AFTER ComponentDidUpdate triggers a new _update(), causing the second load
    // to overwrite the first with potentially empty/different data.
    const generation = ++this._updateGeneration;

    try {
      // Priority 1: Direct geometry data provided
      if (this.props.geometryData) {
        await this.loadFromDirectData(this.props.geometryData, this.props.textureData, this.props.textureUrl);
        return;
      }

      // Priority 2: Geometry URL provided
      if (this.props.geometryUrl) {
        await this.loadFromUrls(this.props.geometryUrl, this.props.textureUrl);
        return;
      }

      // Priority 3: Entity type ID provided - load from vanilla
      if (this.props.entityTypeId && this.props.entityTypeId !== this._lastEntityTypeId) {
        this._lastEntityTypeId = this.props.entityTypeId;
        // Check if a newer _update() has been triggered while we were deciding
        if (this._updateGeneration !== generation) return;
        await this.loadFromEntityTypeId(this.props.entityTypeId);
        return;
      }

      // Priority 3b: Attachable type ID provided - load from vanilla
      if (this.props.attachableTypeId && this.props.attachableTypeId !== this._lastAttachableTypeId) {
        this._lastAttachableTypeId = this.props.attachableTypeId;
        if (this._updateGeneration !== generation) return;
        await this.loadFromAttachableTypeId(this.props.attachableTypeId);
        return;
      }

      // Priority 4: Load from projectItem
      if (this.props.projectItem === undefined) {
        return;
      }

      if (this.props.projectItem.itemType === ProjectItemType.modelGeometryJson) {
        // Check if a newer _update() has been triggered
        if (this._updateGeneration !== generation) return;
        await this.loadFromModelItem(this.props.projectItem);
      }
    } catch (err: unknown) {
      // Only set error state if this is still the current update
      if (this._updateGeneration !== generation) return;
      const errorMessage = err instanceof Error ? err.message : "Failed to load model";
      Log.debug("ModelViewer: " + errorMessage);
      this.setState({ loadError: errorMessage });
    }
  }

  /**
   * Load model from direct data (geometry JSON object and optional texture data).
   * This is useful for headless rendering where data is passed directly.
   */
  async loadFromDirectData(geometryData: object, textureData?: Uint8Array, textureUrl?: string) {
    // Use skipVanillaResources from props, defaulting to false if not specified (load vanilla by default)
    const skipVanilla = this.props.skipVanillaResources === true;

    // Create an empty block volume (no ground blocks needed for direct model rendering)
    const blockVolume = new BlockVolume();
    blockVolume.setMaxDimensions(8, 8, 8);
    // Don't fill with ground blocks - we're rendering just the model without vanilla textures

    // Create a ModelGeometryDefinition from the raw data
    const modelDef = new ModelGeometryDefinition();
    modelDef.loadFromData(geometryData, this.props.geometryId);

    this.setState({
      blockVolume: blockVolume,
      model: modelDef,
      textureData: textureData,
      textureUrl: textureUrl,
      selectedBlocks: this.state.selectedBlocks,
      selectedEntity: this.state.selectedEntity,
      skipVanillaResources: skipVanilla,
    });
  }

  /**
   * Load model from URLs (geometry JSON URL and optional texture URL).
   * This is useful for loading content from external sources.
   */
  async loadFromUrls(geometryUrl: string, textureUrl?: string) {
    // Use skipVanillaResources from props, defaulting to false if not specified (load vanilla by default)
    const skipVanilla = this.props.skipVanillaResources === true;

    // Create an empty block volume (no ground blocks needed for direct model rendering)
    const blockVolume = new BlockVolume();
    blockVolume.setMaxDimensions(8, 8, 8);
    // Don't fill with ground blocks - we're rendering just the model without vanilla textures

    try {
      // Fetch geometry JSON
      const geoResponse = await fetch(geometryUrl);
      if (!geoResponse.ok) {
        Log.debugAlert(`Failed to fetch geometry from ${geometryUrl}: ${geoResponse.statusText}`);
        this.setState({
          blockVolume: blockVolume,
          model: undefined,
          textureData: undefined,
          textureUrl: undefined,
          skipVanillaResources: skipVanilla,
        });
        return;
      }

      const geoData = await geoResponse.json();
      const modelDef = new ModelGeometryDefinition();
      modelDef.loadFromData(geoData, this.props.geometryId);

      // Optionally fetch texture
      let textureData: Uint8Array | undefined;
      if (textureUrl) {
        try {
          const texResponse = await fetch(textureUrl);
          if (texResponse.ok) {
            const texBuffer = await texResponse.arrayBuffer();
            textureData = new Uint8Array(texBuffer);
          }
        } catch (texError) {
          Log.debugAlert(`Failed to fetch texture from ${textureUrl}: ${texError}`);
        }
      }

      this.setState({
        blockVolume: blockVolume,
        model: modelDef,
        textureData: textureData,
        textureUrl: textureUrl,
        selectedBlocks: this.state.selectedBlocks,
        selectedEntity: this.state.selectedEntity,
        skipVanillaResources: skipVanilla,
      });
    } catch (error) {
      Log.debugAlert(`Failed to load model from URL ${geometryUrl}: ${error}`);
      this.setState({
        blockVolume: blockVolume,
        model: undefined,
        textureData: undefined,
        textureUrl: undefined,
        skipVanillaResources: skipVanilla,
      });
    }
  }

  async loadFromModelItem(projectItem: ProjectItem) {
    if (!projectItem.isContentLoaded) {
      await projectItem.loadContent();
    }

    if (!projectItem.primaryFile) {
      return;
    }

    if (!projectItem.primaryFile.isContentLoaded) {
      await projectItem.primaryFile.loadContent();
    }

    const blockVolume = new BlockVolume();

    blockVolume.setMaxDimensions(8, 8, 8);
    blockVolume.fill("dirt", 0, 0, 0, 7, 0, 7);
    blockVolume.fill("grass_block", 0, 1, 0, 7, 1, 7);

    const modelDef = await ModelGeometryDefinition.ensureOnFile(projectItem.primaryFile);

    let textureFile: IFile | null = null;
    let textureData: Uint8Array | undefined = undefined;
    let fallbackTextureUrl: string | undefined;
    let textureVariants: string[] | undefined;
    let selectedTextureVariant: string | undefined;
    let entityResourceDef: EntityTypeResourceDefinition | undefined;

    // Check if this geometry has exactly one parent entity resource.
    // If so, we can offer a texture variant picker just like the entity type editor.
    let singleParentEntityResource: ProjectItem | undefined;
    if (projectItem.parentItems) {
      const entityResourceParents = projectItem.parentItems.filter(
        (rel) => rel.parentItem.itemType === ProjectItemType.entityTypeResource
      );
      if (entityResourceParents.length === 1) {
        singleParentEntityResource = entityResourceParents[0].parentItem;
      }
    }

    // If we have a single parent entity resource, extract variant info and load texture via variant key
    if (singleParentEntityResource && singleParentEntityResource.primaryFile) {
      await singleParentEntityResource.loadContent();
      const etrd = await EntityTypeResourceDefinition.ensureOnFile(singleParentEntityResource.primaryFile);

      if (etrd) {
        entityResourceDef = etrd;

        // Extract texture variant keys, filtering out overlay variants.
        // Two heuristics:
        // 1. Drop any key that is clearly derived from a shorter key (e.g., "white_tame" if "white" exists).
        // 2. Drop keys that share a common prefix with many siblings (e.g., "decor_white", "decor_blue", ...
        //    are likely decoration overlays, not standalone body textures).
        const textureKeys = etrd.texturesIdList;
        if (textureKeys && textureKeys.length > 0) {
          let filteredKeys: string[] | undefined;
          if (textureKeys.length > 1) {
            const keySet = new Set(textureKeys);

            // Count how many keys share each prefix (text before the last underscore)
            const prefixCounts = new Map<string, number>();
            for (const key of textureKeys) {
              const underscoreIdx = key.indexOf("_");
              if (underscoreIdx > 0) {
                const prefix = key.substring(0, underscoreIdx);
                prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
              }
            }

            filteredKeys = textureKeys.filter((key) => {
              // Heuristic 1: drop keys derived from a shorter key
              for (const other of keySet) {
                if (other !== key && key.startsWith(other + "_")) {
                  return false;
                }
              }
              // Heuristic 2: drop keys in a large prefix group (4+ siblings = likely overlays)
              const underscoreIdx = key.indexOf("_");
              if (underscoreIdx > 0) {
                const prefix = key.substring(0, underscoreIdx);
                if ((prefixCounts.get(prefix) || 0) >= 4) {
                  return false;
                }
              }
              return true;
            });
            if (filteredKeys.length === 0) {
              filteredKeys = textureKeys;
            }
          }
          textureVariants = filteredKeys && filteredKeys.length > 1 ? filteredKeys : undefined;
          selectedTextureVariant = textureVariants ? textureVariants[0] : textureKeys[0];

          // Load texture using the selected variant key
          const texturePath = etrd.getTextureByKey(selectedTextureVariant);
          if (texturePath) {
            const resolved = await this._loadTextureByPath(texturePath, this.props.project);
            textureData = resolved.textureData;
            if (!textureData && resolved.textureUrl) {
              fallbackTextureUrl = resolved.textureUrl;
            }
          }
        }
      }
    }

    // Method 0: Use explicit textureItem prop if provided (e.g., from block viewer)
    if (!textureData && !fallbackTextureUrl && this.props.textureItem) {
      Log.verbose(`[ModelViewer] Using textureItem prop: ${this.props.textureItem.projectPath}`);
      if (!this.props.textureItem.isContentLoaded) {
        await this.props.textureItem.loadContent();
      }
      textureFile = this.props.textureItem.primaryFile;
      if (textureFile) {
        if (!textureFile.isContentLoaded) {
          await textureFile.loadContent();
        }
        if (textureFile.content instanceof Uint8Array) {
          textureData = textureFile.content;
        } else {
          Log.verbose(`[ModelViewer] textureFile.content is not Uint8Array: ${typeof textureFile.content}`);
        }
      } else {
        Log.verbose(`[ModelViewer] textureItem has no primaryFile`);
      }
    } else {
      Log.verbose(`[ModelViewer] No textureItem prop provided`);
    }

    // Method 1: Try to get texture via cousin lookup (works when parent relationships are established)
    if (!textureData && projectItem.parentItems && projectItem.parentItems.length > 0) {
      const textureItem = ProjectItemUtilities.getCousinOfType(projectItem, ProjectItemType.texture);

      if (textureItem) {
        if (!textureItem.isContentLoaded) {
          await textureItem.loadContent();
        }

        textureFile = textureItem.primaryFile;

        if (textureFile) {
          if (!textureFile.isContentLoaded) {
            await textureFile.loadContent();
          }
          if (textureFile.content instanceof Uint8Array) {
            textureData = textureFile.content;
          }
        }
      }
    }

    // Method 2: If no texture found via cousin lookup, search project for texture with matching name
    if (!textureData && this.props.project) {
      const baseName = projectItem.primaryFile.name
        .replace(/\.geo\.json$/i, "")
        .replace(/\.json$/i, "")
        .toLowerCase();

      const textureItems = this.props.project.getItemsByType(ProjectItemType.texture);
      for (const texItem of textureItems) {
        if (!texItem.projectPath) continue;

        const texBaseName = texItem.projectPath
          .split("/")
          .pop()
          ?.replace(/\.(png|tga|jpg|jpeg)$/i, "")
          .toLowerCase();

        if (texBaseName === baseName) {
          if (!texItem.isContentLoaded) {
            await texItem.loadContent();
          }

          if (texItem.primaryFile) {
            if (!texItem.primaryFile.isContentLoaded) {
              await texItem.primaryFile.loadContent();
            }
            if (texItem.primaryFile.content instanceof Uint8Array) {
              textureData = texItem.primaryFile.content;
              break;
            }
          }
        }
      }
    }

    // Method 3: Check if texture is too small (likely blank/transparent) and use fallback
    // Also fallback if no texture found at all
    if (!textureData && !fallbackTextureUrl) {
      // Use a 2x2 magenta/black checkerboard PNG as fallback to make missing textures obvious
      // This is the classic "missing texture" pattern
      fallbackTextureUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4AWP4z8DAwMDAxMDAAAANHQEFj6xgAAAAAElFTkSuQmCC";
    } else if (textureData && textureData.length < 50) {
      // Only reject textures under 50 bytes - a valid minimal PNG is around 67+ bytes
      Log.verbose(`[ModelViewer] Texture too small (${textureData.length} bytes), using fallback`);
      // Small texture is likely corrupt, use fallback
      textureData = undefined;
      fallbackTextureUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4AWP4z8DAwMDAxMDAAAANHQEFj6xgAAAAAElFTkSuQmCC";
    } else if (textureData) {
      Log.verbose(`[ModelViewer] Using textureData with size: ${textureData.length}`);
    }

    Log.verbose(
      `[ModelViewer] Setting state: model=${!!modelDef}, textureData=${
        textureData?.length || 0
      }, textureUrl=${!!fallbackTextureUrl}`
    );

    this.setState({
      blockVolume: blockVolume,
      model: modelDef,
      textureData: textureData,
      textureUrl: fallbackTextureUrl,
      selectedBlocks: this.state.selectedBlocks,
      selectedEntity: this.state.selectedEntity,
      textureVariants: textureVariants,
      selectedTextureVariant: selectedTextureVariant,
      entityResourceDef: entityResourceDef,
    });
  }

  async loadFromEntityTypeId(typeId: string) {
    // Normalize the entity type ID
    const fullId = typeId.includes(":") ? typeId : `minecraft:${typeId}`;

    // First, try to load from the project if available
    if (this.props.project) {
      const projectModelData = await this._loadEntityFromProject(fullId);
      if (projectModelData) {
        return; // Successfully loaded from project
      }
    }

    // Empty block volume — the isolated ModelPreview platform handles visual ground.
    const blockVolume = new BlockVolume();
    blockVolume.setMaxDimensions(8, 8, 8);

    // Fall back to vanilla entity data
    const modelData = await VanillaProjectManager.getVanillaEntityModelData(typeId);

    if (!modelData) {
      // Custom entity with no vanilla equivalent - show ground only
      this.setState({
        blockVolume: blockVolume,
        model: undefined,
        textureData: undefined,
        textureUrl: undefined,
      });
      return;
    }

    if (!modelData.geometry || !modelData.modelDefinition) {
      // No geometry found - show ground only
      this.setState({
        blockVolume: blockVolume,
        model: undefined,
        textureData: undefined,
        textureUrl: undefined,
      });
      return;
    }

    this.setState((prevState) => ({
      blockVolume: blockVolume,
      model: modelData.modelDefinition,
      textureData: modelData.textureData,
      textureUrl: modelData.textureUrl,
      tintColor: modelData.tintColor,
      ignoreAlpha: modelData.ignoreAlpha,
      selectedBlocks: prevState.selectedBlocks,
      selectedEntity: prevState.selectedEntity,
      skipVanillaResources: true,
    }));
  }

  /**
   * Load a vanilla attachable (item with 3D model) by its type ID.
   * Resolves geometry and texture via VanillaProjectManager.
   */
  async loadFromAttachableTypeId(typeId: string) {
    const blockVolume = new BlockVolume();
    blockVolume.setMaxDimensions(8, 8, 8);

    const modelData = await VanillaProjectManager.getVanillaAttachableModelData(typeId);

    if (!modelData || !modelData.geometry || !modelData.modelDefinition) {
      this.setState({
        blockVolume: blockVolume,
        model: undefined,
        textureData: undefined,
        textureUrl: undefined,
        baseModel: undefined,
        baseTextureData: undefined,
        baseTextureUrl: undefined,
      });
      return;
    }

    this.setState((prevState) => ({
      blockVolume: blockVolume,
      model: modelData.modelDefinition,
      textureData: modelData.textureData,
      textureUrl: modelData.textureUrl,
      baseModel: modelData.baseModelDefinition,
      baseTextureData: modelData.baseTextureData,
      baseTextureUrl: modelData.baseTextureUrl,
      selectedBlocks: prevState.selectedBlocks,
      selectedEntity: prevState.selectedEntity,
      skipVanillaResources: true,
    }));
  }

  /**
   * Try to load entity model data from the current project.
   * Returns true if successfully loaded, false otherwise.
   */
  async _loadEntityFromProject(entityTypeId: string): Promise<boolean> {
    if (!this.props.project) {
      return false;
    }

    const project = this.props.project;

    // Look for entity type resource definitions that match the entity type ID
    const entityResourceItems = project.getItemsByType(ProjectItemType.entityTypeResource);

    for (const item of entityResourceItems) {
      if (!item.primaryFile) continue;

      await item.loadContent();

      const etrd = await EntityTypeResourceDefinition.ensureOnFile(item.primaryFile);
      if (!etrd || !etrd.id) continue;

      // Check if this entity resource matches the requested entity type
      // Match on full ID, or on short name (after colon) to handle namespace differences
      // e.g., "mc_myaddons:cat" should match "minecraft:cat" since both are "cat"
      const etrdShortId = etrd.id.includes(":") ? etrd.id.split(":")[1] : etrd.id;
      const requestedShortId = entityTypeId.includes(":") ? entityTypeId.split(":")[1] : entityTypeId;
      if (
        etrd.id === entityTypeId ||
        etrd.id === entityTypeId.replace("minecraft:", "") ||
        etrdShortId === requestedShortId
      ) {
        const geometryList = etrd.geometryList;

        if (!geometryList || geometryList.length === 0) {
          continue;
        }

        // Populate child items (geometry, textures, etc.) if not already done
        await etrd.addChildItems(project, item);

        // Find geometry and texture from project child items
        let modelDef: ModelGeometryDefinition | undefined;
        let textureData: Uint8Array | undefined;

        if (item.childItems) {
          for (const childRel of item.childItems) {
            const childItem = childRel.childItem;

            if (childItem.itemType === ProjectItemType.modelGeometryJson && childItem.primaryFile) {
              await childItem.loadContent();
              modelDef = await ModelGeometryDefinition.ensureOnFile(childItem.primaryFile);
            }

            if (childItem.itemType === ProjectItemType.texture && childItem.primaryFile) {
              await childItem.loadContent();

              if (childItem.primaryFile.content instanceof Uint8Array) {
                textureData = childItem.primaryFile.content;
              }
            }
          }
        }

        // Collect texture variant keys from the entity resource definition.
        // Filter out overlay-only variants (e.g., "_tame" suffixed keys for cats are
        // collar overlays that don't render well as standalone textures). Without
        // parsing render controllers we can't reliably detect overlays, so we use
        // two heuristics:
        // 1. Drop any key derived from a shorter key (e.g., "white_tame" if "white" exists).
        // 2. Drop keys in a large prefix group (4+ siblings like "decor_*" are likely overlays).
        const textureKeys = etrd.texturesIdList;
        let filteredKeys: string[] | undefined;
        if (textureKeys && textureKeys.length > 1) {
          const keySet = new Set(textureKeys);

          // Count how many keys share each prefix (text before the first underscore)
          const prefixCounts = new Map<string, number>();
          for (const key of textureKeys) {
            const underscoreIdx = key.indexOf("_");
            if (underscoreIdx > 0) {
              const prefix = key.substring(0, underscoreIdx);
              prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
            }
          }

          filteredKeys = textureKeys.filter((key) => {
            // Heuristic 1: drop keys derived from a shorter key
            for (const other of keySet) {
              if (other !== key && key.startsWith(other + "_")) {
                return false;
              }
            }
            // Heuristic 2: drop keys in a large prefix group (4+ siblings = likely overlays)
            const underscoreIdx = key.indexOf("_");
            if (underscoreIdx > 0) {
              const prefix = key.substring(0, underscoreIdx);
              if ((prefixCounts.get(prefix) || 0) >= 4) {
                return false;
              }
            }
            return true;
          });
          // Fall back to the full list if filtering removed everything
          if (filteredKeys.length === 0) {
            filteredKeys = textureKeys;
          }
        }
        const textureVariants = filteredKeys && filteredKeys.length > 1 ? filteredKeys : undefined;
        const selectedVariant = textureVariants ? textureVariants[0] : (textureKeys?.[0] ?? "default");

        // Load texture for the selected variant.
        let textureUrl: string | undefined;
        if (!textureData) {
          const texturePath = etrd.getTextureByKey(selectedVariant);
          if (texturePath) {
            const resolved = await this._loadTextureByPath(texturePath, project);
            textureData = resolved.textureData;
            textureUrl = resolved.textureUrl;
          }
        }

        if (modelDef && modelDef.defaultGeometry) {
          // Empty block volume — the isolated ModelPreview platform in VolumeEditor
          // handles the visual ground. Keeping the volume empty avoids rendering
          // an oversized block grid that dwarfs the entity model.
          const blockVolume = new BlockVolume();
          blockVolume.setMaxDimensions(8, 8, 8);

          this.setState((prevState) => ({
            blockVolume: blockVolume,
            model: modelDef,
            textureData: textureData,
            textureUrl: textureUrl,
            selectedBlocks: prevState.selectedBlocks,
            selectedEntity: prevState.selectedEntity,
            textureVariants: textureVariants,
            selectedTextureVariant: selectedVariant,
            entityResourceDef: etrd,
            skipVanillaResources: true,
          }));

          return true;
        }
      }
    }

    return false;
  }

  /**
   * Resolves a texture by its Minecraft resource path (e.g., "textures/entity/cat/calico").
   * Searches project items first, then falls back to vanilla data, then to a URL.
   */
  private async _loadTextureByPath(
    texturePath: string,
    project?: Project
  ): Promise<{ textureData?: Uint8Array; textureUrl?: string }> {
    let textureData: Uint8Array | undefined;

    // First, try to find the texture in the project (e.g., for gallery-created entities
    // where textures are copied into the project resource pack)
    if (project) {
      const textureItems = project.getItemsByType(ProjectItemType.texture);
      for (const texItem of textureItems) {
        if (!texItem.projectPath) continue;
        // Match by texture path suffix (e.g., "textures/entity/cat/calico" matches
        // a project path ending in "textures/entity/cat/calico.png")
        const normalizedPath = texItem.projectPath.replace(/\\/g, "/").replace(/\.(png|tga|jpg|jpeg)$/i, "");
        if (normalizedPath.endsWith(texturePath)) {
          if (!texItem.isContentLoaded) {
            await texItem.loadContent();
          }
          if (texItem.primaryFile) {
            if (!texItem.primaryFile.isContentLoaded) {
              await texItem.primaryFile.loadContent();
            }
            if (texItem.primaryFile.content instanceof Uint8Array) {
              textureData = texItem.primaryFile.content;
              break;
            }
          }
        }
      }
    }

    // Fall back to vanilla texture if not found in project
    if (!textureData) {
      const vanillaTextureData = await VanillaProjectManager.loadVanillaTexture(texturePath);
      if (vanillaTextureData) {
        textureData = vanillaTextureData;
      }
    }

    // URL fallback for web contexts
    if (!textureData) {
      return { textureUrl: CreatorToolsHost.contentWebRoot + `res/latest/van/serve/resource_pack/${texturePath}.png` };
    }

    return { textureData };
  }

  async _handleTextureVariantChange(event: SelectChangeEvent) {
    const variantKey = event.target.value;
    const etrd = this.state.entityResourceDef;
    if (!etrd) return;

    const texturePath = etrd.getTextureByKey(variantKey);
    if (!texturePath) return;

    const { textureData, textureUrl } = await this._loadTextureByPath(texturePath, this.props.project);

    this.setState((prevState) => ({
      ...prevState,
      textureData: textureData,
      textureUrl: textureUrl,
      selectedTextureVariant: variantKey,
    }));
  }

  _resetViewClick() {
    if (this._volumeEditor !== undefined) {
      this._volumeEditor.resetCamera();
    }
  }

  _setVolumeEditor(volumeEditor: VolumeEditor) {
    this._volumeEditor = volumeEditor;

    if (this._volumeEditor !== undefined && this._volumeEditor !== null) {
      this._volumeEditor.resize();
    }
  }

  _handleSelectedBlocksChanged(newSelectedBlocks: Block[] | undefined) {
    this.setState({
      blockVolume: this.state.blockVolume,
      selectedEntity: undefined,
      selectedBlocks: newSelectedBlocks,
    });
  }

  _generateTitleForEntity(entity: Entity, index: number) {
    const title = Utilities.humanifyMinecraftName(entity.typeId);

    return title + " " + index;
  }

  _handleEntitySelect(event: SelectChangeEvent<string>) {
    if (this.state === null || event.target.value === null || event.target.value === undefined) {
      return;
    }

    const result = event.target.value;

    if (result !== undefined) {
    }
  }

  async _handleOpenInBlockbench() {
    // If we have a project item, use the full export which includes textures and animations
    if (this.props.projectItem) {
      try {
        if (!this.props.projectItem.isContentLoaded) {
          await this.props.projectItem.loadContent();
        }

        if (this.props.projectItem.project) {
          await this.props.projectItem.project.processRelations(false);
        }

        const bbmodel = await BlockbenchModel.exportModel(this.props.projectItem);

        if (bbmodel) {
          const json = JSON.stringify(bbmodel);
          const baseName = StorageUtilities.getBaseFromName(this.props.projectItem.name);
          saveAs(new Blob([json], { type: "application/json" }), baseName + ".bbmodel");
          return;
        }
      } catch (err) {
        Log.debug("ModelViewer: Failed to export bbmodel from project item: " + err);
      }
    }

    // Fall back to exporting from the model definition directly
    if (this.state?.model) {
      const bbmodel = BlockbenchModel.exportFromDefinition(this.state.model);

      if (bbmodel) {
        const json = JSON.stringify(bbmodel);
        const name = bbmodel.name || "model";
        saveAs(new Blob([json], { type: "application/json" }), name + ".bbmodel");
        return;
      }
    }

    Log.debug("ModelViewer: No model available to export as bbmodel");
  }

  async _handleUploadBbmodel(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !this.props.project) {
      return;
    }

    try {
      const jsonContent = await file.text();
      const bbm = BlockbenchModel.ensureFromContent(jsonContent);
      await bbm.integrateIntoProject(this.props.project);
      await this.props.project.save();
      await this.props.project.inferProjectItemsFromFiles(true);

      // Reload the viewer to show the updated model
      if (this.props.projectItem) {
        await this.loadFromModelItem(this.props.projectItem);
      }
    } catch (err) {
      Log.error("Failed to import bbmodel: " + err);
    }

    // Reset the file input so the same file can be re-uploaded
    event.target.value = "";
  }

  render() {
    // Show error state if loading failed
    if (this.state !== null && this.state.loadError) {
      return (
        <div className="mov-loading-area">
          <div className="mov-error-message">{this.state.loadError}</div>
          <button
            className="mov-retry-button"
            onClick={() => {
              this._lastEntityTypeId = undefined;
              this.setState({ loadError: undefined }, () => this._update());
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    let interior = (
      <div className="mov-loading-area">
        <div className="mov-loading-spinner" />
        <span>Loading model...</span>
      </div>
    );
    let selectionDetails = <></>;
    let visibleAreaCss = "mov-threedarea-lg";
    // For readOnly mode (headless rendering), use heightOffset of 0 to fill the entire viewport
    let canvasHeight = this.props.readOnly ? 0 : this.props.heightOffset + 170;

    const width = WebUtilities.getWidth();

    if (this.props.readOnly) {
      // Keep canvasHeight at 0 for full viewport fill - no adjustment needed
    }

    const height = "calc(100vh - " + this.props.heightOffset + "px)";
    const threedHeight = "calc(100vh - " + (this.props.heightOffset + 180) + "px)";

    const entityTools: any[] = [];

    if (this.state !== null && this.state.blockVolume !== undefined) {
      let viewBounds: IBlockVolumeBounds | undefined;
      const volume = this.state.blockVolume;

      let entity = new Entity();

      entity.id = "entity1";
      entity.typeId = "minecraft:armor_stand";
      // Adjust entity position based on whether we have ground blocks
      entity.location = this.state.skipVanillaResources
        ? new Location(3.5, 0.0, 3.5) // No ground blocks, position at origin
        : new Location(3.5, 2.0, 3.5); // Position above the grass blocks (y=1 surface + 1 block)
      entity.customModel = this.state.model;
      entity.customTextureData = this.state.textureData;
      entity.customTextureUrl = this.state.textureUrl;
      entity.customTintColor = this.state.tintColor;
      entity.customIgnoreAlpha = this.state.ignoreAlpha;

      // Build entity list — includes optional base humanoid model for armor attachables
      const entities: Entity[] = [];

      if (this.state.baseModel) {
        const baseEntity = new Entity();
        baseEntity.id = "base_humanoid";
        baseEntity.typeId = "minecraft:player";
        baseEntity.location = entity.location;
        baseEntity.customModel = this.state.baseModel;
        baseEntity.customTextureData = this.state.baseTextureData;
        baseEntity.customTextureUrl = this.state.baseTextureUrl;
        entities.push(baseEntity);
      }

      entities.push(entity);

      // Use a key that includes the selected texture variant so that changing the
      // variant forces a complete VolumeEditor remount.  VolumeEditor creates its
      // BabylonJS scene once during componentDidMount and does not re-render
      // entity meshes on prop changes, so a key change is the simplest way to
      // get the new texture data on screen.
      const volumeKey = "ve_" + (this.state.selectedTextureVariant || "default");

      interior = (
        <VolumeEditor
          key={volumeKey}
          onSelectedBlocksChanged={this._handleSelectedBlocksChanged}
          blockVolume={volume}
          entities={entities}
          heightOffset={canvasHeight}
          viewBounds={viewBounds}
          viewMode={VolumeEditorViewMode.ModelPreview}
          skipVanillaResources={this.state.skipVanillaResources}
          cameraX={this.props.cameraX}
          cameraY={this.props.cameraY}
          cameraZ={this.props.cameraZ}
          ref={(c: VolumeEditor) => this._setVolumeEditor(c)}
        />
      );
    }

    if (
      this.state !== null &&
      this.state.selectedEntity !== undefined &&
      this.props.project &&
      this.props.theme &&
      this.props.creatorTools
    ) {
      visibleAreaCss = "mov-threedarea";
      selectionDetails = (
        <div
          className="mov-selectionarea"
          style={{
            minHeight: threedHeight,
            maxHeight: threedHeight,
          }}
        >
          <EntityPropertyEditor
            creatorTools={this.props.creatorTools}
            theme={this.props.theme}
            project={this.props.project}
            entity={this.state.selectedEntity}
          />
        </div>
      );
    } else if (
      this.state !== null &&
      this.state.selectedBlocks !== undefined &&
      this.props.theme &&
      this.props.creatorTools
    ) {
      visibleAreaCss = "mov-threedarea";
      selectionDetails = (
        <div
          className="mov-selectionarea"
          style={{
            minHeight: threedHeight,
            maxHeight: threedHeight,
          }}
        >
          <BlockEditor
            creatorTools={this.props.creatorTools}
            theme={this.props.theme}
            blocks={this.state.selectedBlocks}
          />
        </div>
      );
    }

    let blockAdder = <></>;

    if (this._volumeEditor !== undefined) {
      this._volumeEditor.resize();
    }

    // In readOnly mode, hide most toolbar items and just show the 3D view
    // Show texture variant picker if multiple variants are available
    if (this.props.readOnly) {
      const sizeStyle = this.props.fitToContainer
        ? { height: "100%", width: "100%" }
        : { height: "100vh", width: "100vw" };

      const variantPicker =
        this.state?.textureVariants && this.state.textureVariants.length > 1 ? (
          <div style={{ position: "absolute", top: 8, left: 8, zIndex: 10 }}>
            <FormControl size="small">
              <Select
                value={this.state.selectedTextureVariant || ""}
                onChange={this._handleTextureVariantChange}
                aria-label="Select texture variant"
                sx={{
                  fontSize: "0.75rem",
                  height: 28,
                  minWidth: 100,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  color: "#fff",
                  "& .MuiSelect-icon": { color: "#fff" },
                }}
              >
                {this.state.textureVariants.map((variant) => (
                  <MenuItem key={variant} value={variant} sx={{ fontSize: "0.75rem" }}>
                    {Utilities.humanifyMinecraftName(variant)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        ) : null;

      return (
        <div className="mov-area mov-area-readonly" style={{ ...sizeStyle, position: "relative" }}>
          {variantPicker}
          <div className="mov-threedarea-lg mov-threedarea-readonly">{interior}</div>
        </div>
      );
    }

    return (
      <div
        className="mov-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="mov-toolbar">
          <div className="mov-toolbar-area">
            <div className="mov-toolbar-inner">
              <Stack direction="row" spacing={1} alignItems="center" aria-label="Model viewer toolbar">
                <IconButton onClick={this._resetViewClick} title="Reset Camera" size="small">
                  <VideoLabel />
                </IconButton>
                {this.state?.model && (
                  <Tooltip title="Download as Blockbench model (.bbmodel)">
                    <Button
                      onClick={this._handleOpenInBlockbench}
                      size="small"
                      startIcon={<FontAwesomeIcon icon={faCube} />}
                      sx={{ textTransform: "none", fontSize: "0.8rem" }}
                    >
                      Edit in Blockbench
                    </Button>
                  </Tooltip>
                )}
                {this.props.project && (
                  <Tooltip title="Upload a Blockbench model (.bbmodel) to integrate into this project">
                    <Button
                      component="label"
                      size="small"
                      startIcon={<FontAwesomeIcon icon={faUpload} />}
                      sx={{ textTransform: "none", fontSize: "0.8rem" }}
                    >
                      Upload .bbmodel
                      <input type="file" accept=".bbmodel" hidden onChange={this._handleUploadBbmodel} />
                    </Button>
                  </Tooltip>
                )}
                {this.state?.textureVariants && this.state.textureVariants.length > 1 && (
                  <FormControl size="small" sx={{ position: "relative", top: -1 }}>
                    <Select
                      value={this.state.selectedTextureVariant || ""}
                      onChange={this._handleTextureVariantChange}
                      aria-label="Select texture variant"
                      sx={{ fontSize: "0.8rem", height: 32, minWidth: 120 }}
                    >
                      {this.state.textureVariants.map((variant) => (
                        <MenuItem key={variant} value={variant} sx={{ fontSize: "0.8rem" }}>
                          {Utilities.humanifyMinecraftName(variant)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Stack>
            </div>
            {entityTools}
          </div>
        </div>
        <div className={visibleAreaCss}>{interior}</div>
        {selectionDetails}
        {blockAdder}
      </div>
    );
  }
}
