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
 * - Resolves current traits via resolveEntityTraits() when an
 *   EntityTypeDefinition is provided: component-based detection with the
 *   item's tool-only choices (body shape) applied on top
 * - Calls onTraitsChanged when the user toggles a trait, then re-detects from
 *   the entity so the cards always show what is really in the JSON (the
 *   editor applies the toggle synchronously). Showing the optimistic toggle
 *   result instead let the picker drift from the file: a temperament that
 *   the entity's own component groups kept re-asserting looked selected
 *   alongside the one the user just picked, and reverted on the next visit.
 * - Shows the editor's IEntityTraitChangeReport for the last toggle when it
 *   touched the mob's own hand-written content (an authored anger timer
 *   that went when Hostile replaced Neutral, entries put back, entries that
 *   could not be), so a creator is told what changed rather than finding
 *   out from a diff.
 *
 * Related files:
 * - TraitData.ts — Shared trait definitions, grouping, toggle logic
 * - TraitIcons.tsx — SVG icons for each trait
 * - ContentWizard.tsx — Uses this same trait picker in the wizard flow
 * - TraitDetector.ts — Detects traits from raw entity component data
 * - ContentWizard.css — CSS classes (cwiz-trait*) used for styling
 */

import { Component } from "react";
import { Alert, AlertTitle } from "@mui/material";
import "../../home/ContentWizard.css";
import { EntityTraitId } from "../../../minecraft/IContentMetaSchema";
import EntityTypeDefinition from "../../../minecraft/EntityTypeDefinition";
import { ITraitDetectionResult } from "../../../minecraft/TraitDetector";
import {
  IAuthoredEdit,
  IEntityTraitChangeReport,
  IEntityTraitOverrides,
  resolveEntityTraits,
  traitChangeTouchedAuthoredContent,
} from "../../../minecraft/EntityTraitApplier";
import { renderEntityTraitIcon } from "../../shared/components/icons/TraitIcons";
import SectionHeading from "../../shared/components/feedback/sectionHeading/SectionHeading";
import {
  ITraitInfo,
  ENTITY_TRAITS,
  EXCLUSIVE_GROUP_LABELS,
  EXCLUSIVE_GROUP_ICONS,
  getTraitIconColor,
  groupEntityTraits,
  toggleEntityTrait,
  getTraitCardThemeStyle,
} from "../../types/TraitData";
import IProjectTheme from "../../types/IProjectTheme";
import { clickableKeyHandler } from "../../shared/accessibilityUtils";

// ============================================================================
// PROPS & STATE
// ============================================================================

interface IEntityTraitPickerProps {
  /** Entity type definition to detect current traits from. */
  entityType?: EntityTypeDefinition;

  /**
   * Tool-only trait choices kept outside the entity file (the body shape the
   * creator picked); the project item carries them. Applied on top of
   * detection so the cards show what the creator chose.
   */
  traitOverrides?: IEntityTraitOverrides;

  /** Externally managed trait list (e.g., from wizard state). */
  traits?: EntityTraitId[];

  /** Called when traits are toggled by the user. */
  onTraitsChanged?: (traits: EntityTraitId[]) => void;

  /**
   * What the last toggle did to the mob's own content, as returned by
   * applyEntityTraitChanges. Shown above the cards until dismissed or
   * replaced by the next toggle.
   */
  changeReport?: IEntityTraitChangeReport;

  /** Called when the user closes the change report. */
  onChangeReportDismissed?: () => void;

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

    const results = resolveEntityTraits(et, this.props.traitOverrides, 0.6);
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

    // A rejected toggle (clicking the selected body shape) changes nothing,
    // so nothing may be applied to the entity either.
    if (
      newTraits.length === this.state.activeTraits.length &&
      newTraits.every((t, i) => t === this.state.activeTraits[i])
    ) {
      return;
    }

    this.setState({ activeTraits: newTraits });

    if (this.props.onTraitsChanged) {
      this.props.onTraitsChanged(newTraits);
    }

