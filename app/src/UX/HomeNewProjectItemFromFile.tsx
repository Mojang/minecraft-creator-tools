import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./HomeNewProjectItemFromFile.css";
import { Input, InputProps, RadioGroup, RadioGroupItemProps, ThemeInput } from "@fluentui/react-northstar";
import IProjectItemSeed, { ProjectItemSeedAction } from "../app/IProjectItemSeed";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import IFolder from "../storage/IFolder";
import FileExplorer, { FileExplorerMode } from "./FileExplorer";
import Log from "../core/Log";
import ProjectItem from "../app/ProjectItem";
import ProjectEditorUtilities from "./ProjectEditorUtilities";
import Database from "../minecraft/Database";
import { IContentIndex } from "../core/ContentIndex";

export interface IProjectIntegrationItemSeed extends IProjectItemSeed {
  action: ProjectItemSeedAction;
  targetedItem?: ProjectItem;
  folder?: IFolder;
}

interface IHomeNewProjectItemFromFileProps extends IAppProps {
  projects: Project[];
  theme: ThemeInput<any>;
  files?: File;
  heightOffset: number;
  onProjectIntegrationItemSeedChange?: (data: IProjectIntegrationItemSeed) => void;
}

interface IHomeNewProjectItemFromFileState {
  action: ProjectItemSeedAction;
  data?: IProjectItemSeed;
  targetedProject?: Project;
  rootFolder?: IFolder;
  selectedItem?: ProjectItem;
  selectedFolder?: IFolder;
  name: string | undefined;
  nameIsManuallySet: boolean;
  vanillaContentIndex?: IContentIndex;
}

export default class HomeNewProjectItemFromFile extends Component<
  IHomeNewProjectItemFromFileProps,
  IHomeNewProjectItemFromFileState
