import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./IntegrateItem.css";
import { Input, InputProps, RadioGroup, RadioGroupItemProps, ThemeInput } from "@fluentui/react-northstar";
import IProjectItemSeed, { ProjectItemSeedAction } from "../app/IProjectItemSeed";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import IFolder from "../storage/IFolder";
import FileExplorer, { FileExplorerMode } from "./FileExplorer";
import Log from "../core/Log";
import ProjectItem from "../app/ProjectItem";
import ProjectEditorUtilities from "./ProjectEditorUtilities";

interface IIntegrateItemProps extends IAppProps {
  project: Project;
  theme: ThemeInput<any>;
  heightOffset: number;
  data: IProjectItemSeed;
  onDialogDataChange: (updateData: any) => void;
}

interface IIntegrateItemState {
  name?: string;
  rootFolder?: IFolder;
  selectedFolder?: IFolder;
  selectedItem?: ProjectItem;
  action?: ProjectItemSeedAction;
  fileContent?: string | Uint8Array | undefined;
  nameIsManuallySet?: boolean;
}

export default class IntegrateItem extends Component<IIntegrateItemProps, IIntegrateItemState> {
  constructor(props: IIntegrateItemProps) {
    super(props);

    this._handleNameChanged = this._handleNameChanged.bind(this);
    this._handleFolderSelected = this._handleFolderSelected.bind(this);
    this._handleTypeChange = this._handleTypeChange.bind(this);

    this.state = {
      action: this.props.data.action,
      name: this.props.data.fileSource ? this.props.data.fileSource.name : this.state.name,
    };
  }

  _handleNameChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.carto === null || this.state == null) {
      return;
    }

    let nextNameIsManuallySet = this.state.nameIsManuallySet;

    if (data.value === undefined || data.value === "") {
      nextNameIsManuallySet = false;
    }

    if (this.props.onDialogDataChange) {
      this.props.onDialogDataChange({
        name: data.value,
        action: this.state.action,
        itemType: this.props.data.itemType,
        folder: this.state.selectedFolder,
        selectedItem: this.state.selectedItem,
        fileSource: this.props.data.fileSource,
      });
    }

    this.setState({
      name: data.value,
      fileContent: this.state.fileContent,
      nameIsManuallySet: nextNameIsManuallySet,
      rootFolder: this.state.rootFolder,
      selectedItem: this.state.selectedItem,
      selectedFolder: this.state.selectedFolder,
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

    if (this.props.onDialogDataChange) {
      this.props.onDialogDataChange({
        name: this.state.name,
        itemType: this.props.data.itemType,
        folder: folder,
        fileSource: this.props.data.fileSource,
        action: this.state.action,
        selectedItem: this.state.selectedItem,
      });
    }
  }

  componentDidMount(): void {
    this.setRootFolder();
  }

  async setRootFolder() {
    let folder = await ProjectItemUtilities.getDefaultFolderForType(this.props.project, this.props.data.itemType);

    if (!folder && this.props.project.projectFolder) {
      folder = this.props.project.projectFolder;
    }

    if (folder) {
      this.setState({
        name: this.state.name,
        nameIsManuallySet: this.state.nameIsManuallySet,
        selectedItem: this.state.selectedItem,
        rootFolder: folder,
        selectedFolder: folder,
      });
    }
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
      default:
        newAction = ProjectItemSeedAction.overwriteFile;
    }

    let newSelectedItem: ProjectItem | undefined = undefined;

    if (data.value && typeof data.value === "string" && data.value.startsWith("replace.")) {
      if (this.props.data.fileSource) {
        const target = data.value.substring(8);

        for (const projectItem of this.props.project.items) {
          if (projectItem.file && projectItem.projectPath === target) {
            newSelectedItem = projectItem;
          }
        }
      }
    }

    if (this.props.onDialogDataChange) {
      this.props.onDialogDataChange({
        name: this.state.name,
        itemType: this.props.data.itemType,
        folder: this.state.selectedFolder,
        fileSource: this.props.data.fileSource,
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

    if (this.props.data.fileSource) {
      const name = this.props.data.fileSource.name;
      for (const projectItem of this.props.project.items) {
        if (projectItem.file && projectItem.file.name === name) {
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
    }

    return items;
  }

  render() {
    if (this.state === null) {
      return <div>Loading...</div>;
    }

    let inputText = this.state.name;

    if (inputText === undefined) {
      inputText = "";
    }

    let fileArea = <></>;

    let label = "Add file";

    if (this.props.data.fileSource) {
      const tentativeLabel = ProjectEditorUtilities.getIntegrateBrowserFileDefaultActionDescription(
        this.props.project,
        "/" + this.props.data.fileSource.name,
        this.props.data.fileSource,
        this.props.data.fileContent
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

    if (this.props.data.fileSource) {
      const additionalOptions = this.getRelatedFiles();

      integrateOptions = [integrateOptions[0], ...additionalOptions, integrateOptions[1]];
    }

    let selectedOption = integrateOptions[0];

    if (this.state.action === ProjectItemSeedAction.fileOrFolder) {
      selectedOption = integrateOptions[integrateOptions.length - 1];
    } else if (this.state.action === ProjectItemSeedAction.overwriteFile) {
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
              carto={this.props.carto}
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
            <div className="iitem-nameLabel">File Name</div>
            <div className="iitem-nameArea">
              <Input
                value={this.state.name}
                defaultValue={this.props.data.fileSource ? this.props.data.fileSource.name : this.state.name}
                placeholder={ProjectItemUtilities.getNewItemName(this.props.data.itemType) + " name"}
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
