import React, { Component } from "react";
import IFileProps from "../../UX/project/fileExplorer/IFileProps";
import IFile from "../../storage/IFile";
import "./StructureEditor.css";
import VolumeEditor, { VolumeEditorViewMode } from "./VolumeEditor";
import BlockVolume from "../../minecraft/BlockVolume";
import Database from "../../minecraft/Database";
import Structure from "../../minecraft/Structure";
import BlockType from "../../minecraft/BlockType";
import IBlockVolumeBounds from "../../minecraft/IBlockVolumeBounds";
import Block from "../../minecraft/Block";
import CreatorTools from "../../app/CreatorTools";
import BlockLocation from "../../minecraft/BlockLocation";
import Converter from "../../minecraft/Converter";
import ICommand from "../../UX/types/ICommand";
import IBlockSetPropertyCommand from "../../UX/types/IBlockSetPropertyCommand";
import IBlocksSetTypeCommand from "../../UX/types/IBlocksSetTypeCommand";
import { FormControl, IconButton, MenuItem, Select, SelectChangeEvent, Stack, ToggleButton } from "@mui/material";
import Commands from "../../UX/utils/Commands";
import Log from "../../core/Log";
import Utilities from "../../core/Utilities";
import { ExcludeEdgesLabel, VideoLabel, PushToMinecraftLabel } from "../../UX/shared/components/feedback/labels/Labels";
import AppServiceProxy from "../../core/AppServiceProxy";
import CommandRunner from "../../app/CommandRunner";
import Entity from "../../minecraft/Entity";
import WebUtilities from "../../UX/utils/WebUtilities";
import Project from "../../app/Project";
import IProjectTheme from "../../UX/types/IProjectTheme";

interface IStructureEditorProps extends IFileProps {
  creatorTools: CreatorTools;
  heightOffset: number;
  theme: IProjectTheme;
  readOnly: boolean;
  project: Project;
}

interface IStructureEditorState {
  structure: Structure | undefined;
  blockCube: BlockVolume | undefined;
  excludeEdges: boolean;
  activeSearchBlockType: BlockType | undefined;
  selectedBlocks: Block[] | undefined;
  selectedEntity: Entity | undefined;
  autocompleteSuggestions: string[];
  searchTerm: string;
}

export default class StructureEditor extends Component<IStructureEditorProps, IStructureEditorState> {
  _lastFile: IFile | undefined;
  _searchBlockCube: BlockVolume;
  _mainWorld: VolumeEditor | undefined;
  _id?: string;
  _toolbarPortalEl: HTMLDivElement | null = null;

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
    this._handleResizeRequested = this._handleResizeRequested.bind(this);

    this._id = "I:" + StructureEditor.count;
    StructureEditor.count++;

    this._searchBlockCube = new BlockVolume();

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
              } catch (e) {
                Log.debug("Structure sync validation error: " + e);
              }
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

  _handleSearchTextChanged(e: React.ChangeEvent<HTMLInputElement>) {
    this._handleSearchText(e.target.value);
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
          newSuggestions.push(suggestions[i].shortId);
        }
      }
    }

    if (blockType !== undefined) {
      this._searchBlockCube.x(0).y(0).z(0).typeName = blockType.id;

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

  async persist(): Promise<boolean> {
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
          return file.setContent(bytes);
        }
      }
    }

    return false;
  }

  async _handleResizeRequested(newX: number, newY: number, newZ: number) {
    if (!this.state?.blockCube) return;

    this.state.blockCube.resize(newX, newY, newZ);

    // Force re-render with the resized volume
    this.setState({ blockCube: this.state.blockCube });

    // Persist the resized structure data to the file immediately
    await this.persist();
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
            newTypeId: this.state.activeSearchBlockType.id,
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

  async _pushToMinecraft() {
    if (this.state === null || this.state.blockCube === null || this.state.blockCube === undefined) {
      return;
    }

    const commands = this.state.blockCube.getCommandList(1, 1, 1);

    const carto = this.props.creatorTools;

    const operId = await carto.notifyOperationStarted("Pushing this structure to Minecraft");

    CommandRunner.runCommandList(this.props.creatorTools, commands);

    await carto.notifyOperationEnded(operId, "Done pushing this structure to Minecraft");
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

  _handleEntitySelect(event: SelectChangeEvent<string>) {
    if (this.state === null || this.state.structure === undefined || this.state.structure.entities === undefined) {
      return;
    }

    const result = event.target.value;

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
    let interior = <div className="ste-loading-area">Loading {this.props.file.storageRelativePath}...</div>;
    let canvasHeight = this.props.heightOffset + 50; // Toolbar height only
    let isButtonCompact = false;
    const width = WebUtilities.getWidth();

    if (width < 1160) {
      isButtonCompact = true;
    }

    if (this.props.readOnly) {
      canvasHeight -= 10;
    }

    const height = "calc(100vh - " + this.props.heightOffset + "px)";

    this._updateFile();

    const entityTools: any[] = [];

    if (
      this.state !== null &&
      this.state.structure !== undefined &&
      this.state.structure.entities !== undefined &&
      this.state.structure.entities.length > 0
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
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              value={defaultValue}
              displayEmpty
              onChange={this._handleEntitySelect}
              renderValue={(value) => (value ? value : entitySummary)}
            >
              {entityTitles.map((item: string) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
      let viewBounds: IBlockVolumeBounds | undefined;
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
          onResizeRequested={this._handleResizeRequested}
          blockVolume={cube}
          heightOffset={canvasHeight}
          viewBounds={viewBounds}
          viewMode={VolumeEditorViewMode.Structure}
          ref={(c: VolumeEditor) => this._setMainWorld(c)}
          toolbarPortalTarget={this._toolbarPortalEl}
        />
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
              <Stack direction="row" spacing={1} aria-label="Structure editor toolbar">
                <IconButton onClick={this._resetViewClick} title="Reset Camera" size="small">
                  <VideoLabel />
                </IconButton>
                {!this.props.readOnly && (
                  <ToggleButton
                    value="excludeEdges"
                    selected={this.state?.excludeEdges ?? false}
                    onChange={this._excludeEdgesToggle}
                    title="Exclude Edges"
                    size="small"
                  >
                    <ExcludeEdgesLabel isCompact={isButtonCompact} />
                  </ToggleButton>
                )}
                {AppServiceProxy.hasAppServiceOrDebug && (
                  <IconButton onClick={this._pushToMinecraft} title="Push to Minecraft" size="small">
                    <PushToMinecraftLabel isCompact={isButtonCompact} />
                  </IconButton>
                )}
              </Stack>
              <div
                ref={(el) => {
                  if (el && el !== this._toolbarPortalEl) {
                    this._toolbarPortalEl = el;
                    this.forceUpdate();
                  }
                }}
                className="ste-ve-toolbar-portal"
              />
            </div>
            {entityTools}
          </div>
        </div>
        <div className="ste-threedarea-lg">{interior}</div>
      </div>
    );
  }
}
