// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * VoxelShapeLivePreview - Compact live preview component for voxel shapes
 *
 * ARCHITECTURE: This component provides a real-time 3D preview of voxel shape definitions
 * that is designed to work in both:
 * - mctools.dev web application (as a sidebar or panel)
 * - VS Code extension webviews (as a live preview panel)
 *
 * It differs from the full VoxelShapeEditor by being:
 * - Read-only and compact
 * - Focused on 3D visualization, not editing
 * - Suitable for sidebar widths (200-400px)
 * - Optimized for quick visual inspection
 *
 * This component works directly with JSON data for simplicity and portability.
 * It converts the voxel shape JSON to geometry and renders it via ModelViewer.
 */

import React, { Component, Suspense, lazy } from "react";
import Log from "../../../core/Log";
import "./VoxelShapeLivePreview.css";
import VoxelShapeDefinition from "../../../minecraft/VoxelShapeDefinition";

// Lazy load ModelViewer for 3D preview
const ModelViewer = lazy(() => import("../../world/ModelViewer"));

export interface IVoxelShapeLivePreviewProps {
  /** Raw JSON data to preview */
  jsonData?: any;
  /** Shape identifier for display */
  identifier?: string;
  /** Whether the theme is dark */
  darkTheme?: boolean;
  /** Callback when a box is clicked for navigation */
  onNavigate?: (path: string) => void;
  /** Max height (undefined = no limit) */
  maxHeight?: number;
}

interface ParsedVoxelShapeData {
  id: string;
  formatVersion: string;
  boxes: Array<{
    min: number[] | { x: number; y: number; z: number };
    max: number[] | { x: number; y: number; z: number };
  }>;
}

interface IVoxelShapeLivePreviewState {
  isLoaded: boolean;
  shapeData: ParsedVoxelShapeData | null;
  geometryJson: object | null;
  textureData: Uint8Array | null;
  error: string | null;
}

export default class VoxelShapeLivePreview extends Component<IVoxelShapeLivePreviewProps, IVoxelShapeLivePreviewState> {
  private _textureGenerationPending = false;

  constructor(props: IVoxelShapeLivePreviewProps) {
    super(props);

    this.state = {
      isLoaded: false,
      shapeData: null,
      geometryJson: null,
      textureData: null,
      error: null,
    };
  }

  componentDidMount(): void {
    this._loadDefinition();
  }

  componentDidUpdate(prevProps: IVoxelShapeLivePreviewProps): void {
    // Reload if JSON data changed
    if (prevProps.jsonData !== this.props.jsonData) {
      this._loadDefinition();
    }
  }

  private async _loadDefinition(): Promise<void> {
    if (!this.props.jsonData) {
      this.setState({
        isLoaded: true,
        shapeData: null,
        geometryJson: null,
        textureData: null,
        error: "No data provided",
      });
      return;
    }

    try {
      const json = this.props.jsonData;
      const shapeData = this._parseVoxelShape(json);

      if (!shapeData) {
        this.setState({
          isLoaded: true,
          shapeData: null,
          geometryJson: null,
          textureData: null,
          error: "Invalid voxel shape format",
        });
        return;
      }

      // Convert to geometry JSON using the same logic as VoxelShapeDefinition
      const geometryJson = this._convertToGeometry(shapeData);

      this.setState({
        isLoaded: true,
        shapeData,
        geometryJson,
        textureData: null,
        error: null,
      });

      // Generate texture asynchronously
      await this._generateTexture(shapeData);
    } catch (error) {
      Log.debug(`VoxelShapeLivePreview load error: ${error}`);
      this.setState({
        isLoaded: true,
        shapeData: null,
        geometryJson: null,
        textureData: null,
        error: String(error),
      });
    }
  }

  private _parseVoxelShape(json: any): ParsedVoxelShapeData | null {
    try {
      const formatVersion = json.format_version || "unknown";
      const voxelShape = json["minecraft:voxel_shape"];

      if (!voxelShape) {
        return null;
      }

      const description = voxelShape.description || {};
      const shape = voxelShape.shape || {};
      const boxes = shape.boxes || [];

      return {
        id: description.identifier || this.props.identifier || "unknown",
        formatVersion,
        boxes,
      };
    } catch (e) {
      return null;
    }
  }

