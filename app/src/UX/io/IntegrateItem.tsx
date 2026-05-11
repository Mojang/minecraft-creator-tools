import { Component } from "react";
import IAppProps from "../appShell/IAppProps";
import Project from "../../app/Project";
import "./IntegrateItem.css";
import { TextField, RadioGroup, FormControlLabel, Radio } from "@mui/material";
import IProjectItemSeed, { ProjectItemSeedAction } from "../../app/IProjectItemSeed";
import ProjectItemUtilities from "../../app/ProjectItemUtilities";
import IFolder from "../../storage/IFolder";
import FileExplorer, { FileExplorerMode } from "../project/fileExplorer/FileExplorer";
import Log from "../../core/Log";
import ProjectItem from "../../app/ProjectItem";
import ProjectEditorUtilities from "../project/ProjectEditorUtilities";
import Database from "../../minecraft/Database";
import ContentIndex from "../../core/ContentIndex";
import StorageUtilities from "../../storage/StorageUtilities";
import IProjectTheme from "../types/IProjectTheme";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGlobe,
  faCube,
  faMusic,
  faFileCode,
  faBoxOpen,
  faFileLines,
  faPuzzlePiece,
  faImage,
} from "@fortawesome/free-solid-svg-icons";
import { faFile } from "@fortawesome/free-regular-svg-icons";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { WithLocalizationProps, withLocalization } from "../withLocalization";

interface IIntegrateItemProps extends IAppProps, WithLocalizationProps {
  project: Project;
  theme: IProjectTheme;
  heightOffset: number;
  data: IProjectItemSeed;
  onDialogDataChange: (updateData: any) => void;
}

interface IIntegrateItemState {
  name?: string;
  rootFolder?: IFolder;
  selectedFolder?: IFolder;
  vanillaContentIndex?: ContentIndex;
  selectedItem?: ProjectItem;
  action?: ProjectItemSeedAction;
  fileContent?: string | Uint8Array | undefined;
  nameIsManuallySet?: boolean;
}

class IntegrateItem extends Component<IIntegrateItemProps, IIntegrateItemState> {
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

  _handleNameChanged(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.props.creatorTools === null || this.state == null) {
      return;
    }

    const value = e.target.value;
    let nextNameIsManuallySet = this.state.nameIsManuallySet;

    if (value === undefined || value === "") {
      nextNameIsManuallySet = false;
    }

    if (this.props.onDialogDataChange) {
      this.props.onDialogDataChange({
        name: value,
        action: this.state.action,
        itemType: this.props.data.itemType,
        folder: this.state.selectedFolder,
        selectedItem: this.state.selectedItem,
        fileSource: this.props.data.fileSource,
      });
    }

