// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { useState } from "react";
import { Select, MenuItem, TextField, Slider } from "@mui/material";
import { EntityTraitId, GeometryTemplateType, IMinecraftContentDefinition } from "../../minecraft/IContentMetaSchema";
import Project from "../../app/Project";
import { ProjectItemType } from "../../app/IProjectItemData";
import EntityTraitPicker from "../editors/entityType/EntityTraitPicker";
import { ENTITY_TRAITS, ITraitInfo } from "../types/TraitData";
import { BODY_TYPES, renderBodyTypeIcon } from "../shared/components/icons/BodyTypeIcons";
import IProjectTheme from "../types/IProjectTheme";
import WizardFrame from "./WizardFrame";
import { WithLocalizationProps, withLocalization } from "../withLocalization";
import "./ContentWizard.css";

// ============================================================================
// INTERFACES
// ============================================================================

export interface IEntityWizardProps extends WithLocalizationProps {
  project: Project;
  theme: IProjectTheme;
  showProjectNameStep?: boolean;
  onComplete: (definition: IMinecraftContentDefinition, projectName?: string) => void;
  onCancel: () => void;
  /** Called when the user clicks Back on the first step — navigate to launcher */
  onBack: () => void;
}

// ============================================================================
// UTILITIES (entity-scoped, self-contained)
// ============================================================================

function getUniqueDefaultId(
  baseId: string,
  itemType: ProjectItemType,
  project: Project
): { id: string; displayName: string } {
  const existingItems = project.getItemsByType(itemType);
  const existingNames = new Set(
    existingItems
      .filter((item) => item.projectPath)
      .map((item) => {
        const fileName = item.projectPath!.split("/").pop() || "";
        return fileName.replace(/\.json$/i, "").toLowerCase();
      })
  );

  const toDisplayName = (id: string) =>
    id
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  if (!existingNames.has(baseId)) {
    return { id: baseId, displayName: toDisplayName(baseId) };
  }

  for (let i = 1; i <= 100; i++) {
    const candidate = `${baseId}_${i}`;
    if (!existingNames.has(candidate)) {
      return { id: candidate, displayName: toDisplayName(candidate) };
    }
  }

  return { id: baseId, displayName: toDisplayName(baseId) };
}

function generateNameFromTraits(selectedTraits: string[], traitList: ITraitInfo[]): string {
  if (selectedTraits.length === 0) {
    return "mob";
  }

  const toLabel = (id: string) => {
    const info = traitList.find((t) => t.id === id);
    return info
      ? info.label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "")
      : id;
  };

  const exclusiveTraits = selectedTraits.filter((id) => traitList.find((t) => t.id === id)?.exclusiveGroup);
  const behaviorTraits = selectedTraits.filter((id) => !traitList.find((t) => t.id === id)?.exclusiveGroup);

  const primary = exclusiveTraits[0] || selectedTraits[0];
  const primaryLabel = toLabel(primary);

  if (behaviorTraits.length > 0 && exclusiveTraits.length > 0) {
    const modifier = toLabel(behaviorTraits[0]);
    const candidate = `${modifier}_${primaryLabel}_mob`;
    if (candidate.length <= 20) {
      return candidate;
    }
  }

  return `${primaryLabel}_mob`;
}

function deriveBodyTypeFromTraits(traits: EntityTraitId[]): string | undefined {
  const bodyTypeTraitIds = new Set(BODY_TYPES.map((bt) => bt.id));
  for (const t of traits) {
    if (bodyTypeTraitIds.has(t)) {
      return t;
    }
  }
  return undefined;
}

function getIdConflictError(id: string, project: Project, intl: WithLocalizationProps["intl"]): string | undefined {
  if (!id || !project) return undefined;

  const namespace = project.effectiveDefaultNamespace || "custom";
  const fullId = `${namespace}:${id}`;
  const existingItems = project.getItemsByType(ProjectItemType.entityTypeBehavior);

  for (const item of existingItems) {
    if (item.projectPath) {
      const fileName = item.projectPath.split("/").pop() || "";
      const fileBaseName = fileName.replace(/\.json$/i, "").toLowerCase();
      if (fileBaseName === id.toLowerCase()) {
        return intl.formatMessage({ id: "wizard.id_conflict" }, { contentLabel: "mob", fullId });
      }
    }
  }

  return undefined;
}

// ============================================================================
// COMPONENT
// ============================================================================

const MAX_BASE_STEPS = 4; // Traits, Name, Stats, Appearance

