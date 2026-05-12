/**
 * ========================================================================
 * ARCHITECTURE: DataFormComponentAccordion
 * ========================================================================
 *
 * A reusable accordion that shows ALL available components for a given
 * form category. Components that the definition already has are shown
 * expanded with their DataForm editor; absent components are collapsed
 * placeholders that auto-add when clicked.
 *
 * DESIGN:
 * - Loads all minecraft_*.form.json files from a form category folder
 * - For each, checks if the IManagedComponentSetItem has that component
 * - Present components: green left border, "active" badge, expanded
 * - Absent components: dimmed, "click to add" badge, collapsed
 * - Clicking a collapsed section adds the component with defaults
 * - Remove button on present components strips them from the data
 *
 * GOOD FOR: Definition types with ≤30 components (biome, client_biome).
 * For types with hundreds of components (entity), use the categorized
 * component bin pattern (EntityTypeComponentSetEditor) instead.
 *
 * RELATED FILES:
 * - src/dataform/DataFormUtilities.ts — generateDefaultItem, isDefaultOrEmpty
 * - src/dataformux/DataForm.tsx — renders individual component forms
 * - src/minecraft/IManagedComponentSetItem.ts — component get/add/remove
 * - src/UX/editors/biome/BiomeEditor.tsx — primary consumer
 *
 * ========================================================================
 */

import { Component } from "react";
import "./DataFormComponentAccordion.css";
import DataForm from "./DataForm";
import Database from "../minecraft/Database";
import DataFormUtilities from "../dataform/DataFormUtilities";
import IManagedComponentSetItem from "../minecraft/IManagedComponentSetItem";
import Utilities from "../core/Utilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faChevronDown, faMinus } from "@fortawesome/free-solid-svg-icons";
import { getThemeColors } from "../UX/hooks/theme/useThemeColors";
import IProjectTheme from "../UX/types/IProjectTheme";
import IFormDefinition from "../dataform/IFormDefinition";

interface IComponentEntry {
  /** Canonical component id, e.g. "minecraft:climate" */
  canonName: string;
  /** Form base file name without .form.json, e.g. "minecraft_climate" */
  formBaseName: string;
  /** Human-readable display name */
  displayName: string;
  /** Form description text */
  description: string;
  /** Loaded form definition */
  form: IFormDefinition;
}

export interface IDataFormComponentAccordionProps {
  /** The definition that owns the components (biome, block, item, etc.) */
  componentSetItem: IManagedComponentSetItem;
  /** Form category folder name, e.g. "biome", "client_biome", "block_components" */
  formCategory: string;
  theme: IProjectTheme;
  readOnly: boolean;
  /** Height CSS value for the scrollable container */
  maxHeight?: string;
}

interface IDataFormComponentAccordionState {
  availableComponents: IComponentEntry[] | undefined;
  expandedIds: Set<string>;
  isLoaded: boolean;
}

export default class DataFormComponentAccordion extends Component<
  IDataFormComponentAccordionProps,
  IDataFormComponentAccordionState
