import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./BlockTypeActionEditor.css";
import Database from "../minecraft/Database";
import { ThemeInput } from "@fluentui/styles";
import BlockTypeDefinition from "../minecraft/BlockTypeDefinition";
import ProjectItem from "../app/ProjectItem";
import { CustomLabel } from "./Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import WebUtilities from "./WebUtilities";
import { Dialog, Dropdown, DropdownProps, Toolbar } from "@fluentui/react-northstar";
import Carto from "../app/Carto";
import Project from "../app/Project";
import IManagedComponentSetItem from "../minecraft/IManagedComponentSetItem";
import { faAdd } from "@fortawesome/free-solid-svg-icons";
import ProjectUtilities from "../app/ProjectUtilities";
import Utilities from "../core/Utilities";
import { ProjectItemType } from "../app/IProjectItemData";
import JavaScriptEditor, { ScriptEditorRole } from "./JavaScriptEditor";
import IPersistable from "./IPersistable";
import { ProjectScriptLanguage } from "../app/IProjectData";
import SetNamespacedId from "./SetNamespacedId";

interface IBlockTypeActionEditorProps extends IFileProps {
  isVisualsMode: boolean;
  heightOffset: number;
  readOnly: boolean;
  blockTypeItem: BlockTypeDefinition;
  item: ProjectItem;
  project: Project;
  carto: Carto;
  theme: ThemeInput<any>;
}

interface IBlockTypeActionEditorState {
  fileToEdit: IFile;
  selectedActionComponentId?: string;
  dialogMode: BlockTypeActionEditorDialogMode;
  selectedItem: IManagedComponentSetItem;
  selectedNewActionName?: string;
  isLoaded: boolean;
}

export enum BlockTypeActionEditorDialogMode {
  none = 0,
  newActionComponent = 1,
}

export default class BlockTypeActionEditor extends Component<IBlockTypeActionEditorProps, IBlockTypeActionEditorState> {
  private _lastFileEdited?: IFile;

  constructor(props: IBlockTypeActionEditorProps) {
    super(props);

    this._handleBlockTypeLoaded = this._handleBlockTypeLoaded.bind(this);
    this._handleActionChange = this._handleActionChange.bind(this);
    this.setNewName = this.setNewName.bind(this);
    this._hideDialog = this._hideDialog.bind(this);
    this._handleSetNameOK = this._handleSetNameOK.bind(this);
    this._addAction = this._addAction.bind(this);
    this._addNewAction = this._addNewAction.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
    this._onUpdatePreferredTextSize = this._onUpdatePreferredTextSize.bind(this);

    const selectedAction: string | undefined = undefined;
    const comp = this.props.blockTypeItem.getComponent("minecraft:custom_components");

    if (comp) {
      const sarr = comp.getData();

      if (sarr && Array.isArray(sarr) && sarr.length > 0) {
      }
    }

    this.state = {
      fileToEdit: props.file,
      selectedActionComponentId: selectedAction,
      dialogMode: BlockTypeActionEditorDialogMode.none,
      selectedNewActionName: undefined,
      selectedItem: this.props.blockTypeItem,
      isLoaded: false,
    };

    this._updateManager(false);
  }

  componentDidUpdate(prevProps: IBlockTypeActionEditorProps, prevState: IBlockTypeActionEditorState) {
    this._updateManager(true);
  }

