// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * RenderControllerLivePreview - Compact live preview for render controller definitions
 *
 * Shows render controllers with geometry, textures, materials, arrays,
 * and part visibility in a hierarchical format with click-to-navigate support.
 */

import React, { Component } from "react";
import SectionIcon from "../../shared/components/icons/SectionIcon";
import "./RenderControllerLivePreview.css";

export interface IRenderControllerLivePreviewProps {
  jsonData?: any;
  identifier?: string;
  darkTheme?: boolean;
  onNavigate?: (path: string) => void;
  maxHeight?: number;
}

interface RenderControllerData {
  id: string;
  geometry?: string | string[];
  textures?: string[];
  materials?: Array<{ name: string; value: string }>;
  arrays?: { [key: string]: { type: string; values: string[] } };
  partVisibility?: Array<{ bone: string; condition: string }>;
  overlayColor?: string;
  onFireColor?: string;
  isHurtColor?: string;
}

interface ParsedRenderControllersData {
  controllers: RenderControllerData[];
}

interface IRenderControllerLivePreviewState {
  isLoaded: boolean;
  renderData: ParsedRenderControllersData | null;
  expandedSections: Set<string>;
}

export default class RenderControllerLivePreview extends Component<
  IRenderControllerLivePreviewProps,
  IRenderControllerLivePreviewState
