// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ==========================================================================================
 * VOXEL SHAPE EDITOR
 * ==========================================================================================
 *
 * OVERVIEW:
 * ---------
 * VoxelShapeEditor provides a visual editor for Minecraft voxel shape files.
 * It displays the shape boxes in a list and provides a 3D preview using ModelViewer.
 *
 * KEY FEATURES:
 * - List view of all boxes in the voxel shape
 * - Add/remove/edit boxes
 * - 3D preview of the shape using ModelViewer
 * - Coordinates shown in voxel units (0-16 = 1 block)
 *
 * COORDINATE SYSTEM:
 * - Voxel shape coordinates: 0-16 per block dimension
 * - Values can extend beyond 0-16 (min: -30, max: 30)
 * - Origin (0,0,0) is bottom-southwest corner
 *
 * ==========================================================================================
 */

import { Component, Suspense, lazy } from "react";
import Log from "../../../core/Log";
import IFileProps from "../../project/fileExplorer/IFileProps";
import IFile from "../../../storage/IFile";
import "./VoxelShapeEditor.css";
import VoxelShapeDefinition from "../../../minecraft/VoxelShapeDefinition";
import ProjectItem from "../../../app/ProjectItem";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { Button, TextField, List, ListItemButton, ListItemText } from "@mui/material";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import CreatorTools from "../../../app/CreatorTools";
import Project from "../../../app/Project";
import { IVoxelShapeBox } from "../../../minecraft/IVoxelShapeFile";
import IProjectTheme from "../../types/IProjectTheme";

// Lazy load ModelViewer for 3D preview
const ModelViewer = lazy(() => import("../../world/ModelViewer"));

interface IVoxelShapeEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  item: ProjectItem;
  project: Project;
  creatorTools: CreatorTools;
  theme: IProjectTheme;
}

interface IVoxelShapeEditorState {
  fileToEdit: IFile;
  isLoaded: boolean;
  selectedBoxIndex: number;
  geometryJson?: object;
  textureData?: Uint8Array;
}

export default class VoxelShapeEditor extends Component<IVoxelShapeEditorProps, IVoxelShapeEditorState> {
  private _lastFileEdited?: IFile;

  constructor(props: IVoxelShapeEditorProps) {
    super(props);

    this._handleDefinitionLoaded = this._handleDefinitionLoaded.bind(this);
    this._handleAddBox = this._handleAddBox.bind(this);
    this._handleRemoveBox = this._handleRemoveBox.bind(this);
    this._handleBoxSelected = this._handleBoxSelected.bind(this);

    this.state = {
      fileToEdit: props.file,
      isLoaded: false,
      selectedBoxIndex: -1,
    };
  }

  static getDerivedStateFromProps(props: IVoxelShapeEditorProps, state: IVoxelShapeEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        isLoaded: false,
        selectedBoxIndex: -1,
      };

