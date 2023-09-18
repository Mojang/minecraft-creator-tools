import React, { Component, SyntheticEvent } from "react";
import IFileProps from "./IFileProps";
import IFile from "./../storage/IFile";
import "./StructureEditor.css";
import VolumeEditor, { VolumeEditorViewMode } from "../worldux/VolumeEditor";
import BlockCube from "../minecraft/BlockCube";
import Database from "../minecraft/Database";
import Structure from "../minecraft/Structure";
import BlockType from "../minecraft/BlockType";
import IBlockCubeBounds from "../minecraft/IBlockCubeBounds";
import Block from "../minecraft/Block";
import Carto from "../app/Carto";
import BlockEditor from "./BlockEditor";
import BlockLocation from "../minecraft/BlockLocation";
import EntityPropertyEditor from "./EntityPropertyEditor";
import Converter from "./../minecraft/Converter";
import ICommand, { ICommander } from "./ICommand";
import IBlockSetPropertyCommand from "./IBlockSetPropertyCommand";
import IBlocksSetTypeCommand from "./IBlocksSetTypeCommand";
import { Toolbar, Input, Dropdown, InputProps, DropdownProps } from "@fluentui/react-northstar";
import { SearchIcon } from "@fluentui/react-icons-northstar";
import IPersistable from "./IPersistable";
import Commands from "./Commands";
import Log from "../core/Log";
import Utilities from "../core/Utilities";
import { ExcludeEdgesLabel, VideoLabel, PushToMinecraftLabel } from "./Labels";
import BlockTypeTile from "./BlockTypeTile";
import AppServiceProxy from "../core/AppServiceProxy";
import CommandManager from "../app/CommandManager";
import Entity from "../minecraft/Entity";
import WebUtilities from "./WebUtilities";
import Project from "../app/Project";

interface IStructureEditorProps extends IFileProps {
  carto: Carto;
  heightOffset: number;
  readOnly: boolean;
  project: Project;
}

interface IStructureEditorState {
  structure: Structure | undefined;
  blockCube: BlockCube | undefined;
  excludeEdges: boolean;
  activeSearchBlockType: BlockType | undefined;
  selectedBlocks: Block[] | undefined;
  selectedEntity: Entity | undefined;
  autocompleteSuggestions: string[];
  searchTerm: string;
}

