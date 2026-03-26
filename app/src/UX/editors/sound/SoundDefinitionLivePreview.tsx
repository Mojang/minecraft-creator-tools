// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * SoundDefinitionLivePreview - Compact live preview for sound definition files
 *
 * Shows sound definitions with categories, sounds, and properties in a
 * hierarchical format with click-to-navigate support.
 */

import React, { Component } from "react";
import SectionIcon from "../../shared/components/icons/SectionIcon";
import "./SoundDefinitionLivePreview.css";

export interface ISoundDefinitionLivePreviewProps {
  jsonData?: any;
  identifier?: string;
  darkTheme?: boolean;
  onNavigate?: (path: string) => void;
  maxHeight?: number;
}

interface SoundFile {
  name: string;
  volume?: number;
  pitch?: number;
  weight?: number;
  stream?: boolean;
  loadOnLowMemory?: boolean;
}

interface SoundDefinition {
  id: string;
  category?: string;
  sounds: SoundFile[];
  minDistance?: number;
  maxDistance?: number;
}

interface ParsedSoundData {
  formatVersion: string;
  definitions: SoundDefinition[];
}

interface ISoundDefinitionLivePreviewState {
  isLoaded: boolean;
  soundData: ParsedSoundData | null;
  expandedSections: Set<string>;
}

export default class SoundDefinitionLivePreview extends Component<
  ISoundDefinitionLivePreviewProps,
  ISoundDefinitionLivePreviewState