function EntityWizardInner({
  project,
  theme,
  showProjectNameStep,
  onComplete,
  onCancel,
  onBack,
  intl,
}: IEntityWizardProps) {
  const maxSteps = MAX_BASE_STEPS + (showProjectNameStep ? 1 : 0);

  const [step, setStep] = useState(0);
  const [entityId, setEntityId] = useState(
    () => getUniqueDefaultId("mob", ProjectItemType.entityTypeBehavior, project).id
  );
  const [entityDisplayName, setEntityDisplayName] = useState(
    () => getUniqueDefaultId("mob", ProjectItemType.entityTypeBehavior, project).displayName
  );
  const [entityIdManuallyEdited, setEntityIdManuallyEdited] = useState(false);
  const [entityTraits, setEntityTraits] = useState<EntityTraitId[]>([]);
  const [entityHealth, setEntityHealth] = useState(20);
  const [entityDamage, setEntityDamage] = useState(3);
  const [entitySpeed, setEntitySpeed] = useState(0.25);
  const [entityPrimaryColor, setEntityPrimaryColor] = useState("#5B8C3E");
  const [entitySecondaryColor, setEntitySecondaryColor] = useState("#3D6B2E");
  const [entityBodyType, setEntityBodyType] = useState("humanoid");
  const [entityBodyTypeManuallyEdited, setEntityBodyTypeManuallyEdited] = useState(false);
  const [projectName, setProjectName] = useState("My Add-On");

  function handleBack() {
    if (step === 0) {
      onBack();
    } else {
      setStep(step - 1);
    }
  }

  function handleNext() {
    if (step === 0 && !entityIdManuallyEdited) {
      const generated = generateNameFromTraits(entityTraits, ENTITY_TRAITS);
      const unique = getUniqueDefaultId(generated, ProjectItemType.entityTypeBehavior, project);
      setEntityId(unique.id);
      setEntityDisplayName(unique.displayName);
    }

    if (step === 1) {
      if (!entityDisplayName || entityDisplayName.trim() === "") return;
      if (getIdConflictError(entityId, project, intl)) return;
    }

    setStep(step + 1);
  }

  function handleComplete() {
    const namespace = project.effectiveDefaultNamespace || "custom";
    const definition: IMinecraftContentDefinition = {
      schemaVersion: "1.0.0",
      namespace,
      entityTypes: [
        {
          id: entityId,
          displayName: entityDisplayName,
          traits: entityTraits,
          health: entityHealth,
          attackDamage: entityDamage,
          movementSpeed: entitySpeed,
          appearance: {
            bodyType: entityBodyType as GeometryTemplateType,
            primaryColor: entityPrimaryColor,
            secondaryColor: entitySecondaryColor,
          },
        },
      ],
    };

    if (showProjectNameStep) {
      onComplete(definition, projectName);
    } else {
      onComplete(definition);
    }
  }

  const isLastStep = step >= maxSteps - 1;
  const isProjectNameStep = showProjectNameStep && isLastStep;

  let stepTitle = "";
  let stepContent: JSX.Element | null = null;

  if (!isProjectNameStep) {
    switch (step) {
      case 0:
        stepTitle = intl.formatMessage({ id: "wizard.select_traits" });
        stepContent = (
          <EntityTraitPicker
            traits={entityTraits}
            onTraitsChanged={(traits) => {
              setEntityTraits(traits);
              if (!entityBodyTypeManuallyEdited) {
                const derived = deriveBodyTypeFromTraits(traits);
                if (derived) setEntityBodyType(derived);
              }
            }}
            theme={theme}
          />
        );
        break;

      case 1: {
        stepTitle = intl.formatMessage({ id: "wizard.basic_information" });
        const idConflictError = getIdConflictError(entityId, project, intl);
        stepContent = (
          <div className="cwiz-step-content">
            <div className="cwiz-field">
              <label>{intl.formatMessage({ id: "wizard.display_name" })}</label>
              <TextField
                fullWidth
                value={entityDisplayName}
                onChange={(e) => {
                  const displayName = e.target.value || "";
                  setEntityDisplayName(displayName);
                  if (!entityIdManuallyEdited) {
                    setEntityId(
                      displayName
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "_")
                        .replace(/^_|_$/g, "") || "mob"
                    );
                  }
                }}
                placeholder={intl.formatMessage({ id: "wizard.display_name_mob_placeholder" })}
                size="small"
              />
              <div className="cwiz-field-hint">{intl.formatMessage({ id: "wizard.name_in_game_hint" })}</div>
            </div>
            <div className="cwiz-field">
              <label>{intl.formatMessage({ id: "wizard.mob_id" })}</label>
              <TextField
                fullWidth
                value={entityId}
                onChange={(e) => {
                  const sanitized = (e.target.value || "").toLowerCase().replace(/[^a-z0-9_]/g, "_");
                  setEntityId(sanitized);
                  setEntityIdManuallyEdited(true);
                }}
                placeholder={intl.formatMessage({ id: "wizard.mob_id_placeholder" })}
                size="small"
                error={!!idConflictError}
              />
              {idConflictError ? (
                <div className="cwiz-field-error">{idConflictError}</div>
              ) : (
                <div className="cwiz-field-hint">{intl.formatMessage({ id: "wizard.id_hint" })}</div>
              )}
            </div>
          </div>
        );
        break;
      }

      case 2:
        stepTitle = intl.formatMessage({ id: "wizard.mob_stats" });
        stepContent = (
          <div className="cwiz-step-content">
            <div className="cwiz-field">
              <label>{intl.formatMessage({ id: "wizard.health" }, { value: entityHealth })}</label>
              <Slider
                min={1}
                max={100}
                value={entityHealth}
                onChange={(e, value) => setEntityHealth(Number(value) || 20)}
                size="small"
              />
            </div>
            <div className="cwiz-field">
              <label>{intl.formatMessage({ id: "wizard.attack_damage" }, { value: entityDamage })}</label>
              <Slider
                min={0}
                max={20}
                value={entityDamage}
                onChange={(e, value) => setEntityDamage(Number(value) || 3)}
                size="small"
              />
            </div>
            <div className="cwiz-field">
              <label>{intl.formatMessage({ id: "wizard.movement_speed" }, { value: entitySpeed.toFixed(2) })}</label>
              <Slider
                min={0.1}
                max={1.0}
                step={0.05}
                value={entitySpeed}
                onChange={(e, value) => setEntitySpeed(Number(value) || 0.25)}
                size="small"
              />
            </div>
          </div>
        );
        break;

      case 3:
        stepTitle = intl.formatMessage({ id: "wizard.appearance" });
        stepContent = (
          <div className="cwiz-step-content">
            <div className="cwiz-field">
              <label>{intl.formatMessage({ id: "wizard.body_type" })}</label>
              <Select
                fullWidth
                value={entityBodyType}
                onChange={(e) => {
                  setEntityBodyType(e.target.value as string);
                  setEntityBodyTypeManuallyEdited(true);
                }}
                size="small"
              >
                {BODY_TYPES.map((bt) => (
                  <MenuItem key={bt.id} value={bt.id}>
                    <div className="cwiz-bodytype-option">
                      <span className="cwiz-bodytype-icon">{renderBodyTypeIcon(bt.id)}</span>
                      <div className="cwiz-bodytype-text">
                        <span className="cwiz-bodytype-label">{bt.label}</span>
                        <span className="cwiz-bodytype-desc">{bt.description}</span>
                      </div>
                    </div>
                  </MenuItem>
                ))}
              </Select>
            </div>
            <div className="cwiz-field">
              <label>{intl.formatMessage({ id: "wizard.primary_color" })}</label>
              <input type="color" value={entityPrimaryColor} onChange={(e) => setEntityPrimaryColor(e.target.value)} />
            </div>
            <div className="cwiz-field">
              <label>{intl.formatMessage({ id: "wizard.secondary_color" })}</label>
              <input
                type="color"
                value={entitySecondaryColor}
                onChange={(e) => setEntitySecondaryColor(e.target.value)}
              />
            </div>
          </div>
        );
        break;
    }
  }

  const displayTitle = isProjectNameStep ? intl.formatMessage({ id: "wizard.name_your_project" }) : stepTitle;
  const displayContent = isProjectNameStep ? (
    <div className="cwiz-step-content" style={{ padding: "16px 20px" }}>
      <div className="cwiz-field-hint" style={{ marginBottom: 16 }}>
        {intl.formatMessage({ id: "wizard.project_ready_desc" }, { typeName: "mob" })}
      </div>
      <div className="cwiz-field">
        <label>{intl.formatMessage({ id: "wizard.project_name" })}</label>
        <TextField
          fullWidth
          value={projectName}
          onChange={(e) => setProjectName(e.target.value || "")}
          placeholder={intl.formatMessage({ id: "wizard.project_name_placeholder" })}
          size="small"
          autoFocus
        />
        <div className="cwiz-field-hint">
          {intl.formatMessage({ id: "wizard.project_name_hint" }, { typeName: "mob" })}
        </div>
      </div>
    </div>
  ) : (
    stepContent
  );

  return (
    <WizardFrame
      intl={intl}
      typeName="Mob"
      title={displayTitle}
      currentStep={step}
      totalSteps={maxSteps}
      onBack={handleBack}
      onCancel={onCancel}
      onPrimary={isLastStep ? handleComplete : handleNext}
      isLastStep={isLastStep}
    >
      {displayContent}
    </WizardFrame>
  );
}

export default withLocalization(EntityWizardInner);
