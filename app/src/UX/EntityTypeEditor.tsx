import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./EntityTypeEditor.css";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import Database from "../minecraft/Database";
import EntityTypeComponentSetEditor from "./EntityTypeComponentSetEditor";
import { ThemeInput } from "@fluentui/styles";
import { List, ListProps, Toolbar, selectableListBehavior } from "@fluentui/react-northstar";
import ManagedComponentGroup from "../minecraft/ManagedComponentGroup";
import { CustomTabLabel } from "./Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBolt, faBone, faCow, faDiagramProject, faEgg, faSliders } from "@fortawesome/free-solid-svg-icons";
import WebUtilities from "./WebUtilities";
import Log from "../core/Log";
import Utilities from "../core/Utilities";
import EventActionDesign from "./EventActionDesign";
import SpawnRulesEditor from "./SpawnRulesEditor";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import LootTableEditor from "./LootTableEditor";
import EntityTypeResourceEditor from "./EntityTypeResourceEditor";
import EntityTypePropertyEditor from "./EntityTypePropertyEditor";
import { faSquarePlus } from "@fortawesome/free-regular-svg-icons";
import CreatorTools from "../app/CreatorTools";
import Project from "../app/Project";
import IEventWrapper from "../minecraft/IEventWrapper";
import EntityTypeDiagramEditor from "./EntityTypeDiagramEditor";

export enum EntityTypeEditorMode {
  diagram = 0,
  properties = 1,
  components = 2,
  actions = 3,
  visuals = 4,
  audio = 5,
  spawnRules = 6,
  loot = 7,
}

// Layout constants
const COMPONENTS_MODE_DEFAULT = EntityTypeEditorMode.components;
const DIAGRAM_MODE_INTERIOR_HEIGHT_OFFSET = 72;
const PROPERTIES_MODE_INTERIOR_HEIGHT_OFFSET = 72;
const COMPONENTS_LIST_TOP_HEIGHT = 144;
const COMPONENTS_MODE_HEIGHT_OFFSET = 115;
const ACTIONS_MODE_HEIGHT_OFFSET = 115;
const SPAWN_RULES_MODE_HEIGHT_OFFSET = 170;
const VISUALS_MODE_HEIGHT_OFFSET = 72;
const LOOT_MODE_HEIGHT_OFFSET = 72;
const COMPACT_MODE_TRIGGER_WIDTH = 1016;

interface IEntityTypeEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  item: ProjectItem;
  project: Project;
  creatorTools: CreatorTools;
  theme: ThemeInput<any>;
}

interface IEntityTypeEditorState {
  fileToEdit: IFile;
  isLoaded: boolean;
  mode: EntityTypeEditorMode;
  selectedItem: EntityTypeDefinition | ManagedComponentGroup | IEventWrapper | undefined;
}

export default class EntityTypeEditor extends Component<IEntityTypeEditorProps, IEntityTypeEditorState> {
  constructor(props: IEntityTypeEditorProps) {
    super(props);

    this._handleEntityTypeLoaded = this._handleEntityTypeLoaded.bind(this);
    this._handleItemSelected = this._handleItemSelected.bind(this);
    this._setActionsMode = this._setActionsMode.bind(this);
    this._setComponentsMode = this._setComponentsMode.bind(this);
    this._updateManager = this._updateManager.bind(this);
    this._setDiagramMode = this._setDiagramMode.bind(this);
    this._doUpdate = this._doUpdate.bind(this);

    this._setAudioMode = this._setAudioMode.bind(this);
    this._setVisualsMode = this._setVisualsMode.bind(this);
    this._setSpawnRulesMode = this._setSpawnRulesMode.bind(this);
    this._setLootMode = this._setLootMode.bind(this);
    this._setPropertiesMode = this._setPropertiesMode.bind(this);

    this.state = {
      fileToEdit: props.file,
      isLoaded: false,
      mode: COMPONENTS_MODE_DEFAULT,
      selectedItem: undefined,
    };
  }

