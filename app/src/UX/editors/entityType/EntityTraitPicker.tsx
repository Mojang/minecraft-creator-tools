// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * EntityTraitPicker — Reusable trait picker panel for entity types.
 *
 * Used in both the Content Wizard (for new mobs) and the Entity Type Editor
 * (for existing mobs). When used in the editor, it auto-detects the current
 * trait state from the entity's components via TraitDetector.
 *
 * Architecture:
 * - Reads traits from TraitData.ts (shared definitions)
 * - Renders the same Minecraft-style beveled card grid with grouped sections
 * - Detects current traits via TraitDetector.detectEntityTraits() when an
 *   EntityTypeDefinition is provided
 * - Calls onTraitsChanged when the user toggles a trait
 *
 * Related files:
 * - TraitData.ts — Shared trait definitions, grouping, toggle logic
 * - TraitIcons.tsx — SVG icons for each trait
 * - ContentWizard.tsx — Uses this same trait picker in the wizard flow
 * - TraitDetector.ts — Detects traits from raw entity component data
 * - ContentWizard.css — CSS classes (cwiz-trait*) used for styling
 */

import { Component } from "react";
import "../../home/ContentWizard.css";
import { EntityTraitId } from "../../../minecraft/IContentMetaSchema";
import EntityTypeDefinition from "../../../minecraft/EntityTypeDefinition";
import TraitDetector from "../../../minecraft/TraitDetector";
import { ITraitDetectionResult } from "../../../minecraft/TraitDetector";
import { renderEntityTraitIcon } from "../../shared/components/icons/TraitIcons";
import {
  ITraitInfo,
  EXCLUSIVE_GROUP_LABELS,
  EXCLUSIVE_GROUP_ICONS,
  getTraitIconColor,
  groupEntityTraits,
  toggleEntityTrait,
} from "../../types/TraitData";
import IProjectTheme from "../../types/IProjectTheme";

// ============================================================================
// PROPS & STATE
// ============================================================================

interface IEntityTraitPickerProps {
  /** Entity type definition to detect current traits from. */
  entityType?: EntityTypeDefinition;

  /** Externally managed trait list (e.g., from wizard state). */
  traits?: EntityTraitId[];

  /** Called when traits are toggled by the user. */
  onTraitsChanged?: (traits: EntityTraitId[]) => void;

  /** Theme for styling. */
  theme: IProjectTheme;

  /** If true, traits cannot be toggled. */
  readOnly?: boolean;
}

interface IEntityTraitPickerState {
  /** Currently active traits. */
  activeTraits: EntityTraitId[];

  /** Detection results with confidence scores (only when reading from entity). */
  detectionResults: ITraitDetectionResult<EntityTraitId>[];
}

// ============================================================================
// COMPONENT
// ============================================================================

export default class EntityTraitPicker extends Component<IEntityTraitPickerProps, IEntityTraitPickerState> {
  constructor(props: IEntityTraitPickerProps) {
    super(props);

    this.state = {
      activeTraits: props.traits || [],
      detectionResults: [],
    };
  }

  componentDidMount(): void {
    this._detectTraits();
  }

  componentDidUpdate(prevProps: IEntityTraitPickerProps): void {
    // Re-detect if the entity definition changed
    if (prevProps.entityType !== this.props.entityType) {
      this._detectTraits();
    }

    // Sync externally-managed traits
    if (prevProps.traits !== this.props.traits && this.props.traits) {
      const newTraits = this.props.traits;
      this.setState({ activeTraits: newTraits });
    }
  }

  /**
   * Detect traits from the entity definition's components.
   */
  private _detectTraits(): void {
    const et = this.props.entityType;
    if (!et || !et._data) {
      return;
    }

    const components = et._data.components || {};
    const componentGroups = et._data.component_groups || {};

    // Build raw component group map for TraitDetector
    const rawComponentGroups: Record<string, Record<string, any>> = {};
    for (const [groupName, groupData] of Object.entries(componentGroups)) {
      if (groupData && typeof groupData === "object") {
        rawComponentGroups[groupName] = groupData as Record<string, any>;
      }
    }

    const results = TraitDetector.detectEntityTraits(components, rawComponentGroups, 0.6);
    const detectedIds = results.map((r) => r.traitId);

    this.setState({
      activeTraits: detectedIds,
      detectionResults: results,
    });
  }

  /**
   * Get confidence label for a detected trait.
   */
  private _getConfidenceLabel(traitId: string): string | undefined {
    const result = this.state.detectionResults.find((r) => r.traitId === traitId);
    if (!result) return undefined;

    if (result.confidence >= 0.8) return "Strong match";
    if (result.confidence >= 0.6) return "Detected";
    return "Possible";
  }

  private _handleTraitClick = (trait: ITraitInfo): void => {
    if (this.props.readOnly) return;

    const newTraits = toggleEntityTrait(this.state.activeTraits, trait.id as EntityTraitId);
    this.setState({ activeTraits: newTraits });

    if (this.props.onTraitsChanged) {
      this.props.onTraitsChanged(newTraits);
    }
  };

  render(): JSX.Element {
    const groupedTraits = groupEntityTraits();
    const isFromEntity = !!this.props.entityType;

    return (
      <div className="cwiz-step-content" style={{ padding: "16px 20px" }}>
        <div className="cwiz-field-hint cwiz-traits-hint">
          {isFromEntity
            ? "Traits detected from this mob's components. Toggle traits to change behaviors."
            : "Traits are pre-packaged bundles of behaviors. Select the ones that match your mob."}
        </div>
        {groupedTraits.map((section) => (
          <div key={section.group || "other"} className="cwiz-trait-section">
            {section.group && (
              <div className="cwiz-trait-group-header">
                <span className="cwiz-trait-group-icon">{EXCLUSIVE_GROUP_ICONS[section.group] || ""}</span>
                {EXCLUSIVE_GROUP_LABELS[section.group] || section.group}
                <span className="cwiz-trait-group-line" />
              </div>
            )}
            {!section.group && (
              <div className="cwiz-trait-group-header">
                Additional Traits
                <span className="cwiz-trait-group-line" />
              </div>
            )}
            <div className="cwiz-traits-grid">
              {section.traits.map((trait) => {
                const isSelected = this.state.activeTraits.includes(trait.id as EntityTraitId);
                const confidenceLabel = isFromEntity ? this._getConfidenceLabel(trait.id) : undefined;

                return (
                  <div
                    key={trait.id}
                    className={`cwiz-trait ${isSelected ? "cwiz-trait-selected" : ""}`}
                    onClick={() => this._handleTraitClick(trait)}
                    title={confidenceLabel ? `${trait.description} (${confidenceLabel})` : trait.description}
                  >
                    <div className="cwiz-trait-icon" style={{ color: getTraitIconColor(trait) }}>
                      {renderEntityTraitIcon(trait.id)}
                    </div>
                    <div className="cwiz-trait-text">
                      <div className="cwiz-trait-label">{trait.label}</div>
                      <div className="cwiz-trait-desc">{trait.description}</div>
                    </div>
                    {isSelected && <div className="cwiz-trait-check">&#10003;</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }
}