      return state;
    }

    if (props.file !== state.fileToEdit) {
      state.fileToEdit = props.file;
      state.isLoaded = false;
      state.selectedBoxIndex = -1;

      return state;
    }

    return null;
  }

  componentDidMount(): void {
    this._updateManager(true);
  }

  componentDidUpdate(prevProps: IVoxelShapeEditorProps, prevState: IVoxelShapeEditorState): void {
    if (prevProps.file !== this.props.file) {
      this._updateManager(true);
    }
  }

  async _updateManager(setState: boolean) {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;
        await this._doUpdate(setState);
      }
    }
  }

  _handleDefinitionLoaded(def: VoxelShapeDefinition, _: VoxelShapeDefinition) {
    this.setState({
      ...this.state,
      isLoaded: true,
    });
  }

  async _doUpdate(setState: boolean) {
    const definition = await VoxelShapeDefinition.ensureOnFile(this.state.fileToEdit);

    if (definition) {
      if (!definition.isLoaded) {
        definition.onLoaded.subscribe(this._handleDefinitionLoaded);
      } else {
        if (setState) {
          this.setState({
            ...this.state,
            isLoaded: true,
          });
        }
      }
    }
  }

  async persist(): Promise<boolean> {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      const definition = this.state.fileToEdit.manager;

      if (definition !== undefined && definition instanceof VoxelShapeDefinition) {
        await definition.save();
        return true;
      }
    }

    return false;
  }

  /**
   * Generates the preview texture using Canvas API (browser-compatible).
   * Creates a 128x16 atlas with 8 colored, numbered slots.
   */
  async _generatePreviewTexture(definition: VoxelShapeDefinition) {
    try {
      const { pixels, width, height } = definition.generatePreviewTexturePixels();

      // Use Canvas to encode to PNG (browser-compatible)
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        const imageData = ctx.createImageData(width, height);
        imageData.data.set(pixels);
        ctx.putImageData(imageData, 0, 0);

        // Convert to PNG blob and then to Uint8Array
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, "image/png");
        });

        if (blob) {
          const arrayBuffer = await blob.arrayBuffer();
          const textureData = new Uint8Array(arrayBuffer);

          this.setState({
            ...this.state,
            textureData: textureData,
            geometryJson: definition.toGeometryJson(),
          });
          return;
        }
      }
    } catch (e) {
      Log.error("Failed to generate preview texture: " + e);
    }

    // Fallback: still show preview but texture generation failed
    this.setState({
      ...this.state,
      textureData: undefined,
    });
  }

  async _handleAddBox() {
    if (this.props.readOnly) return;

    const definition = this.state.fileToEdit.manager as VoxelShapeDefinition;
    if (definition) {
      definition.addBox([0, 0, 0], [16, 16, 16]);
      await definition.persist();

      const geometryJson = definition.toGeometryJson();
      this.setState({
        ...this.state,
        selectedBoxIndex: definition.boxes.length - 1,
        geometryJson: geometryJson,
      });
    }
  }

  async _handleRemoveBox() {
    if (this.props.readOnly || this.state.selectedBoxIndex < 0) return;

    const definition = this.state.fileToEdit.manager as VoxelShapeDefinition;
    if (definition) {
      definition.removeBox(this.state.selectedBoxIndex);
      await definition.persist();

      const geometryJson = definition.toGeometryJson();
      this.setState({
        ...this.state,
        selectedBoxIndex: -1,
        geometryJson: geometryJson,
      });
    }
  }

  _handleBoxSelected(index: number) {
    this.setState({
      ...this.state,
      selectedBoxIndex: index,
    });
  }

  async _handleBoxCoordChange(boxIndex: number, coord: "min" | "max", axis: number, value: string) {
    if (this.props.readOnly) return;

    const definition = this.state.fileToEdit.manager as VoxelShapeDefinition;
    if (!definition) return;

    const box = definition.boxes[boxIndex];
    if (!box) return;

    const numValue = parseFloat(value) || 0;
    const coords = coord === "min" ? box.min : box.max;

    if (Array.isArray(coords)) {
      coords[axis] = numValue;
    } else {
      const keys: ("x" | "y" | "z")[] = ["x", "y", "z"];
      (coords as { x: number; y: number; z: number })[keys[axis]] = numValue;
    }

    await definition.persist();

    const geometryJson = definition.toGeometryJson();
    this.setState({
      ...this.state,
      geometryJson: geometryJson,
    });
  }

  _formatBoxCoords(box: IVoxelShapeBox): string {
    const minArr = Array.isArray(box.min) ? box.min : [box.min.x, box.min.y, box.min.z];
    const maxArr = Array.isArray(box.max) ? box.max : [box.max.x, box.max.y, box.max.z];
    return `[${minArr.join(", ")}] → [${maxArr.join(", ")}]`;
  }

  _getBoxCoord(box: IVoxelShapeBox, coord: "min" | "max", axis: number): number {
    const coords = coord === "min" ? box.min : box.max;
    if (Array.isArray(coords)) {
      return coords[axis];
    }
    const keys: ("x" | "y" | "z")[] = ["x", "y", "z"];
    return (coords as { x: number; y: number; z: number })[keys[axis]];
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";
    const areaHeight = "calc(100vh - " + String(this.props.heightOffset + 60) + "px)";

    if (
      this.state === null ||
      !this.state.isLoaded ||
      this.state.fileToEdit === null ||
      this.state.fileToEdit.manager === undefined
    ) {
      return <div className="vse-loading">Loading...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    const definition = this.state.fileToEdit.manager as VoxelShapeDefinition;

    // Build the box list UI using MUI List components
    const leftPanel = (
      <div className="vse-leftPanel">
        <div className="vse-listToolbar">
          {!this.props.readOnly && (
            <>
              <Button
                startIcon={<FontAwesomeIcon icon={faPlus} />}
                onClick={this._handleAddBox}
                variant="contained"
                size="small"
              >
                Add Box
              </Button>
              <Button
                startIcon={<FontAwesomeIcon icon={faTrash} />}
                onClick={this._handleRemoveBox}
                disabled={this.state.selectedBoxIndex < 0}
                size="small"
              >
                Remove
              </Button>
            </>
          )}
        </div>
        <div className="vse-listContainer">
          <List>
            {definition.boxes.map((box, index) => (
              <ListItemButton
                key={`box-${index}`}
                selected={index === this.state.selectedBoxIndex}
                onClick={() => this._handleBoxSelected(index)}
              >
                <ListItemText primary={`Box ${index + 1}`} secondary={this._formatBoxCoords(box)} />
              </ListItemButton>
            ))}
          </List>
        </div>
        {this.state.selectedBoxIndex >= 0 && definition.boxes[this.state.selectedBoxIndex] && (
          <div className="vse-boxEditor">
            <h4>Edit Box {this.state.selectedBoxIndex + 1}</h4>
            <div className="vse-coordRow">
              <span className="vse-coordLabel">Min:</span>
              <TextField
                type="number"
                size="small"
                value={String(this._getBoxCoord(definition.boxes[this.state.selectedBoxIndex], "min", 0))}
                onChange={(e) =>
                  this._handleBoxCoordChange(this.state.selectedBoxIndex, "min", 0, e.target.value || "0")
                }
                disabled={this.props.readOnly}
                className="vse-coordInput"
                placeholder="X"
              />
              <TextField
                type="number"
                size="small"
                value={String(this._getBoxCoord(definition.boxes[this.state.selectedBoxIndex], "min", 1))}
                onChange={(e) =>
                  this._handleBoxCoordChange(this.state.selectedBoxIndex, "min", 1, e.target.value || "0")
                }
                disabled={this.props.readOnly}
                className="vse-coordInput"
                placeholder="Y"
              />
              <TextField
                type="number"
                size="small"
                value={String(this._getBoxCoord(definition.boxes[this.state.selectedBoxIndex], "min", 2))}
                onChange={(e) =>
                  this._handleBoxCoordChange(this.state.selectedBoxIndex, "min", 2, e.target.value || "0")
                }
                disabled={this.props.readOnly}
                className="vse-coordInput"
                placeholder="Z"
              />
            </div>
            <div className="vse-coordRow">
              <span className="vse-coordLabel">Max:</span>
              <TextField
                type="number"
                size="small"
                value={String(this._getBoxCoord(definition.boxes[this.state.selectedBoxIndex], "max", 0))}
                onChange={(e) =>
                  this._handleBoxCoordChange(this.state.selectedBoxIndex, "max", 0, e.target.value || "0")
                }
                disabled={this.props.readOnly}
                className="vse-coordInput"
                placeholder="X"
              />
              <TextField
                type="number"
                size="small"
                value={String(this._getBoxCoord(definition.boxes[this.state.selectedBoxIndex], "max", 1))}
                onChange={(e) =>
                  this._handleBoxCoordChange(this.state.selectedBoxIndex, "max", 1, e.target.value || "0")
                }
                disabled={this.props.readOnly}
                className="vse-coordInput"
                placeholder="Y"
              />
              <TextField
                type="number"
                size="small"
                value={String(this._getBoxCoord(definition.boxes[this.state.selectedBoxIndex], "max", 2))}
                onChange={(e) =>
                  this._handleBoxCoordChange(this.state.selectedBoxIndex, "max", 2, e.target.value || "0")
                }
                disabled={this.props.readOnly}
                className="vse-coordInput"
                placeholder="Z"
              />
            </div>
          </div>
        )}
      </div>
    );

    // Build the 3D preview - trigger texture generation if needed
    let previewContent: JSX.Element;
    if (definition.boxes.length > 0) {
      const geometryJson = definition.toGeometryJson();

      if (this.state.textureData) {
        previewContent = (
          <Suspense fallback={<div className="vse-previewLoading">Loading 3D viewer...</div>}>
            <ModelViewer
              creatorTools={this.props.creatorTools}
              project={this.props.project}
              geometryData={geometryJson}
              textureData={this.state.textureData}
              heightOffset={this.props.heightOffset + 60}
              theme={this.props.theme}
              readOnly={true}
              skipVanillaResources={true}
            />
          </Suspense>
        );
      } else {
        // Trigger async texture generation
        this._generatePreviewTexture(definition);
        previewContent = <div className="vse-previewLoading">Generating preview...</div>;
      }
    } else {
      previewContent = <div className="vse-noPreview">Add boxes to see preview</div>;
    }

    const rightPanel = <div className="vse-rightPanel">{previewContent}</div>;

    const colors = getThemeColors();
    return (
      <div
        className="vse-areaOuter"
        style={{
          backgroundColor: colors.background1,
          color: colors.foreground1,
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="vse-header">
          <div className="vse-identifier">
            <strong>Identifier:</strong> {definition.id || "(unnamed)"}
          </div>
        </div>
        <div
          className="vse-area"
          style={{
            minHeight: areaHeight,
            maxHeight: areaHeight,
          }}
        >
          {leftPanel}
          {rightPanel}
        </div>
      </div>
    );
  }
}
