import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./ItemTypeActionEditor.css";
import Database from "../minecraft/Database";
import { ThemeInput } from "@fluentui/styles";
import ItemTypeDefinition from "../minecraft/ItemTypeDefinition";
import ProjectItem from "../app/ProjectItem";
import { CustomLabel } from "./Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import WebUtilities from "./WebUtilities";
import { Dialog, Dropdown, DropdownProps, Toolbar } from "@fluentui/react-northstar";
import CreatorTools from "../app/CreatorTools";
import Project from "../app/Project";
import IManagedComponentSetItem from "../minecraft/IManagedComponentSetItem";
import { faAdd } from "@fortawesome/free-solid-svg-icons";
import Utilities from "../core/Utilities";
import { ProjectItemType } from "../app/IProjectItemData";
import JavaScriptEditor, { ScriptEditorRole } from "./JavaScriptEditor";
import IPersistable from "./IPersistable";
import { ProjectScriptLanguage } from "../app/IProjectData";
import SetNamespacedId from "./SetNamespacedId";
import ProjectItemRelations from "../app/ProjectItemRelations";

interface IItemTypeActionEditorProps extends IFileProps {
  isVisualsMode: boolean;
  heightOffset: number;
  readOnly: boolean;
  itemTypeItem: ItemTypeDefinition;
  item: ProjectItem;
  project: Project;
  creatorTools: CreatorTools;
  theme: ThemeInput<any>;
}

interface IItemTypeActionEditorState {
  fileToEdit: IFile;
  selectedActionComponentId?: string;
  dialogMode: ItemTypeActionEditorDialogMode;
  selectedItem: IManagedComponentSetItem;
  selectedNewActionName?: string;
  isLoaded: boolean;
}

export enum ItemTypeActionEditorDialogMode {
  none = 0,
  newActionComponent = 1,
}

export default class ItemTypeActionEditor extends Component<IItemTypeActionEditorProps, IItemTypeActionEditorState> {
  private _lastFileEdited?: IFile;

  constructor(props: IItemTypeActionEditorProps) {
    super(props);

    this._handleItemTypeLoaded = this._handleItemTypeLoaded.bind(this);
    this._handleActionChange = this._handleActionChange.bind(this);
    this.setNewName = this.setNewName.bind(this);
    this._hideDialog = this._hideDialog.bind(this);
    this._handleSetNameOK = this._handleSetNameOK.bind(this);
    this._addAction = this._addAction.bind(this);
    this._addNewAction = this._addNewAction.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
    this._onUpdatePreferredTextSize = this._onUpdatePreferredTextSize.bind(this);

    const selectedAction: string | undefined = undefined;

    this.state = {
      fileToEdit: props.file,
      selectedActionComponentId: selectedAction,
      dialogMode: ItemTypeActionEditorDialogMode.none,
      selectedNewActionName: undefined,
      selectedItem: this.props.itemTypeItem,
      isLoaded: false,
    };

    this._updateManager(false);
  }

  componentDidUpdate(prevProps: IItemTypeActionEditorProps, prevState: IItemTypeActionEditorState) {
    this._updateManager(true);
  }

  async _updateManager(setState: boolean) {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        await ItemTypeDefinition.ensureOnFile(this.state.fileToEdit, this._handleItemTypeLoaded);
      }
    }

    await this.props.item.ensureDependencies();

    if (
      this.state.fileToEdit &&
      this.state.fileToEdit.manager !== undefined &&
      this.state.fileToEdit.manager instanceof ItemTypeDefinition &&
      (this.state.fileToEdit.manager as ItemTypeDefinition).isLoaded &&
      !this.state.isLoaded
    ) {
      this._doUpdate(setState);
    }
  }

  _handleItemTypeLoaded(ItemType: ItemTypeDefinition, typeA: ItemTypeDefinition) {
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

  async persist(): Promise<boolean> {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager) {
        const bt = file.manager as ItemTypeDefinition;

        return bt.persist();
      }
    }

    return false;
  }

  _addNewAction() {
    this.setState({
      fileToEdit: this.state.fileToEdit,
      dialogMode: ItemTypeActionEditorDialogMode.newActionComponent,
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
    await this.props.itemTypeItem.addCustomComponent(this.props.item, actionName);

    await ProjectItemRelations.calculateForItem(this.props.item);

    this.setState({
      fileToEdit: this.state.fileToEdit,
      selectedActionComponentId: this.state.selectedActionComponentId,
      dialogMode: ItemTypeActionEditorDialogMode.none,
      selectedItem: this.state.selectedItem,
      selectedNewActionName: this.state.selectedNewActionName,
      isLoaded: false,
    });
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
      dialogMode: ItemTypeActionEditorDialogMode.none,
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
        dialogMode: ItemTypeActionEditorDialogMode.none,
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
    this.props.creatorTools.preferredTextSize = newTextSize;
  }

  _getSuggestedName() {
    let suggestedName = "actions";

    if (this.props.itemTypeItem.id) {
      suggestedName =
        Utilities.getHumanifiedObjectNameNoSpaces(this.props.itemTypeItem.id).toLowerCase() + "_" + suggestedName;
    }

    return suggestedName;
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";

    const bt = this.state.fileToEdit.manager as ItemTypeDefinition;

    if (bt.data === undefined) {
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

      return <div className="itae-loading">Loading...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    if (this.state.dialogMode === ItemTypeActionEditorDialogMode.newActionComponent) {
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
              candItem.childItem.primaryFile &&
              candItem.childItem.primaryFile.content &&
              typeof candItem.childItem.primaryFile.content === "string" &&
              candItem.childItem.primaryFile.content.indexOf(this.state.selectedActionComponentId) >= 0
            ) {
              foundTypeScript = true;
              itemInterior = (
                <JavaScriptEditor
                  role={ScriptEditorRole.script}
                  creatorTools={this.props.creatorTools}
                  theme={this.props.theme}
                  onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                  preferredTextSize={this.props.creatorTools.preferredTextSize}
                  readOnly={this.props.readOnly}
                  project={this.props.project}
                  scriptLanguage={ProjectScriptLanguage.typeScript}
                  heightOffset={226}
                  file={candItem.childItem.primaryFile}
                  setActivePersistable={this._handleNewChildPersistable}
                />
              );
              break;
            }
          }
        }

        if (!foundTypeScript) {
          itemInterior = (
            <div className="itae-error">
              Could not find any TypeScript files that references `{this.state.selectedActionComponentId}`.
            </div>
          );
        }
      }

      const toolbarItems = [];

      const compIdArr = this.props.itemTypeItem.getCustomComponentIds();

      if (compIdArr && Array.isArray(compIdArr) && compIdArr.length > 0) {
        dropdownArea = (
          <Dropdown
            items={compIdArr}
            placeholder="Select an action component"
            defaultValue={this.state.selectedActionComponentId}
            value={this.state.selectedActionComponentId}
            onChange={this._handleActionChange}
          />
        );
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
          className="itae-area"
          style={{
            minHeight: height,
            maxHeight: height,
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
          }}
        >
          <div className="itae-toolBarArea">
            <div className="itae-tools">
              <Toolbar aria-label="Actions" items={toolbarItems} />
            </div>
            <div className="itae-dropdown">{dropdownArea}</div>
          </div>
          {itemInterior}
        </div>
      );
    }
  }
}
