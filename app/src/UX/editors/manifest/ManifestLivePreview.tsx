// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ManifestLivePreview - Compact live preview for behavior pack and resource pack manifests
 *
 * Shows pack metadata, modules, dependencies, and capabilities in a
 * table-of-contents style format with click-to-navigate support.
 */

import React, { Component } from "react";
import SectionIcon from "../../shared/components/icons/SectionIcon";
import "./ManifestLivePreview.css";

export interface IManifestLivePreviewProps {
  jsonData?: any;
  identifier?: string;
  packType: "behavior" | "resource";
  darkTheme?: boolean;
  onNavigate?: (path: string) => void;
  maxHeight?: number;
}

interface ParsedModule {
  type: string;
  description?: string;
  uuid: string;
  version: string;
  language?: string;
  entry?: string;
}

interface ParsedDependency {
  name?: string;
  uuid?: string;
  moduleName?: string;
  version: string;
}

interface ParsedManifestData {
  formatVersion: string;
  name: string;
  description: string;
  uuid: string;
  version: string;
  minEngineVersion?: string;
  packScope?: string;
  modules: ParsedModule[];
  dependencies: ParsedDependency[];
  capabilities: string[];
  authors?: string[];
  license?: string;
  url?: string;
  productType?: string;
}

interface IManifestLivePreviewState {
  isLoaded: boolean;
  manifestData: ParsedManifestData | null;
  expandedSections: Set<string>;
}

export default class ManifestLivePreview extends Component<IManifestLivePreviewProps, IManifestLivePreviewState> {
  constructor(props: IManifestLivePreviewProps) {
    super(props);
    this.state = {
      isLoaded: false,
      manifestData: null,
      expandedSections: new Set(["header", "modules", "dependencies", "capabilities"]),
    };
  }

  componentDidMount(): void {
    this._loadDefinition();
  }

  componentDidUpdate(prevProps: IManifestLivePreviewProps): void {
    if (prevProps.jsonData !== this.props.jsonData) {
      this._loadDefinition();
    }
  }

  private _loadDefinition(): void {
    try {
      if (!this.props.jsonData) {
        this.setState({ isLoaded: true, manifestData: null });
        return;
      }

      const json = this.props.jsonData;
      const header = json.header;

      if (!header) {
        this.setState({ isLoaded: true, manifestData: null });
        return;
      }

      const parsed: ParsedManifestData = {
        formatVersion: String(json.format_version || "unknown"),
        name: header.name || "Unnamed Pack",
        description: header.description || "",
        uuid: header.uuid || "unknown",
        version: this._formatVersion(header.version),
        minEngineVersion: header.min_engine_version ? this._formatVersion(header.min_engine_version) : undefined,
        packScope: header.pack_scope,
        modules: this._parseModules(json.modules),
        dependencies: this._parseDependencies(json.dependencies),
        capabilities: json.capabilities || [],
        authors: json.metadata?.authors,
        license: json.metadata?.license,
        url: json.metadata?.url,
        productType: json.metadata?.product_type,
      };

      this.setState({ isLoaded: true, manifestData: parsed });
    } catch {
      this.setState({ isLoaded: true, manifestData: null });
    }
  }

  private _formatVersion(version: string | number[] | undefined): string {
    if (!version) return "unknown";
    if (typeof version === "string") return version;
    if (Array.isArray(version)) return version.join(".");
    return String(version);
  }

  private _parseModules(modules: any[] | undefined): ParsedModule[] {
    if (!modules || !Array.isArray(modules)) return [];

    return modules.map((mod) => ({
      type: mod.type || "unknown",
      description: mod.description,
      uuid: mod.uuid || "unknown",
      version: this._formatVersion(mod.version),
      language: mod.language,
      entry: mod.entry,
    }));
  }

  private _parseDependencies(dependencies: any[] | undefined): ParsedDependency[] {
    if (!dependencies || !Array.isArray(dependencies)) return [];

    return dependencies.map((dep) => ({
      uuid: dep.uuid,
      moduleName: dep.module_name,
      version: this._formatVersion(dep.version),
      name: dep.module_name || this._getKnownModuleName(dep.module_name) || dep.uuid?.substring(0, 8),
    }));
  }