> {
  constructor(props: IHomeNewProjectItemFromFileProps) {
    super(props);
  }

  componentDidMount(): void {
    this.load();
  }

  async load() {
    await Database.loadPreviewVanillaInfoData();

    this.setState({
      vanillaContentIndex: Database.previewVanillaContentIndex || undefined,
    });
  }

  _handleFolderSelected(folder: IFolder) {
    this.setState({
      name: this.state.name,
      nameIsManuallySet: this.state.nameIsManuallySet,
      rootFolder: this.state.rootFolder,
      selectedItem: this.state.selectedItem,
      selectedFolder: folder,
    });
    /*
    if (this.props.onProjectIntegrationItemSeedChange) {
      this.props.onProjectIntegrationItemSeedChange({
        action: this.state.action,
        folder: this.state.selectedFolder,
        selectedItem: this.state.selectedItem,
        fileSource: this.state.data?.fileSource,
      });
    }*/
  }

  _handleNameChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.creatorTools === null || this.state == null) {
      return;
    }

    let nextNameIsManuallySet = this.state.nameIsManuallySet;

    if (data.value === undefined || data.value === "") {
      nextNameIsManuallySet = false;
    }
    /*
    if (this.props.onProjectIntegrationItemSeedChange) {
      this.props.onProjectIntegrationItemSeedChange({
        name: data.value,
        action: this.state.action,
        folder: this.state.selectedFolder,
        selectedItem: this.state.selectedItem,
        fileSource: this.state.data?.fileSource,
      });
    }
*/
    this.setState({
      name: data.value,
      nameIsManuallySet: nextNameIsManuallySet,
      rootFolder: this.state.rootFolder,
      selectedItem: this.state.selectedItem,
      selectedFolder: this.state.selectedFolder,
    });
  }

  _handleTypeChange(e: SyntheticEvent, data: RadioGroupItemProps | undefined) {
    if (data === undefined || data.value === undefined) {
      Log.unexpectedUndefined("IITC");
      return;
    }

    let newAction = this.state.action;

    switch (data.value) {
      case "defaultAction":
        newAction = ProjectItemSeedAction.defaultAction;
        break;
      case "addNewFile":
        newAction = ProjectItemSeedAction.fileOrFolder;
        break;
      case "overwriteVanillaPath":
        newAction = ProjectItemSeedAction.overrwriteVanillaPath;
        break;
      default:
        newAction = ProjectItemSeedAction.overwriteFile;
    }

    let newSelectedItem: ProjectItem | undefined = undefined;

    if (data.value && typeof data.value === "string" && data.value.startsWith("replace.")) {
      if (this.state.data && this.state.data.fileSource && this.state.targetedProject) {
        const target = data.value.substring(8);

        for (const projectItem of this.state.targetedProject.items) {
          if (projectItem.primaryFile && projectItem.projectPath === target) {
            newSelectedItem = projectItem;
          }
        }
      }
    }

    let replacePath: string | undefined = undefined;
    if (data.value && typeof data.value === "string" && data.value.startsWith("overwriteVanillaPath.")) {
      replacePath = data.value.substring(21);
    }

    if (this.props.onProjectIntegrationItemSeedChange && this.state.data) {
      this.props.onProjectIntegrationItemSeedChange({
        name: this.state.name,
        itemType: this.state.data.itemType,
        folder: this.state.selectedFolder,
        fileSource: this.state.data.fileSource,
        replacePath: replacePath,
        action: newAction,
        targetedItem: newSelectedItem,
      });
    }

    this.setState({
      name: this.state.name,
      nameIsManuallySet: this.state.nameIsManuallySet,
      rootFolder: this.state.rootFolder,
      selectedItem: newSelectedItem,
      action: newAction,
      selectedFolder: this.state.selectedFolder,
    });
  }

  getRelatedFiles() {
    const items = [];

    if (this.state.data && this.state.data.fileSource && this.state.targetedProject) {
      const name = this.state.data.fileSource.name;
      for (const projectItem of this.state.targetedProject.items) {
        if (projectItem.primaryFile && projectItem.primaryFile.name === name) {
          items.push({
            name: "replace." + projectItem.projectPath,
            key: "replace." + projectItem.projectPath,
            value: "replace." + projectItem.projectPath,
            label: "Replace " + projectItem.projectPath,
          });

          if (items.length >= 3) {
            return items;
          }
        }
      }

      if (Database.previewVanillaContentIndex) {
        const pathMatches = Database.previewVanillaContentIndex.getPathMatches(this.state.data.fileSource.name);

        if (pathMatches) {
          for (const pathMatch of pathMatches) {
            items.push({
              name: "overwriteVanillaPath." + pathMatch,
              key: "overwriteVanillaPath." + pathMatch,
              value: "overwriteVanillaPath." + pathMatch,
              label: "Override vanilla file at " + pathMatch,
            });
          }
        }
      }
    }

    return items;
  }

  render() {
    if (this.state === null || this.state.vanillaContentIndex === undefined) {
      return <div>Loading...</div>;
    }

    let inputText = this.state.name;

    if (inputText === undefined) {
      inputText = "";
    }

    let fileArea = <></>;

    let label = "Add file";

    if (this.state.targetedProject && this.state.data && this.state.data.fileSource) {
      const tentativeLabel = ProjectEditorUtilities.getIntegrateBrowserFileDefaultActionDescription(
        this.state.targetedProject,
        "/" + this.state.data.fileSource.name,
        this.state.data.fileSource,
        this.state.data.fileContent
      );

      if (tentativeLabel) {
        label = tentativeLabel;
      }
    }

    let integrateOptions = [
      {
        name: "defaultAction",
        key: "defaultAction",
        value: "defaultAction",
        label: label,
      },
      {
        name: "addNewFile",
        key: "addNewFile",
        value: "addNewFile",
        label: "Add file at folder...",
      },
    ];

    if (this.state.data && this.state.data.fileSource) {
      const additionalOptions = this.getRelatedFiles();

      integrateOptions = [integrateOptions[0], ...additionalOptions, integrateOptions[1]];
    }

    let selectedOption = integrateOptions[0];

    if (this.state.action === ProjectItemSeedAction.fileOrFolder) {
      selectedOption = integrateOptions[integrateOptions.length - 1];
    } else if (this.state.action === ProjectItemSeedAction.overwriteFile) {
    } else if (this.state.action === ProjectItemSeedAction.overrwriteVanillaPath) {
    }

    if (this.state.action === ProjectItemSeedAction.fileOrFolder) {
      let folderPicker = <></>;

      if (this.state.rootFolder) {
        folderPicker = (
          <div className="iitem-folderArea">
            <div className="iitem-folderAreaLabel">Choose a folder:</div>
            <FileExplorer
              rootFolder={this.state.rootFolder}
              theme={this.props.theme}
              mode={FileExplorerMode.folderPicker}
              heightOffset={this.props.heightOffset + 340}
              creatorTools={this.props.creatorTools}
              selectedItem={this.state.rootFolder}
              onFolderSelected={this._handleFolderSelected}
              readOnly={false}
            />
          </div>
        );
      }

      fileArea = (
        <div>
          <div className="iitem-optionsArea">
            <div className="iitem-nameLabel" id="iitem-nameLabel">
              File Name
            </div>
            <div className="iitem-nameArea">
              <Input
                value={this.state.name}
                aria-labelledby="iitem-nameLabel"
                defaultValue={
                  this.state.data && this.state.data.fileSource ? this.state.data.fileSource.name : this.state.name
                }
                placeholder={
                  this.state.data && this.state.data.itemType
                    ? ProjectItemUtilities.getNewItemName(this.state.data.itemType) + " name"
                    : "File"
                }
                onChange={this._handleNameChanged}
              />
            </div>
          </div>
          {folderPicker}
        </div>
      );
    }

    return (
      <div className="iitem-outer">
        <RadioGroup
          vertical
          defaultCheckedValue={selectedOption.name}
          items={integrateOptions}
          onCheckedValueChange={this._handleTypeChange}
        />
        {fileArea}
      </div>
    );
  }
}
