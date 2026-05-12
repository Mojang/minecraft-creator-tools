import { Component } from "react";
import IFileProps from "../../project/fileExplorer/IFileProps";
import IFile from "../../../storage/IFile";
import IFolder from "../../../storage/IFolder";
import "./WorldTestEditor.css";
import EntityTypeDefinition from "../../../minecraft/EntityTypeDefinition";
import CreatorTools from "../../../app/CreatorTools";
import WorldTestAreaEditor from "./WorldTestAreaEditor";
import { Button, FormControl, MenuItem, Select, SelectChangeEvent, Stack } from "@mui/material";
import WorldTestManager from "../../../script/WorldTestManager";
import Project from "../../../app/Project";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { LazyWorldDisplay } from "../../appShell/LazyComponents";
import { WorldViewMode } from "../../world/WorldViewTypes";
import BlockLocation from "../../../minecraft/BlockLocation";
import WorldTestArea from "../../../worldtest/WorldTestArea";
import IProjectTheme from "../../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../../withLocalization";

interface IWorldTestEditorProps extends IFileProps, WithLocalizationProps {
  heightOffset: number;
  readOnly: boolean;
  theme: IProjectTheme;
  creatorTools: CreatorTools;
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

class WorldTestEditor extends Component<IWorldTestEditorProps, IWorldTestEditorState> {
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
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        await WorldTestManager.ensureOnFile(this.state.fileToEdit, this._handleWorldTestLoaded);
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
          pi.primaryFile
        ) {
          await pi.loadFileContent();
        }
      }

      for (const pi of this.props.project.items) {
        if (pi.itemType === ProjectItemType.worldFolder && pi.name === selectedWorldId && pi.defaultFolder) {
          await pi.loadFolder();
        }
      }
    }

    this.forceUpdate();
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

  async _handleWorldChange(event: SelectChangeEvent<string>) {
    const projectItems = this.props.project.items;
    const selectedValue = event.target.value;

    for (let i = 0; i < projectItems.length; i++) {
      const pi = projectItems[i];

      if (pi.name === selectedValue && this.worldTest) {
        this.worldTest.worldId = pi.name;

        let worldFile = undefined;
        let worldFolder = undefined;

        worldFile = await pi.loadFileContent();
        worldFolder = await pi.loadFolder();

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

  _handleAreaChange(event: SelectChangeEvent<string>) {
    const worldTestManager = this.state.fileToEdit.manager as WorldTestManager;

    if (worldTestManager === undefined || worldTestManager.worldTest === undefined) {
      return;
    }

    const test = worldTestManager.worldTest;
    const selectedValue = event.target.value;

    let i = 0;
    for (const area of test.areas) {
      const areaTitle = this.getAreaTitle(area, i);

      if (areaTitle === selectedValue) {
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

    if (this.state === null || this.state.fileToEdit === null || this.state.fileToEdit.manager === undefined) {
      if (this.state.fileToEdit !== null) {
        if (this.state.fileToEdit.manager === undefined) {
          this._updateManager();
        }
      }

      return <div>{this.props.intl.formatMessage({ id: "project_editor.world_test.loading" })}</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    const worldTestManager = this.state.fileToEdit.manager as WorldTestManager;

    if (worldTestManager === undefined || worldTestManager.worldTest === undefined) {
      return <div>{this.props.intl.formatMessage({ id: "project_editor.world_test.not_found" })}</div>;
    }

    const worldList: string[] = [];
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
            if (pi.itemType === ProjectItemType.MCWorld && pi.name === selectedWorldId && pi.primaryFile) {
              file = pi.primaryFile;
            }
          }
        }

        if (selectedWorldId && !folder) {
          for (const pi of this.props.project.items) {
            if (pi.itemType === ProjectItemType.worldFolder && pi.name === selectedWorldId && pi.defaultFolder) {
              folder = pi.defaultFolder;
            }
          }
        }

        if (file || folder) {
          worldView = (
            <LazyWorldDisplay
              creatorTools={this.props.creatorTools}
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
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              disabled={worldTest.areas.length === 0}
              value={selectedAreaTitle}
              displayEmpty
              onChange={this._handleAreaChange}
            >
              {areaList.map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

        if (selectedArea) {
          areaComponent = (
            <WorldTestAreaEditor
              area={selectedArea}
              objectKey={selectedAreaTitle}
              project={this.props.project}
              creatorTools={this.props.creatorTools}
              theme={this.props.theme}
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
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <Select value={worldSelection} displayEmpty onChange={this._handleWorldChange}>
                  <MenuItem value="" disabled>
                    {this.props.intl.formatMessage({ id: "project_editor.world_test.select_world" })}
                  </MenuItem>
                  {worldList.map((item) => (
                    <MenuItem key={item} value={item}>
                      {item}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
            <div className="wte-topArea">{areaDropdown}</div>
            <div className="wte-topAdd">
              <Button
                variant="contained"
                onClick={this._addAreaClick}
                aria-describedby="instruction-message-primary-button"
              >
                {this.props.intl.formatMessage({ id: "project_editor.world_test.add_area" })}
              </Button>
            </div>
            <div className="wte-topTools">
              <Stack direction="row" spacing={1} aria-label={this.props.intl.formatMessage({ id: "project_editor.world_test.actions_aria" })}></Stack>
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

export default withLocalization(WorldTestEditor);
