import { Component, ReactNode } from "react";
import IFileProps from "../../project/fileExplorer/IFileProps";
import IFile from "../../../storage/IFile";
import "./EntityTypeEditor.css";
import EntityTypeDefinition from "../../../minecraft/EntityTypeDefinition";
import Database from "../../../minecraft/Database";
import EntityTypeComponentSetEditor from "./EntityTypeComponentSetEditor";
import McSelectableList, {
  McSelectableListItem,
} from "../../shared/components/inputs/mcSelectableList/McSelectableList";
import { Stack, Button, Menu, MenuItem, Alert, Box } from "@mui/material";
import ManagedComponentGroup from "../../../minecraft/ManagedComponentGroup";
import { CustomTabLabel } from "../../shared/components/feedback/labels/Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ProjectEditPreference } from "../../../app/IProjectData";
import {
  faBolt,
  faBone,
  faChevronLeft,
  faChevronRight,
  faCow,
  faDiagramProject,
  faEgg,
  faEllipsisV,
  faHome,
  faPlus,
  faPuzzlePiece,
  faSliders,
  faVolumeUp,
} from "@fortawesome/free-solid-svg-icons";
import WebUtilities from "../../utils/WebUtilities";
import Log from "../../../core/Log";
import Utilities from "../../../core/Utilities";
import EventActionDesign from "../event/EventActionDesign";
import ProjectItem from "../../../app/ProjectItem";
import { ProjectItemType } from "../../../app/IProjectItemData";
import EntityTypeResourceEditor from "./EntityTypeResourceEditor";
import EntityTypePropertyEditor from "./EntityTypePropertyEditor";
import { faSquarePlus } from "@fortawesome/free-regular-svg-icons";
import CreatorTools from "../../../app/CreatorTools";
import Project from "../../../app/Project";
import IEventWrapper from "../../../minecraft/IEventWrapper";
import EntityTypeDiagramEditor from "./EntityTypeDiagramEditor";
import EntityTypeOverviewPanel from "./EntityTypeOverviewPanel";
import telemetry from "../../../analytics/Telemetry";
import { TelemetryEvents, TelemetryProperties } from "../../../analytics/TelemetryConstants";
import { EditorHeaderChip, EditorHeaderBar, EditorHeaderTabs } from "../../appShell/EditorHeader";
import { EditorContentPanel, EditorPanelGrid } from "../../appShell/EditorContentPanel";
import { mcColors } from "../../hooks/theme/mcColors";
import { getThemeColors, getThemedColor, ThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";
import { getFriendlyComponentGroupName } from "../../utils/ComponentFriendlyNames";
import EntityTraitPicker from "./EntityTraitPicker";
import SpawnRulesEditorWrapper from "../../components/fileEditors/SpawnRulesEditor/SpawnRulesEditorWrapper";
import LootTableVisualEditor from "../lootTable/LootTableVisualEditor";
import SoundEventSetEditor, { SoundEventSetType } from "../sound/SoundEventSetEditor";
import EntityTypeResourceDefinition from "../../../minecraft/EntityTypeResourceDefinition";
import { WithLocalizationProps, withLocalization } from "../../withLocalization";

export enum EntityTypeEditorMode {
  overview = 0,
  properties = 1,
  components = 2,
  stateDiagrams = 3,
  actions = 4,
  visuals = 5,
  audio = 6,
  spawnRules = 7,
  loot = 8,
  traits = 9,
}

// Layout constants
const OVERVIEW_MODE_DEFAULT = EntityTypeEditorMode.overview;
const STATE_DIAGRAMS_MODE_INTERIOR_HEIGHT_OFFSET = 72;
const OVERVIEW_MODE_INTERIOR_HEIGHT_OFFSET = 72;
const PROPERTIES_MODE_INTERIOR_HEIGHT_OFFSET = 72;
const COMPONENTS_LIST_TOP_HEIGHT = 144;
const COMPONENTS_MODE_HEIGHT_OFFSET = 115;
const ACTIONS_MODE_HEIGHT_OFFSET = 115;
const SPAWN_RULES_MODE_HEIGHT_OFFSET = 92;
const VISUALS_MODE_HEIGHT_OFFSET = 72;
const LOOT_MODE_HEIGHT_OFFSET = 92;
const COMPACT_MODE_TRIGGER_WIDTH = 1200;

interface IEntityTypeEditorProps extends IFileProps, WithLocalizationProps {
  heightOffset: number;
  readOnly: boolean;
  item: ProjectItem;
  project: Project;
  creatorTools: CreatorTools;
  theme: IProjectTheme;
  onOpenProjectItem?: (projectPath: string) => void;
}

interface IEntityTypeEditorState {
  fileToEdit: IFile;
  isLoaded: boolean;
  mode: EntityTypeEditorMode;
  selectedItem: EntityTypeDefinition | ManagedComponentGroup | IEventWrapper | undefined;
  initialComponentId?: string;
  loadTimedOut: boolean;
  advancedMenuAnchorEl: HTMLElement | null;
  statesCollapsed: boolean;
}

class EntityTypeEditor extends Component<IEntityTypeEditorProps, IEntityTypeEditorState> {
  private _loadingTimeout: ReturnType<typeof setTimeout> | undefined;
  private static _lastActiveMode: EntityTypeEditorMode = OVERVIEW_MODE_DEFAULT;

  constructor(props: IEntityTypeEditorProps) {
    super(props);

    this._handleEntityTypeLoaded = this._handleEntityTypeLoaded.bind(this);
    this._handleItemSelected = this._handleItemSelected.bind(this);
    this._setActionsMode = this._setActionsMode.bind(this);
    this._setComponentsMode = this._setComponentsMode.bind(this);
    this._updateManager = this._updateManager.bind(this);
    this._setOverviewMode = this._setOverviewMode.bind(this);
    this._setStateDiagramsMode = this._setStateDiagramsMode.bind(this);
    this._doUpdate = this._doUpdate.bind(this);
    this._handleNavigateToComponent = this._handleNavigateToComponent.bind(this);

    this._setAudioMode = this._setAudioMode.bind(this);
    this._setVisualsMode = this._setVisualsMode.bind(this);
    this._setSpawnRulesMode = this._setSpawnRulesMode.bind(this);
    this._setLootMode = this._setLootMode.bind(this);
    this._setPropertiesMode = this._setPropertiesMode.bind(this);
    this._setTraitsMode = this._setTraitsMode.bind(this);
    this._handleAdvancedMenuOpen = this._handleAdvancedMenuOpen.bind(this);
    this._handleAdvancedMenuClose = this._handleAdvancedMenuClose.bind(this);
    this._handleOpenEventFull = this._handleOpenEventFull.bind(this);

    this.state = {
      fileToEdit: props.file,
      isLoaded: false,
      mode: EntityTypeEditor._lastActiveMode,
      selectedItem: undefined,
      loadTimedOut: false,
      advancedMenuAnchorEl: null,
      statesCollapsed: false,
    };
  }

  componentDidMount(): void {
    this._updateManager();
    this._loadingTimeout = setTimeout(() => {
      if (!this.state.isLoaded) {
        this.setState({ loadTimedOut: true });
      }
    }, 20000);
  }

  componentWillUnmount(): void {
    if (this._loadingTimeout) {
      clearTimeout(this._loadingTimeout);
    }
  }

  componentDidUpdate(prevProps: Readonly<IEntityTypeEditorProps>, prevState: Readonly<IEntityTypeEditorState>): void {
    if (this.state && this.props.file !== this.state.fileToEdit) {
      this.setState(
        {
          fileToEdit: this.props.file,
          isLoaded: false,
          selectedItem: this.state.selectedItem,
        },
        () => {
          this._updateManager();
        }
      );
    }
  }

  async _updateManager() {
    let didLoadDb = false;

    if (Database.uxCatalog === null) {
      await Database.loadUx();

      if (Database.uxCatalog === null) {
        Log.debugAlert("Could not load UX catalog.");
      }

      didLoadDb = true;
    }

    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      await EntityTypeDefinition.ensureOnFile(this.state.fileToEdit, this._handleEntityTypeLoaded, true);
    }

    await this.props.item.ensureDependencies();

    if (
      (this.state.fileToEdit &&
        this.state.fileToEdit.manager !== undefined &&
        this.state.fileToEdit.manager instanceof EntityTypeDefinition &&
        (this.state.fileToEdit.manager as EntityTypeDefinition).isLoaded &&
        !this.state.isLoaded) ||
      didLoadDb
    ) {
      this._doUpdate();
    }
  }

  _handleEntityTypeLoaded(entityType: EntityTypeDefinition, typeA: EntityTypeDefinition) {
    this._doUpdate();
  }

  _doUpdate() {
    let selItem = this.state.selectedItem;

    if (selItem === undefined && this.state && this.state.fileToEdit && this.state.fileToEdit.manager) {
      selItem = this.state.fileToEdit.manager as EntityTypeDefinition;
    }

    this.setState({
      fileToEdit: this.state.fileToEdit,
      isLoaded: true,
      selectedItem: this.state.selectedItem,
    });
  }

  async persist(): Promise<boolean> {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager) {
        const et = file.manager as EntityTypeDefinition;

        return et.persist();
      }
    }

    return false;
  }

  _setOverviewMode() {
    this._setMode(EntityTypeEditorMode.overview);
  }

  _setStateDiagramsMode() {
    this._setMode(EntityTypeEditorMode.stateDiagrams);
  }

  _setPropertiesMode() {
    this._setMode(EntityTypeEditorMode.properties);
  }

  _setTraitsMode() {
    this._setMode(EntityTypeEditorMode.traits);
  }

  _setComponentsMode() {
    this._setMode(EntityTypeEditorMode.components);
  }

  _setActionsMode() {
    this._setMode(EntityTypeEditorMode.actions);
  }

  /**
   * Opens the full actions editor tab with a specific event selected.
   * Called from the diagram view's inline action editor expand button.
   */
  _handleOpenEventFull(eventId: string) {
    if (!this.state.fileToEdit || !this.state.fileToEdit.manager) {
      return;
    }

    const et = this.state.fileToEdit.manager as EntityTypeDefinition;
    const evtData = et.getEvent(eventId);

    if (evtData) {
      const evt: IEventWrapper = { id: eventId, event: evtData };

      EntityTypeEditor._lastActiveMode = EntityTypeEditorMode.actions;

      this.setState({
        fileToEdit: this.state.fileToEdit,
        isLoaded: this.state.isLoaded,
        mode: EntityTypeEditorMode.actions,
        selectedItem: evt,
      });
    } else {
      this._setActionsMode();
    }
  }

  _handleAdvancedMenuOpen(event: React.MouseEvent<HTMLButtonElement>) {
    this.setState({ advancedMenuAnchorEl: event.currentTarget });
  }

  _handleAdvancedMenuClose() {
    this.setState({ advancedMenuAnchorEl: null });
  }

  _setVisualsMode() {
    this._setMode(EntityTypeEditorMode.visuals);
  }

  _setAudioMode() {
    this._setMode(EntityTypeEditorMode.audio);
  }

  _setSpawnRulesMode() {
    this._setMode(EntityTypeEditorMode.spawnRules);
  }

  _setLootMode() {
    this._setMode(EntityTypeEditorMode.loot);
  }

  _handleAddState = () => {
    if (!this.state.fileToEdit || !this.state.fileToEdit.manager) return;

    const et = this.state.fileToEdit.manager as EntityTypeDefinition;
    const cg = et.addComponentGroup();

    if (cg) {
      this.setState({
        selectedItem: cg,
      });
    }

    this.forceUpdate();
  };

  _handleAddAction = () => {
    if (!this.state.fileToEdit || !this.state.fileToEdit.manager) return;

    const et = this.state.fileToEdit.manager as EntityTypeDefinition;
    et.addEvent();
    this.forceUpdate();
  };

  _generateSpawnRulesJson = (entityId: string) => {
    return {
      format_version: "1.8.0",
      "minecraft:spawn_rules": {
        description: {
          identifier: entityId,
          population_control: "animal",
        },
        conditions: [
          {
            "minecraft:spawns_on_surface": {},
            "minecraft:brightness_filter": {
              min: 7,
              max: 15,
              adjust_for_weather: false,
            },
            "minecraft:weight": {
              default: 8,
            },
            "minecraft:biome_filter": [
              {
                test: "has_biome_tag",
                operator: "==",
                value: "animal",
              },
            ],
          },
        ],
      },
    };
  };

  _generateLootTableJson = () => {
    return {
      pools: [
        {
          rolls: {
            min: 1,
            max: 1,
          },
          entries: [
            {
              type: "item",
              name: "minecraft:leather",
              weight: 1,
              functions: [
                {
                  function: "set_count",
                  count: { min: 0, max: 2 },
                },
              ],
            },
          ],
        },
      ],
    };
  };

  _handleAddSpawnRules = async () => {
    if (!this.props.project || !this.props.item) return;

    const etDef =
      this.state.fileToEdit && this.state.fileToEdit.manager instanceof EntityTypeDefinition
        ? (this.state.fileToEdit.manager as EntityTypeDefinition)
        : undefined;
    const entityId = etDef ? etDef.id : undefined;
    const name = entityId ? entityId.split(":").pop() || "entity" : this.props.item.name || "entity";

    const project = this.props.project;
    const bpFolder = await project.getDefaultBehaviorPackFolder();
    if (!bpFolder) return;

    const spawnRulesFolder = bpFolder.ensureFolder("spawn_rules");
    const spawnRulesFile = spawnRulesFolder.ensureFile(name + ".json");

    const entityFullId = entityId || "custom:entity";
    const spawnRulesContent = this._generateSpawnRulesJson(entityFullId);
    spawnRulesFile.setContent(JSON.stringify(spawnRulesContent, null, 2));
    if (spawnRulesFile.manager) {
      await spawnRulesFile.manager.persist();
    }

    await project.inferProjectItemsFromFiles(true);
    await this.props.item.ensureDependencies();

    this.forceUpdate();
  };

  _handleAddLootTable = async () => {
    if (!this.props.project || !this.props.item) return;

    const etDef =
      this.state.fileToEdit && this.state.fileToEdit.manager instanceof EntityTypeDefinition
        ? (this.state.fileToEdit.manager as EntityTypeDefinition)
        : undefined;
    const entityId = etDef ? etDef.id : undefined;
    const name = entityId ? entityId.split(":").pop() || "entity" : this.props.item.name || "entity";

    const project = this.props.project;
    const bpFolder = await project.getDefaultBehaviorPackFolder();
    if (!bpFolder) return;

    const lootTablesFolder = bpFolder.ensureFolder("loot_tables");
    const entitiesFolder = lootTablesFolder.ensureFolder("entities");
    const lootTableFile = entitiesFolder.ensureFile(name + ".json");

    const lootTableContent = this._generateLootTableJson();
    lootTableFile.setContent(JSON.stringify(lootTableContent, null, 2));

    const lootPath = "loot_tables/entities/" + name + ".json";
    etDef?.addComponent("minecraft:loot", { table: lootPath });

    if (lootTableFile.manager) {
      await lootTableFile.manager.persist();
    }
    await project.inferProjectItemsFromFiles(true);
    await this.props.item.ensureDependencies();

    this.forceUpdate();
  };

  _handleNavigateToComponent(componentGroupId: string | undefined, componentId?: string) {
    if (!this.state.fileToEdit || !this.state.fileToEdit.manager) {
      return;
    }

    const et = this.state.fileToEdit.manager as EntityTypeDefinition;
    let selectedItem: EntityTypeDefinition | ManagedComponentGroup | undefined;

    if (componentGroupId === undefined || componentGroupId === "default") {
      selectedItem = et;
    } else {
      const cg = et.getComponentGroup(componentGroupId);
      if (cg) {
        selectedItem = cg;
      }
    }

    this.setState({
      fileToEdit: this.state.fileToEdit,
      isLoaded: this.state.isLoaded,
      mode: EntityTypeEditorMode.components,
      selectedItem: selectedItem,
      initialComponentId: componentId,
    });
  }

  _setMode(mode: EntityTypeEditorMode) {
    telemetry.trackEvent({
      name: TelemetryEvents.ENTITY_TYPE_EDITOR_VIEW_CHANGE,
      properties: {
        [TelemetryProperties.MODE]: EntityTypeEditorMode[mode],
      },
    });

    EntityTypeEditor._lastActiveMode = mode;

    this.setState({
      fileToEdit: this.state.fileToEdit,
      isLoaded: this.state.isLoaded,
      mode: mode,
      selectedItem: this.state.selectedItem,
    });
  }

  _handleItemSelected(index: number, item: McSelectableListItem) {
    if (
      index === undefined ||
      this.state == null ||
      this.state.fileToEdit === undefined ||
      this.state.fileToEdit.manager === undefined
    ) {
      return;
    }

    const et = this.state.fileToEdit.manager as EntityTypeDefinition;
    let itemListings = undefined;

    if (this.state.mode === EntityTypeEditorMode.components) {
      itemListings = this.getComponentGroupListings();
    } else {
      itemListings = this.getEventListings();
    }

    const key = itemListings[index].key;

    if (key) {
      telemetry.trackEvent({
        name: TelemetryEvents.ENTITY_TYPE_EDITOR_COMPONENT_CLICKED,
        properties: {
          [TelemetryProperties.COMPONENT_ID]: key,
        },
      });
      if (key === "defaultEntityType") {
        this.setState({
          fileToEdit: this.state.fileToEdit,
          isLoaded: this.state.isLoaded,
          selectedItem: et,
          initialComponentId: undefined,
        });
      } else if (key.startsWith("cg.")) {
        const cg = et.getComponentGroup(key.substring(3));

        if (cg) {
          this.setState({
            fileToEdit: this.state.fileToEdit,
            isLoaded: this.state.isLoaded,
            mode: this.state.mode,
            selectedItem: cg,
            initialComponentId: undefined,
          });
        }
      } else if (key.startsWith("evt.")) {
        let evtD = et.getEvent(key.substring(4));

        if (evtD) {
          const evt: IEventWrapper = { id: key.substring(4), event: evtD };

          if (evt) {
            this.setState({
              fileToEdit: this.state.fileToEdit,
              isLoaded: this.state.isLoaded,
              mode: this.state.mode,
              selectedItem: evt,
            });
          }
        }
      }
    }
  }

  getComponentGroupListings() {
    if (!this.state || !this.state.fileToEdit) {
      return [];
    }

    const itemListings = [];

    itemListings.push({
      key: "defaultEntityType",
      header: getFriendlyComponentGroupName("default"),
      headerMedia: " ",
      content: " ",
    });

    const et = this.state.fileToEdit.manager as EntityTypeDefinition;

    const componentGroups = et.getComponentGroups();

    for (const compGroup of componentGroups) {
      let id = compGroup.id;

      let colon = id.indexOf(":");

      if (colon >= 0) {
        id = id.substring(colon + 1);
      }

      const header = getFriendlyComponentGroupName(id);

      itemListings.push({
        key: "cg." + compGroup.id,
        header: header,
        headerMedia: " ",
        content: " ",
      });
    }

    return itemListings;
  }

  getEventListings() {
    if (!this.state || !this.state.fileToEdit) {
      return [];
    }

    const itemListings = [];

    const et = this.state.fileToEdit.manager as EntityTypeDefinition;

    const events = et.getEvents();

    for (const evt of events) {
      let id = "";

      if (evt.id) {
        id = evt.id;
      }

      const header = Utilities.humanifyMinecraftName(id);

      itemListings.push({
        key: "evt." + id,
        header: header,
        title: header,
        headerMedia: " ",
        content: " ",
      });
    }

    return itemListings;
  }

  /**
   * Gets the thumbnail URL for this entity type, checking the item's own
   * cached thumbnail first, then following any thumbnailLink to a linked item.
   */
  private _getThumbnailUrl(): string | undefined {
    const item = this.props.item;
    if (!item) {
      return undefined;
    }

    let thumbnailUrl = item.imageUrl;

    if (!thumbnailUrl && item.thumbnailLink && this.props.project) {
      const linkedItem = this.props.project.getItemByProjectPath(item.thumbnailLink);
      if (linkedItem && linkedItem.cachedThumbnail) {
        thumbnailUrl = linkedItem.cachedThumbnail;
      }
    }

    return thumbnailUrl;
  }

  buildModeArea(
    colors: ThemeColors,
    et: EntityTypeDefinition,
    selectedIndex: number,
    componentListHeight: string
  ): ReactNode {
    if (this.state.mode === EntityTypeEditorMode.overview) {
      let selItem = undefined;
      if (this.state.fileToEdit && this.state.fileToEdit.manager) {
        selItem = this.state.fileToEdit.manager as EntityTypeDefinition;
      }

      if (selItem) {
        return (
          <div
            className="ete-componentEditorInteriorFull"
            style={{
              borderColor: colors.sectionBorder,
            }}
          >
            <EntityTypeOverviewPanel
              creatorTools={this.props.creatorTools}
              project={this.props.project}
              item={this.props.item}
              heightOffset={this.props.heightOffset + OVERVIEW_MODE_INTERIOR_HEIGHT_OFFSET}
              theme={this.props.theme}
              entityType={selItem}
              onNavigateToComponent={this._handleNavigateToComponent}
            />
          </div>
        );
      }
    } else if (this.state.mode === EntityTypeEditorMode.traits) {
      return (
        <div
          className="ete-componentEditorInteriorFull"
          style={{
            borderColor: colors.sectionBorder,
            overflowY: "auto",
          }}
        >
          <EntityTraitPicker entityType={et} theme={this.props.theme} readOnly={this.props.readOnly} />
        </div>
      );
    } else if (this.state.mode === EntityTypeEditorMode.stateDiagrams) {
      let selItem = undefined;
      if (this.state.fileToEdit && this.state.fileToEdit.manager) {
        selItem = this.state.fileToEdit.manager as EntityTypeDefinition;
      }

      if (selItem) {
        return (
          <div
            className="ete-componentEditorInteriorFull"
            style={{
              borderColor: colors.sectionBorder,
            }}
          >
            <div
              style={{
                padding: "8px 12px",
                fontSize: "13px",
                color: colors.mutedForeground,
                borderBottom: `1px solid ${colors.sectionBorder}`,
                backgroundColor: getThemedColor("rgba(255,255,255,0.03)", "rgba(0,0,0,0.02)"),
              }}
            >
              <FontAwesomeIcon icon={faDiagramProject} style={{ marginRight: "6px", opacity: 0.7 }} />
              {this.props.intl.formatMessage({ id: "project_editor.entity.diagram_description" })}
            </div>
            <EntityTypeDiagramEditor
              creatorTools={this.props.creatorTools}
              project={this.props.project}
              heightOffset={this.props.heightOffset + STATE_DIAGRAMS_MODE_INTERIOR_HEIGHT_OFFSET}
              theme={this.props.theme}
              entityType={selItem}
              onOpenEventFull={this._handleOpenEventFull}
            />
          </div>
        );
      }
    } else if (this.state.mode === EntityTypeEditorMode.properties) {
      let selItem = undefined;
      if (this.state.fileToEdit && this.state.fileToEdit.manager) {
        selItem = this.state.fileToEdit.manager as EntityTypeDefinition;
      }

      if (selItem) {
        return (
          <div
            className="ete-componentEditorInteriorFull"
            style={{
              borderColor: colors.sectionBorder,
            }}
          >
            <EntityTypePropertyEditor
              theme={this.props.theme}
              project={this.props.project}
              entityTypeItem={selItem}
              heightOffset={this.props.heightOffset + PROPERTIES_MODE_INTERIOR_HEIGHT_OFFSET}
            />
          </div>
        );
      }
    } else if (this.state.mode === EntityTypeEditorMode.components) {
      const items = this.getComponentGroupListings();

      const cgs = et.getComponentGroups();

      selectedIndex = 0;
      if (this.state.selectedItem instanceof ManagedComponentGroup) {
        const groupIndex = cgs.indexOf(this.state.selectedItem);
        if (groupIndex >= 0) {
          selectedIndex = groupIndex + 1;
        }
      }

      let itemInterior = <></>;

      if (this.state) {
        let selItem = this.state.selectedItem;
        let entityTypeDefinition = undefined;
        if (this.state.fileToEdit && this.state.fileToEdit.manager) {
          entityTypeDefinition = this.state.fileToEdit.manager as EntityTypeDefinition;

          if (selItem === undefined && items && items.length > 0) {
            selItem = entityTypeDefinition;
          }
        }

        if (
          (selItem instanceof EntityTypeDefinition || selItem instanceof ManagedComponentGroup) &&
          entityTypeDefinition &&
          selItem.id
        ) {
          itemInterior = (
            <EntityTypeComponentSetEditor
              componentSetItem={selItem}
              entityTypeItem={entityTypeDefinition}
              creatorTools={this.props.creatorTools}
              project={this.props.project}
              theme={this.props.theme}
              title={selItem.id}
              isDefault={selItem instanceof EntityTypeDefinition}
              heightOffset={this.props.heightOffset + COMPONENTS_MODE_HEIGHT_OFFSET}
              initialComponentId={this.state.initialComponentId}
            />
          );
        } else {
          itemInterior = (
            <div className="ete-emptyState">
              <div className="ete-emptyStateIcon">
                <FontAwesomeIcon icon={faSquarePlus} className="fa-2x" />
              </div>
              <div className="ete-emptyStateTitle">
                {this.props.intl.formatMessage({ id: "project_editor.entity.select_state" })}
              </div>
              <div className="ete-emptyStateMessage">
                {this.props.intl.formatMessage({ id: "project_editor.entity.select_state_hint" })}
              </div>
            </div>
          );
        }
      }

      const statesCollapsed = this.state.statesCollapsed;

      return (
        <EditorPanelGrid
          theme={this.props.theme}
          itemType={ProjectItemType.entityTypeBehavior}
          columns={statesCollapsed ? "32px 1fr" : "280px 1fr"}
          className="ete-componentEditorInterior"
        >
          {statesCollapsed ? (
            <EditorContentPanel
              variant="inset"
              theme={this.props.theme}
              itemType={ProjectItemType.entityTypeBehavior}
              className="ete-groupsPanel ete-groupsPanel-collapsed"
            >
              <button
                className="ete-statesToggle ete-statesToggle-expand"
                onClick={() => this.setState({ statesCollapsed: false })}
                title={this.props.intl.formatMessage({ id: "project_editor.entity.states_header" })}
                aria-label={this.props.intl.formatMessage({ id: "project_editor.entity.states_header" })}
              >
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </EditorContentPanel>
          ) : (
            <EditorContentPanel
              variant="inset"
              theme={this.props.theme}
              itemType={ProjectItemType.entityTypeBehavior}
              header={this.props.intl.formatMessage({ id: "project_editor.entity.states_header" })}
              compactHeader
              className="ete-groupsPanel"
              title={this.props.intl.formatMessage({ id: "project_editor.entity.states_hint" })}
            >
              <button
                className="ete-statesToggle ete-statesToggle-collapse"
                onClick={() => this.setState({ statesCollapsed: true })}
                title="Collapse states list"
                aria-label="Collapse states list"
              >
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              <div className="ete-groupsInfo">
                {this.props.intl.formatMessage({ id: "project_editor.entity.states_guidance" })}
              </div>
              <div
                className="ete-listInterior"
                style={{ minHeight: componentListHeight, maxHeight: componentListHeight }}
              >
                <McSelectableList
                  aria-label="List of components"
                  selectedIndex={selectedIndex}
                  items={items}
                  onSelectedIndexChange={this._handleItemSelected}
                />
                <div className="ete-addStateRow">
                  <Button
                    className="eat-mcBtn"
                    size="small"
                    onClick={this._handleAddState}
                    startIcon={<FontAwesomeIcon icon={faPlus} />}
                  >
                    {this.props.intl.formatMessage({ id: "project_editor.entity.add_state" })}
                  </Button>
                </div>
              </div>
            </EditorContentPanel>
          )}
          <EditorContentPanel
            variant="raised"
            theme={this.props.theme}
            itemType={ProjectItemType.entityTypeBehavior}
            className="ete-itemBinPanel"
          >
            {itemInterior}
          </EditorContentPanel>
        </EditorPanelGrid>
      );
    } else if (this.state.mode === EntityTypeEditorMode.actions) {
      const items = this.getEventListings();

      let itemInterior = <></>;

      if (this.state) {
        const selItem = this.state.selectedItem;
        let et = undefined;

        if (this.state.fileToEdit && this.state.fileToEdit.manager) {
          et = this.state.fileToEdit.manager as EntityTypeDefinition;
        }

        if (
          et &&
          selItem &&
          !(selItem instanceof ManagedComponentGroup) &&
          !(selItem instanceof EntityTypeDefinition)
        ) {
          itemInterior = (
            <div>
              <EventActionDesign
                creatorTools={this.props.creatorTools}
                displayTriggers={true}
                readOnly={this.props.readOnly}
                displayAddRemoveGroups={true}
                displayHelperText={true}
                theme={this.props.theme}
                project={this.props.project}
                heightOffset={this.props.heightOffset + ACTIONS_MODE_HEIGHT_OFFSET}
                entityType={et}
                event={selItem.event}
                id={selItem.id}
              />
            </div>
          );
        } else {
          itemInterior = (
            <div className="ete-emptyState">
              <div className="ete-emptyStateIcon">
                <FontAwesomeIcon icon={faBolt} className="fa-2x" />
              </div>
              <div className="ete-emptyStateTitle">
                {this.props.intl.formatMessage({ id: "project_editor.entity.no_action_selected" })}
              </div>
              <div className="ete-emptyStateMessage">
                Actions trigger entity behavior changes when events fire — for example, growing up or becoming angry.
                Select an action from the list on the left, or click{" "}
                <strong>{this.props.intl.formatMessage({ id: "project_editor.entity.add_action" })}</strong> above to
                create one.
              </div>
            </div>
          );
        }
      }

      return (
        <EditorPanelGrid
          theme={this.props.theme}
          itemType={ProjectItemType.entityTypeBehavior}
          columns="280px 1fr"
          className="ete-componentEditorInterior"
        >
          <EditorContentPanel
            variant="inset"
            theme={this.props.theme}
            itemType={ProjectItemType.entityTypeBehavior}
            header={this.props.intl.formatMessage({ id: "project_editor.entity.actions_header" })}
            compactHeader
            className="ete-groupsPanel"
          >
            <div className="ete-addButtonRow">
              <button className="ete-addActionBtn" onClick={this._handleAddAction}>
                <FontAwesomeIcon icon={faPlus} style={{ marginRight: "6px" }} />
                {this.props.intl.formatMessage({ id: "project_editor.entity.add_action_btn" })}
              </button>
            </div>
            <div
              className="ete-listInterior"
              style={{ minHeight: componentListHeight, maxHeight: componentListHeight }}
            >
              <McSelectableList
                aria-label={this.props.intl.formatMessage({ id: "project_editor.entity.aria_actions_list" })}
                items={items}
                onSelectedIndexChange={this._handleItemSelected}
              />
            </div>
          </EditorContentPanel>
          <EditorContentPanel
            variant="raised"
            theme={this.props.theme}
            itemType={ProjectItemType.entityTypeBehavior}
            className="ete-itemBinPanel"
          >
            {itemInterior}
          </EditorContentPanel>
        </EditorPanelGrid>
      );
    } else if (this.state.mode === EntityTypeEditorMode.spawnRules) {
      const spawnNode = this.props.item.childItems?.find(
        (child) => child.childItem.itemType === ProjectItemType.spawnRuleBehavior
      );
      const spawnItem = spawnNode?.childItem;

      if (!spawnItem) {
        return this.buildAddNewSpawnRules(colors);
      }

      if (!spawnItem.primaryFile) {
        return (
          <Box height="2.5em">
            <Alert severity="error" sx={{ m: 2 }}>
              Error: Spawn File Expected And Not Found
            </Alert>
          </Box>
        );
      }

      return (
        <div
          className="ete-componentEditorInteriorFull"
          style={{
            borderColor: colors.sectionBorder,
          }}
        >
          <SpawnRulesEditorWrapper
            project={this.props.project}
            file={spawnItem.primaryFile}
            heightOffset={this.props.heightOffset + SPAWN_RULES_MODE_HEIGHT_OFFSET}
            setActivePersistable={this.props.setActivePersistable}
            theme={this.props.theme}
          />
        </div>
      );
    } else if (this.state.mode === EntityTypeEditorMode.visuals) {
      let resourceItem = undefined;
      if (this.props.item && this.props.item.childItems) {
        for (const childItem of this.props.item.childItems) {
          if (childItem.childItem.itemType === ProjectItemType.entityTypeResource) {
            resourceItem = childItem.childItem;
          }
        }
      }

      if (resourceItem && resourceItem.primaryFile) {
        return (
          <div
            className="ete-componentEditorInteriorFull"
            style={{
              borderColor: colors.sectionBorder,
            }}
          >
            <EntityTypeResourceEditor
              readOnly={this.props.readOnly}
              theme={this.props.theme}
              displayHeader={false}
              item={resourceItem}
              project={this.props.project}
              creatorTools={this.props.creatorTools}
              file={resourceItem.primaryFile}
              heightOffset={this.props.heightOffset + VISUALS_MODE_HEIGHT_OFFSET}
              onOpenProjectItem={this.props.onOpenProjectItem}
            />
          </div>
        );
      }
    } else if (this.state.mode === EntityTypeEditorMode.audio) {
      // Find the entity type resource to get the entity ID for sound lookup
      let entityId: string | undefined;
      if (this.props.item && this.props.item.childItems) {
        for (const childItem of this.props.item.childItems) {
          if (childItem.childItem.itemType === ProjectItemType.entityTypeResource && childItem.childItem.primaryFile) {
            const mgr = childItem.childItem.primaryFile.manager;
            if (mgr instanceof EntityTypeResourceDefinition && mgr.id) {
              entityId = mgr.id;
            }
          }
        }
      }

      if (entityId) {
        return (
          <div className="ete-componentEditorInteriorFull" style={{ borderColor: colors.sectionBorder }}>
            <SoundEventSetEditor
              readOnly={this.props.readOnly}
              displayHeader={false}
              key={"ete-audio"}
              typeId={entityId}
              eventType={SoundEventSetType.entity}
              project={this.props.project}
              theme={this.props.theme}
              creatorTools={this.props.creatorTools}
            />
          </div>
        );
      }
    } else if (this.state.mode === EntityTypeEditorMode.loot) {
      const lootNode = this.props.item.childItems?.find(
        (child) => child.childItem.itemType === ProjectItemType.lootTableBehavior
      );
      const lootTableItem = lootNode?.childItem;

      if (!lootTableItem) {
        return this.buildAddNewLootTable(colors);
      }

      if (!lootTableItem.primaryFile) {
        // The relationship was created (e.g. just after Save) but the linked
        // item's file storage hasn't been resolved yet. Kick off the load and
        // re-render once it's ready instead of showing a hard error.
        lootTableItem
          .loadFileContent()
          .then(() => {
            if (this.state.mode === EntityTypeEditorMode.loot) {
              this.forceUpdate();
            }
          })
          .catch((e) => {
            Log.debug("Failed to load loot table file: " + e);
          });

        return (
          <div className="ete-message">
            {this.props.intl.formatMessage({ id: "project_editor.entity.loading_definition" })}
          </div>
        );
      }

      return (
        <div
          className="ete-componentEditorInteriorFull"
          style={{
            borderColor: colors.sectionBorder,
          }}
        >
          <LootTableVisualEditor
            readOnly={this.props.readOnly}
            project={this.props.project}
            file={lootTableItem.primaryFile}
            heightOffset={this.props.heightOffset + LOOT_MODE_HEIGHT_OFFSET}
            setActivePersistable={this.props.setActivePersistable}
          />
        </div>
      );
    }

    return <>Unexpected error: No Valid State Found</>;
  }
  private buildAddNewLootTable(colors: ThemeColors): ReactNode {
    return (
      <div
        className="ete-componentEditorInteriorFull"
        style={{
          borderColor: colors.sectionBorder,
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center",
          justifyContent: "center",
          padding: "40px",
          textAlign: "center" as const,
        }}
      >
        <FontAwesomeIcon
          icon={faBone}
          style={{ fontSize: "48px", color: colors.mutedForeground, marginBottom: "16px" }}
        />
        <div
          style={{
            fontSize: "18px",
            fontWeight: "bold",
            color: colors.primaryForeground,
            marginBottom: "8px",
          }}
        >
          {this.props.intl.formatMessage({ id: "project_editor.entity.no_loot" })}
        </div>
        <div
          style={{
            fontSize: "14px",
            color: colors.secondaryForeground,
            marginBottom: "24px",
            maxWidth: "400px",
          }}
        >
          {this.props.intl.formatMessage({ id: "project_editor.entity.loot_description" })}
        </div>
        <Button
          variant="contained"
          onClick={this._handleAddLootTable}
          style={{ backgroundColor: mcColors.green4, color: "#fff", textTransform: "none" }}
        >
          <FontAwesomeIcon icon={faBone} style={{ marginRight: "8px" }} />
          {this.props.intl.formatMessage({ id: "project_editor.entity.add_loot_table" })}
        </Button>
      </div>
    );
  }

  private buildAddNewSpawnRules(colors: ThemeColors): ReactNode {
    return (
      <div
        className="ete-componentEditorInteriorFull"
        style={{
          borderColor: colors.sectionBorder,
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center",
          justifyContent: "center",
          padding: "40px",
          textAlign: "center" as const,
        }}
      >
        <FontAwesomeIcon
          icon={faEgg}
          style={{ fontSize: "48px", color: colors.emptyStateIcon, marginBottom: "16px" }}
        />
        <div
          style={{
            fontSize: "18px",
            fontWeight: "bold",
            color: colors.primaryForeground,
            marginBottom: "8px",
          }}
        >
          {this.props.intl.formatMessage({ id: "project_editor.entity.no_spawn_rules" })}
        </div>
        <div
          style={{
            fontSize: "14px",
            color: colors.mutedForeground,
            marginBottom: "24px",
            maxWidth: "400px",
          }}
        >
          {this.props.intl.formatMessage({ id: "project_editor.entity.spawn_description" })}
        </div>
        <Button
          variant="contained"
          onClick={this._handleAddSpawnRules}
          style={{ backgroundColor: mcColors.green4, color: "#fff", textTransform: "none" }}
        >
          <FontAwesomeIcon icon={faEgg} style={{ marginRight: "8px" }} />
          {this.props.intl.formatMessage({ id: "project_editor.entity.add_spawn_rules" })}
        </Button>
      </div>
    );
  }

  render() {
    const height = "calc(100vh - " + (this.props.heightOffset - 1) + "px)";
    const width = WebUtilities.getWidth();
    let isButtonCompact = false;
    let selectedIndex = 0;
    const colors = getThemeColors();

    if (width < COMPACT_MODE_TRIGGER_WIDTH) {
      isButtonCompact = true;
    }

    let topHeight = COMPONENTS_LIST_TOP_HEIGHT;

    if (
      this.state === null ||
      this.state.fileToEdit === null ||
      this.state.fileToEdit.manager === undefined ||
      Database.uxCatalog === null
    ) {
      if (this.state && this.state.loadTimedOut) {
        return (
          <div className="ete-loading">
            <div>{this.props.intl.formatMessage({ id: "project_editor.entity.loading_error" })}</div>
            <button
              className="ete-retry-button"
              onClick={() => {
                this.setState({ loadTimedOut: false });
                this._loadingTimeout = setTimeout(() => {
                  if (!this.state.isLoaded) {
                    this.setState({ loadTimedOut: true });
                  }
                }, 20000);
                this._updateManager();
              }}
            >
              {this.props.intl.formatMessage({ id: "common.retry" })}
            </button>
          </div>
        );
      }
      return (
        <div className="ete-loading">{this.props.intl.formatMessage({ id: "project_editor.entity.loading" })}</div>
      );
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    // Get entity type definition early so we can use it for tab counts
    const et = this.state.fileToEdit.manager as EntityTypeDefinition;

    if (et.data === undefined) {
      if (this.state.loadTimedOut) {
        return (
          <div className="ete-loading">
            <div>{this.props.intl.formatMessage({ id: "project_editor.entity.loading_data_error" })}</div>
            <button
              className="ete-retry-button"
              onClick={() => {
                this.setState({ loadTimedOut: false });
                this._loadingTimeout = setTimeout(() => {
                  if (et.data === undefined) {
                    this.setState({ loadTimedOut: true });
                  }
                }, 20000);
                this._updateManager();
              }}
            >
              {this.props.intl.formatMessage({ id: "common.retry" })}
            </button>
          </div>
        );
      }
      return (
        <div className="ete-message">
          {this.props.intl.formatMessage({ id: "project_editor.entity.loading_definition" })}
        </div>
      );
    }

    // Calculate counts for tab badges
    const componentCount = et.getComponents().length;
    const componentGroupCount = et.getComponentGroups().length;
    const eventCount = et.getEvents().length;

    // Labels for tabs
    const componentsLabel = this.props.intl.formatMessage({ id: "project_editor.entity.tab_components" });
    const actionsLabel = this.props.intl.formatMessage({ id: "project_editor.entity.tab_actions" });

    const componentListHeight = "calc(100vh - " + String(this.props.heightOffset + topHeight) + "px)";
    const modeArea = this.buildModeArea(colors, et, selectedIndex, componentListHeight);

    return (
      <div
        className="ete-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <EditorHeaderChip itemType={ProjectItemType.entityTypeBehavior} theme={this.props.theme}>
          <EditorHeaderBar
            itemId={et.id}
            displayName={et.shortId ? (Utilities.humanifyMinecraftName(et.shortId) as string) : undefined}
            itemType={ProjectItemType.entityTypeBehavior}
            typeName={this.props.intl.formatMessage({ id: "project_editor.entity.type_name" })}
            formatVersion={et.formatVersion}
            thumbnailUrl={this._getThumbnailUrl()}
          />
          <EditorHeaderTabs>
            <Stack
              direction="row"
              spacing={0.5}
              aria-label={this.props.intl.formatMessage({ id: "project_editor.entity.aria_mob_actions" })}
            >
              <Button
                onClick={this._setOverviewMode}
                title={this.props.intl.formatMessage({ id: "project_editor.entity.tooltip_overview" })}
              >
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faHome} className="fa-lg" />}
                  text={this.props.intl.formatMessage({ id: "project_editor.entity.tab_overview" })}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === EntityTypeEditorMode.overview}
                  theme={this.props.theme}
                />
              </Button>
              <Button
                onClick={this._setTraitsMode}
                title={this.props.intl.formatMessage({ id: "project_editor.entity.tooltip_traits" })}
              >
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faPuzzlePiece} className="fa-lg" />}
                  text={this.props.intl.formatMessage({ id: "project_editor.entity.tab_traits" })}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === EntityTypeEditorMode.traits}
                  theme={this.props.theme}
                />
              </Button>
              <Button
                onClick={this._setVisualsMode}
                title={this.props.intl.formatMessage({ id: "project_editor.entity.tooltip_visuals" })}
              >
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faCow} className="fa-lg" />}
                  text={this.props.intl.formatMessage({ id: "project_editor.entity.tab_visuals" })}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === EntityTypeEditorMode.visuals}
                  theme={this.props.theme}
                />
              </Button>
              <Button
                onClick={this._setAudioMode}
                title={this.props.intl.formatMessage({ id: "project_editor.entity.tooltip_audio" })}
              >
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faVolumeUp} className="fa-lg" />}
                  text={this.props.intl.formatMessage({ id: "project_editor.entity.tab_audio" })}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === EntityTypeEditorMode.audio}
                  theme={this.props.theme}
                />
              </Button>
              <Button
                onClick={this._setSpawnRulesMode}
                title={this.props.intl.formatMessage({ id: "project_editor.entity.tooltip_spawn" })}
              >
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faEgg} className="fa-lg" />}
                  text={this.props.intl.formatMessage({ id: "project_editor.entity.tab_spawn" })}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === EntityTypeEditorMode.spawnRules}
                  theme={this.props.theme}
                />
              </Button>
              <Button
                onClick={this._setLootMode}
                title={this.props.intl.formatMessage({ id: "project_editor.entity.tooltip_loot" })}
              >
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faBone} className="fa-lg" />}
                  text={this.props.intl.formatMessage({ id: "project_editor.entity.tab_loot" })}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === EntityTypeEditorMode.loot}
                  theme={this.props.theme}
                />
              </Button>
              <Button
                onClick={this._setComponentsMode}
                title={this.props.intl.formatMessage(
                  { id: "project_editor.entity.tooltip_components" },
                  { componentCount, groupCount: componentGroupCount }
                )}
              >
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faSquarePlus} className="fa-lg" />}
                  text={componentsLabel}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === EntityTypeEditorMode.components}
                  theme={this.props.theme}
                />
              </Button>
              <Button
                onClick={this._handleAdvancedMenuOpen}
                title={this.props.intl.formatMessage({ id: "project_editor.entity.tooltip_more" })}
              >
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faEllipsisV} className="fa-lg" />}
                  text={
                    this.state.mode === EntityTypeEditorMode.properties
                      ? this.props.project.effectiveEditPreference === ProjectEditPreference.summarized
                        ? this.props.intl.formatMessage({ id: "project_editor.entity.advanced_properties" })
                        : this.props.intl.formatMessage({ id: "project_editor.entity.tab_more_props" })
                      : this.state.mode === EntityTypeEditorMode.stateDiagrams
                        ? this.props.project.effectiveEditPreference === ProjectEditPreference.summarized
                          ? this.props.intl.formatMessage({ id: "project_editor.entity.advanced_ai" })
                          : this.props.intl.formatMessage({ id: "project_editor.entity.tab_more_ai" })
                        : this.state.mode === EntityTypeEditorMode.actions
                          ? this.props.project.effectiveEditPreference === ProjectEditPreference.summarized
                            ? this.props.intl.formatMessage({ id: "project_editor.entity.advanced_actions" })
                            : this.props.intl.formatMessage({ id: "project_editor.entity.tab_more_actions" })
                          : this.props.project.effectiveEditPreference === ProjectEditPreference.summarized
                            ? this.props.intl.formatMessage({ id: "project_editor.entity.advanced" })
                            : this.props.intl.formatMessage({ id: "project_editor.entity.tab_more" })
                  }
                  isCompact={isButtonCompact}
                  isSelected={
                    this.state.mode === EntityTypeEditorMode.properties ||
                    this.state.mode === EntityTypeEditorMode.stateDiagrams ||
                    this.state.mode === EntityTypeEditorMode.actions
                  }
                  theme={this.props.theme}
                />
              </Button>
              <Menu
                anchorEl={this.state.advancedMenuAnchorEl}
                open={Boolean(this.state.advancedMenuAnchorEl)}
                onClose={this._handleAdvancedMenuClose}
                slotProps={{
                  paper: {
                    sx: {
                      backgroundColor: this.props.theme.mc4,
                      color: this.props.theme.mcc1,
                      border: `2px solid ${this.props.theme.mc0}`,
                      borderRadius: 0,
                      boxShadow: `inset -2px -2px 0 ${this.props.theme.mc1}, inset 2px 2px 0 ${this.props.theme.mc5}, 4px 4px 0 rgba(0,0,0,0.4)`,
                      minWidth: 180,
                    },
                  },
                }}
              >
                <MenuItem
                  onClick={() => {
                    this._handleAdvancedMenuClose();
                    this._setPropertiesMode();
                  }}
                  selected={this.state.mode === EntityTypeEditorMode.properties}
                  sx={{ gap: 1.5, fontSize: 13 }}
                >
                  <FontAwesomeIcon icon={faSliders} fixedWidth />
                  {this.props.intl.formatMessage({ id: "project_editor.entity.menu_properties" })}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    this._handleAdvancedMenuClose();
                    this._setStateDiagramsMode();
                  }}
                  selected={this.state.mode === EntityTypeEditorMode.stateDiagrams}
                  sx={{ gap: 1.5, fontSize: 13 }}
                >
                  <FontAwesomeIcon icon={faDiagramProject} fixedWidth />
                  {this.props.intl.formatMessage({ id: "project_editor.entity.menu_ai_behaviors" })}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    this._handleAdvancedMenuClose();
                    this._setActionsMode();
                  }}
                  selected={this.state.mode === EntityTypeEditorMode.actions}
                  sx={{ gap: 1.5, fontSize: 13 }}
                >
                  <FontAwesomeIcon icon={faBolt} fixedWidth />
                  {actionsLabel}
                </MenuItem>
              </Menu>
            </Stack>
          </EditorHeaderTabs>
        </EditorHeaderChip>

        <div className="ete-mainArea">{modeArea}</div>
      </div>
    );
  }
}

export default withLocalization(EntityTypeEditor);