    if (this.props.entityType) {
      this._detectTraits();
    }
  };

  private static _traitLabel(traitId: string): string {
    return ENTITY_TRAITS.find((t) => t.id === traitId)?.label || traitId;
  }

  private static _describeEdit(edit: IAuthoredEdit): string {
    if (edit.kind === "componentGroup") {
      return "component group " + edit.id;
    }
    if (edit.kind === "eventGroup") {
      return (edit.action === "remove" ? "removal of " : "") + edit.id + " in event " + edit.event;
    }
    if (edit.kind === "family") {
      return edit.id + " family" + (edit.group ? " in " + edit.group : "");
    }
    return edit.group ? edit.id + " in " + edit.group : edit.id;
  }

  private static _joinTraitLabels(traitIds: string[]): string {
    return traitIds.map((t) => EntityTraitPicker._traitLabel(t)).join(", ");
  }

  /**
   * One line per thing the last toggle did to the mob's own content.
   * Canonical trait data coming and going is routine and not reported.
   */
  private _renderChangeReport(): JSX.Element | undefined {
    const report = this.props.changeReport;
    if (!report || !traitChangeTouchedAuthoredContent(report)) {
      return undefined;
    }

    const lines: JSX.Element[] = [];
    const list = (edits: IAuthoredEdit[]) => edits.map((e) => EntityTraitPicker._describeEdit(e)).join(", ");
    const cause =
      report.added.length > 0
        ? "Selecting " + EntityTraitPicker._joinTraitLabels(report.added)
        : "Deselecting " + EntityTraitPicker._joinTraitLabels(report.removed);

    if (report.removedAuthored.length > 0) {
      const restoreWith = report.removed.length > 0 ? EntityTraitPicker._joinTraitLabels(report.removed) : undefined;
      lines.push(
        <div key="removed">
          {cause} removed this mob's own {list(report.removedAuthored)}.
          {restoreWith ? " Select " + restoreWith + " again to put it back." : ""}
        </div>
      );
    }

    if (report.restoredAuthored.length > 0) {
      lines.push(
        <div key="restored">
          {cause} put back this mob's own {list(report.restoredAuthored)}.
        </div>
      );
    }

    if (report.unrestoredAuthored.length > 0) {
      lines.push(
        <div key="unrestored">
          Could not put back {list(report.unrestoredAuthored)}: something else is there now. It stays saved with the
          project and comes back once that slot is free.
        </div>
      );
    }

    const severity = report.removedAuthored.length > 0 || report.unrestoredAuthored.length > 0 ? "warning" : "info";

    return (
      <Alert severity={severity} onClose={this.props.onChangeReportDismissed} sx={{ mb: 2 }}>
        <AlertTitle>This mob's own content changed</AlertTitle>
        {lines}
      </Alert>
    );
  }

  render(): JSX.Element {
    const groupedTraits = groupEntityTraits();
    const isFromEntity = !!this.props.entityType;

    return (
      <div className="cwiz-step-content" style={{ padding: "16px 20px", ...getTraitCardThemeStyle(this.props.theme) }}>
        <div className="cwiz-field-hint cwiz-traits-hint">
          {isFromEntity
            ? "Traits detected from this mob's components. Toggle traits to change behaviors."
            : "Traits are pre-packaged bundles of behaviors. Select the ones that match your mob."}
        </div>
        {this._renderChangeReport()}
        {groupedTraits.map((section) => (
          <div key={section.group || "other"} className="cwiz-trait-section">
            {section.group && (
              <SectionHeading level={3} className="cwiz-trait-group-header">
                <span className="cwiz-trait-group-icon">{EXCLUSIVE_GROUP_ICONS[section.group] || ""}</span>
                {EXCLUSIVE_GROUP_LABELS[section.group] || section.group}
                <span className="cwiz-trait-group-line" />
              </SectionHeading>
            )}
            {!section.group && (
              <SectionHeading level={3} className="cwiz-trait-group-header">
                Additional Traits
                <span className="cwiz-trait-group-line" />
              </SectionHeading>
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
                    aria-pressed={isSelected}
                    title={confidenceLabel ? `${trait.description} (${confidenceLabel})` : trait.description}
                    {...clickableKeyHandler(() => this._handleTraitClick(trait))}
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