> {
  constructor(props: IRenderControllerLivePreviewProps) {
    super(props);
    this.state = {
      isLoaded: false,
      renderData: null,
      expandedSections: new Set(["controllers", "geometry", "textures", "materials", "arrays", "partVisibility"]),
    };
  }

  componentDidMount(): void {
    this._loadDefinition();
  }

  componentDidUpdate(prevProps: IRenderControllerLivePreviewProps): void {
    if (prevProps.jsonData !== this.props.jsonData) {
      this._loadDefinition();
    }
  }

  private _loadDefinition(): void {
    try {
      if (!this.props.jsonData) {
        this.setState({ isLoaded: true, renderData: null });
        return;
      }

      const json = this.props.jsonData;
      const renderControllers = json.render_controllers || {};
      const controllers: RenderControllerData[] = [];

      for (const [id, controller] of Object.entries(renderControllers)) {
        const ctrl = controller as any;
        const data: RenderControllerData = {
          id,
          geometry: ctrl.geometry,
          textures: ctrl.textures,
          materials: this._parseMaterials(ctrl.materials),
          arrays: this._parseArrays(ctrl.arrays),
          partVisibility: this._parsePartVisibility(ctrl.part_visibility),
          overlayColor: ctrl.overlay_color,
          onFireColor: ctrl.on_fire_color,
          isHurtColor: ctrl.is_hurt_color,
        };
        controllers.push(data);
      }

      this.setState({
        isLoaded: true,
        renderData: { controllers },
      });
    } catch {
      this.setState({ isLoaded: true, renderData: null });
    }
  }

  private _parseMaterials(materials: any): Array<{ name: string; value: string }> {
    if (!materials) return [];
    const result: Array<{ name: string; value: string }> = [];
    if (Array.isArray(materials)) {
      for (const mat of materials) {
        if (typeof mat === "object") {
          for (const [name, value] of Object.entries(mat)) {
            result.push({ name, value: String(value) });
          }
        }
      }
    }
    return result;
  }

  private _parseArrays(arrays: any): { [key: string]: { type: string; values: string[] } } {
    if (!arrays) return {};
    const result: { [key: string]: { type: string; values: string[] } } = {};
    for (const [type, arrayDef] of Object.entries(arrays)) {
      if (typeof arrayDef === "object") {
        for (const [name, values] of Object.entries(arrayDef as object)) {
          result[name] = { type, values: Array.isArray(values) ? values.map(String) : [String(values)] };
        }
      }
    }
    return result;
  }

  private _parsePartVisibility(partVis: any): Array<{ bone: string; condition: string }> {
    if (!partVis) return [];
    const result: Array<{ bone: string; condition: string }> = [];
    if (Array.isArray(partVis)) {
      for (const pv of partVis) {
        if (typeof pv === "object") {
          for (const [bone, condition] of Object.entries(pv)) {
            result.push({ bone, condition: String(condition) });
          }
        }
      }
    }
    return result;
  }

  private _toggleSection(section: string): void {
    const expanded = new Set(this.state.expandedSections);
    if (expanded.has(section)) {
      expanded.delete(section);
    } else {
      expanded.add(section);
    }
    this.setState({ expandedSections: expanded });
  }

  private _shortenRef(ref: string): string {
    if (!ref) return "unknown";
    // Handle Molang expressions
    if (ref.includes("Array.")) {
      return ref;
    }
    return ref.replace(/^(Geometry|Texture|Material)\./, "").replace(/_/g, " ");
  }

  private _renderHeader(): JSX.Element {
    const identifier = this.props.identifier || "Render Controller";
    const shortId = identifier.includes("/") ? identifier.split("/").pop() : identifier;

    return (
      <div className="rclp-header">
        <div className="rclp-icon"><SectionIcon type="palette" /></div>
        <div className="rclp-title">
          <div className="rclp-name">{this._toTitleCase(shortId?.replace(".json", "") || "")}</div>
          <div className="rclp-id">{identifier}</div>
        </div>
      </div>
    );
  }

  private _renderController(controller: RenderControllerData, index: number): JSX.Element {
    const controllerKey = `controller-${index}`;
    const isExpanded = this.state.expandedSections.has(controllerKey);

    return (
      <div key={controller.id} className="rclp-controller">
        <div
          className="rclp-controller-header rclp-clickable"
          onClick={() => {
            this._toggleSection(controllerKey);
            this.props.onNavigate?.(`render_controllers/${controller.id}`);
          }}
          title={`Go to ${controller.id}`}
        >
          <span className="rclp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span className="rclp-controller-id">{controller.id}</span>
        </div>
        {isExpanded && (
          <div className="rclp-controller-content">
            {this._renderGeometry(controller, index)}
            {this._renderTextures(controller, index)}
            {this._renderMaterials(controller, index)}
            {this._renderArrays(controller, index)}
            {this._renderPartVisibility(controller, index)}
          </div>
        )}
      </div>
    );
  }

  private _renderGeometry(controller: RenderControllerData, _controllerIndex: number): JSX.Element | null {
    if (!controller.geometry) return null;

    const geometries = Array.isArray(controller.geometry) ? controller.geometry : [controller.geometry];

    return (
      <div className="rclp-subsection">
        <div className="rclp-subsection-label"><SectionIcon type="triangle" /> Geometry</div>
        <div className="rclp-items">
          {geometries.map((geo, idx) => (
            <div key={idx} className="rclp-item">
              <span className="rclp-item-value">{this._shortenRef(geo)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  private _renderTextures(controller: RenderControllerData, _controllerIndex: number): JSX.Element | null {
    if (!controller.textures || controller.textures.length === 0) return null;

    return (
      <div className="rclp-subsection">
        <div className="rclp-subsection-label"><SectionIcon type="image" /> Textures</div>
        <div className="rclp-items">
          {controller.textures.map((tex, idx) => (
            <div key={idx} className="rclp-item">
              <span className="rclp-item-index">[{idx}]</span>
              <span className="rclp-item-value">{this._shortenRef(tex)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  private _renderMaterials(controller: RenderControllerData, _controllerIndex: number): JSX.Element | null {
    if (!controller.materials || controller.materials.length === 0) return null;

    return (
      <div className="rclp-subsection">
        <div className="rclp-subsection-label"><SectionIcon type="block" /> Materials</div>
        <div className="rclp-items">
          {controller.materials.map((mat, idx) => (
            <div key={idx} className="rclp-item">
              <span className="rclp-item-name">{mat.name}</span>
              <span className="rclp-item-arrow">→</span>
              <span className="rclp-item-value">{this._shortenRef(mat.value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  private _renderArrays(controller: RenderControllerData, _controllerIndex: number): JSX.Element | null {
    if (!controller.arrays || Object.keys(controller.arrays).length === 0) return null;

    return (
      <div className="rclp-subsection">
        <div className="rclp-subsection-label"><SectionIcon type="clipboard" /> Arrays</div>
        <div className="rclp-items">
          {Object.entries(controller.arrays).map(([name, arr], idx) => (
            <div key={idx} className="rclp-array">
              <div className="rclp-array-header">
                <span className="rclp-array-name">{name}</span>
                <span className="rclp-array-type">{arr.type}</span>
                <span className="rclp-badge">{arr.values.length}</span>
              </div>
              <div className="rclp-array-values">
                {arr.values.slice(0, 5).map((val, vIdx) => (
                  <span key={vIdx} className="rclp-array-value">
                    {this._shortenRef(val)}
                  </span>
                ))}
                {arr.values.length > 5 && <span className="rclp-array-more">+{arr.values.length - 5} more</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  private _renderPartVisibility(controller: RenderControllerData, _controllerIndex: number): JSX.Element | null {
    if (!controller.partVisibility || controller.partVisibility.length === 0) return null;

    return (
      <div className="rclp-subsection">
        <div className="rclp-subsection-label"><SectionIcon type="eye" /> Part Visibility</div>
        <div className="rclp-items">
          {controller.partVisibility.map((pv, idx) => (
            <div key={idx} className="rclp-item">
              <span className="rclp-item-name">{pv.bone}</span>
              <span className="rclp-item-arrow">→</span>
              <span className="rclp-item-condition" title={pv.condition}>
                {pv.condition.length > 30 ? pv.condition.substring(0, 30) + "..." : pv.condition}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  private _toTitleCase(str: string): string {
    return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  render(): JSX.Element {
    const { darkTheme, maxHeight } = this.props;
    const { isLoaded, renderData } = this.state;

    const containerClass = `rclp-container ${darkTheme ? "rclp-dark" : "rclp-light"}`;
    const style: React.CSSProperties = maxHeight ? { maxHeight, overflowY: "auto" } : {};

    if (!isLoaded) {
      return (
        <div className={containerClass} style={style}>
          <div className="rclp-loading">Loading render controller...</div>
        </div>
      );
    }

    if (!renderData || renderData.controllers.length === 0) {
      return (
        <div className={containerClass} style={style}>
          <div className="rclp-error"><SectionIcon type="warning" /> No render controller loaded</div>
        </div>
      );
    }

    return (
      <div className={containerClass} style={style}>
        {this._renderHeader()}
        <div className="rclp-controllers">
          {renderData.controllers.map((ctrl, idx) => this._renderController(ctrl, idx))}
        </div>
      </div>
    );
  }
}
