// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * EntityTypeResourceLivePreview - Compact live preview for entity type resource (client) definitions
 *
 * Shows client-side entity data including textures, geometry, animations,
 * render controllers, and materials in a hierarchical format with click-to-navigate support.
 */

import React, { Component } from "react";
import SectionIcon from "../../shared/components/icons/SectionIcon";
import "./EntityTypeResourceLivePreview.css";

export interface IEntityTypeResourceLivePreviewProps {
  jsonData?: any;
  identifier?: string;
  darkTheme?: boolean;
  onNavigate?: (path: string) => void;
  maxHeight?: number;
}

interface EntityResourceData {
  identifier: string;
  textures: { [key: string]: string };
  geometry: { [key: string]: string };
  animations: { [key: string]: string };
  animationControllers: { [key: string]: string };
  renderControllers: string[];
  materials: { [key: string]: string };
  particleEffects: { [key: string]: string };
  soundEffects: { [key: string]: string };
  spawnEgg?: { baseColor?: string; overlayColor?: string; texture?: string };
  enableAttachables?: boolean;
  scripts?: {
    preAnimation?: string[];
    animate?: Array<string | { [key: string]: string }>;
    initialize?: string[];
    variables?: { [key: string]: string };
  };
}

interface IEntityTypeResourceLivePreviewState {
  isLoaded: boolean;
  entityData: EntityResourceData | null;
  expandedSections: Set<string>;
}

export default class EntityTypeResourceLivePreview extends Component<
  IEntityTypeResourceLivePreviewProps,
  IEntityTypeResourceLivePreviewState
