/**
 * EntityTypeOverviewPanel
 *
 * This component displays an overview of an entity type, including:
 * 1. A model viewer showing the entity's 3D model
 * 2. A summary of default (base) components
 * 3. A list of component groups with their components
 *
 * Each component group and the default components section has a clickable link
 * that navigates to the Components tab with the appropriate item selected.
 */
import { Component } from "react";
import EntityTypeDefinition from "../../../minecraft/EntityTypeDefinition";
import CreatorTools from "../../../app/CreatorTools";
import Project from "../../../app/Project";
import ProjectItem from "../../../app/ProjectItem";
import { ProjectItemType } from "../../../app/IProjectItemData";
import ModelViewer from "../../world/ModelViewer";
import { EditorContentPanel } from "../../appShell/EditorContentPanel";
import Database from "../../../minecraft/Database";
import DataFormUtilities from "../../../dataform/DataFormUtilities";
import SummarizerEvaluator from "../../../dataform/SummarizerEvaluator";
import Utilities from "../../../core/Utilities";
import ComponentIcon, { getComponentColor } from "../../shared/components/icons/ComponentIcon";
import IManagedComponent from "../../../minecraft/IManagedComponent";
import "./EntityTypeOverviewPanel.css";
import IProjectTheme from "../../types/IProjectTheme";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import { mcColors } from "../../hooks/theme/mcColors";
import { getComponentDescription } from "../../../minecraft/ComponentDescriptions";
import { getFriendlyComponentGroupName, getFriendlyComponentName } from "../../utils/ComponentFriendlyNames";
import { WithLocalizationProps, withLocalization } from "../../withLocalization";

interface IEntityTypeOverviewPanelProps extends WithLocalizationProps {
  entityType: EntityTypeDefinition;
  creatorTools: CreatorTools;
  project: Project;
  item?: ProjectItem;
  heightOffset: number;
  theme: IProjectTheme;
  onNavigateToComponent: (componentGroupId: string | undefined, componentId?: string) => void;
}

interface IComponentSummary {
  componentId: string;
  displayName: string;
  summary?: string;
  slotColor: string;
}

interface IComponentGroupSummary {
  groupId: string;
  displayName: string;
  components: IComponentSummary[];
}

interface IEntityTypeOverviewPanelState {
  isLoaded: boolean;
  defaultComponents: IComponentSummary[];
  componentGroups: IComponentGroupSummary[];
  geometryItem?: ProjectItem;
  textureItem?: ProjectItem;
  hideWhatsNext: boolean;
}

class EntityTypeOverviewPanel extends Component<
  IEntityTypeOverviewPanelProps,
  IEntityTypeOverviewPanelState
