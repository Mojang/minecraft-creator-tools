import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./EntityTypeEditor.css";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import Database from "../minecraft/Database";
import ComponentSetEditor from "./ComponentSetEditor";
import { ThemeInput } from "@fluentui/styles";
import { List, ListProps, Toolbar, selectableListBehavior } from "@fluentui/react-northstar";
import ManagedComponentGroup from "../minecraft/ManagedComponentGroup";
import { CustomTabLabel } from "./Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBolt, faBone, faCow, faEgg, faSliders } from "@fortawesome/free-solid-svg-icons";
import WebUtilities from "./WebUtilities";
import Log from "../core/Log";
import Utilities from "../core/Utilities";
import ManagedEvent from "../minecraft/ManagedEvent";
import EventActionDesign from "./EventActionDesign";
import SpawnRulesEditor from "./SpawnRulesEditor";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import LootTableEditor from "./LootTableEditor";
import EntityTypeResourceEditor from "./EntityTypeResourceEditor";

export enum EntityTypeEditorMode {
  properties = 0,
  actions = 1,
  visuals = 2,
  audio = 3,
  spawnRules = 4,
  loot = 5,
}

interface IEntityTypeEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  item: ProjectItem;
  theme: ThemeInput<any>;
}

interface IEntityTypeEditorState {
  fileToEdit: IFile;
  isLoaded: boolean;
  mode: EntityTypeEditorMode;
  selectedItem: EntityTypeDefinition | ManagedComponentGroup | ManagedEvent | undefined;
}

export default class EntityTypeEditor extends Component<IEntityTypeEditorProps, IEntityTypeEditorState> {
  constructor(props: IEntityTypeEditorProps) {
    super(props);

    this._handleEntityTypeLoaded = this._handleEntityTypeLoaded.bind(this);
    this._handleItemSelected = this._handleItemSelected.bind(this);
    this._setActionsMode = this._setActionsMode.bind(this);
    this._setPropertiesMode = this._setPropertiesMode.bind(this);
    this._updateManager = this._updateManager.bind(this);
    this._doUpdate = this._doUpdate.bind(this);

    this._setAudioMode = this._setAudioMode.bind(this);
    this._setVisualsMode = this._setVisualsMode.bind(this);
    this._setSpawnRulesMode = this._setSpawnRulesMode.bind(this);
    this._setLootMode = this._setLootMode.bind(this);

    this.state = {
      fileToEdit: props.file,
      isLoaded: false,
      mode: EntityTypeEditorMode.properties,
      selectedItem: undefined,
    };

    window.setTimeout(this._updateManager, 1);
  }

  static getDerivedStateFromProps(props: IEntityTypeEditorProps, state: IEntityTypeEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        isLoaded: false,
        mode: EntityTypeEditorMode.properties,
        selectedItem: undefined,
      };

      return state;
    }

    if (props.file !== state.fileToEdit) {
      state.fileToEdit = props.file;
      state.isLoaded = false;

      return state;
    }

    return null; // No change to state
  }

  componentDidUpdate(prevProps: IEntityTypeEditorProps, prevState: IEntityTypeEditorState) {
    this._updateManager(true);
  }

  async _updateManager(setState: boolean) {
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

  async persist() {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager !== null) {
        const et = file.manager as EntityTypeDefinition;

        et.persist();
      }
    }
  }

  _setPropertiesMode() {
    this._setMode(EntityTypeEditorMode.properties);
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

    if (this.state.mode === EntityTypeEditorMode.properties) {
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
        const evt = et.getEvent(key.substring(4));

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
      const header = Utilities.humanifyMinecraftName(compGroup.id);

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
      const header = Utilities.humanifyMinecraftName(evt.id);

      itemListings.push({
        key: "evt." + evt.id,
        header: header,
        headerMedia: " ",
        content: " ",
      });
    }

    return itemListings;
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";
    const toolbarItems = [];
    const width = WebUtilities.getWidth();
    let isButtonCompact = false;
    let selectedIndex = 0;

    if (width < 1016) {
      isButtonCompact = true;
    }

    let topHeight = 144;

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
          icon={<FontAwesomeIcon icon={faSliders} className="fa-lg" />}
          text={"Properties"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === EntityTypeEditorMode.properties}
          theme={this.props.theme}
        />
      ),
      key: "etePropertiesTab",
      onClick: this._setPropertiesMode,
      title: "Edit documentation by types",
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

    if (this.state.mode === EntityTypeEditorMode.properties) {
      const items = this.getComponentGroupListings();

      const cgs = et.getComponentGroups();

      let index = 0;
      for (const item of cgs) {
        if (item === this.state.selectedItem) {
          selectedIndex = index;
        }
        index++;
      }
      const componentListHeight = "calc(100vh - " + String(this.props.heightOffset + topHeight + 30) + "px)";

      let itemInterior = <></>;

      if (this.state) {
        let selItem = this.state.selectedItem;
        if (
          selItem === undefined &&
          items &&
          items.length > 0 &&
          this.state.fileToEdit &&
          this.state.fileToEdit.manager
        ) {
          selItem = this.state.fileToEdit.manager as EntityTypeDefinition;
        }

        if (selItem instanceof EntityTypeDefinition || selItem instanceof ManagedComponentGroup) {
          itemInterior = (
            <ComponentSetEditor
              componentSetItem={selItem}
              theme={this.props.theme}
              title={selItem.id}
              isDefault={true}
              heightOffset={this.props.heightOffset + 170}
            />
          );
        } else {
          itemInterior = <div className="ete-select">Select a group to edit properties.</div>;
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
              className="ete-componentListInterior"
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

        if (et && selItem instanceof ManagedEvent) {
          itemInterior = (
            <div>
              <EventActionDesign
                item={this.props.item}
                readOnly={this.props.readOnly}
                file={this.props.file}
                theme={this.props.theme}
                heightOffset={this.props.heightOffset + topHeight}
                entityType={et}
                event={selItem}
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
              className="ete-eventListInterior"
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

      if (spawnItem && spawnItem.file) {
        modeArea = (
          <div
            className="ete-componentEditorInteriorFull"
            style={{
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            }}
          >
            <SpawnRulesEditor
              readOnly={this.props.readOnly}
              theme={this.props.theme}
              displayHeader={false}
              file={spawnItem.file}
              heightOffset={this.props.heightOffset + 170}
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

      if (resourceItem && resourceItem.file) {
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
              file={resourceItem.file}
              heightOffset={this.props.heightOffset + 170}
            />
          </div>
        );
      }
    } else if (this.state.mode === EntityTypeEditorMode.loot) {
      let lootTableItem = undefined;
      if (this.props.item && this.props.item.childItems) {
        for (const childItem of this.props.item.childItems) {
          if (childItem.childItem.itemType === ProjectItemType.lootTableBehaviorJson) {
            lootTableItem = childItem.childItem;
          }
        }
      }

      if (lootTableItem && lootTableItem.file) {
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
              file={lootTableItem.file}
              heightOffset={this.props.heightOffset + 88}
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
            <Toolbar aria-label="Actions toolbar overflow menu" items={toolbarItems} />
          </div>
          {modeArea}
        </div>
      </div>
    );
  }
}