  componentDidMount(): void {
    this._updateManager();
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
      await EntityTypeDefinition.ensureOnFile(this.state.fileToEdit, this._handleEntityTypeLoaded);
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

  _setDiagramMode() {
    this._setMode(EntityTypeEditorMode.diagram);
  }

  _setPropertiesMode() {
    this._setMode(EntityTypeEditorMode.properties);
  }

  _setComponentsMode() {
    this._setMode(EntityTypeEditorMode.components);
  }

  _setActionsMode() {
    this._setMode(EntityTypeEditorMode.actions);
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

  _setMode(mode: EntityTypeEditorMode) {
    this.setState({
      fileToEdit: this.state.fileToEdit,
      isLoaded: this.state.isLoaded,
      mode: mode,
      selectedItem: this.state.selectedItem,
    });
  }

  _handleItemSelected(elt: any, event: ListProps | undefined) {
    if (
      event === undefined ||
      event.selectedIndex === undefined ||
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

    const key = itemListings[event.selectedIndex].key;

    if (key) {
      if (key === "defaultEntityType") {
        this.setState({
          fileToEdit: this.state.fileToEdit,
          isLoaded: this.state.isLoaded,
          selectedItem: et,
        });
      } else if (key.startsWith("cg.")) {
        const cg = et.getComponentGroup(key.substring(3));

        if (cg) {
          this.setState({
            fileToEdit: this.state.fileToEdit,
            isLoaded: this.state.isLoaded,
            mode: this.state.mode,
            selectedItem: cg,
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
      header: "(default)",
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

      const header = Utilities.humanifyMinecraftName(id);

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
        headerMedia: " ",
        content: " ",
      });
    }

    return itemListings;
  }

  render() {
    const height = "calc(100vh - " + (this.props.heightOffset - 1) + "px)";
    const toolbarItems = [];
    const width = WebUtilities.getWidth();
    let isButtonCompact = false;
    let selectedIndex = 0;

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
      return <div className="ete-loading">Loading entity type...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faDiagramProject} className="fa-lg" />}
          text={"Overview"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === EntityTypeEditorMode.diagram}
          theme={this.props.theme}
        />
      ),
      key: "eteDiagramTab",
      onClick: this._setDiagramMode,
      title: "Edit properties",
    });

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faSliders} className="fa-lg" />}
          text={"Properties"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === EntityTypeEditorMode.properties}
          theme={this.props.theme}
        />
      ),
      key: "eteProprertiesTab",
      onClick: this._setPropertiesMode,
      title: "Edit properties",
    });

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faSquarePlus} className="fa-lg" />}
          text={"Components"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === EntityTypeEditorMode.components}
          theme={this.props.theme}
        />
      ),
      key: "eteComponentsTab",
      onClick: this._setComponentsMode,
      title: "Edit components and properties",
    });

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faBolt} className="fa-lg" />}
          text={"Actions"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === EntityTypeEditorMode.actions}
          theme={this.props.theme}
        />
      ),
      key: "eteActionsTab",
      onClick: this._setActionsMode,
      title: "Edit documentation by types that need edits",
    });

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faCow} className="fa-lg" />}
          text={"Visuals"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === EntityTypeEditorMode.visuals}
          theme={this.props.theme}
        />
      ),
      key: "eteVisualsTab",
      onClick: this._setVisualsMode,
      title: "Edit documentation by types that need edits",
    });

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faEgg} className="fa-lg" />}
          text={"Spawn"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === EntityTypeEditorMode.spawnRules}
          theme={this.props.theme}
        />
      ),
      key: "eteSpawnRulesTab",
      onClick: this._setSpawnRulesMode,
      title: "Spawn behavior",
    });

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faBone} className="fa-lg" />}
          text={"Loot"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === EntityTypeEditorMode.loot}
          theme={this.props.theme}
        />
      ),
      key: "eteLootTableTab",
      onClick: this._setLootMode,
      title: "Loot",
    });

    const et = this.state.fileToEdit.manager as EntityTypeDefinition;

    if (et.data === undefined) {
      return <div className="ete-message">Loading mob definition...</div>;
    }

    let modeArea = <></>;

    if (this.state.mode === EntityTypeEditorMode.diagram) {
      let selItem = undefined;
      if (this.state.fileToEdit && this.state.fileToEdit.manager) {
        selItem = this.state.fileToEdit.manager as EntityTypeDefinition;
      }

      if (selItem) {
        modeArea = (
          <div
            className="ete-componentEditorInteriorFull"
            style={{
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            }}
          >
            <EntityTypeDiagramEditor
              creatorTools={this.props.creatorTools}
              project={this.props.project}
              heightOffset={this.props.heightOffset + DIAGRAM_MODE_INTERIOR_HEIGHT_OFFSET}
              theme={this.props.theme}
              entityType={selItem}
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
        modeArea = (
          <div
            className="ete-componentEditorInteriorFull"
            style={{
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
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

      let index = 0;
      for (const item of cgs) {
        if (item === this.state.selectedItem) {
          selectedIndex = index;
        }
        index++;
      }
      const componentListHeight = "calc(100vh - " + String(this.props.heightOffset + topHeight) + "px)";

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
            />
          );
        } else {
          itemInterior = <div className="ete-select">Select a group to edit components.</div>;
        }
      }

      modeArea = (
        <div
          className="ete-componentEditorInterior"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
          }}
        >
          <div className="ete-componentListHeader">Groups:</div>
          <div className="ete-componentList">
            <div
              className="ete-listInterior"
              style={{ minHeight: componentListHeight, maxHeight: componentListHeight }}
            >
              <List
                selectable
                aria-label="List of components"
                accessibility={selectableListBehavior}
                defaultSelectedIndex={selectedIndex}
                selectedIndex={selectedIndex}
                items={items}
                onSelectedIndexChange={this._handleItemSelected}
              />
            </div>
          </div>
          <div
            className="ete-itemBin"
            style={{
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            }}
          >
            {itemInterior}
          </div>
        </div>
      );
    } else if (this.state.mode === EntityTypeEditorMode.actions) {
      const items = this.getEventListings();
      const componentListHeight = "calc(100vh - " + String(this.props.heightOffset + topHeight) + "px)";

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
          itemInterior = <div className="ete-select">Select an action to edit properties.</div>;
        }
      }

      modeArea = (
        <div
          className="ete-componentEditorInterior"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
          }}
        >
          <div className="ete-eventListHeader">Actions:</div>
          <div className="ete-eventList">
            <div
              className="ete-listInterior"
              style={{ minHeight: componentListHeight, maxHeight: componentListHeight }}
            >
              <List
                selectable
                aria-label="List of entity actions"
                accessibility={selectableListBehavior}
                defaultSelectedIndex={0}
                items={items}
                onSelectedIndexChange={this._handleItemSelected}
              />
            </div>
          </div>
          <div
            className="ete-itemBin"
            style={{
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            }}
          >
            {itemInterior}
          </div>
        </div>
      );
    } else if (this.state.mode === EntityTypeEditorMode.spawnRules) {
      let spawnItem = undefined;
      if (this.props.item && this.props.item.childItems) {
        for (const childItem of this.props.item.childItems) {
          if (childItem.childItem.itemType === ProjectItemType.spawnRuleBehavior) {
            spawnItem = childItem.childItem;
          }
        }
      }

      if (spawnItem && spawnItem.primaryFile) {
        modeArea = (
          <div
            className="ete-componentEditorInteriorFull"
            style={{
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            }}
          >
            <SpawnRulesEditor
              readOnly={this.props.readOnly}
              project={this.props.project}
              theme={this.props.theme}
              displayHeader={false}
              file={spawnItem.primaryFile}
              heightOffset={this.props.heightOffset + SPAWN_RULES_MODE_HEIGHT_OFFSET}
            />
          </div>
        );
      }
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
        modeArea = (
          <div
            className="ete-componentEditorInteriorFull"
            style={{
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            }}
          >
            <EntityTypeResourceEditor
              readOnly={this.props.readOnly}
              theme={this.props.theme}
              displayHeader={false}
              item={resourceItem}
              project={this.props.project}
              file={resourceItem.primaryFile}
              heightOffset={this.props.heightOffset + VISUALS_MODE_HEIGHT_OFFSET}
            />
          </div>
        );
      }
    } else if (this.state.mode === EntityTypeEditorMode.loot) {
      let lootTableItem = undefined;
      if (this.props.item && this.props.item.childItems) {
        for (const childItem of this.props.item.childItems) {
          if (childItem.childItem.itemType === ProjectItemType.lootTableBehavior) {
            lootTableItem = childItem.childItem;
          }
        }
      }

      if (lootTableItem && lootTableItem.primaryFile) {
        modeArea = (
          <div
            className="ete-componentEditorInteriorFull"
            style={{
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            }}
          >
            <LootTableEditor
              readOnly={this.props.readOnly}
              theme={this.props.theme}
              project={this.props.project}
              file={lootTableItem.primaryFile}
              heightOffset={this.props.heightOffset + LOOT_MODE_HEIGHT_OFFSET}
            />
          </div>
        );
      }
    }

    return (
      <div
        className="ete-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div
          className="ete-header"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
          }}
        >
          {et.id}
        </div>

        <div className="ete-mainArea">
          <div
            className="ete-toolBarArea"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
            }}
          >
            <Toolbar aria-label="Entity type actions" items={toolbarItems} />
          </div>
          {modeArea}
        </div>
      </div>
    );
  }
}