export default class StructureEditor
  extends Component<IStructureEditorProps, IStructureEditorState>
  implements ICommander, IPersistable
{
  _lastFile: IFile | undefined;
  _searchBlockCube: BlockCube;
  _mainWorld: VolumeEditor | undefined;
  _id?: string;

  static count = 0;

  constructor(props: IStructureEditorProps) {
    super(props);

    this._handleContentUpdated = this._handleContentUpdated.bind(this);
    this._updateFile = this._updateFile.bind(this);
    this._setMainWorld = this._setMainWorld.bind(this);
    this._resetViewClick = this._resetViewClick.bind(this);
    this._handleSearchTextChanged = this._handleSearchTextChanged.bind(this);
    this._handleSelectedBlocksChanged = this._handleSelectedBlocksChanged.bind(this);
    this._handleSearchBlockClicked = this._handleSearchBlockClicked.bind(this);
    this._excludeEdgesToggle = this._excludeEdgesToggle.bind(this);
    this._handleSuggestionClick = this._handleSuggestionClick.bind(this);
    this._pushToMinecraft = this._pushToMinecraft.bind(this);
    this._handleEntitySelect = this._handleEntitySelect.bind(this);
    this._handleAddEntityClick = this._handleAddEntityClick.bind(this);

    this._id = "I:" + StructureEditor.count;
    StructureEditor.count++;

    this._searchBlockCube = new BlockCube();

    this._searchBlockCube.setMaxDimensions(1, 1, 1);
  }

  componentDidUpdate(prevProps: IStructureEditorProps, prevState: IStructureEditorState) {
    this._updateFile();
  }

  async _updateFile() {
    if (this._lastFile !== this.props.file) {
      this._lastFile = this.props.file;

      let newExcludeEdges = false;

      if (this.state !== null) {
        newExcludeEdges = this.state.excludeEdges;
      }

      if (this.props.file !== undefined && this.props.file.isContentLoaded) {
        const file = this.props.file;

        if (this.props.setActivePersistable !== undefined) {
          this.props.setActivePersistable(this);
        }

        if (file.content !== undefined) {
          if (file.type === "snbt" && typeof file.content === "string") {
            const mcs = new Structure();

            mcs.loadFromSnbtText(file.content);

            if (mcs.cube !== undefined) {
              Converter.cubeEnsureBedrockProperties(mcs.cube);
            }

            this.setState({
              structure: mcs,
              blockCube: mcs.cube,
              excludeEdges: newExcludeEdges,
            });
          } else if (file.type === "mcstructure" && file.content instanceof Uint8Array) {
            const mcs = new Structure();

            await mcs.loadFromNbtBytes(file.content);

            // temporary test code - verify that we can 'roundtrip' a structure with 100% fidelity
            // entities are not implemented yet, so this will be known to fail on things.
            if (Utilities.isDebug) {
              try {
                const newMcs = new Structure();

                newMcs.shallowCopyFrom(mcs);

                const nbt = newMcs.createNbt();

                if (nbt !== undefined) {
                  let structsNotInSync = false;

                  try {
                    if (mcs.nbt !== undefined && nbt.getJsonString() !== mcs.nbt.getJsonString()) {
                      structsNotInSync = true;
                    }
                  } catch (e) {
                    // JSON stringify and parse functions in don't support BigInt, so will throw  when trying to
                    // serialize them.  catch and swallow that.
                  }

                  if (structsNotInSync) {
                    throw new Error("NBT structures are not in sync");
                  }

                  const bytes = nbt.toBinary();

                  if (bytes !== undefined) {
                    Utilities.throwIfUint8ArraysNotEqual(file.content, bytes);
                  }
                }
              } catch (e) {}
            }
            // end temporary test code.

            this.setState({
              structure: mcs,
              blockCube: mcs.cube,
              excludeEdges: newExcludeEdges,
            });
          }
        }
      }
    }
  }

  _handleSearchTextChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined) {
      return;
    }

    this._handleSearchText(data.value);
  }

  _handleSearchText(newValue: string) {
    let blockType = undefined;

    const newSuggestions: string[] = [];

    if (newValue.length > 3) {
      const suggestions = Database.getMatchingBlocks(newValue);

      if (suggestions.length > 0) {
        blockType = suggestions[0];
      }

      for (let i = 0; i < suggestions.length && newSuggestions.length < 3; i++) {
        if (suggestions[i].title.toLowerCase() !== newValue.toLowerCase()) {
          newSuggestions.push(suggestions[i].shortTypeName);
        }
      }
    }

    if (blockType !== undefined) {
      this._searchBlockCube.x(0).y(0).z(0).typeName = blockType.name;

      this.setState({
        structure: this.state.structure,
        blockCube: this.state.blockCube,
        activeSearchBlockType: blockType,
        selectedEntity: this.state.selectedEntity,
        searchTerm: newValue,
        excludeEdges: this.state.excludeEdges,
        autocompleteSuggestions: newSuggestions,
      });
    } else if (this.state !== undefined && this.state.activeSearchBlockType !== undefined) {
      this.setState({
        structure: this.state.structure,
        blockCube: this.state.blockCube,
        activeSearchBlockType: undefined,
        selectedEntity: this.state.selectedEntity,
        searchTerm: newValue,
        excludeEdges: this.state.excludeEdges,
        selectedBlocks: this.state.selectedBlocks,
        autocompleteSuggestions: newSuggestions,
      });
    } else if (this.state !== undefined && this.state.autocompleteSuggestions !== newSuggestions) {
      this.setState({
        structure: this.state.structure,
        blockCube: this.state.blockCube,
        activeSearchBlockType: this.state.activeSearchBlockType,
        selectedEntity: this.state.selectedEntity,
        excludeEdges: this.state.excludeEdges,
        searchTerm: newValue,
        selectedBlocks: this.state.selectedBlocks,
        autocompleteSuggestions: newSuggestions,
      });
    }
  }

  async persist() {
    if (
      this.props.file !== undefined &&
      this.props.file.isContentLoaded &&
      this.state !== null &&
      this.state.blockCube !== undefined
    ) {
      const file = this.props.file;

      if (file.type === "mcstructure") {
        let structure = new Structure();

        if (this.state.structure !== undefined) {
          structure = this.state.structure;
        }

        structure.cube = this.state.blockCube;

        const bytes = structure.getMCStructureBytes();

        if (bytes !== undefined) {
          file.setContent(bytes);
        }
      }
    }
  }

  runCommand(command: ICommand, trackCommand: boolean) {
    Log.message("Command run: " + command.command);

    switch (command.command) {
      case Commands.setBlockProperty:
        if (this.state.blockCube !== undefined) {
          const setBlock = command as IBlockSetPropertyCommand;

          const block = this.state.blockCube.x(setBlock.x).y(setBlock.y).z(setBlock.z);

          block.getProperty(setBlock.propertyName).value = setBlock.propertyValue;
        }
        break;

      case Commands.setBlocksTypeProperty:
        if (this.state.blockCube !== undefined) {
          const setBlocksType = command as IBlocksSetTypeCommand;

          for (let i = 0; i < setBlocksType.updatedBlocks.length; i++) {
            const update = setBlocksType.updatedBlocks[i];

            const block = this.state.blockCube.x(update.location.x).y(update.location.y).z(update.location.z);

            block.typeName = update.newTypeId;
          }
        }
        break;
    }
  }

  _handleContentUpdated(newValue: string) {
    this.props.file.setContent(newValue);
  }

  _handleAddEntityClick() {}

  _handleSearchBlockClicked() {
    if (this.state === null) {
      return;
    }

    if (this.state.activeSearchBlockType !== undefined && this.state.selectedBlocks !== undefined) {
      const updatedBlocks: { newTypeId: string; location: BlockLocation }[] = [];
      const existingBlocks: { newTypeId: string; location: BlockLocation }[] = [];

      for (let i = 0; i < this.state.selectedBlocks.length; i++) {
        const block = this.state.selectedBlocks[i];

        if (block.x === undefined || block.y === undefined || block.z === undefined || block.typeName === undefined) {
          Log.fail("Unexpected untyped block in attempting to set blocks");
        } else {
          const location = new BlockLocation(block.x, block.y, block.z);

          existingBlocks.push({
            newTypeId: block.typeName,
            location: location,
          });

          updatedBlocks.push({
            newTypeId: this.state.activeSearchBlockType.name,
            location: location,
          });
        }
      }

      if (updatedBlocks.length === 0) {
        Log.fail("No blocks to update in apply command.");
        return;
      }

      const undoCommand = {
        command: Commands.setBlocksTypeProperty,
        updatedBlocks: existingBlocks,
      };

      const doCommand = {
        command: Commands.setBlocksTypeProperty,
        updatedBlocks: updatedBlocks,
        undoCommand: undoCommand,
      };

      this.runCommand(doCommand, true);
    }
  }

  _resetViewClick() {
    if (this._mainWorld !== undefined) {
      this._mainWorld.resetCamera();
    }
  }

  _excludeEdgesToggle() {
    if (this.state !== null) {
      this.setState({
        structure: this.state.structure,
        blockCube: this.state.blockCube,
        activeSearchBlockType: this.state.activeSearchBlockType,
        selectedEntity: this.state.selectedEntity,
        excludeEdges: !this.state.excludeEdges,
        selectedBlocks: this.state.selectedBlocks,
      });
    }
  }

  _pushToMinecraft() {
    if (this.state === null || this.state.blockCube === null || this.state.blockCube === undefined) {
      return;
    }

    const commands = this.state.blockCube.getCommandList(1, 1, 1);

    const carto = this.props.carto;

    const operId = carto.notifyOperationStarted("Pushing this structure to Minecraft");

    CommandManager.runCommandList(this.props.carto, commands);

    carto.notifyOperationEnded(operId, "Done pushing this structure to Minecraft");
  }

  _setMainWorld(worldEditor: VolumeEditor) {
    this._mainWorld = worldEditor;

    if (this._mainWorld !== undefined && this._mainWorld !== null) {
      this._mainWorld.resize();
    }
  }

  _handleSuggestionClick(blockTypeId: string) {
    const blockType = Database.getBlockType(blockTypeId);

    if (blockType !== null) {
      this._handleSearchText(blockType.title);
    }
  }

  _handleSelectedBlocksChanged(newSelectedBlocks: Block[] | undefined) {
    this.setState({
      structure: this.state.structure,
      blockCube: this.state.blockCube,
      activeSearchBlockType: this.state.activeSearchBlockType,
      excludeEdges: this.state.excludeEdges,
      selectedEntity: undefined,
      selectedBlocks: newSelectedBlocks,
      autocompleteSuggestions: this.state.autocompleteSuggestions,
    });
  }

  _generateTitleForEntity(entity: Entity, index: number) {
    const title = Utilities.humanifyMinecraftName(entity.typeId);

    return title + " " + index;
  }

  _handleEntitySelect(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    if (
      this.state === null ||
      this.state.structure === undefined ||
      this.state.structure.entities === undefined ||
      data.value === null ||
      data.value === undefined
    ) {
      return;
    }

    const result = data.value;

    if (result !== undefined) {
      const entitiesList = this.state.structure.entities;

      for (let i = 0; i < entitiesList.length; i++) {
        const entity = entitiesList[i];
        const entityTitle = this._generateTitleForEntity(entity, i);

        if (entityTitle === result) {
          this.setState({
            blockCube: this.state.blockCube,
            activeSearchBlockType: undefined,
            excludeEdges: this.state.excludeEdges,
            selectedEntity: entitiesList[i],
            selectedBlocks: undefined,
            structure: this.state.structure,
            autocompleteSuggestions: this.state.autocompleteSuggestions,
          });
        }
      }
    }
  }

  render() {
    let interior = <>Loading {this.props.file.fullPath}...</>;
    let selectionDetails = <></>;
    const autocompleteElements = [];
    let visibleAreaCss = "ste-threedarea-lg";
    let activeSearchTile = <></>;
    let canvasHeight = this.props.heightOffset + 170;
    let isButtonCompact = false;
    const width = WebUtilities.getWidth();

    if (width < 1160) {
      isButtonCompact = true;
    }

    if (this.props.readOnly) {
      canvasHeight -= 128;
    }

    const height = "calc(100vh - " + this.props.heightOffset + "px)";
    const threedHeight = "calc(100vh - " + (this.props.heightOffset + 180) + "px)";

    this._updateFile();

    const toolbarItems: any[] = [
      {
        icon: <VideoLabel />,
        key: "camera",
        active: true,
        onClick: this._resetViewClick,
        title: "Reset Camera",
      },
    ];

    if (!this.props.readOnly) {
      toolbarItems.push({
        icon: <ExcludeEdgesLabel isCompact={isButtonCompact} />,
        key: "excludeEdges",
        active: true,
        kind: "toggle",
        onClick: this._excludeEdgesToggle,
        title: "Exclude Edges",
      });
    }

    if (AppServiceProxy.hasAppServiceOrDebug) {
      toolbarItems.push({
        icon: <PushToMinecraftLabel isCompact={isButtonCompact} />,
        key: "pushToMinecraft",
        active: true,
        onClick: this._pushToMinecraft,
        title: "Push to Minecraft",
      });
    }

    const entityTools: any[] = [];

    if (
      this.state !== null &&
      this.state.structure !== undefined &&
      this.state.structure.entities !== undefined &&
      (!this.props.readOnly || this.state.structure.entities?.length > 0)
    ) {
      const entityTitles: any[] = [];
      let defaultValue = "";

      for (let i = 0; i < this.state.structure.entities.length; i++) {
        const entity = this.state.structure.entities[i];
        const entityTitle = this._generateTitleForEntity(entity, i);

        if (entity === this.state.selectedEntity) {
          defaultValue = entityTitle;
        }

        entityTitles.push(entityTitle);
      }

      const entitySummary = "(" + this.state.structure.entities.length + " entities)";

      entityTools.push(
        <div className="ste-entityselector-area" key="entityselector">
          <Dropdown
            items={entityTitles}
            defaultValue={defaultValue}
            placeholder={entitySummary}
            onChange={this._handleEntitySelect}
          />
        </div>
      );
    }

    /*
    entityTools.push(
      <div className="ste-entityadder-area">
        <Button onClick={this._handleAddEntityClick} content="Add entity" />
      </div>
    );*/

    if (this.state !== null && this.state.blockCube !== undefined) {
      let viewBounds: IBlockCubeBounds | undefined = undefined;
      const cube = this.state.blockCube;

      if (this.state.excludeEdges && cube.maxX > 2 && cube.maxY > 2 && cube.maxZ > 2) {
        viewBounds = {
          fromX: 1,
          fromY: 0,
          fromZ: 1,
          toX: cube.maxX - 1,
          toY: cube.maxY - 1,
          toZ: cube.maxZ - 1,
        };
      }

      interior = (
        <VolumeEditor
          onApplyRequested={this._handleSearchBlockClicked}
          onSelectedBlocksChanged={this._handleSelectedBlocksChanged}
          blockCube={cube}
          heightOffset={canvasHeight}
          viewBounds={viewBounds}
          viewMode={VolumeEditorViewMode.Structure}
          ref={(c: VolumeEditor) => this._setMainWorld(c)}
        />
      );
    }

    if (this.state !== null && this.state.activeSearchBlockType !== undefined) {
      activeSearchTile = (
        <BlockTypeTile
          isSelected={false}
          carto={this.props.carto}
          blockTypeId={this.state.activeSearchBlockType.name}
        />
      );
    }

    if (this.state !== null && this.state.selectedEntity !== undefined) {
      visibleAreaCss = "ste-threedarea";
      selectionDetails = (
        <div
          className="ste-selectionarea"
          style={{
            minHeight: threedHeight,
            maxHeight: threedHeight,
          }}
        >
          <EntityPropertyEditor carto={this.props.carto} commander={this} entity={this.state.selectedEntity} />
        </div>
      );
    } else if (this.state !== null && this.state.selectedBlocks !== undefined) {
      visibleAreaCss = "ste-threedarea";
      selectionDetails = (
        <div
          className="ste-selectionarea"
          style={{
            minHeight: threedHeight,
            maxHeight: threedHeight,
          }}
        >
          <BlockEditor carto={this.props.carto} commander={this} blocks={this.state.selectedBlocks} />
        </div>
      );
    }

    if (
      this.state !== null &&
      this.state.autocompleteSuggestions !== null &&
      this.state.autocompleteSuggestions !== undefined
    ) {
      for (let i = 0; i < this.state.autocompleteSuggestions.length; i++) {
        const sugg = this.state.autocompleteSuggestions[i];

        autocompleteElements.push(
          <BlockTypeTile
            isSelected={false}
            key={sugg}
            blockTypeId={sugg}
            onClick={this._handleSuggestionClick}
            carto={this.props.carto}
          />
        );
      }
    }

    let blockAdder = <></>;

    if (!this.props.readOnly) {
      blockAdder = (
        <div className="ste-editorbin">
          <div className="ste-editorgrid">
            <div className="ste-editorsearchinput">
              <Input
                icon={<SearchIcon />}
                clearable
                placeholder="Search..."
                value={this.state ? this.state.searchTerm : ""}
                onChange={this._handleSearchTextChanged}
              />
              <div>{autocompleteElements}</div>
            </div>
            <div className="ste-searchview">
              <div className="ste-searchviewcontainer">
                <VolumeEditor
                  blockCube={this._searchBlockCube}
                  height={64}
                  onClicked={this._handleSearchBlockClicked}
                  viewMode={VolumeEditorViewMode.SingleBlock}
                />
              </div>
              <div>{activeSearchTile}</div>
            </div>
          </div>
        </div>
      );
    }

    if (this._mainWorld !== undefined) {
      this._mainWorld.resize();
    }

    return (
      <div
        className="ste-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="ste-toolbar">
          <div className="ste-toolbar-area">
            <div className="ste-toolbar-inner">
              <Toolbar
                aria-label="Editor toolbar overflow menu"
                items={toolbarItems}
                overflow
                overflowItem={{
                  title: "More",
                }}
              />
            </div>
            {entityTools}
          </div>
        </div>
        <div className={visibleAreaCss}>{interior}</div>
        {selectionDetails}
        {blockAdder}
      </div>
    );
  }
}
