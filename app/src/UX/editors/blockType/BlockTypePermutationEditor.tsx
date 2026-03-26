import { Component } from "react";
import IFileProps from "../../project/fileExplorer/IFileProps";
import IFile from "../../../storage/IFile";
import "./BlockTypePermutationEditor.css";
import Database from "../../../minecraft/Database";
import BlockTypeDefinition from "../../../minecraft/BlockTypeDefinition";
import ProjectItem from "../../../app/ProjectItem";
import BlockTypeComponentSetEditor from "./BlockTypeComponentSetEditor";
import { CustomLabel } from "../../shared/components/feedback/labels/Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import WebUtilities from "../../utils/WebUtilities";
import { Stack, Button, List, ListItemButton, ListItemText } from "@mui/material";
import CreatorTools from "../../../app/CreatorTools";
import Project from "../../../app/Project";
import IManagedComponentSetItem from "../../../minecraft/IManagedComponentSetItem";
import ManagedPermutation from "../../../minecraft/ManagedPermutation";
import { faPlus, faFillDrip } from "@fortawesome/free-solid-svg-icons";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";

interface IBlockTypePermutationEditorProps extends IFileProps {
  isVisualsMode: boolean;
  heightOffset: number;
  readOnly: boolean;
  blockTypeItem: BlockTypeDefinition;
  item: ProjectItem;
  project: Project;
  creatorTools: CreatorTools;
  theme: IProjectTheme;
}

interface IBlockTypePermutationEditorState {
  fileToEdit: IFile;
  selectedItem: IManagedComponentSetItem;
  isLoaded: boolean;
}

export default class BlockTypePermutationEditor extends Component<
  IBlockTypePermutationEditorProps,
  IBlockTypePermutationEditorState
