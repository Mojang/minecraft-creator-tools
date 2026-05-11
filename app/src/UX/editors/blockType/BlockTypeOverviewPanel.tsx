/**
 * BlockTypeOverviewPanel
 *
 * This component displays an overview of a block type, including:
 * 1. A block viewer showing the block's 3D preview
 * 2. A summary of base components
 * 3. A list of permutations with their components
 *
 * Each section has a clickable link that navigates to the appropriate tab.
 *
 * BLOCK RENDERING MODES:
 * ----------------------
 * Blocks can be rendered in two ways:
 *
 * 1. SIMPLE BLOCKS (unit cube + textures):
 *    - geometry = "minecraft:geometry.full_block" or no geometry component
 *    - Textures defined via blocks.json or material_instances component
 *    - Renders as a standard unit cube with face textures
 *
 * 2. COMPLEX BLOCKS (custom geometry):
 *    - geometry = custom model identifier (e.g., "geometry.my_block")
 *    - Model linked from minecraft:geometry component
 *    - Textures linked from minecraft:material_instances component
 *    - Uses ModelViewer to render the custom 3D model
 *
 * DEPENDENCY CHAIN:
 * -----------------
 * BlockTypeBehavior → modelGeometryJson (via geometry component)
 *                   → terrainTextureCatalogResourceJson (via material_instances)
 *                   → texture (from terrain_texture.json references)
 *
 * The child items are populated via BlockTypeDefinition.addChildItems().
 */
import { Component } from "react";
import BlockTypeDefinition from "../../../minecraft/BlockTypeDefinition";
import CreatorTools from "../../../app/CreatorTools";
import Project from "../../../app/Project";
import ProjectItem from "../../../app/ProjectItem";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { EditorContentPanel } from "../../appShell/EditorContentPanel";
import ModelViewer from "../../world/ModelViewer";
import Database from "../../../minecraft/Database";
import DataFormUtilities from "../../../dataform/DataFormUtilities";
import SummarizerEvaluator from "../../../dataform/SummarizerEvaluator";
import Utilities from "../../../core/Utilities";
import BlockComponentIcon, { getBlockComponentColor } from "./BlockComponentIcon";
import IManagedComponent from "../../../minecraft/IManagedComponent";
import Log from "../../../core/Log";
import "./BlockTypeOverviewPanel.css";
import IProjectTheme from "../../types/IProjectTheme";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import { WithLocalizationProps, withLocalization } from "../../withLocalization";

interface IBlockTypeOverviewPanelProps extends WithLocalizationProps {
  blockType: BlockTypeDefinition;
  creatorTools: CreatorTools;
  project: Project;
  item?: ProjectItem;
  heightOffset: number;
  theme: IProjectTheme;
  onNavigateToTab: (tabId: string) => void;
}

interface IComponentSummary {
  componentId: string;
  displayName: string;
  summary?: string;
  slotColor: string;
}

interface IPermutationSummary {
  permutationIndex: number;
  condition: string;
  displayName: string;
  components: IComponentSummary[];
}

interface IBlockTypeOverviewPanelState {
  isLoaded: boolean;
  baseComponents: IComponentSummary[];
  permutations: IPermutationSummary[];
  stateCount: number;
  geometryItem?: ProjectItem;
  textureItem?: ProjectItem;
  textureData?: Uint8Array; // Loaded texture data for unit cube blocks
  isSimpleBlock: boolean; // True if block uses minecraft:geometry.full_block or no geometry
  expectedTextureIds?: string[]; // Debug: texture IDs expected from blocks.json
}

class BlockTypeOverviewPanel extends Component<
  IBlockTypeOverviewPanelProps,
  IBlockTypeOverviewPanelState