  async _updateManager(setState: boolean) {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        await BlockTypeDefinition.ensureOnFile(this.state.fileToEdit, this._handleBlockTypeLoaded);
      }
    }

    if (
      this.state.fileToEdit &&
      this.state.fileToEdit.manager !== undefined &&
      this.state.fileToEdit.manager instanceof BlockTypeDefinition &&
      (this.state.fileToEdit.manager as BlockTypeDefinition).isLoaded &&
      !this.state.isLoaded
    ) {
      this._doUpdate(setState);
    }
  }

  _handleBlockTypeLoaded(blockType: BlockTypeDefinition, typeA: BlockTypeDefinition) {
    this._doUpdate(true);
  }

  async _doUpdate(setState: boolean) {
    if (setState) {
      this.setState({
        fileToEdit: this.state.fileToEdit,
        isLoaded: true,
      });
    } else {
      this.state = {
        fileToEdit: this.props.file,
        dialogMode: this.state.dialogMode,
        selectedActionComponentId: this.state.selectedActionComponentId,
        selectedNewActionName: this.state.selectedNewActionName,
        selectedItem: this.state.selectedItem,
        isLoaded: true,
      };
    }
  }

  async persist() {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager !== null) {
        const bt = file.manager as BlockTypeDefinition;

        bt.persist();
      }
    }
  }

  _addNewAction() {
    this.setState({
      fileToEdit: this.state.fileToEdit,
      dialogMode: BlockTypeActionEditorDialogMode.newActionComponent,
      selectedActionComponentId: this.state.selectedActionComponentId,
      selectedNewActionName: this.props.project.effectiveDefaultNamespace + ":" + this._getSuggestedName(),
      selectedItem: this.state.selectedItem,
      isLoaded: this.state.isLoaded,
    });
  }

  async _handleActionChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    if (typeof data.value === "string") {
      this.setState({
        fileToEdit: this.state.fileToEdit,
        dialogMode: this.state.dialogMode,
        selectedActionComponentId: data.value,
        selectedNewActionName: this.state.selectedNewActionName,
        selectedItem: this.state.selectedItem,
        isLoaded: this.state.isLoaded,
      });
    }
  }

  async _addAction(actionName: string) {
    const comp = this.props.blockTypeItem.ensureComponent("minecraft:custom_components", []);

    if (comp) {
      let sarr = comp.getData();

      if (!sarr) {
        sarr = [actionName];

        comp.setData(sarr);
      } else if (!Array.isArray(sarr)) {
        if (typeof sarr === "string") {
          sarr = [sarr, actionName];
        } else {
          sarr = [actionName];
        }

        comp.setData(sarr);
      } else {
        (sarr as string[]).push(actionName);
      }

      let actionNameShort = actionName;

      const idx = actionName.indexOf(":");
      if (idx >= 0) {
        actionNameShort = actionName.substring(idx + 1);
      }

      const fileNameSugg = Utilities.getHumanifiedObjectName(actionNameShort);

      await ProjectUtilities.ensureTypeScriptFileWith(
        this.props.project,
        actionName,
        "new-templates",
        "blockCustomComponent",
        fileNameSugg,
        {
          "example:newComponentId": actionName,
          ExampleNewComponent: fileNameSugg,
          initExampleNew: "init" + fileNameSugg,
        }
      );

      const defaultScriptFile = await this.props.project.getDefaultScriptsFile();

      if (defaultScriptFile) {
        await defaultScriptFile.loadContent();

        if (typeof defaultScriptFile.content === "string" && defaultScriptFile.content.length > 0) {
          if (defaultScriptFile.content.indexOf("init" + fileNameSugg) <= 0) {
            let newContent = "import { init" + fileNameSugg + ' } from "./' + fileNameSugg + '"\r\n';

            newContent += defaultScriptFile.content + "\r\ninit" + fileNameSugg + "();\r\n";

            defaultScriptFile.setContent(newContent);

            await defaultScriptFile.saveContent();
          }
        }
      }

      this.forceUpdate();
    }
  }

  setNewName(newName: string) {
    this.setState({
      fileToEdit: this.state.fileToEdit,
      dialogMode: this.state.dialogMode,
      selectedActionComponentId: this.state.selectedActionComponentId,
      selectedNewActionName: newName,
      selectedItem: this.state.selectedItem,
      isLoaded: this.state.isLoaded,
    });
  }

  private _hideDialog() {
    this.setState({
      fileToEdit: this.state.fileToEdit,
      dialogMode: BlockTypeActionEditorDialogMode.none,
      selectedActionComponentId: this.state.selectedActionComponentId,
      selectedNewActionName: undefined,
      selectedItem: this.state.selectedItem,
      isLoaded: this.state.isLoaded,
    });
  }

  private async _handleSetNameOK() {
    if (this.state.selectedNewActionName) {
      await this._addAction(this.state.selectedNewActionName);

      this.setState({
        fileToEdit: this.state.fileToEdit,
        dialogMode: BlockTypeActionEditorDialogMode.none,
        selectedActionComponentId: this.state.selectedNewActionName,
        selectedNewActionName: undefined,
        selectedItem: this.state.selectedItem,
        isLoaded: this.state.isLoaded,
      });
    }
  }

  _handleNewChildPersistable(newPersistable: IPersistable) {
    if (this.props.setActivePersistable) {
      this.props.setActivePersistable(newPersistable);
    }
  }

  _onUpdatePreferredTextSize(newTextSize: number) {
    this.props.carto.preferredTextSize = newTextSize;
  }

  _getSuggestedName() {
    let suggestedName = "actions";

    if (this.props.blockTypeItem.id) {
      suggestedName =
        Utilities.getHumanifiedObjectName(this.props.blockTypeItem.id).toLowerCase() + "_" + suggestedName;
    }

    return suggestedName;
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";

    const bt = this.state.fileToEdit.manager as BlockTypeDefinition;

    if (bt._data === undefined) {
      return <div className="btpe-loading">Loading behavior pack...</div>;
    }

    const width = WebUtilities.getWidth();
    let isButtonCompact = false;

    if (width < 1016) {
      isButtonCompact = true;
    }

    if (
      this.state === null ||
      this.state.fileToEdit === null ||
      this.state.fileToEdit.manager === undefined ||
      Database.uxCatalog === null
    ) {
      if (this.state.fileToEdit !== null) {
        if (this.state.fileToEdit.manager === undefined) {
          this._updateManager(true);
        }
      }

      return <div className="btae-loading">Loading...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    if (this.state.dialogMode === BlockTypeActionEditorDialogMode.newActionComponent) {
      return (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          key="btse-addComponentOuter"
          onCancel={this._hideDialog}
          onConfirm={this._handleSetNameOK}
          content={
            <SetNamespacedId
              onNameChanged={this.setNewName}
              defaultNamespace={this.props.project.effectiveDefaultNamespace}
              defaultName={this._getSuggestedName()}
              theme={this.props.theme}
            />
          }
          header={"Add new action component"}
        />
      );
    } else {
      let itemInterior = <></>;
      let dropdownArea = <></>;

      if (this.state.selectedActionComponentId && this.props.item.childItems) {
        let foundTypeScript = false;

        for (const candItem of this.props.item.childItems) {
          if (candItem.childItem.itemType === ProjectItemType.ts) {
            if (
              candItem.childItem.defaultFile &&
              candItem.childItem.defaultFile.content &&
              typeof candItem.childItem.defaultFile.content === "string" &&
              candItem.childItem.defaultFile.content.indexOf(this.state.selectedActionComponentId) >= 0
            ) {
              foundTypeScript = true;
              itemInterior = (
                <JavaScriptEditor
                  role={ScriptEditorRole.script}
                  carto={this.props.carto}
                  theme={this.props.theme}
                  onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                  preferredTextSize={this.props.carto.preferredTextSize}
                  readOnly={this.props.readOnly}
                  project={this.props.project}
                  scriptLanguage={ProjectScriptLanguage.typeScript}
                  heightOffset={226}
                  file={candItem.childItem.defaultFile}
                  setActivePersistable={this._handleNewChildPersistable}
                />
              );
              break;
            }
          }
        }

        if (!foundTypeScript) {
          itemInterior = (
            <div>Could not find any TypeScript files that references `{this.state.selectedActionComponentId}`.</div>
          );
        }
      }

      const toolbarItems = [];

      const comp = this.props.blockTypeItem.getComponent("minecraft:custom_components");

      if (comp) {
        const sarr = comp.getData();

        if (sarr && Array.isArray(sarr) && sarr.length > 0) {
          dropdownArea = (
            <Dropdown
              items={sarr}
              placeholder="Select an action component"
              defaultValue={this.state.selectedActionComponentId}
              value={this.state.selectedActionComponentId}
              onChange={this._handleActionChange}
            />
          );
        }
      }

      toolbarItems.push({
        icon: (
          <CustomLabel
            isCompact={isButtonCompact}
            text="Add action"
            icon={<FontAwesomeIcon icon={faAdd} className="fa-lg" />}
          />
        ),
        key: "add",
        tag: "addItem",
        onClick: this._addNewAction,
        title: "Add action",
      });

      return (
        <div
          className="btae-area"
          style={{
            minHeight: height,
            maxHeight: height,
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
          }}
        >
          <div className="btae-toolBarArea">
            <div className="btae-tools">
              <Toolbar aria-label="Actions toolbar overflow menu" items={toolbarItems} />
            </div>
            <div className="btae-dropdown">{dropdownArea}</div>
          </div>
          {itemInterior}
        </div>
      );
    }
  }
}