> {
  constructor(props: IDataFormComponentAccordionProps) {
    super(props);

    this._toggleSection = this._toggleSection.bind(this);
    this._removeComponent = this._removeComponent.bind(this);

    this.state = {
      availableComponents: undefined,
      expandedIds: new Set<string>(),
      isLoaded: false,
    };
  }

  componentDidMount() {
    this._loadAvailableComponents();
  }

  componentDidUpdate(prevProps: IDataFormComponentAccordionProps) {
    if (
      prevProps.formCategory !== this.props.formCategory ||
      prevProps.componentSetItem !== this.props.componentSetItem
    ) {
      this.setState({ availableComponents: undefined, isLoaded: false }, () => {
        this._loadAvailableComponents();
      });
    }
  }

  async _loadAvailableComponents() {
    const formsFolder = await Database.getFormsFolder(this.props.formCategory);
    const entries: IComponentEntry[] = [];

    for (const fileName in formsFolder.files) {
      if (fileName.startsWith("minecraft") && fileName.endsWith(".form.json")) {
        const baseName = fileName.substring(0, fileName.length - 10); // strip .form.json
        const form = await Database.ensureFormLoaded(this.props.formCategory, baseName);

        if (form && !form.isDeprecated && !form.isInternal) {
          // Convert form base name to canonical component id:
          // minecraft_climate -> minecraft:climate
          let shortName = baseName;
          if (shortName.startsWith("minecraft_")) {
            shortName = shortName.substring(10);
          }
          const canonName = "minecraft:" + shortName;

          entries.push({
            canonName,
            formBaseName: baseName,
            displayName: form.title || Utilities.humanifyMinecraftName(canonName),
            description: form.description || "",
            form,
          });
        }
      }
    }

    entries.sort((a, b) => a.displayName.localeCompare(b.displayName));

    // Auto-expand components that already exist in the definition
    const expanded = new Set<string>();
    for (const entry of entries) {
      if (this.props.componentSetItem.getComponent(entry.canonName)) {
        expanded.add(entry.canonName);
      }
    }

    this.setState({
      availableComponents: entries,
      expandedIds: expanded,
      isLoaded: true,
    });
  }

  _toggleSection(canonName: string) {
    const expanded = new Set(this.state.expandedIds);

    if (expanded.has(canonName)) {
      expanded.delete(canonName);
    } else {
      expanded.add(canonName);

      // If the component doesn't exist yet, auto-add it with defaults
      if (!this.props.componentSetItem.getComponent(canonName)) {
        const entry = this.state.availableComponents?.find((e) => e.canonName === canonName);
        if (entry) {
          const defaultData = DataFormUtilities.generateDefaultItem(entry.form);
          this.props.componentSetItem.addComponent(canonName, defaultData);
        }
      }
    }

    this.setState({ expandedIds: expanded });
  }

  _removeComponent(canonName: string, e: React.MouseEvent) {
    e.stopPropagation();

    this.props.componentSetItem.removeComponent(canonName);

    const expanded = new Set(this.state.expandedIds);
    expanded.delete(canonName);
    this.setState({ expandedIds: expanded });
  }

  render() {
    if (!this.state.isLoaded || !this.state.availableComponents) {
      return <div className="dfca-loading">Loading components...</div>;
    }

    const colors = getThemeColors();
    const style: React.CSSProperties = {
      backgroundColor: colors.contentBackground,
      color: colors.contentForeground,
    };

    if (this.props.maxHeight) {
      style.maxHeight = this.props.maxHeight;
      style.overflowY = "auto";
    }

    return (
      <div className="dfca-outer" style={style}>
        {this.state.availableComponents.map((entry) => {
          const component = this.props.componentSetItem.getComponent(entry.canonName);
          const isPresent = component !== undefined;
          const isExpanded = this.state.expandedIds.has(entry.canonName);

          return (
            <div
              key={entry.canonName}
              className={`dfca-section ${isPresent ? "dfca-present" : "dfca-absent"}`}
              style={{
                backgroundColor: colors.sectionHeaderBackground,
                borderColor: colors.sectionBorder,
              }}
            >
              <div
                className="dfca-header"
                onClick={() => this._toggleSection(entry.canonName)}
                title={entry.description}
              >
                <span className="dfca-chevron">
                  <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} />
                </span>
                <span className="dfca-title">{entry.displayName}</span>
                {isPresent && <span className="dfca-badge dfca-badge-present">active</span>}
                {!isPresent && <span className="dfca-badge dfca-badge-absent">click to add</span>}
                {isPresent && !this.props.readOnly && (
                  <button
                    className="dfca-removeBtn"
                    onClick={(e) => this._removeComponent(entry.canonName, e)}
                    title="Remove component"
                    type="button"
                  >
                    <FontAwesomeIcon icon={faMinus} />
                  </button>
                )}
              </div>
              {isExpanded && component && (
                <div className="dfca-body">
                  {entry.description && <div className="dfca-description">{entry.description}</div>}
                  <DataForm
                    key={"dfca-" + entry.canonName}
                    definition={entry.form}
                    directObject={component.getData()}
                    readOnly={this.props.readOnly}
                    theme={this.props.theme}
                    objectKey={entry.canonName}
                    displayTitle={false}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
}