  private _convertToGeometry(shapeData: ParsedVoxelShapeData): object {
    // Use the same conversion logic as VoxelShapeDefinition.toGeometryJson()
    const cubes: any[] = [];
    const TEXTURE_SLOT_WIDTH = 16;
    const NUM_SLOTS = 8;

    // Calculate bounds for visible_bounds
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    for (let i = 0; i < shapeData.boxes.length; i++) {
      const box = shapeData.boxes[i];
      const minArr = Array.isArray(box.min) ? box.min : [(box.min as any).x, (box.min as any).y, (box.min as any).z];
      const maxArr = Array.isArray(box.max) ? box.max : [(box.max as any).x, (box.max as any).y, (box.max as any).z];

      // Track bounds
      minX = Math.min(minX, minArr[0]);
      minY = Math.min(minY, minArr[1]);
      minZ = Math.min(minZ, minArr[2]);
      maxX = Math.max(maxX, maxArr[0]);
      maxY = Math.max(maxY, maxArr[1]);
      maxZ = Math.max(maxZ, maxArr[2]);

      const sizeX = maxArr[0] - minArr[0];
      const sizeY = maxArr[1] - minArr[1];
      const sizeZ = maxArr[2] - minArr[2];

      // Use texture slot based on box index
      const textureSlot = i % NUM_SLOTS;
      const uOffset = textureSlot * TEXTURE_SLOT_WIDTH;

      // Per-face UV mapping
      const faceUv: { [key: string]: { uv: number[]; uv_size: number[] } } = {};
      const faceNames = ["north", "south", "east", "west", "up", "down"];
      for (const faceName of faceNames) {
        faceUv[faceName] = {
          uv: [uOffset, 0],
          uv_size: [TEXTURE_SLOT_WIDTH, TEXTURE_SLOT_WIDTH],
        };
      }

      cubes.push({
        origin: minArr,
        size: [sizeX, sizeY, sizeZ],
        uv: faceUv,
      });
    }

    // Calculate dynamic bounds
    const boundsWidth = Math.max(maxX - minX, maxZ - minZ, 32) * 1.5;
    const boundsHeight = Math.max(maxY - minY, 32) * 1.5;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    return {
      format_version: "1.12.0",
      "minecraft:geometry": [
        {
          description: {
            identifier: `geometry.voxelshape.${shapeData.id.replace(/[^a-zA-Z0-9_]/g, "_")}`,
            texture_width: TEXTURE_SLOT_WIDTH * NUM_SLOTS,
            texture_height: TEXTURE_SLOT_WIDTH,
            visible_bounds_width: boundsWidth,
            visible_bounds_height: boundsHeight,
            visible_bounds_offset: [centerX, centerY, centerZ],
          },
          bones: [
            {
              name: "voxelshape",
              pivot: [0, 0, 0],
              cubes: cubes,
            },
          ],
        },
      ],
    };
  }

  private async _generateTexture(shapeData: ParsedVoxelShapeData): Promise<void> {
    if (this._textureGenerationPending) {
      return;
    }
    this._textureGenerationPending = true;

    try {
      const { pixels, width, height } = VoxelShapeDefinition.generatePreviewTexturePixelsStatic(shapeData.boxes.length);

      // Use Canvas to encode to PNG (browser-compatible)
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        const imageData = ctx.createImageData(width, height);
        imageData.data.set(pixels);
        ctx.putImageData(imageData, 0, 0);

        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, "image/png");
        });

        if (blob) {
          const arrayBuffer = await blob.arrayBuffer();
          const textureData = new Uint8Array(arrayBuffer);

          this.setState({
            textureData,
          });
        }
      }
    } catch (e) {
      Log.debug(`VoxelShapeLivePreview texture generation error: ${e}`);
    } finally {
      this._textureGenerationPending = false;
    }
  }

  private _formatBoxCoords(box: any): string {
    const minArr = Array.isArray(box.min) ? box.min : [box.min.x, box.min.y, box.min.z];
    const maxArr = Array.isArray(box.max) ? box.max : [box.max.x, box.max.y, box.max.z];
    return `[${minArr.join(", ")}] → [${maxArr.join(", ")}]`;
  }

  private _handleBoxClick = (index: number) => {
    if (this.props.onNavigate) {
      this.props.onNavigate(`minecraft:voxel_shape.shape.boxes[${index}]`);
    }
  };

  render() {
    const { darkTheme, maxHeight, identifier } = this.props;
    const { isLoaded, shapeData, geometryJson, textureData, error } = this.state;

    const themeClass = darkTheme ? "vslp-dark" : "vslp-light";

    if (!isLoaded) {
      return (
        <div className={`vslp-container ${themeClass}`}>
          <div className="vslp-loading">Loading...</div>
        </div>
      );
    }

    if (error || !shapeData) {
      return (
        <div className={`vslp-container ${themeClass}`}>
          <div className="vslp-error">
            <span className="vslp-errorIcon">⚠️</span>
            <span>{error || "Invalid voxel shape"}</span>
          </div>
        </div>
      );
    }

    const containerStyle: React.CSSProperties = maxHeight ? { maxHeight: `${maxHeight}px` } : {};

    return (
      <div className={`vslp-container ${themeClass}`} style={containerStyle}>
        {/* Header */}
        <div className="vslp-header">
          <div className="vslp-title">
            <span className="vslp-icon">🧊</span>
            <span className="vslp-identifier">{shapeData.id || identifier || "Voxel Shape"}</span>
          </div>
          <div className="vslp-version">v{shapeData.formatVersion}</div>
        </div>

        {/* 3D Preview */}
        <div className="vslp-preview">
          {geometryJson && textureData ? (
            <Suspense fallback={<div className="vslp-previewLoading">Loading 3D viewer...</div>}>
              <ModelViewer
                geometryData={geometryJson}
                textureData={textureData}
                heightOffset={0}
                readOnly={true}
                skipVanillaResources={true}
                fitToContainer={true}
              />
            </Suspense>
          ) : (
            <div className="vslp-previewLoading">
              {!geometryJson ? "Preparing geometry..." : "Generating texture..."}
            </div>
          )}
        </div>

        {/* Box List */}
        <div className="vslp-section">
          <div className="vslp-sectionHeader">
            <span className="vslp-sectionIcon">📦</span>
            <span className="vslp-sectionTitle">Boxes ({shapeData.boxes.length})</span>
          </div>
          <div className="vslp-boxList">
            {shapeData.boxes.map((box, index) => (
              <div
                key={index}
                className="vslp-boxItem"
                onClick={() => this._handleBoxClick(index)}
                title={`Click to navigate to box ${index + 1}`}
              >
                <span className="vslp-boxNumber">{index + 1}</span>
                <span className="vslp-boxCoords">{this._formatBoxCoords(box)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
}
