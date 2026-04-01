// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * AttachableLivePreview - Compact live preview for attachable definitions
 *
 * Shows attachable items with textures, geometry, animations, render controllers,
 * and scripts in a hierarchical format with click-to-navigate support.
 */

import React, { Component } from "react";
import SectionIcon from "../../shared/components/icons/SectionIcon";
import { clickableKeyHandler } from "../../shared/accessibilityUtils";
import "./AttachableLivePreview.css";

export interface IAttachableLivePreviewProps {
  jsonData?: any;
  identifier?: string;
  darkTheme?: boolean;
  onNavigate?: (path: string) => void;
  maxHeight?: number;
}

interface AttachableData {
  identifier: string;
  textures: { [key: string]: string };
  geometry: { [key: string]: string };
  animations: { [key: string]: string };
  animationControllers: { [key: string]: string };
  renderControllers: string[];
  materials: { [key: string]: string };
  scripts?: {
    preAnimation?: string[];
    animate?: Array<string | { [key: string]: string }>;
  };
  item?: string | { [key: string]: string };
}

interface IAttachableLivePreviewState {
  isLoaded: boolean;
  attachableData: AttachableData | null;
  expandedSections: Set<string>;
}

export default class AttachableLivePreview extends Component<IAttachableLivePreviewProps, IAttachableLivePreviewState> {
  constructor(props: IAttachableLivePreviewProps) {
    super(props);
    this.state = {
      isLoaded: false,
      attachableData: null,
      expandedSections: new Set(["textures", "geometry", "animations", "renderControllers", "materials", "scripts"]),
    };
  }

  componentDidMount(): void {
    this._loadDefinition();
  }

  componentDidUpdate(prevProps: IAttachableLivePreviewProps): void {
    if (prevProps.jsonData !== this.props.jsonData) {
      this._loadDefinition();
    }
  }