> {
  constructor(props: IEntityTypeResourceLivePreviewProps) {
    super(props);
    this.state = {
      isLoaded: false,
      entityData: null,
      expandedSections: new Set([
        "textures",
        "geometry",
        "animations",
        "animControllers",
        "renderControllers",
        "materials",
        "particles",
        "sounds",
        "scripts",
      ]),
    };
  }

  componentDidMount(): void {
    this._loadDefinition();
  }

  componentDidUpdate(prevProps: IEntityTypeResourceLivePreviewProps): void {
    if (prevProps.jsonData !== this.props.jsonData) {
      this._loadDefinition();
    }
  }

  private _loadDefinition(): void {
    try {
      if (!this.props.jsonData) {
        this.setState({ isLoaded: true, entityData: null });
        return;
      }

      const json = this.props.jsonData;
      const clientEntity = json["minecraft:client_entity"];
      if (!clientEntity) {
        this.setState({ isLoaded: true, entityData: null });
        return;
      }

      const desc = clientEntity.description || {};

      const data: EntityResourceData = {
        identifier: desc.identifier || this.props.identifier || "unknown",
        textures: desc.textures || {},
        geometry: desc.geometry || {},
        animations: desc.animations || {},
        animationControllers: desc.animation_controllers || {},
        renderControllers: desc.render_controllers || [],
        materials: desc.materials || {},
        particleEffects: desc.particle_effects || {},
        soundEffects: desc.sound_effects || {},
        spawnEgg: desc.spawn_egg,
        enableAttachables: desc.enable_attachables,
        scripts: desc.scripts,
      };

      this.setState({ isLoaded: true, entityData: data });
    } catch {
      this.setState({ isLoaded: true, entityData: null });
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

  private _shortenPath(path: unknown): string {
    if (!path || typeof path !== "string") return "unknown";
    return path
      .replace(/^textures\//, "")
      .replace(/^geometry\./, "")
      .replace(/^animation\./, "")
      .replace(/^controller\./, "");
  }

  private _renderHeader(): JSX.Element {
    const { entityData } = this.state;
    const identifier = entityData?.identifier || "Mob Resource";
    const shortId = identifier.replace(/^minecraft:/, "").replace(/_/g, " ");

    return (
      <div className="etrlp-header">
        <div className="etrlp-icon">
          <SectionIcon type="figure" />
        </div>
        <div className="etrlp-title">
          <div className="etrlp-name">{this._toTitleCase(shortId)}</div>
          <div className="etrlp-id">{identifier}</div>
        </div>
        {entityData?.spawnEgg && (
          <div className="etrlp-spawn-egg" title="Has spawn egg">
            <SectionIcon type="egg" />
          </div>
        )}
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
      <div className="etrlp-section">
        <div className="etrlp-section-header" onClick={() => this._toggleSection(sectionKey)}>
          <span className="etrlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span>
            {icon} {title}
          </span>
          <span className="etrlp-badge">{entries.length}</span>
        </div>
        {isExpanded && (
          <div className="etrlp-items">
            {entries.map(([key, value], idx) => (
              <div
                key={idx}
                className="etrlp-item etrlp-clickable"
                onClick={() => this.props.onNavigate?.(`minecraft:client_entity/description/${basePath}/${key}`)}
                title={`Go to ${key}`}
              >
                <span className="etrlp-item-key">{key}</span>
                <span className="etrlp-item-arrow">→</span>
                <span className="etrlp-item-value">{this._shortenPath(value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  private _renderRenderControllers(): JSX.Element | null {
    const { entityData } = this.state;
    if (!entityData || entityData.renderControllers.length === 0) return null;

    const isExpanded = this.state.expandedSections.has("renderControllers");

    return (
      <div className="etrlp-section">
        <div className="etrlp-section-header" onClick={() => this._toggleSection("renderControllers")}>
          <span className="etrlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span>
            <SectionIcon type="palette" /> Render Controllers
          </span>
          <span className="etrlp-badge">{entityData.renderControllers.length}</span>
        </div>
        {isExpanded && (
          <div className="etrlp-items">
            {entityData.renderControllers.map((rc, idx) => (
              <div
                key={idx}
                className="etrlp-item etrlp-clickable"
                onClick={() => this.props.onNavigate?.(`minecraft:client_entity/description/render_controllers/${idx}`)}
                title={`Go to render controller ${idx}`}
              >
                <span className="etrlp-item-value">{typeof rc === "string" ? rc : JSON.stringify(rc)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  private _renderScripts(): JSX.Element | null {
    const { entityData } = this.state;
    if (!entityData || !entityData.scripts) return null;

    const { preAnimation, animate, initialize, variables } = entityData.scripts;
    const hasContent =
      (preAnimation && preAnimation.length > 0) ||
      (animate && animate.length > 0) ||
      (initialize && initialize.length > 0) ||
      (variables && Object.keys(variables).length > 0);

    if (!hasContent) return null;

    const isExpanded = this.state.expandedSections.has("scripts");

    return (
      <div className="etrlp-section">
        <div className="etrlp-section-header" onClick={() => this._toggleSection("scripts")}>
          <span className="etrlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span>
            <SectionIcon type="scroll" /> Scripts
          </span>
        </div>
        {isExpanded && (
          <div className="etrlp-scripts-content">
            {variables && Object.keys(variables).length > 0 && (
              <div className="etrlp-script-group">
                <div className="etrlp-script-label">Variables</div>
                {Object.entries(variables).map(([name, value], idx) => (
                  <div key={idx} className="etrlp-script-item">
                    <span className="etrlp-var-name">{name}</span>
                    <span className="etrlp-var-value">
                      {String(value).length > 30 ? String(value).substring(0, 30) + "..." : value}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {initialize && initialize.length > 0 && (
              <div className="etrlp-script-group">
                <div className="etrlp-script-label">Initialize</div>
                {initialize.map((script, idx) => (
                  <div key={idx} className="etrlp-script-item">
                    {script.length > 50 ? script.substring(0, 50) + "..." : script}
                  </div>
                ))}
              </div>
            )}
            {preAnimation && preAnimation.length > 0 && (
              <div className="etrlp-script-group">
                <div className="etrlp-script-label">Pre-Animation</div>
                {preAnimation.map((script, idx) => (
                  <div key={idx} className="etrlp-script-item">
                    {script.length > 50 ? script.substring(0, 50) + "..." : script}
                  </div>
                ))}
              </div>
            )}
            {animate && animate.length > 0 && (
              <div className="etrlp-script-group">
                <div className="etrlp-script-label">Animate</div>
                {animate.map((anim, idx) => {
                  const animText = typeof anim === "string" ? anim : Object.keys(anim)[0];
                  return (
                    <div key={idx} className="etrlp-script-item">
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
    const { isLoaded, entityData } = this.state;

    const containerClass = `etrlp-container ${darkTheme ? "etrlp-dark" : "etrlp-light"}`;
    const style: React.CSSProperties = maxHeight ? { maxHeight, overflowY: "auto" } : {};

    if (!isLoaded) {
      return (
        <div className={containerClass} style={style}>
          <div className="etrlp-loading">Loading entity resource...</div>
        </div>
      );
    }

    if (!entityData) {
      return (
        <div className={containerClass} style={style}>
          <div className="etrlp-error">
            <SectionIcon type="warning" /> No entity resource loaded
          </div>
        </div>
      );
    }

    return (
      <div className={containerClass} style={style}>
        {this._renderHeader()}
        {this._renderKeyValueSection(
          "Textures",
          <SectionIcon type="image" />,
          entityData.textures,
          "textures",
          "textures"
        )}
        {this._renderKeyValueSection(
          "Geometry",
          <SectionIcon type="triangle" />,
          entityData.geometry,
          "geometry",
          "geometry"
        )}
        {this._renderKeyValueSection(
          "Materials",
          <SectionIcon type="block" />,
          entityData.materials,
          "materials",
          "materials"
        )}
        {this._renderKeyValueSection(
          "Animations",
          <SectionIcon type="film" />,
          entityData.animations,
          "animations",
          "animations"
        )}
        {this._renderKeyValueSection(
          "Animation Controllers",
          <SectionIcon type="gamepad" />,
          entityData.animationControllers,
          "animControllers",
          "animation_controllers"
        )}
        {this._renderRenderControllers()}
        {this._renderKeyValueSection(
          "Particle Effects",
          <SectionIcon type="sparkle" />,
          entityData.particleEffects,
          "particles",
          "particle_effects"
        )}
        {this._renderKeyValueSection(
          "Sound Effects",
          <SectionIcon type="speaker" />,
          entityData.soundEffects,
          "sounds",
          "sound_effects"
        )}
        {this._renderScripts()}
      </div>
    );
  }
}