    this.setState({
      name: value,
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

    await Database.loadPreviewVanillaInfoData();

    if (folder) {
      this.setState({
        name: this.state.name,
        nameIsManuallySet: this.state.nameIsManuallySet,
        selectedItem: this.state.selectedItem,
        vanillaContentIndex: Database.previewVanillaContentIndex || undefined,
        rootFolder: folder,
        selectedFolder: folder,
      });
    }
  }

  _handleTypeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const dataValue = e.target.value;
    if (dataValue === undefined) {
      Log.unexpectedUndefined("IITC");
      return;
    }

    let newAction = this.state.action;

    switch (dataValue) {
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

    if (dataValue && typeof dataValue === "string" && dataValue.startsWith("replace.")) {
      if (this.props.data.fileSource) {
        const target = dataValue.substring(8);

        for (const projectItem of this.props.project.items) {
          if (projectItem.primaryFile && projectItem.projectPath === target) {
            newSelectedItem = projectItem;
          }
        }
      }
    }

    let replacePath: string | undefined = undefined;
    if (dataValue && typeof dataValue === "string" && dataValue.startsWith("overwriteVanillaPath.")) {
      replacePath = dataValue.substring(21);
    }

    if (this.props.onDialogDataChange) {
      this.props.onDialogDataChange({
        name: this.state.name,
        itemType: this.props.data.itemType,
        folder: this.state.selectedFolder,
        fileSource: this.props.data.fileSource,
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

    if (this.props.data.fileSource) {
      const name = this.props.data.fileSource.name;
      for (const projectItem of this.props.project.items) {
        if (projectItem.primaryFile && projectItem.primaryFile.name === name) {
          items.push({
            name: "replace." + projectItem.projectPath,
            key: "replace." + projectItem.projectPath,
            value: "replace." + projectItem.projectPath,
            label: this.props.intl.formatMessage({ id: "integrate_item.replace" }, { path: projectItem.projectPath }),
          });

          if (items.length >= 3) {
            return items;
          }
        }
      }

      if (Database.previewVanillaContentIndex) {
        const pathMatches = Database.previewVanillaContentIndex.getPathMatches(
          StorageUtilities.ensureStartsWithDelimiter(this.props.data.fileSource.name)
        );

        if (pathMatches) {
          for (const pathMatch of pathMatches) {
            items.push({
              name: "overwriteVanillaPath." + pathMatch,
              key: "overwriteVanillaPath." + pathMatch,
              value: "overwriteVanillaPath." + pathMatch,
              label: this.props.intl.formatMessage({ id: "integrate_item.override_vanilla" }, { path: pathMatch }),
            });
          }
        }
      }
    }

    return items;
  }

  getContentTypeInfo(): { icon: IconDefinition; typeName: string; description: string } {
    const intl = this.props.intl;

    if (!this.props.data.fileSource) {
      return { icon: faFile, typeName: intl.formatMessage({ id: "integrate_item.type_file" }), description: intl.formatMessage({ id: "integrate_item.desc_add_file" }) };
    }

    const extension = StorageUtilities.getTypeFromName(this.props.data.fileSource.name);
    const fileName = this.props.data.fileSource.name.toLowerCase();

    if (
      fileName === "level.dat" ||
      extension === "db" ||
      fileName === "current" ||
      fileName.startsWith("manifest-") ||
      fileName === "level.dat_old" ||
      fileName === "levelname.txt" ||
      fileName.startsWith("world_")
    ) {
      return { icon: faGlobe, typeName: intl.formatMessage({ id: "integrate_item.type_world_data" }), description: intl.formatMessage({ id: "integrate_item.desc_world_data" }) };
    }

    switch (extension) {
      case "mcworld":
        return {
          icon: faGlobe,
          typeName: intl.formatMessage({ id: "integrate_item.type_mcworld" }),
          description: intl.formatMessage({ id: "integrate_item.desc_mcworld" }),
        };
      case "mcproject":
        return {
          icon: faBoxOpen,
          typeName: intl.formatMessage({ id: "integrate_item.type_mcproject" }),
          description: intl.formatMessage({ id: "integrate_item.desc_mcproject" }),
        };
      case "mctemplate":
        return {
          icon: faBoxOpen,
          typeName: intl.formatMessage({ id: "integrate_item.type_template" }),
          description: intl.formatMessage({ id: "integrate_item.desc_template" }),
        };
      case "mcaddon":
        return {
          icon: faPuzzlePiece,
          typeName: intl.formatMessage({ id: "integrate_item.type_addon" }),
          description: intl.formatMessage({ id: "integrate_item.desc_addon" }),
        };
      case "mcpack":
        return {
          icon: faPuzzlePiece,
          typeName: intl.formatMessage({ id: "integrate_item.type_pack" }),
          description: intl.formatMessage({ id: "integrate_item.desc_pack" }),
        };
      case "zip":
        return {
          icon: faBoxOpen,
          typeName: intl.formatMessage({ id: "integrate_item.type_archive" }),
          description: intl.formatMessage({ id: "integrate_item.desc_archive" }),
        };
      case "ogg":
      case "mp3":
      case "wav":
        return {
          icon: faMusic,
          typeName: intl.formatMessage({ id: "integrate_item.type_sound" }),
          description: intl.formatMessage({ id: "integrate_item.desc_sound" }),
        };
      case "mcstructure":
        return {
          icon: faCube,
          typeName: intl.formatMessage({ id: "integrate_item.type_structure" }),
          description: intl.formatMessage({ id: "integrate_item.desc_structure" }),
        };
      case "snbt":
        return {
          icon: faCube,
          typeName: intl.formatMessage({ id: "integrate_item.type_snbt" }),
          description: intl.formatMessage({ id: "integrate_item.desc_snbt" }),
        };
      case "bbmodel":
        return {
          icon: faCube,
          typeName: intl.formatMessage({ id: "integrate_item.type_bbmodel" }),
          description: intl.formatMessage({ id: "integrate_item.desc_bbmodel" }),
        };
      case "json":
        return {
          icon: faFileCode,
          typeName: intl.formatMessage({ id: "integrate_item.type_json" }),
          description: intl.formatMessage({ id: "integrate_item.desc_json" }),
        };
      case "png":
      case "jpg":
      case "jpeg":
      case "tga":
        return {
          icon: faImage,
          typeName: intl.formatMessage({ id: "integrate_item.type_image" }),
          description: intl.formatMessage({ id: "integrate_item.desc_image" }),
        };
      case "js":
      case "ts":
        return {
          icon: faFileCode,
          typeName: intl.formatMessage({ id: "integrate_item.type_script" }),
          description: intl.formatMessage({ id: "integrate_item.desc_script" }),
        };
      default:
        return {
          icon: faFileLines,
          typeName: intl.formatMessage({ id: "integrate_item.type_ext_file" }, { extension: StorageUtilities.getTypeFromName(this.props.data.fileSource.name)?.toUpperCase() || "" }),
          description: intl.formatMessage({ id: "integrate_item.desc_default" }),
        };
    }
  }

  render() {
    const intl = this.props.intl;

    if (this.state === null || this.state.vanillaContentIndex === undefined) {
      return <div>{intl.formatMessage({ id: "integrate_item.loading" })}</div>;
    }

    let inputText = this.state.name;

    if (inputText === undefined) {
      inputText = "";
    }

    let fileArea = <></>;

    let label = intl.formatMessage({ id: "integrate_item.add_file" });

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
        label: intl.formatMessage({ id: "integrate_item.add_file_at_folder" }),
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
    } else if (this.state.action === ProjectItemSeedAction.overrwriteVanillaPath) {
    }

    if (this.state.action === ProjectItemSeedAction.fileOrFolder) {
      let folderPicker = <></>;

      if (this.state.rootFolder) {
        folderPicker = (
          <div className="iitem-folderArea">
            <div className="iitem-folderAreaLabel">{intl.formatMessage({ id: "integrate_item.choose_folder" })}</div>
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
              {intl.formatMessage({ id: "integrate_item.file_name" })}
            </div>
            <div className="iitem-nameArea">
              <TextField
                value={this.state.name}
                aria-labelledby="iitem-nameLabel"
                placeholder={intl.formatMessage({ id: "integrate_item.name_placeholder" }, { name: ProjectItemUtilities.getNewItemName(this.props.data.itemType) })}
                onChange={this._handleNameChanged}
                size="small"
                variant="outlined"
              />
            </div>
          </div>
          {folderPicker}
        </div>
      );
    }

    const contentTypeInfo = this.getContentTypeInfo();
    const infoBgColor = this.props.theme ? this.props.theme.background3 : "#2a2a2a";
    const infoTextColor = this.props.theme ? this.props.theme.foreground1 : "#e0e0e0";

    return (
      <div className="iitem-outer">
        <div className="iitem-contentInfo" style={{ backgroundColor: infoBgColor, color: infoTextColor }}>
          <div className="iitem-contentInfo-icon">
            <FontAwesomeIcon icon={contentTypeInfo.icon} />
          </div>
          <div className="iitem-contentInfo-text">
            <div className="iitem-contentInfo-type">{contentTypeInfo.typeName}</div>
            <div className="iitem-contentInfo-description">{contentTypeInfo.description}</div>
          </div>
        </div>
        <RadioGroup defaultValue={selectedOption.name} onChange={this._handleTypeChange}>
          {integrateOptions.map((option) => (
            <FormControlLabel key={option.key} value={option.value} control={<Radio />} label={option.label} />
          ))}
        </RadioGroup>
        {fileArea}
      </div>
    );
  }
}

export default withLocalization(IntegrateItem);