  private _getKnownModuleName(moduleName: string | undefined): string | undefined {
    if (!moduleName) return undefined;

    const knownModules: Record<string, string> = {
      "@minecraft/server": "Server API",
      "@minecraft/server-ui": "Server UI",
      "@minecraft/server-net": "Server Network",
      "@minecraft/server-admin": "Server Admin",
      "@minecraft/server-gametest": "GameTest",
      "@minecraft/server-editor": "Editor API",
      "@minecraft/debug-utilities": "Debug Utils",
    };

    return knownModules[moduleName] || moduleName;
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

  private _getPackIcon(): React.ReactNode {
    return this.props.packType === "behavior" ? <SectionIcon type="gear" /> : <SectionIcon type="palette" />;
  }

  private _getModuleIcon(type: string): React.ReactNode {
    switch (type) {
      case "data":
        return <SectionIcon type="chart" />;
      case "resources":
        return <SectionIcon type="image" />;
      case "script":
      case "client_data":
        return <SectionIcon type="scroll" />;
      default:
        return <SectionIcon type="cube" />;
    }
  }

  private _renderHeader(data: ParsedManifestData): JSX.Element {
    const packTypeName = this.props.packType === "behavior" ? "Behavior Pack" : "Resource Pack";

    return (
      <div className="mnlp-header">
        <div className="mnlp-icon">{this._getPackIcon()}</div>
        <div className="mnlp-title">
          <div className="mnlp-name">{data.name}</div>
          <div className="mnlp-type">{packTypeName}</div>
        </div>
      </div>
    );
  }

  private _renderMetadata(data: ParsedManifestData): JSX.Element {
    const isExpanded = this.state.expandedSections.has("header");

    return (
      <div className="mnlp-section">
        <div className="mnlp-section-header" onClick={() => this._toggleSection("header")}>
          <span className="mnlp-toggle">{isExpanded ? "▼" : "▶"}</span>
          <span className="mnlp-section-icon"><SectionIcon type="tag" /></span>
          <span className="mnlp-section-title">Pack Info</span>
        </div>
        {isExpanded && (
          <div className="mnlp-section-content">
            <div className="mnlp-meta-item">
              <span className="mnlp-meta-label">Version:</span>
              <span className="mnlp-meta-value">{data.version}</span>
            </div>
            {data.minEngineVersion && (
              <div className="mnlp-meta-item">
                <span className="mnlp-meta-label">Min Engine:</span>
                <span className="mnlp-meta-value">{data.minEngineVersion}</span>
              </div>
            )}
            <div className="mnlp-meta-item">
              <span className="mnlp-meta-label">Format:</span>
              <span className="mnlp-meta-value">{data.formatVersion}</span>
            </div>
            {data.packScope && (
              <div className="mnlp-meta-item">
                <span className="mnlp-meta-label">Scope:</span>
                <span className="mnlp-meta-value">{data.packScope}</span>
              </div>
            )}
            {data.productType && (
              <div className="mnlp-meta-item">
                <span className="mnlp-meta-label">Type:</span>
                <span className="mnlp-meta-value">{data.productType}</span>
              </div>
            )}
            {data.description && (
              <div className="mnlp-meta-item mnlp-description">
                <span className="mnlp-meta-label">Description:</span>
                <span className="mnlp-meta-value">{data.description}</span>
              </div>
            )}
            <div className="mnlp-meta-item mnlp-uuid">
              <span className="mnlp-meta-label">UUID:</span>
              <span className="mnlp-meta-value mnlp-mono">{data.uuid}</span>
            </div>
            {data.authors && data.authors.length > 0 && (
              <div className="mnlp-meta-item">
                <span className="mnlp-meta-label">Authors:</span>
                <span className="mnlp-meta-value">{data.authors.join(", ")}</span>
              </div>
            )}
            {data.license && (
              <div className="mnlp-meta-item">
                <span className="mnlp-meta-label">License:</span>
                <span className="mnlp-meta-value">{data.license}</span>
              </div>
            )}
            {data.url && (
              <div className="mnlp-meta-item">
                <span className="mnlp-meta-label">URL:</span>
                <span className="mnlp-meta-value mnlp-url">{data.url}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  private _renderModules(modules: ParsedModule[]): JSX.Element | null {
    if (modules.length === 0) return null;

    const isExpanded = this.state.expandedSections.has("modules");

    return (
      <div className="mnlp-section">
        <div className="mnlp-section-header" onClick={() => this._toggleSection("modules")}>
          <span className="mnlp-toggle">{isExpanded ? "▼" : "▶"}</span>
          <span className="mnlp-section-icon"><SectionIcon type="cube" /></span>
          <span className="mnlp-section-title">Modules</span>
          <span className="mnlp-count">{modules.length}</span>
        </div>
        {isExpanded && (
          <div className="mnlp-section-content">
            {modules.map((mod, index) => (
              <div key={index} className="mnlp-module-item">
                <span className="mnlp-module-icon">{this._getModuleIcon(mod.type)}</span>
                <div className="mnlp-module-info">
                  <div className="mnlp-module-type">{mod.type}</div>
                  <div className="mnlp-module-version">v{mod.version}</div>
                  {mod.language && <div className="mnlp-module-lang">{mod.language}</div>}
                  {mod.entry && <div className="mnlp-module-entry">{mod.entry}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  private _renderDependencies(dependencies: ParsedDependency[]): JSX.Element | null {
    if (dependencies.length === 0) return null;

    const isExpanded = this.state.expandedSections.has("dependencies");

    return (
      <div className="mnlp-section">
        <div className="mnlp-section-header" onClick={() => this._toggleSection("dependencies")}>
          <span className="mnlp-toggle">{isExpanded ? "▼" : "▶"}</span>
          <span className="mnlp-section-icon"><SectionIcon type="link" /></span>
          <span className="mnlp-section-title">Dependencies</span>
          <span className="mnlp-count">{dependencies.length}</span>
        </div>
        {isExpanded && (
          <div className="mnlp-section-content">
            {dependencies.map((dep, index) => (
              <div key={index} className="mnlp-dep-item">
                <span className="mnlp-dep-icon"><SectionIcon type="link" /></span>
                <div className="mnlp-dep-info">
                  <div className="mnlp-dep-name">
                    {dep.moduleName || (dep.uuid ? dep.uuid.substring(0, 8) + "..." : "Unknown")}
                  </div>
                  <div className="mnlp-dep-version">v{dep.version}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  private _renderCapabilities(capabilities: string[]): JSX.Element | null {
    if (capabilities.length === 0) return null;

    const isExpanded = this.state.expandedSections.has("capabilities");

    return (
      <div className="mnlp-section">
        <div className="mnlp-section-header" onClick={() => this._toggleSection("capabilities")}>
          <span className="mnlp-toggle">{isExpanded ? "▼" : "▶"}</span>
          <span className="mnlp-section-icon"><SectionIcon type="sparkle" /></span>
          <span className="mnlp-section-title">Capabilities</span>
          <span className="mnlp-count">{capabilities.length}</span>
        </div>
        {isExpanded && (
          <div className="mnlp-section-content">
            <div className="mnlp-capabilities-list">
              {capabilities.map((cap, index) => (
                <span key={index} className="mnlp-capability-tag">
                  {cap}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  render(): JSX.Element {
    const { darkTheme, maxHeight } = this.props;
    const { isLoaded, manifestData } = this.state;

    const containerClass = `mnlp-container ${darkTheme ? "mnlp-dark" : "mnlp-light"}`;
    const style = maxHeight ? { maxHeight: `${maxHeight}px` } : undefined;

    if (!isLoaded) {
      return (
        <div className={containerClass} style={style}>
          <div className="mnlp-loading">Loading manifest...</div>
        </div>
      );
    }

    if (!manifestData) {
      return (
        <div className={containerClass} style={style}>
          <div className="mnlp-error">
            <span className="mnlp-error-icon"><SectionIcon type="warning" /></span>
            <span>No manifest data loaded</span>
          </div>
        </div>
      );
    }

    return (
      <div className={containerClass} style={style}>
        {this._renderHeader(manifestData)}
        <div className="mnlp-sections">
          {this._renderMetadata(manifestData)}
          {this._renderModules(manifestData.modules)}
          {this._renderDependencies(manifestData.dependencies)}
          {this._renderCapabilities(manifestData.capabilities)}
        </div>
      </div>
    );
  }
}
