import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import IFolder from "../storage/IFolder";
import "./WorldTestEditor.css";
import IPersistable from "./IPersistable";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import Database from "../minecraft/Database";
import DataFormUtilities from "../dataform/DataFormUtilities";
import Carto from "../app/Carto";
import WorldTestAreaEditor from "./WorldTestAreaEditor";
import { Toolbar, SplitButton, Dropdown, DropdownProps } from "@fluentui/react-northstar";
import WorldTestManager from "../script/WorldTestManager";
import Project from "../app/Project.js";
import { ProjectItemType } from "../app/IProjectItemData";
import WorldView, { WorldViewMode } from "../worldux/WorldView";
import BlockLocation from "../minecraft/BlockLocation";
import WorldTestArea from "../worldtest/WorldTestArea";

interface IWorldTestEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  carto: Carto;
  project: Project;
}

interface IWorldTestEditorState {
  fileToEdit: IFile;
  selectedAreaIndex: number | undefined;
  worldFile?: IFile;
  worldFolder?: IFolder;
  selectionBlockFrom?: BlockLocation;
  selectionBlockTo?: BlockLocation;
}

export default class WorldTestEditor
  extends Component<IWorldTestEditorProps, IWorldTestEditorState>
  implements IPersistable
{
  private _lastFileEdited?: IFile;

  get worldTest() {
    if (!this.state || !this.state.fileToEdit || !this.state.fileToEdit.manager) {
      return undefined;
    }

    const manager = this.state.fileToEdit.manager as WorldTestManager;

    return manager.worldTest;
  }

  constructor(props: IWorldTestEditorProps) {
    super(props);

    this._handleWorldTestLoaded = this._handleWorldTestLoaded.bind(this);
    this._addComponentClick = this._addComponentClick.bind(this);
    this._addComponent = this._addComponent.bind(this);
    this._addAreaClick = this._addAreaClick.bind(this);
    this._handleWorldChange = this._handleWorldChange.bind(this);
    this._handleAreaChange = this._handleAreaChange.bind(this);
    this._handleSelectionChange = this._handleSelectionChange.bind(this);

    this.state = {
      fileToEdit: props.file,
      selectedAreaIndex: undefined,
      worldFile: undefined,
      worldFolder: undefined,
      selectionBlockFrom: undefined,
      selectionBlockTo: undefined,
    };
  }

  static getDerivedStateFromProps(props: IWorldTestEditorProps, state: IWorldTestEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        selectedAreaIndex: undefined,
      };

      return state;
    }

    if (props.file !== state.fileToEdit) {
      state.fileToEdit = props.file;

      return state;
    }

    return null; // No change to state
  }

  componentDidUpdate(prevProps: IWorldTestEditorProps, prevState: IWorldTestEditorState) {
    this._updateManager();
  }

  async _updateManager() {
    if (Database.uxCatalog === null) {
      await Database.loadUx();
    }

    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        await WorldTestManager.ensureWorldTestOnFile(this.state.fileToEdit, this._handleWorldTestLoaded);
      }
    }
  }

  async _handleWorldTestLoaded(worldTest: WorldTestManager, worldTestA: WorldTestManager) {
    const selectedWorldId = worldTest.name;

    if (selectedWorldId) {
      for (const pi of this.props.project.items) {
        if (
          (pi.itemType === ProjectItemType.MCWorld || pi.itemType === ProjectItemType.MCProject) &&
          pi.name === selectedWorldId &&
          pi.file
        ) {
          await pi.ensureFileStorage();
        }
      }

      for (const pi of this.props.project.items) {
        if (pi.itemType === ProjectItemType.worldFolder && pi.name === selectedWorldId && pi.folder) {
          await pi.ensureFolderStorage();
        }
      }
    }

    this.forceUpdate();
  }

  async _doUpdate() {
    if (Database.uxCatalog === null) {
      await Database.loadUx();

      this.forceUpdate();
    }
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

  _addComponentClick() {
    this._addComponent("minecraft:tameable");

    this.forceUpdate();
  }

  _addComponent(name: string) {
    if (Database.uxCatalog === null) {
      return;
    }

    const form = Database.uxCatalog.componentForms[name];

    if (form !== undefined) {
      const newDataObject = DataFormUtilities.generateDefaultItem(form);

      const et = this.state.fileToEdit.manager as EntityTypeDefinition;

      if (et.behaviorPackEntityTypeDef === undefined) {
        return;
      }

      et.behaviorPackEntityTypeDef.components[name] = newDataObject;
    }
  }

  _addAreaClick() {
    if (this.state.fileToEdit === undefined) {
      return;
    }

    const worldTest = this.worldTest;

    if (worldTest === undefined) {
      return;
    }

    worldTest.createArea("");

    this.setState({
      fileToEdit: this.state.fileToEdit,
      selectedAreaIndex: worldTest.areas.length - 1,
    });
  }

  async _handleWorldChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    const projectItems = this.props.project.items;
    for (let i = 0; i < projectItems.length; i++) {
      const pi = projectItems[i];

      if (pi.name === data.value && this.worldTest) {
        this.worldTest.worldId = pi.name;

        let worldFile = undefined;
        let worldFolder = undefined;

        worldFile = await pi.ensureFileStorage();
        worldFolder = await pi.ensureFolderStorage();

        if (worldFile === null) worldFile = undefined;
        if (worldFolder === null) worldFolder = undefined;

        this.setState({
          fileToEdit: this.state.fileToEdit,
          selectedAreaIndex: this.state.selectedAreaIndex,
          worldFile: worldFile,
          worldFolder: worldFolder,
        });
      }
    }
  }

  _handleAreaChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    const worldTestManager = this.state.fileToEdit.manager as WorldTestManager;

    if (worldTestManager === undefined || worldTestManager.worldTest === undefined) {
      return;
    }

    const test = worldTestManager.worldTest;

    let i = 0;
    for (const area of test.areas) {
      const areaTitle = this.getAreaTitle(area, i);

      if (areaTitle === data.value) {
        this.setState({
          fileToEdit: this.state.fileToEdit,
          selectedAreaIndex: i,
          worldFile: this.state.worldFile,
          worldFolder: this.state.worldFolder,
        });

        return;
      }

      i++;
    }
  }

  _handleSelectionChange(from: BlockLocation, to: BlockLocation) {
    if (!this.state) {
      return;
    }

    this.setState({
      fileToEdit: this.state.fileToEdit,
      selectedAreaIndex: this.state.selectedAreaIndex,
      worldFile: this.state.worldFile,
      worldFolder: this.state.worldFolder,
      selectionBlockFrom: from,
      selectionBlockTo: to,
    });
  }

  getAreaTitle(area: WorldTestArea, index: number) {
    return (index + 1).toString() + ". " + area.title;
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";

    if (
      this.state === null ||
      this.state.fileToEdit === null ||
      this.state.fileToEdit.manager === undefined ||
      Database.uxCatalog === null
    ) {
      if (this.state.fileToEdit !== null) {
        if (this.state.fileToEdit.manager === undefined) {
          this._updateManager();
        }
      }

      return <div>Loading...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    const worldTestManager = this.state.fileToEdit.manager as WorldTestManager;

    if (worldTestManager === undefined || worldTestManager.worldTest === undefined) {
      return <div>(could not find world test)...</div>;
    }

    const toolbarItems: any[] = [];

    const splitButtonMenuItems = [
      {
        id: "testArea",
        key: "testArea",
        onClick: this._addAreaClick,
        content: "Add test area",
      },
    ];

    const worldList = [];
    let worldSelection = "";

    let areaComponent = <></>;
    let worldView = <></>;
    let areaDropdown = <></>;

    if (this.state) {
      const worldTest = this.worldTest;

      if (worldTest) {
        const selectedWorldId = worldTest.worldId;

        let file = this.state.worldFile;
        let folder = this.state.worldFolder;

        for (const pi of this.props.project.items) {
          if (
            pi.itemType === ProjectItemType.MCWorld ||
            pi.itemType === ProjectItemType.MCTemplate ||
            pi.itemType === ProjectItemType.worldFolder
          ) {
            worldList.push(pi.name);

            if (pi.name === worldTest.worldId) {
              worldSelection = pi.name;
            }
          }
        }

        if (selectedWorldId && !file) {
          for (const pi of this.props.project.items) {
            if (pi.itemType === ProjectItemType.MCWorld && pi.name === selectedWorldId && pi.file) {
              file = pi.file;
            }
          }
        }

        if (selectedWorldId && !folder) {
          for (const pi of this.props.project.items) {
            if (pi.itemType === ProjectItemType.worldFolder && pi.name === selectedWorldId && pi.folder) {
              folder = pi.folder;
            }
          }
        }

        if (file || folder) {
          worldView = (
            <WorldView
              carto={this.props.carto}
              file={file}
              folder={folder}
              project={this.props.project}
              heightOffset={this.props.heightOffset + 48}
              initialDisplayMode={WorldViewMode.mapOnly}
              onSelectionChange={this._handleSelectionChange}
            />
          );
        }

        const areaList: string[] = [];
        let selectedAreaTitle = "";
        let areaPlaceholder = "";
        let selectedArea = undefined;

        if (worldTest.areas.length > 0) {
          let i = 0;

          for (const area of worldTest.areas) {
            const areaTitle = this.getAreaTitle(area, i);

            areaList.push(areaTitle);

            if (i === this.state.selectedAreaIndex || (i === 0 && this.state.selectedAreaIndex === undefined)) {
              selectedAreaTitle = areaTitle;
              areaPlaceholder = areaTitle;
              selectedArea = area;
            }

            i++;
          }
        }

        areaDropdown = (
          <Dropdown
            disabled={worldTest.areas.length === 0}
            items={areaList}
            defaultValue={selectedAreaTitle}
            placeholder={areaPlaceholder}
            onChange={this._handleAreaChange}
          />
        );

        if (selectedArea) {
          areaComponent = (
            <WorldTestAreaEditor
              area={selectedArea}
              objectKey={selectedAreaTitle}
              carto={this.props.carto}
              heightOffset={this.props.heightOffset + 48}
              selectionBlockFrom={this.state.selectionBlockFrom}
              selectionBlockTo={this.state.selectionBlockTo}
            />
          );
        }
      }
    }

    return (
      <div
        className="wte-outer"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="wte-componentHeader">
          <div className="wte-topZone">
            <div className="wte-topWorld">
              <Dropdown
                items={worldList}
                defaultValue={worldSelection}
                placeholder="Select a world"
                onChange={this._handleWorldChange}
              />
            </div>
            <div className="wte-topArea">{areaDropdown}</div>
            <div className="wte-topAdd">
              <SplitButton
                menu={splitButtonMenuItems}
                button={{
                  content: "Add test area",
                  "aria-roledescription": "splitbutton",
                  "aria-describedby": "instruction-message-primary-button",
                }}
                primary
                toggleButton={{
                  "aria-label": "more options",
                }}
                onMainButtonClick={this._addAreaClick}
              />
            </div>
            <div className="wte-topTools">
              <Toolbar aria-label="Actions toolbar overflow menu" items={toolbarItems} />
            </div>
          </div>
        </div>
        <div className="wte-toolBin">
          <div className="wte-worldView">{worldView}</div>
          <div className="wte-areaView">{areaComponent}</div>
        </div>
      </div>
    );
  }
}
