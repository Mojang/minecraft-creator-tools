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
import { Stack, Button, Menu, MenuItem } from "@mui/material";
import ManagedComponentGroup from "../../../minecraft/ManagedComponentGroup";
import { CustomTabLabel } from "../../shared/components/feedback/labels/Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ProjectEditPreference } from "../../../app/IProjectData";
import {
  faBolt,
  faBone,
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
import SpawnRulesEditor from "../../components/fileEditors/SpawnRulesEditor/SpawnRulesEditor";
import LootTableEditor from "../../components/fileEditors/lootTableEditor/LootTableEditor";
import SoundEventSetEditor, { SoundEventSetType } from "../sound/SoundEventSetEditor";
import EntityTypeResourceDefinition from "../../../minecraft/EntityTypeResourceDefinition";

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
const COMPACT_MODE_TRIGGER_WIDTH = 900;

interface IEntityTypeEditorProps extends IFileProps {
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
  showAdvancedGroups: boolean;
  advancedMenuAnchorEl: HTMLElement | null;
}

export default class EntityTypeEditor extends Component<IEntityTypeEditorProps, IEntityTypeEditorState> {
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
    this._toggleAdvancedGroups = this._toggleAdvancedGroups.bind(this);
    this._handleAdvancedMenuOpen = this._handleAdvancedMenuOpen.bind(this);
    this._handleAdvancedMenuClose = this._handleAdvancedMenuClose.bind(this);
    this._handleOpenEventFull = this._handleOpenEventFull.bind(this);

    this.state = {
      fileToEdit: props.file,
      isLoaded: false,
      mode: EntityTypeEditor._lastActiveMode,
      selectedItem: undefined,
      loadTimedOut: false,
      showAdvancedGroups: false,
      advancedMenuAnchorEl: null,
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

  componentDidUpdate(
    prevProps: Readonly<IEntityTypeEditorProps>,
    prevState: Readonly<IEntityTypeEditorState>,
    snapshot?: any
  ): void {
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
      itemListings = this.getComponentGroupListings(this.state.showAdvancedGroups);
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

  private _toggleAdvancedGroups() {
    this.setState((prevState) => {
      const showAdvancedGroups = !prevState.showAdvancedGroups;
      let selectedItem = prevState.selectedItem;

      if (
        !showAdvancedGroups &&
        selectedItem instanceof ManagedComponentGroup &&
        prevState.fileToEdit.manager instanceof EntityTypeDefinition
      ) {
        selectedItem = prevState.fileToEdit.manager as EntityTypeDefinition;
      }

      return {
        ...prevState,
        showAdvancedGroups,
        selectedItem,
      };
    });
  }

  getComponentGroupListings(includeAdvanced: boolean) {
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

    if (includeAdvanced) {
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
              This diagram shows how your mob makes decisions. Each box is a behavior group, and arrows show transitions
              between them.
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
      const items = this.getComponentGroupListings(this.state.showAdvancedGroups);

      const cgs = et.getComponentGroups();

      selectedIndex = 0;
      if (this.state.selectedItem instanceof ManagedComponentGroup && this.state.showAdvancedGroups) {
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

          if (!this.state.showAdvancedGroups && selItem instanceof ManagedComponentGroup) {
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
              <div className="ete-emptyStateTitle">Select a State</div>
              <div className="ete-emptyStateMessage">
                Choose a state from the list on the left to see its behaviors and properties. Each state represents a
                variant (like Baby or Adult) that can change how your mob behaves.
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
            header="States (Advanced)"
            compactHeader
            className="ete-groupsPanel"
            title="Use base state for most edits. Advanced states are optional per-variant overrides."
          >
            <div className="ete-groupsInfo">
              Start with <strong>Default (base state)</strong>. Enable advanced states only if you need different
              behaviors for Baby, Adult, or special variants.
            </div>
            <div className="ete-groupsToggleRow">
              <Button size="small" onClick={this._toggleAdvancedGroups}>
                {this.state.showAdvancedGroups ? "Hide advanced states" : "Show advanced states"}
              </Button>
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
              {this.state.showAdvancedGroups && (
                <div className="ete-addStateRow">
                  <button className="eat-mcBtn" onClick={this._handleAddState}>
                    <FontAwesomeIcon icon={faPlus} /> Add state
                  </button>
                </div>
              )}
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
              <div className="ete-emptyStateTitle">No Action Selected</div>
              <div className="ete-emptyStateMessage">
                Actions trigger entity behavior changes when events fire — for example, growing up or becoming angry.
                Select an action from the list on the left, or click <strong>Add Action</strong> above to create one.
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
            header="Actions"
            compactHeader
            className="ete-groupsPanel"
          >
            <div className="ete-addButtonRow">
              <button className="ete-addActionBtn" onClick={this._handleAddAction}>
                <FontAwesomeIcon icon={faPlus} style={{ marginRight: "6px" }} />
                Add Action
              </button>
            </div>
            <div
              className="ete-listInterior"
              style={{ minHeight: componentListHeight, maxHeight: componentListHeight }}
            >
              <McSelectableList
                aria-label="List of mob actions"
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
        return <>Error: Spawn File Expected And Not Found</>;
      }

      return (
        <div
          className="ete-componentEditorInteriorFull"
          style={{
            borderColor: colors.sectionBorder,
          }}
        >
          <SpawnRulesEditor
            project={this.props.project}
            file={spawnItem.primaryFile}
            heightOffset={this.props.heightOffset + SPAWN_RULES_MODE_HEIGHT_OFFSET}
            setActivePersistable={this.props.setActivePersistable}
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
        return <>Error: Loot Table File Expected And Not Found</>;
      }

      return (
        <div
          className="ete-componentEditorInteriorFull"
          style={{
            borderColor: colors.sectionBorder,
          }}
        >
          <LootTableEditor
            readOnly={this.props.readOnly}
            project={this.props.project}
            file={lootTableItem.primaryFile}
            heightOffset={this.props.heightOffset + LOOT_MODE_HEIGHT_OFFSET}
            setActivePersistable={this.props.setActivePersistable}
          />
        </div>
      );
    }

    console.warn("Unexpected error: No Valid State Found", selectedIndex, this.state.mode);
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
          No loot drops yet
        </div>
        <div
          style={{
            fontSize: "14px",
            color: colors.secondaryForeground,
            marginBottom: "24px",
            maxWidth: "400px",
          }}
        >
          Loot is what items your mob drops when defeated by a player. Common examples include raw meat (for animals),
          bones (for skeletons), or rare items (for bosses).
        </div>
        <Button
          variant="contained"
          onClick={this._handleAddLootTable}
          style={{ backgroundColor: mcColors.green4, color: "#fff", textTransform: "none" }}
        >
          <FontAwesomeIcon icon={faBone} style={{ marginRight: "8px" }} />
          Add Loot Table
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
          No spawn rules configured yet
        </div>
        <div
          style={{
            fontSize: "14px",
            color: colors.mutedForeground,
            marginBottom: "24px",
            maxWidth: "400px",
          }}
        >
          Spawn rules control where and when your mob appears in the world. Add spawn rules to make your mob spawn
          naturally in Minecraft.
        </div>
        <Button
          variant="contained"
          onClick={this._handleAddSpawnRules}
          style={{ backgroundColor: mcColors.green4, color: "#fff", textTransform: "none" }}
        >
          <FontAwesomeIcon icon={faEgg} style={{ marginRight: "8px" }} />
          Add Spawn Rules
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
            <div>Unable to load mob definition. The data may not be available.</div>
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
              Retry
            </button>
          </div>
        );
      }
      return <div className="ete-loading">Loading mob...</div>;
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
            <div>Unable to load mob definition data.</div>
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
              Retry
            </button>
          </div>
        );
      }
      return <div className="ete-message">Loading mob definition...</div>;
    }

    // Calculate counts for tab badges
    const componentCount = et.getComponents().length;
    const componentGroupCount = et.getComponentGroups().length;
    const eventCount = et.getEvents().length;

    // Labels for tabs
    const componentsLabel = "Components";
    const actionsLabel = "Actions";

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
            typeName="Mob"
            formatVersion={et.formatVersion}
            thumbnailUrl={this._getThumbnailUrl()}
          />
          <EditorHeaderTabs>
            <Stack direction="row" spacing={0.5} aria-label="Mob type actions">
              <Button onClick={this._setOverviewMode} title="Overview — Basic information and model preview">
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faHome} className="fa-lg" />}
                  text={"Overview"}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === EntityTypeEditorMode.overview}
                  theme={this.props.theme}
                />
              </Button>
              <Button onClick={this._setTraitsMode} title="Traits — High-level mob traits and behaviors">
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faPuzzlePiece} className="fa-lg" />}
                  text={"Traits"}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === EntityTypeEditorMode.traits}
                  theme={this.props.theme}
                />
              </Button>
              <Button onClick={this._setVisualsMode} title="Visuals — Change how your mob looks (textures, models)">
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faCow} className="fa-lg" />}
                  text={"Visuals"}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === EntityTypeEditorMode.visuals}
                  theme={this.props.theme}
                />
              </Button>
              <Button onClick={this._setAudioMode} title="Audio — Configure mob sound effects">
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faVolumeUp} className="fa-lg" />}
                  text={"Audio"}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === EntityTypeEditorMode.audio}
                  theme={this.props.theme}
                />
              </Button>
              <Button onClick={this._setSpawnRulesMode} title="Spawn — Where and when your mob appears in the world">
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faEgg} className="fa-lg" />}
                  text={"Spawn"}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === EntityTypeEditorMode.spawnRules}
                  theme={this.props.theme}
                />
              </Button>
              <Button onClick={this._setLootMode} title="Loot — Items dropped when your mob is defeated">
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faBone} className="fa-lg" />}
                  text={"Loot"}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === EntityTypeEditorMode.loot}
                  theme={this.props.theme}
                />
              </Button>
              <Button
                onClick={this._setComponentsMode}
                title={`Components — Stats and abilities (${componentCount} components, ${componentGroupCount} groups)`}
              >
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faSquarePlus} className="fa-lg" />}
                  text={componentsLabel}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === EntityTypeEditorMode.components}
                  theme={this.props.theme}
                />
              </Button>
              <Button onClick={this._handleAdvancedMenuOpen} title="More — Properties, AI Behaviors, Actions">
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faEllipsisV} className="fa-lg" />}
                  text={
                    this.state.mode === EntityTypeEditorMode.properties
                      ? this.props.project.effectiveEditPreference === ProjectEditPreference.summarized
                        ? "Advanced (Properties) ▾"
                        : "More (Properties) ▾"
                      : this.state.mode === EntityTypeEditorMode.stateDiagrams
                        ? this.props.project.effectiveEditPreference === ProjectEditPreference.summarized
                          ? "Advanced (AI Behaviors) ▾"
                          : "More (AI Behaviors) ▾"
                        : this.state.mode === EntityTypeEditorMode.actions
                          ? this.props.project.effectiveEditPreference === ProjectEditPreference.summarized
                            ? "Advanced (Actions) ▾"
                            : "More (Actions) ▾"
                          : this.props.project.effectiveEditPreference === ProjectEditPreference.summarized
                            ? "Advanced ▾"
                            : "More ▾"
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
                  Properties
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
                  AI Behaviors
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