> {
  constructor(props: ISoundDefinitionLivePreviewProps) {
    super(props);
    this.state = {
      isLoaded: false,
      soundData: null,
      expandedSections: new Set(["definitions"]),
    };
  }

  componentDidMount(): void {
    this._loadDefinition();
  }

  componentDidUpdate(prevProps: ISoundDefinitionLivePreviewProps): void {
    if (prevProps.jsonData !== this.props.jsonData) {
      this._loadDefinition();
    }
  }

  private _loadDefinition(): void {
    try {
      if (!this.props.jsonData) {
        this.setState({ isLoaded: true, soundData: null });
        return;
      }

      const json = this.props.jsonData;
      const formatVersion = json.format_version || "unknown";
      const soundDefinitions = json.sound_definitions || json;
      const definitions: SoundDefinition[] = [];

      for (const [id, def] of Object.entries(soundDefinitions)) {
        if (id === "format_version") continue;

        const soundDef = def as any;
        const sounds: SoundFile[] = [];

        if (soundDef.sounds) {
          for (const sound of soundDef.sounds) {
            if (typeof sound === "string") {
              sounds.push({ name: sound });
            } else if (typeof sound === "object") {
              sounds.push({
                name: sound.name || sound.sound || "unknown",
                volume: sound.volume,
                pitch: sound.pitch,
                weight: sound.weight,
                stream: sound.stream,
                loadOnLowMemory: sound.load_on_low_memory,
              });
            }
          }
        }

        definitions.push({
          id,
          category: soundDef.category,
          sounds,
          minDistance: soundDef.min_distance,
          maxDistance: soundDef.max_distance,
        });
      }

      // Sort definitions alphabetically
      definitions.sort((a, b) => a.id.localeCompare(b.id));

      this.setState({
        isLoaded: true,
        soundData: { formatVersion, definitions },
      });
    } catch {
      this.setState({ isLoaded: true, soundData: null });
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

  private _shortenSoundName(name: string): string {
    if (!name) return "unknown";
    return name.replace(/^sounds\//, "").replace(/\.ogg$|\.wav$|\.fsb$/, "");
  }

  private _getCategoryIcon(category: string): React.ReactNode {
    switch (category?.toLowerCase()) {
      case "hostile":
        return <SectionIcon type="error" />;
      case "neutral":
        return <SectionIcon type="figure" />;
      case "player":
        return <SectionIcon type="person" />;
      case "ambient":
        return <SectionIcon type="tree" />;
      case "block":
        return <SectionIcon type="block" />;
      case "bucket":
      case "bottle":
        return <SectionIcon type="flask" />;
      case "ui":
        return <SectionIcon type="grid" />;
      case "weather":
        return <SectionIcon type="sun" />;
      case "music":
      case "record":
        return <SectionIcon type="music" />;
      default:
        return <SectionIcon type="folder" />;
    }
  }

  private _renderHeader(): JSX.Element {
    const { soundData } = this.state;
    const identifier = this.props.identifier || "Sound Definitions";
    const shortId = identifier.includes("/") ? identifier.split("/").pop() : identifier;
    const defCount = soundData?.definitions.length || 0;

    return (
      <div className="sdlp-header">
        <div className="sdlp-icon"><SectionIcon type="speaker" /></div>
        <div className="sdlp-title">
          <div className="sdlp-name">{this._toTitleCase(shortId?.replace(".json", "") || "")}</div>
          <div className="sdlp-id">
            {defCount} sound definition{defCount !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    );
  }

  private _renderDefinitions(): JSX.Element | null {
    const { soundData } = this.state;
    if (!soundData || soundData.definitions.length === 0) return null;

    // Group definitions by category
    const byCategory: { [key: string]: SoundDefinition[] } = {};
    for (const def of soundData.definitions) {
      const cat = def.category || "other";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(def);
    }

    const categories = Object.keys(byCategory).sort();

    return (
      <div className="sdlp-definitions">
        {categories.map((category) => this._renderCategory(category, byCategory[category]))}
      </div>
    );
  }

  private _renderCategory(category: string, definitions: SoundDefinition[]): JSX.Element {
    const isExpanded = this.state.expandedSections.has(`cat-${category}`);

    return (
      <div key={category} className="sdlp-category">
        <div className="sdlp-category-header" onClick={() => this._toggleSection(`cat-${category}`)}>
          <span className="sdlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span className="sdlp-category-icon">{this._getCategoryIcon(category)}</span>
          <span className="sdlp-category-name">{this._toTitleCase(category)}</span>
          <span className="sdlp-badge">{definitions.length}</span>
        </div>
        {isExpanded && (
          <div className="sdlp-category-items">{definitions.map((def) => this._renderDefinition(def))}</div>
        )}
      </div>
    );
  }

  private _renderDefinition(def: SoundDefinition): JSX.Element {
    const defKey = `def-${def.id}`;
    const isExpanded = this.state.expandedSections.has(defKey);

    return (
      <div key={def.id} className="sdlp-definition">
        <div
          className="sdlp-def-header sdlp-clickable"
          onClick={() => {
            this._toggleSection(defKey);
            this.props.onNavigate?.(`sound_definitions/${def.id}`);
          }}
          title={`Go to ${def.id}`}
        >
          <span className="sdlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span className="sdlp-def-id">{def.id}</span>
          <span className="sdlp-def-count">
            {def.sounds.length} sound{def.sounds.length !== 1 ? "s" : ""}
          </span>
        </div>
        {isExpanded && def.sounds.length > 0 && (
          <div className="sdlp-sounds">{def.sounds.map((sound, idx) => this._renderSound(sound, def.id, idx))}</div>
        )}
      </div>
    );
  }

  private _renderSound(sound: SoundFile, defId: string, index: number): JSX.Element {
    return (
      <div
        key={index}
        className="sdlp-sound sdlp-clickable"
        onClick={() => this.props.onNavigate?.(`sound_definitions/${defId}/sounds/${index}`)}
        title={sound.name}
      >
        <span className="sdlp-sound-icon"><SectionIcon type="music" /></span>
        <span className="sdlp-sound-name">{this._shortenSoundName(sound.name)}</span>
        {sound.volume !== undefined && (
          <span className="sdlp-sound-prop" title="Volume">
            <SectionIcon type="speaker" /> {sound.volume}
          </span>
        )}
        {sound.pitch !== undefined && (
          <span className="sdlp-sound-prop" title="Pitch">
            <SectionIcon type="music" /> {sound.pitch}
          </span>
        )}
        {sound.weight !== undefined && (
          <span className="sdlp-sound-prop" title="Weight">
            <SectionIcon type="scale" /> {sound.weight}
          </span>
        )}
        {sound.stream && (
          <span className="sdlp-sound-prop" title="Streaming">
            <SectionIcon type="broadcast" />
          </span>
        )}
      </div>
    );
  }

  private _toTitleCase(str: string): string {
    return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  render(): JSX.Element {
    const { darkTheme, maxHeight } = this.props;
    const { isLoaded, soundData } = this.state;

    const containerClass = `sdlp-container ${darkTheme ? "sdlp-dark" : "sdlp-light"}`;
    const style: React.CSSProperties = maxHeight ? { maxHeight, overflowY: "auto" } : {};

    if (!isLoaded) {
      return (
        <div className={containerClass} style={style}>
          <div className="sdlp-loading">Loading sound definitions...</div>
        </div>
      );
    }

    if (!soundData || soundData.definitions.length === 0) {
      return (
        <div className={containerClass} style={style}>
          <div className="sdlp-error"><SectionIcon type="warning" /> No sound definitions loaded</div>
        </div>
      );
    }

    return (
      <div className={containerClass} style={style}>
        {this._renderHeader()}
        {this._renderDefinitions()}
      </div>
    );
  }
}