  private _loadDefinition(): void {
    try {
      if (!this.props.jsonData) {
        this.setState({ isLoaded: true, attachableData: null });
        return;
      }

      const json = this.props.jsonData;
      const attachable = json["minecraft:attachable"];
      if (!attachable) {
        this.setState({ isLoaded: true, attachableData: null });
        return;
      }

      const desc = attachable.description || {};

      const data: AttachableData = {
        identifier: desc.identifier || this.props.identifier || "unknown",
        textures: desc.textures || {},
        geometry: desc.geometry || {},
        animations: desc.animations || {},
        animationControllers: desc.animation_controllers || {},
        renderControllers: desc.render_controllers || [],
        materials: desc.materials || {},
        scripts: desc.scripts,
        item: desc.item,
      };

      this.setState({ isLoaded: true, attachableData: data });
    } catch {
      this.setState({ isLoaded: true, attachableData: null });
    }
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

  private _shortenPath(path: string): string {
    if (!path) return "unknown";
    // Remove common prefixes
    return path
      .replace(/^textures\//, "")
      .replace(/^geometry\./, "")
      .replace(/^animation\./, "")
      .replace(/^controller\./, "");
  }

  private _renderHeader(): JSX.Element {
    const { attachableData } = this.state;
    const identifier = attachableData?.identifier || "Attachable";
    const shortId = identifier.replace(/^minecraft:/, "").replace(/_/g, " ");

    return (
      <div className="atlp-header">
        <div className="atlp-icon"><SectionIcon type="backpack" /></div>
        <div className="atlp-title">
          <div className="atlp-name">{this._toTitleCase(shortId)}</div>
          <div className="atlp-id">{identifier}</div>
        </div>
      </div>
    );
  }

  private _renderKeyValueSection(
    title: string,
    icon: React.ReactNode,
    data: { [key: string]: string },
    sectionKey: string,
    basePath: string
  ): JSX.Element | null {
    const entries = Object.entries(data);
    if (entries.length === 0) return null;

    const isExpanded = this.state.expandedSections.has(sectionKey);

    return (
      <div className="atlp-section">
        <div
          className="atlp-section-header"
          onClick={() => this._toggleSection(sectionKey)}
          {...clickableKeyHandler(() => this._toggleSection(sectionKey))}
        >
          <span className="atlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span>
            {icon} {title}
          </span>
          <span className="atlp-badge">{entries.length}</span>
        </div>
        {isExpanded && (
          <div className="atlp-items">
            {entries.map(([key, value], idx) => (
              <div
                key={idx}
                className="atlp-item atlp-clickable"
                onClick={() => this.props.onNavigate?.(`minecraft:attachable/description/${basePath}/${key}`)}
                title={`Go to ${key}`}
              >
                <span className="atlp-item-key">{key}</span>
                <span className="atlp-item-arrow">→</span>
                <span className="atlp-item-value">{this._shortenPath(value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  private _renderRenderControllers(): JSX.Element | null {
    const { attachableData } = this.state;
    if (!attachableData || attachableData.renderControllers.length === 0) return null;

    const isExpanded = this.state.expandedSections.has("renderControllers");

    return (
      <div className="atlp-section">
        <div
          className="atlp-section-header"
          onClick={() => this._toggleSection("renderControllers")}
          {...clickableKeyHandler(() => this._toggleSection("renderControllers"))}
        >
          <span className="atlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span><SectionIcon type="palette" /> Render Controllers</span>
          <span className="atlp-badge">{attachableData.renderControllers.length}</span>
        </div>
        {isExpanded && (
          <div className="atlp-items">
            {attachableData.renderControllers.map((rc, idx) => (
              <div
                key={idx}
                className="atlp-item atlp-clickable"
                onClick={() => this.props.onNavigate?.(`minecraft:attachable/description/render_controllers/${idx}`)}
                title={`Go to render controller ${idx}`}
              >
                <span className="atlp-item-value">{typeof rc === "string" ? rc : JSON.stringify(rc)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  private _renderScripts(): JSX.Element | null {
    const { attachableData } = this.state;
    if (!attachableData || !attachableData.scripts) return null;

    const { preAnimation, animate } = attachableData.scripts;
    const hasContent = (preAnimation && preAnimation.length > 0) || (animate && animate.length > 0);
    if (!hasContent) return null;

    const isExpanded = this.state.expandedSections.has("scripts");

    return (
      <div className="atlp-section">
        <div
          className="atlp-section-header"
          onClick={() => this._toggleSection("scripts")}
          {...clickableKeyHandler(() => this._toggleSection("scripts"))}
        >
          <span className="atlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span><SectionIcon type="scroll" /> Scripts</span>
        </div>
        {isExpanded && (
          <div className="atlp-scripts-content">
            {preAnimation && preAnimation.length > 0 && (
              <div className="atlp-script-group">
                <div className="atlp-script-label">Pre-Animation</div>
                {preAnimation.map((script, idx) => (
                  <div key={idx} className="atlp-script-item">
                    {script.length > 50 ? script.substring(0, 50) + "..." : script}
                  </div>
                ))}
              </div>
            )}
            {animate && animate.length > 0 && (
              <div className="atlp-script-group">
                <div className="atlp-script-label">Animate</div>
                {animate.map((anim, idx) => {
                  const animText = typeof anim === "string" ? anim : Object.keys(anim)[0];
                  return (
                    <div key={idx} className="atlp-script-item">
                      {animText}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  private _toTitleCase(str: string): string {
    return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  render(): JSX.Element {
    const { darkTheme, maxHeight } = this.props;
    const { isLoaded, attachableData } = this.state;

    const containerClass = `atlp-container ${darkTheme ? "atlp-dark" : "atlp-light"}`;
    const style: React.CSSProperties = maxHeight ? { maxHeight, overflowY: "auto" } : {};

    if (!isLoaded) {
      return (
        <div className={containerClass} style={style}>
          <div className="atlp-loading">Loading attachable...</div>
        </div>
      );
    }

    if (!attachableData) {
      return (
        <div className={containerClass} style={style}>
          <div className="atlp-error"><SectionIcon type="warning" /> No attachable loaded</div>
        </div>
      );
    }

    return (
      <div className={containerClass} style={style}>
        {this._renderHeader()}
        {this._renderKeyValueSection("Textures", <SectionIcon type="image" />, attachableData.textures, "textures", "textures")}
        {this._renderKeyValueSection("Geometry", <SectionIcon type="triangle" />, attachableData.geometry, "geometry", "geometry")}
        {this._renderKeyValueSection("Materials", <SectionIcon type="block" />, attachableData.materials, "materials", "materials")}
        {this._renderKeyValueSection(
          "Animations",
          <SectionIcon type="film" />,
          attachableData.animations,
          "animations",
          "animations"
        )}
        {this._renderKeyValueSection(
          "Animation Controllers",
          <SectionIcon type="film" />,
          attachableData.animationControllers,
          "animControllers",
          "animation_controllers"
        )}
        {this._renderRenderControllers()}
        {this._renderScripts()}
      </div>
    );
  }
}