> {
  constructor(props: IEntityTypeOverviewPanelProps) {
    super(props);

    this._handleDefaultClick = this._handleDefaultClick.bind(this);
    this._handleGroupClick = this._handleGroupClick.bind(this);
    this._handleDismissWhatsNext = this._handleDismissWhatsNext.bind(this);

    let hideWhatsNext = false;
    try {
      hideWhatsNext = localStorage.getItem("mct-hide-whats-next") === "true";
    } catch (_e) {
      // localStorage may not be available
    }

    this.state = {
      isLoaded: false,
      defaultComponents: [],
      componentGroups: [],
      geometryItem: undefined,
      textureItem: undefined,
      hideWhatsNext,
    };
  }

  private _handleDismissWhatsNext() {
    try {
      localStorage.setItem("mct-hide-whats-next", "true");
    } catch (_e) {
      // localStorage may not be available
    }
    this.setState({ hideWhatsNext: true });
  }

  componentDidMount(): void {
    this._loadData();
  }

  componentDidUpdate(prevProps: IEntityTypeOverviewPanelProps): void {
    if (prevProps.entityType !== this.props.entityType || prevProps.item !== this.props.item) {
      this._loadData();
    }
  }

  async _loadData() {
    // Ensure dependencies are loaded to get childItems
    if (this.props.item) {
      await this.props.item.ensureDependencies();
    }

    // Find geometry and texture items through the resource pack entity
    // Chain: behavior entity → entityTypeResource → modelGeometryJson/texture
    let geometryItem: ProjectItem | undefined = undefined;
    let textureItem: ProjectItem | undefined = undefined;
    let resourceItem: ProjectItem | undefined = undefined;

    if (this.props.item && this.props.item.childItems) {
      // First, find the resource pack entity
      for (const childRef of this.props.item.childItems) {
        if (childRef.childItem.itemType === ProjectItemType.entityTypeResource) {
          resourceItem = childRef.childItem;
          break;
        }
      }

      // If we found a resource item, ensure its dependencies and look for geometry and texture
      if (resourceItem) {
        await resourceItem.ensureDependencies();

        if (resourceItem.childItems) {
          // Find geometry and texture from resource item children
          // Track best texture (prefer larger files with actual content)
          let bestTextureSize = 0;

          for (const childRef of resourceItem.childItems) {
            if (childRef.childItem.itemType === ProjectItemType.modelGeometryJson) {
              geometryItem = childRef.childItem;
            }

            if (childRef.childItem.itemType === ProjectItemType.texture) {
              const texItem = childRef.childItem;
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
                  textureItem = texItem;
                  bestTextureSize = size;
                }
              } else if (!textureItem) {
                // Use first texture as fallback if none found yet
                textureItem = texItem;
              }
            }
          }
        }
      }
    }

    // Load component summaries
    await this._loadSummaries(geometryItem, textureItem);
  }

  async _loadSummaries(geometryItem?: ProjectItem, textureItem?: ProjectItem) {
    const entityType = this.props.entityType;

    // Load default components
    const defaultComponents = await this._getComponentSummaries(entityType.getComponents());

    // Load component groups
    const componentGroups: IComponentGroupSummary[] = [];
    const groups = entityType.getComponentGroups();

    for (const group of groups) {
      const components = await this._getComponentSummaries(group.getComponents());
      componentGroups.push({
        groupId: group.id,
        displayName: getFriendlyComponentGroupName(group.id),
        components,
      });
    }

    this.setState({
      isLoaded: true,
      defaultComponents,
      componentGroups,
      geometryItem,
      textureItem,
    });
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
    const humanified = Utilities.humanifyMinecraftName(componentId);
    const displayName = getFriendlyComponentName(componentId, humanified);
    const slotColor = getComponentColor(componentId);

    if (componentId === "minecraft:type_family") {
      const families = Array.isArray(componentData?.family) ? componentData.family : [];
      const summary =
        families.length > 0
          ? `Behaves like: ${families.join(", ")}. Other mobs and game systems will treat this mob as these types.`
          : "Defines which mob categories this entity belongs to for behavior targeting and interactions.";
      return { componentId, displayName, summary, slotColor };
    }

    // Ensure form is loaded before trying to access it
    await Database.ensureFormLoaded("entity", formId);
    const form = Database.getForm("entity", formId);

    if (!form || !componentData || typeof componentData !== "object") {
      return { componentId, displayName, slotColor };
    }

    try {
      let summarizer = form.summarizer;
      if (!summarizer && form.summarizerId) {
        summarizer = await DataFormUtilities.loadSummarizerById(form.summarizerId);
      }

      if (!summarizer) {
        // Fallback: generate a basic summary from the component's property values
        const fallbackSummary = this._generateFallbackSummary(componentData);
        return { componentId, displayName, summary: fallbackSummary, slotColor };
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

  _generateFallbackSummary(componentData: { [key: string]: any }): string | undefined {
    const entries = Object.entries(componentData);
    if (entries.length === 0) {
      return undefined;
    }

    const parts: string[] = [];
    for (const [key, value] of entries) {
      if (parts.length >= 3) break;
      if (value === null || value === undefined) continue;
      if (typeof value === "object" && !Array.isArray(value)) continue;
      const displayVal = Array.isArray(value) ? value.join(", ") : String(value);
      if (displayVal.length > 40) continue;
      parts.push(`${key}: ${displayVal}`);
    }

    return parts.length > 0 ? parts.join(", ") : undefined;
  }

  _handleDefaultClick() {
    this.props.onNavigateToComponent("default");
  }

  _handleGroupClick(groupId: string) {
    this.props.onNavigateToComponent(groupId);
  }

  _handleComponentClick(groupId: string, componentId: string) {
    this.props.onNavigateToComponent(groupId, componentId);
  }

  _renderComponentList(components: IComponentSummary[], groupId: string) {
    if (components.length === 0) {
      return (
        <div className="etop-componentList">
          <div className="etop-emptyState">
            <span className="etop-emptyText">
              {this.props.intl.formatMessage({ id: "project_editor.entity_overview.no_behaviors" })}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="etop-componentList">
        {components.map((comp) => (
          <div
            key={comp.componentId}
            className="etop-componentRow etop-componentRowClickable"
            title={getComponentDescription(comp.componentId) || comp.componentId}
            onClick={() => this._handleComponentClick(groupId, comp.componentId)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                this._handleComponentClick(groupId, comp.componentId);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="etop-componentIcon" style={{ "--slot-color": comp.slotColor } as React.CSSProperties}>
              <ComponentIcon componentId={comp.componentId} size={20} />
            </div>
            <span className="etop-componentText">
              {comp.summary ? (
                <>
                  <strong>{comp.displayName}:</strong> {comp.summary}
                </>
              ) : (
                comp.displayName
              )}
              {comp.displayName !== comp.componentId && (
                <span className="etop-componentRawId"> {comp.componentId}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    );
  }

  _renderComponentGroup(group: IComponentGroupSummary) {
    return (
      <div key={group.groupId} className="etop-componentGroupSection">
        <div
          className="etop-groupHeader"
          onClick={() => this._handleGroupClick(group.groupId)}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              this._handleGroupClick(group.groupId);
            }
          }}
          role="button"
          tabIndex={0}
          title={this.props.intl.formatMessage({ id: "project_editor.entity_overview.states_tooltip" })}
        >
          <span className="etop-groupName">{group.displayName}</span>
          <span className="etop-groupLink" title={this.props.intl.formatMessage({ id: "project_editor.entity_overview.edit_state_tooltip" })}>{this.props.intl.formatMessage({ id: "project_editor.entity_overview.edit_state" })}</span>
        </div>
        {this._renderComponentList(group.components, group.groupId)}
      </div>
    );
  }

  render() {
    const entityType = this.props.entityType;
    const entityId = entityType.shortId || entityType.id;
    const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;

    // Use geometry and texture items from state (loaded after ensureDependencies)
    const geometryItem = this.state.geometryItem;
    const textureItem = this.state.textureItem;

    // Always use entityTypeId path for the model preview.
    // _loadEntityFromProject (called by loadFromEntityTypeId) searches the project first,
    // falls back to vanilla, and populates texture variants for the picker dropdown.
    // We wait until _loadData completes so the entity resource dependencies are populated
    // before ModelViewer tries to find them.
    let modelViewerContent: React.ReactNode;
    if (!this.state.isLoaded) {
      modelViewerContent = (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: isDark ? "#888" : "#999",
            fontSize: "12px",
          }}
        >
          {this.props.intl.formatMessage({ id: "project_editor.entity_overview.loading_model" })}
        </div>
      );
    } else {
      modelViewerContent = (
        <ModelViewer
          creatorTools={this.props.creatorTools}
          project={this.props.project}
          entityTypeId={entityId}
          heightOffset={0}
          theme={this.props.theme}
          readOnly={true}
          fitToContainer={true}
        />
      );
    }

    return (
      <div
        className={
          "etop-outer" +
          (CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? " etop-outer-dark" : " etop-outer-light")
        }
      >
        <div className="etop-modelSection">
          <EditorContentPanel theme={this.props.theme} variant="raised" header={this.props.intl.formatMessage({ id: "project_editor.entity_overview.model_preview" })}>
            <div className="etop-modelViewer" role="img" aria-label={this.props.intl.formatMessage({ id: "project_editor.entity_overview.model_aria" })}>
              {modelViewerContent}
            </div>
            <div className="etop-modelHint">{this.props.intl.formatMessage({ id: "project_editor.entity_overview.drag_hint" })}</div>
          </EditorContentPanel>
        </div>
        <div className="etop-behaviorsSection">
          <EditorContentPanel theme={this.props.theme} variant="raised" header={this.props.intl.formatMessage({ id: "project_editor.entity_overview.behaviors" })}>
            <div className="etop-behaviorsScroll">
              {/* What's Next? Guidance - dismissible, hidden once user clicks close */}
              {!this.state.hideWhatsNext && (
              <div
                style={{
                  margin: "8px 12px 12px",
                  padding: "12px 16px",
                  backgroundColor: isDark ? `${mcColors.green4}18` : `${mcColors.green5}14`,
                  border: `1px solid ${isDark ? mcColors.green4 + "45" : mcColors.green5 + "35"}`,
                  borderRadius: "4px",
                  position: "relative",
                }}
              >
                <button
                  onClick={this._handleDismissWhatsNext}
                  title={this.props.intl.formatMessage({ id: "common.dismiss" })}
                  aria-label={this.props.intl.formatMessage({ id: "project_editor.entity_overview.dismiss_aria" })}
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "14px",
                    opacity: 0.6,
                    color: "inherit",
                    padding: "2px 6px",
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: isDark ? mcColors.green3 : mcColors.green5,
                    marginBottom: "6px",
                  }}
                >
                  {this.props.intl.formatMessage({ id: "project_editor.entity_overview.whats_next" })}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: isDark ? mcColors.gray3 : mcColors.gray4,
                    lineHeight: 1.6,
                  }}
                >
                  {this.props.intl.formatMessage({ id: "project_editor.entity_overview.whats_next_body" })}
                </div>
              </div>
              )}

              {/* Default Properties section */}
              <div className="etop-componentGroupSection">
                <div
                  className="etop-groupHeader"
                  onClick={this._handleDefaultClick}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      this._handleDefaultClick();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  title={this.props.intl.formatMessage({ id: "project_editor.entity_overview.base_tooltip" })}
                >
                  <span className="etop-groupName">{this.props.intl.formatMessage({ id: "project_editor.entity_overview.base_behaviors" })}</span>
                  <span className="etop-groupLink" title={this.props.intl.formatMessage({ id: "project_editor.entity_overview.edit_base" })}>{this.props.intl.formatMessage({ id: "common.edit" })}</span>
                </div>
                {this._renderComponentList(this.state.defaultComponents, "default")}
              </div>

              {/* Optional variant states */}
              {this.state.componentGroups.map((group) => this._renderComponentGroup(group))}
            </div>
          </EditorContentPanel>
        </div>
      </div>
    );
  }
}

export default withLocalization(EntityTypeOverviewPanel);