> {
  constructor(props: IBlockTypeOverviewPanelProps) {
    super(props);

    this._handleBaseClick = this._handleBaseClick.bind(this);
    this._handlePermutationsClick = this._handlePermutationsClick.bind(this);
    this._handleStatesClick = this._handleStatesClick.bind(this);

    this.state = {
      isLoaded: false,
      baseComponents: [],
      permutations: [],
      stateCount: 0,
      geometryItem: undefined,
      textureItem: undefined,
      textureData: undefined,
      isSimpleBlock: true,
      expectedTextureIds: undefined,
    };
  }

  componentDidMount(): void {
    this._loadData();
  }

  componentDidUpdate(prevProps: IBlockTypeOverviewPanelProps): void {
    if (prevProps.blockType !== this.props.blockType || prevProps.item !== this.props.item) {
      this._loadData();
    }
  }

  async _loadData() {
    const blockType = this.props.blockType;

    // Ensure dependencies are loaded to get childItems (geometry, textures, etc.)
    if (this.props.item) {
      await this.props.item.ensureDependencies();
    }

    // Use the block type's isUnitCube property which handles:
    // 1. minecraft:unit_cube component (legacy)
    // 2. geometry = "minecraft:geometry.full_block" or "geometry.full_block"
    // 3. No geometry component at all
    const isSimpleBlock = blockType.isUnitCube;

    // Find geometry and texture items from child items
    let geometryItem: ProjectItem | undefined = undefined;
    let textureItem: ProjectItem | undefined = undefined;
    let expectedTextureIds: string[] | undefined = undefined;

    // For unit cube blocks, get expected texture IDs from blocks.json (for info panel display)
    if (isSimpleBlock && this.props.project) {
      expectedTextureIds = await blockType.getTextureListFromBlocksCatalog(this.props.project);
    }

    // Use getTextureItems to get the correct specific texture for this block
    // This looks up textures via material_instances/blocks.json → terrain_texture.json → texture file chain
    if (this.props.item && this.props.project) {
      const textureItems = await blockType.getTextureItems(this.props.item, this.props.project);

      if (textureItems) {
        const textureKeys = Object.keys(textureItems);

        // Find a texture with actual content (prefer larger files)
        let bestTextureItem: ProjectItem | undefined;
        let bestTextureSize = 0;

        for (const texKey of textureKeys) {
          const texItem = textureItems[texKey];
          if (!texItem.isContentLoaded) {
            await texItem.loadContent();
          }
          const texFile = texItem.primaryFile;
          if (texFile && texFile.content instanceof Uint8Array) {
            const size = texFile.content.length;
            if (size > 200 && size > bestTextureSize) {
              bestTextureItem = texItem;
              bestTextureSize = size;
            }
          }
        }

        if (bestTextureItem) {
          textureItem = bestTextureItem;
        } else if (textureKeys.length > 0) {
          // Fall back to first texture
          textureItem = textureItems[textureKeys[0]];
        }
      }
    }

    // Look through childItems to find geometry, and fallback textures if needed
    if (this.props.item && this.props.item.childItems) {
      for (const childRef of this.props.item.childItems) {
        const childItem = childRef.childItem;

        if (childItem.itemType === ProjectItemType.modelGeometryJson) {
          geometryItem = childItem;
        }

        // Only use direct texture children as fallback if we don't already have a texture
        if (!textureItem && childItem.itemType === ProjectItemType.texture) {
          textureItem = childItem;
        }

        // Also check for textures through terrain texture catalog → texture chain
        // But only if we don't already have a texture (from getTextureItems or direct child)
        if (!textureItem && childItem.itemType === ProjectItemType.terrainTextureCatalogResourceJson) {
          // Ensure terrain texture catalog's dependencies are loaded
          await childItem.ensureDependencies();

          if (childItem.childItems) {
            // Look for a texture that is likely visible (not blank/transparent)
            // Prefer textures with larger file sizes as they're more likely to have actual content
            let bestTextureItem: ProjectItem | undefined;
            let bestTextureSize = 0;

            for (const texRef of childItem.childItems) {
              if (texRef.childItem.itemType === ProjectItemType.texture) {
                const texItem = texRef.childItem;
                // Load content to check file size
                if (!texItem.isContentLoaded) {
                  await texItem.loadContent();
                }
                const texFile = texItem.primaryFile;
                if (texFile && texFile.content instanceof Uint8Array) {
                  const size = texFile.content.length;
                  // Prefer larger textures (more likely to have visible content)
                  // Skip very small textures (< 200 bytes likely transparent/blank)
                  if (size > 200 && size > bestTextureSize) {
                    bestTextureItem = texItem;
                    bestTextureSize = size;
                  }
                }
              }
            }

            if (bestTextureItem) {
              textureItem = bestTextureItem;
            } else if (childItem.childItems.length > 0) {
              // Fall back to first texture if all are small
              for (const texRef of childItem.childItems) {
                if (texRef.childItem.itemType === ProjectItemType.texture) {
                  textureItem = texRef.childItem;
                  break;
                }
              }
            }
          }
        }
      }
    }

    // Load base components
    const baseComponents = await this._getComponentSummaries(blockType.getComponents());

    // Load permutations
    const permutations: IPermutationSummary[] = [];
    const managedPermutations = blockType.getManagedPermutations();

    if (managedPermutations) {
      for (let i = 0; i < managedPermutations.length; i++) {
        const perm = managedPermutations[i];
        if (perm) {
          const components = await this._getComponentSummaries(perm.getComponents());
          const condition = perm.condition || "(no condition)";
          permutations.push({
            permutationIndex: i,
            condition: condition,
            displayName: `Permutation ${i + 1}`,
            components,
          });
        }
      }
    }

    // Count states
    const states = blockType.getStates();
    const stateCount = states ? Object.keys(states).length : 0;

    // For unit cube blocks, load the texture data for rendering
    let textureData: Uint8Array | undefined = undefined;
    if (isSimpleBlock && textureItem) {
      try {
        if (!textureItem.isContentLoaded) {
          await textureItem.loadContent();
        }
        const texFile = textureItem.primaryFile;
        if (texFile && texFile.content instanceof Uint8Array) {
          textureData = texFile.content;
        }
      } catch {
        // Continue without texture data
      }
    }

    this.setState({
      isLoaded: true,
      baseComponents,
      permutations,
      stateCount,
      geometryItem,
      textureItem,
      textureData,
      expectedTextureIds,
      isSimpleBlock,
    });

    Log.verbose(
      `[BlockTypeOverviewPanel] State set: geometryItem=${geometryItem?.projectPath}, textureItem=${textureItem?.projectPath}, isSimpleBlock=${isSimpleBlock}`
    );
  }

  async _getComponentSummaries(components: IManagedComponent[]): Promise<IComponentSummary[]> {
    const summaries: IComponentSummary[] = [];

    for (const comp of components) {
      const summary = await this._getComponentSummary(comp.id, comp.getData());
      summaries.push(summary);
    }

    return summaries;
  }

  async _getComponentSummary(componentId: string, componentData: any): Promise<IComponentSummary> {
    const formId = componentId.replace(/:/gi, "_").replace(/\./gi, "_");
    const displayName = Utilities.humanifyMinecraftName(componentId);
    const slotColor = getBlockComponentColor(componentId);

    // Ensure form is loaded before trying to access it
    await Database.ensureFormLoaded("block", formId);
    const form = Database.getForm("block", formId);

    if (!form || !componentData || (typeof componentData !== "object" && typeof componentData !== "number")) {
      return { componentId, displayName, slotColor };
    }

    try {
      let summarizer = form.summarizer;
      if (!summarizer && form.summarizerId) {
        summarizer = await DataFormUtilities.loadSummarizerById(form.summarizerId);
      }

      if (!summarizer) {
        return { componentId, displayName, slotColor };
      }

      const evaluator = new SummarizerEvaluator();
      const result = evaluator.evaluate(summarizer, componentData, form);

      if (result.phrases.length > 0) {
        let text = result.asSentence;
        if (text.length > 0) {
          text = text.charAt(0).toUpperCase() + text.slice(1);
        }
        return { componentId, displayName, summary: text, slotColor };
      }
    } catch (e) {
      // Ignore errors and return without summary
    }

    return { componentId, displayName, slotColor };
  }

  _handleBaseClick() {
    this.props.onNavigateToTab("components");
  }

  _handlePermutationsClick() {
    this.props.onNavigateToTab("components");
  }

  _handleStatesClick() {
    this.props.onNavigateToTab("states");
  }

  _renderComponentList(components: IComponentSummary[]) {
    if (components.length === 0) {
      return <div className="btop-emptyMessage">{this.props.intl.formatMessage({ id: "project_editor.block_overview.no_components" })}</div>;
    }

    return (
      <div className="btop-componentList">
        {components.map((comp) => (
          <div key={comp.componentId} className="btop-componentRow" title={comp.componentId}>
            <div className="btop-componentIcon" style={{ "--slot-color": comp.slotColor } as React.CSSProperties}>
              <BlockComponentIcon componentId={comp.componentId} size={20} />
            </div>
            <span className="btop-componentText">
              {comp.summary ? (
                <>
                  <strong>{comp.displayName}:</strong> {comp.summary}
                </>
              ) : (
                comp.displayName
              )}
            </span>
          </div>
        ))}
      </div>
    );
  }

  _renderPermutation(perm: IPermutationSummary) {
    return (
      <div key={perm.permutationIndex} className="btop-permutationSection">
        <div className="btop-permutationHeader">
          <span className="btop-permutationName">{perm.displayName}</span>
          <span className="btop-permutationCondition" title={perm.condition}>
            {perm.condition.length > 40 ? perm.condition.substring(0, 37) + "..." : perm.condition}
          </span>
        </div>
        {this._renderComponentList(perm.components)}
      </div>
    );
  }

  render() {
    const blockType = this.props.blockType;
    const blockId = blockType.id || "unknown";

    // Get geometry identifier if available
    const geometryId = blockType.geometryIdentifier;
    const { geometryItem, textureItem, textureData, isSimpleBlock } = this.state;

    // Determine what to render for the block preview
    let blockPreviewContent: React.ReactNode;

    if (!isSimpleBlock && geometryItem) {
      // Complex block with custom geometry - use ModelViewer
      blockPreviewContent = (
        <ModelViewer
          creatorTools={this.props.creatorTools}
          project={this.props.project}
          projectItem={geometryItem}
          textureItem={textureItem}
          heightOffset={0}
          theme={this.props.theme}
          readOnly={true}
        />
      );
    } else if (isSimpleBlock && textureData) {
      // Unit cube block with texture - render using ModelViewer with generated geometry
      // Create a standard 16x16x16 unit cube geometry (1 block)
      // The geometry description is simplified since ModelViewer only needs identifier and texture size
      const unitCubeGeometry = {
        "minecraft:geometry": [
          {
            description: {
              identifier: "geometry.unit_cube_preview",
              texture_width: 16,
              texture_height: 16,
            },
            bones: [
              {
                name: "body",
                pivot: [0, 0, 0],
                cubes: [
                  {
                    origin: [-8, 0, -8],
                    size: [16, 16, 16],
                    uv: [0, 0],
                  },
                ],
              },
            ],
          },
        ],
      };

      blockPreviewContent = (
        <ModelViewer
          creatorTools={this.props.creatorTools}
          project={this.props.project}
          geometryData={unitCubeGeometry}
          textureData={textureData}
          heightOffset={0}
          theme={this.props.theme}
          readOnly={true}
          skipVanillaResources={true}
        />
      );
    } else {
      // No geometry or no texture - show info panel
      const expectedTextures = this.state.expectedTextureIds;
      blockPreviewContent = (
        <div className="btop-blockPreviewInfo">
          <div className="btop-blockIcon">
            <span className="btop-blockIconEmoji">🧱</span>
          </div>
          <div className="btop-blockDetails">
            <div className="btop-blockId">{blockId}</div>
            {geometryId && (
              <div className="btop-blockGeometry">
                <span className="btop-detailLabel">{this.props.intl.formatMessage({ id: "project_editor.block_overview.geometry_label" })}</span> {geometryId}
              </div>
            )}
            {isSimpleBlock && expectedTextures && expectedTextures.length > 0 && (
              <div className="btop-blockGeometry">
                <span className="btop-detailLabel">{this.props.intl.formatMessage({ id: "project_editor.block_overview.textures_label" })}</span> {expectedTextures.join(", ")}
              </div>
            )}
            {isSimpleBlock && (!expectedTextures || expectedTextures.length === 0) && (
              <div className="btop-blockGeometry">
                <span className="btop-detailLabel">{this.props.intl.formatMessage({ id: "project_editor.block_overview.unit_cube_label" })}</span> {this.props.intl.formatMessage({ id: "project_editor.block_overview.no_textures" })}
              </div>
            )}
            <div className="btop-blockStats">
              <span className="btop-stat">
                {this.props.intl.formatMessage({ id: "project_editor.block_overview.state_count_stat" }, { count: this.state.stateCount })}
              </span>
              <span className="btop-statSep">•</span>
              <span className="btop-stat">
                {this.props.intl.formatMessage({ id: "project_editor.block_overview.component_count_stat" }, { count: this.state.baseComponents.length })}
              </span>
              <span className="btop-statSep">•</span>
              <span className="btop-stat">
                {this.props.intl.formatMessage({ id: "project_editor.block_overview.permutation_count_stat" }, { count: this.state.permutations.length })}
              </span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={"btop-outer" + (CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? " btop-outer-dark" : " btop-outer-light")}>
        <div className="btop-previewSection">
          <EditorContentPanel theme={this.props.theme} variant="raised" header={this.props.intl.formatMessage({ id: "project_editor.block_overview.block_preview" })}>
            <div className="btop-blockViewer">{blockPreviewContent}</div>
            <div className="btop-modelHint">{this.props.intl.formatMessage({ id: "project_editor.block_overview.drag_hint" })}</div>
          </EditorContentPanel>
        </div>
        <div className="btop-detailsSection">
          <EditorContentPanel theme={this.props.theme} variant="raised" header={this.props.intl.formatMessage({ id: "project_editor.block_overview.block_config" })}>
            <div className="btop-detailsScroll">
              {/* States summary */}
              <div className="btop-sectionGroup">
                <div className="btop-groupHeader" onClick={this._handleStatesClick} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._handleStatesClick(); } }} role="button" tabIndex={0}>
                  <span className="btop-groupName">{this.props.intl.formatMessage({ id: "project_editor.block_overview.states_count" }, { count: this.state.stateCount })}</span>
                  <span className="btop-groupLink">{this.props.intl.formatMessage({ id: "common.edit" })}</span>
                </div>
                {this.state.stateCount > 0 ? (
                  <div className="btop-stateInfo">
                    {this.props.intl.formatMessage({ id: "project_editor.block_overview.states_info" }, { count: this.state.stateCount })}
                  </div>
                ) : (
                  <div className="btop-emptyMessage">{this.props.intl.formatMessage({ id: "project_editor.block_overview.no_states" })}</div>
                )}
              </div>

              {/* Base Components */}
              <div className="btop-sectionGroup">
                <div className="btop-groupHeader" onClick={this._handleBaseClick} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._handleBaseClick(); } }} role="button" tabIndex={0}>
                  <span className="btop-groupName">{this.props.intl.formatMessage({ id: "project_editor.block_overview.base_components_count" }, { count: this.state.baseComponents.length })}</span>
                  <span className="btop-groupLink">{this.props.intl.formatMessage({ id: "common.edit" })}</span>
                </div>
                {this._renderComponentList(this.state.baseComponents)}
              </div>

              {/* Permutations */}
              {this.state.permutations.length > 0 && (
                <div className="btop-sectionGroup">
                  <div className="btop-groupHeader" onClick={this._handlePermutationsClick} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._handlePermutationsClick(); } }} role="button" tabIndex={0}>
                    <span className="btop-groupName">{this.props.intl.formatMessage({ id: "project_editor.block_overview.permutations_count" }, { count: this.state.permutations.length })}</span>
                    <span className="btop-groupLink">{this.props.intl.formatMessage({ id: "common.edit" })}</span>
                  </div>
                  {this.state.permutations.map((perm) => this._renderPermutation(perm))}
                </div>
              )}
            </div>
          </EditorContentPanel>
        </div>
      </div>
    );
  }
}

export default withLocalization(BlockTypeOverviewPanel);