> {
  private _lastFileEdited?: IFile;

  constructor(props: IBlockTypePermutationEditorProps) {
    super(props);

    this._handleBlockTypeLoaded = this._handleBlockTypeLoaded.bind(this);
    this._fillPermutations = this._fillPermutations.bind(this);
    this._addPermutation = this._addPermutation.bind(this);
    this._handleItemSelected = this._handleItemSelected.bind(this);

    this.state = {
      fileToEdit: props.file,
      selectedItem: this.props.blockTypeItem,
      isLoaded: false,
    };

    this._updateManager(false);
  }

  componentDidUpdate(prevProps: IBlockTypePermutationEditorProps, prevState: IBlockTypePermutationEditorState) {
    this._updateManager(true);
  }

  async _updateManager(setState: boolean) {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        await BlockTypeDefinition.ensureOnFile(this.state.fileToEdit, this._handleBlockTypeLoaded, true);
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
        selectedItem: this.state.selectedItem,
        isLoaded: true,
      };
    }
  }

  async persist(): Promise<boolean> {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager) {
        const bt = file.manager as BlockTypeDefinition;

        return bt.persist();
      }
    }

    return false;
  }

  getPermutationListings() {
    if (!this.state || !this.state.fileToEdit) {
      return [];
    }

    const itemListings = [];

    itemListings.push({
      key: "baseBlockType",
      header: "(base)",
      headerMedia: " ",
      content: " ",
    });

    const perms = this.props.blockTypeItem.getPermutations();

    for (const perm of perms) {
      itemListings.push({
        key: "perm." + perm.condition,
        header: perm.condition,
        headerMedia: " ",
        content: " ",
      });
    }

    return itemListings;
  }

  _handleItemSelected(key: string) {
    if (this.state == null) {
      return;
    }

    if (key) {
      if (key === "baseBlockType") {
        this.setState({
          fileToEdit: this.state.fileToEdit,
          isLoaded: this.state.isLoaded,
          selectedItem: this.props.blockTypeItem,
        });
      } else if (key.startsWith("perm.")) {
        const perm = this.props.blockTypeItem.getPermutationByCondition(key.substring(5));

        if (perm) {
          this.setState({
            fileToEdit: this.state.fileToEdit,
            isLoaded: this.state.isLoaded,
            selectedItem: new ManagedPermutation(perm),
          });
        }
      }
    }
  }

  _addPermutation() {
    const bt = this.props.blockTypeItem;

    bt.addNextPermutation();

    this.forceUpdate();
  }

  _fillPermutations() {
    const bt = this.props.blockTypeItem;

    const uniquePermutations = bt.getMissingPermutations();

    for (const cond of uniquePermutations) {
      bt.addPermutation(cond);
    }

    this.forceUpdate();
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";
    const componentListHeight = "calc(100vh - " + String(this.props.heightOffset + 40) + "px)";

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

      return <div className="btpe-loading">Loading...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    const colors = getThemeColors();
    const states = this.props.blockTypeItem.getStateList();
    const dirTrait = this.props.blockTypeItem.getPlacementDirectionTrait();
    const posTrait = this.props.blockTypeItem.getPlacementPositionTrait();

    const canHaveSets = dirTrait || posTrait || (states && states.length > 0);

    let componentInterior = <></>;
    const items = this.getPermutationListings();
    const selectedKey =
      this.state.selectedItem instanceof ManagedPermutation
        ? `perm.${(this.state.selectedItem as ManagedPermutation).condition}`
        : "baseBlockType";

    componentInterior = (
      <div>
        <BlockTypeComponentSetEditor
          isVisualsMode={false}
          componentSet={bt}
          readOnly={this.props.readOnly}
          creatorTools={this.props.creatorTools}
          permutation={
            this.state.selectedItem instanceof ManagedPermutation
              ? (this.state.selectedItem as ManagedPermutation)
              : undefined
          }
          project={this.props.project}
          theme={this.props.theme}
          isDefault={true}
          heightOffset={this.props.heightOffset}
        />
      </div>
    );

    let itemInterior = <></>;

    if (canHaveSets) {
      itemInterior = (
        <div
          className="btpe-componentEditorInterior"
          style={{
            backgroundColor: colors.sectionHeaderBackground,
            color: colors.sectionHeaderForeground,
          }}
        >
          <div className="btpe-componentListHeader">
            <div className="btpe-setsLabel">Sets:</div>
            <div
              className="btpe-toolBarArea"
              style={{
                backgroundColor: colors.contentBackground,
                color: colors.contentForeground,
              }}
            >
              <Stack direction="row" spacing={1} aria-label="Block type permutations actions">
                <Button
                  onClick={this._addPermutation}
                  disabled={this.props.readOnly}
                  title="Edit documentation by types"
                >
                  <CustomLabel
                    icon={<FontAwesomeIcon icon={faPlus} className="fa-lg" />}
                    text={"Add"}
                    isCompact={isButtonCompact}
                  />
                </Button>
                {canHaveSets && !bt.hasCustomPermutationConditions() && (
                  <Button onClick={this._fillPermutations} title="Edit documentation by types">
                    <CustomLabel
                      icon={<FontAwesomeIcon icon={faFillDrip} className="fa-lg" />}
                      text={"Fill remaining..."}
                      isCompact={isButtonCompact}
                    />
                  </Button>
                )}
              </Stack>
            </div>
          </div>
          <div className="btpe-componentList">
            <div
              className="btpe-listInterior"
              style={{ minHeight: componentListHeight, maxHeight: componentListHeight }}
            >
              <List aria-label="List of components">
                {items.map((item: any) => (
                  <ListItemButton
                    key={item.key}
                    selected={item.key === selectedKey}
                    onClick={() => this._handleItemSelected(item.key)}
                  >
                    <ListItemText primary={item.header} />
                  </ListItemButton>
                ))}
              </List>
            </div>
          </div>
          <div
            className="btpe-itemBin"
            style={{
              borderColor: colors.sectionBorder,
            }}
          >
            {componentInterior}
          </div>
        </div>
      );
    } else {
      itemInterior = componentInterior;
    }

    return (
      <div
        className="btpe-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        {itemInterior}
      </div>
    );
  }
}
