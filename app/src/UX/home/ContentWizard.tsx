// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ContentWizard - Content Creation Wizards
 *
 * This component provides a fleet of wizards for creating Minecraft content
 * using the meta-schema system. Each wizard type focuses on a specific content
 * type (entity, block, item, structure, feature) and generates the appropriate
 * definition that can be passed to ContentGenerator.
 *
 * ARCHITECTURE:
 * - ContentWizardLauncher: Entry point that shows wizard type selection
 * - EntityWizard: Creates entity type definitions with traits
 * - BlockWizard: Creates block type definitions
 * - ItemWizard: Creates item type definitions
 * - StructureWizard: Creates structure definitions
 * - FeatureWizard: Creates feature/world-gen definitions
 *
 * Each wizard uses a multi-step flow:
 * 1. Basic info (name, display name)
 * 2. Trait selection (pre-packaged behaviors)
 * 3. Simplified properties (health, damage, etc.)
 * 4. Appearance (colors, textures)
 * 5. Preview and confirm
 */

import { Component } from "react";
import IAppProps from "../appShell/IAppProps";
import Project from "../../app/Project";
import "./ContentWizard.css";
import { Select, MenuItem, TextField, Slider } from "@mui/material";
import {
  IMinecraftContentDefinition,
  EntityTraitId,
  BlockTraitId,
  ItemTraitId,
} from "../../minecraft/IContentMetaSchema";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faArrowRight,
  faCheck,
  faCode,
  faTerminal,
  faChevronDown,
  faChevronRight,
  faFile,
} from "@fortawesome/free-solid-svg-icons";
import IGalleryItem, { GalleryItemType } from "../../app/IGalleryItem";
import { ProjectItemType } from "../../app/IProjectItemData";
import { ProjectScriptLanguage } from "../../app/IProjectData";
import { BODY_TYPES, renderBodyTypeIcon } from "../shared/components/icons/BodyTypeIcons";
import { renderBlockTraitIcon, renderItemTraitIcon } from "../shared/components/icons/TraitIcons";
import EntityTraitPicker from "../editors/entityType/EntityTraitPicker";
import { BLOCK_TRAITS, ITEM_TRAITS, getTraitIconColor, getTraitCardThemeStyle } from "../types/TraitData";
import IProjectTheme from "../types/IProjectTheme";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";

// ============================================================================
// WIZARD TYPE ENUM
// ============================================================================

export enum ContentWizardType {
  launcher = 0,
  entity = 1,
  block = 2,
  item = 3,
  structure = 4,
  feature = 5,
}

/**
 * Actions that can be triggered from the wizard launcher.
 * These bypass the wizard flow and directly create content or open dialogs.
 */
export enum ContentWizardAction {
  none = 0,
  newTypeScript = 1,
  newFunction = 2,
  entityFromVanilla = 3,
  basicBlockType = 4,
  basicItemType = 5,
  newSpawnRule = 6,
  newLootTable = 7,
  newStructure = 8,
  galleryItem = 10, // A specific gallery item was selected
}

// ============================================================================
// SHARED INTERFACES
// ============================================================================

export interface IContentWizardProps extends IAppProps {
  project: Project;
  theme: IProjectTheme;
  heightOffset: number;
  onComplete: (definition: IMinecraftContentDefinition) => void;
  onCancel: () => void;
  initialType?: ContentWizardType;
  /** Called when a quick action is selected (TypeScript, Function, etc.) */
  onQuickAction?: (action: ContentWizardAction, galleryItem?: IGalleryItem) => void;
  /** When true, adds a final step for naming the project. Used when wizard is hosted on the homepage. */
  showProjectNameStep?: boolean;
  /** Called on completion when showProjectNameStep is true. Receives definition + project name. */
  onCompleteWithProjectName?: (definition: IMinecraftContentDefinition, projectName: string) => void;
}

interface IContentWizardState {
  wizardType: ContentWizardType;
  step: number;
  // Entity state
  entityId: string;
  entityDisplayName: string;
  entityIdManuallyEdited: boolean;
  entityTraits: EntityTraitId[];
  entityHealth: number;
  entityDamage: number;
  entitySpeed: number;
  entityPrimaryColor: string;
  entitySecondaryColor: string;
  entityBodyType: string;
  // Block state
  blockId: string;
  blockDisplayName: string;
  blockIdManuallyEdited: boolean;
  blockTraits: BlockTraitId[];
  blockDestroyTime: number;
  blockLightEmission: number;
  blockPrimaryColor: string;
  // Item state
  itemId: string;
  itemDisplayName: string;
  itemIdManuallyEdited: boolean;
  itemTraits: ItemTraitId[];
  itemMaxStack: number;
  itemDurability: number;
  itemDamage: number;
  itemPrimaryColor: string;
  // Launcher state
  expandedSections: string[];
  // Project name (only used when showProjectNameStep is true)
  projectName: string;
}

// Trait definitions imported from shared TraitData.ts

// ============================================================================
// MAIN WIZARD COMPONENT
// ============================================================================

export default class ContentWizard extends Component<IContentWizardProps, IContentWizardState> {
  constructor(props: IContentWizardProps) {
    super(props);

    this._handleBack = this._handleBack.bind(this);
    this._handleNext = this._handleNext.bind(this);
    this._handleComplete = this._handleComplete.bind(this);
    this._handleCancel = this._handleCancel.bind(this);
    this._handleWizardTypeSelect = this._handleWizardTypeSelect.bind(this);
    this._handleQuickAction = this._handleQuickAction.bind(this);
    this._handleGalleryItemClick = this._handleGalleryItemClick.bind(this);
    this._toggleSection = this._toggleSection.bind(this);

    this.state = {
      wizardType: props.initialType || ContentWizardType.launcher,
      step: 0,
      // Entity defaults
      entityId: "my_mob",
      entityDisplayName: "My Mob",
      entityIdManuallyEdited: false,
      entityTraits: [],
      entityHealth: 20,
      entityDamage: 3,
      entitySpeed: 0.25,
      entityPrimaryColor: "#5B8C3E",
      entitySecondaryColor: "#3D6B2E",
      entityBodyType: "humanoid",
      // Block defaults
      blockId: "my_block",
      blockDisplayName: "My Block",
      blockIdManuallyEdited: false,
      blockTraits: [],
      blockDestroyTime: 1.5,
      blockLightEmission: 0,
      blockPrimaryColor: "#7B6B5A",
      // Item defaults
      itemId: "my_item",
      itemDisplayName: "My Item",
      itemIdManuallyEdited: false,
      itemTraits: [],
      itemMaxStack: 64,
      itemDurability: 0,
      itemDamage: 0,
      itemPrimaryColor: "#4A7BA5",
      // Launcher state
      expandedSections: ["worldgen-top"],
      // Project name
      projectName: "My Add-On",
    };
  }

  _handleQuickAction(action: ContentWizardAction, galleryItem?: IGalleryItem) {
    if (this.props.onQuickAction) {
      this.props.onQuickAction(action, galleryItem);
    }
  }

  _handleGalleryItemClick(item: IGalleryItem) {
    this._handleQuickAction(ContentWizardAction.galleryItem, item);
  }

  _toggleSection(sectionId: string) {
    const expanded = [...this.state.expandedSections];
    const idx = expanded.indexOf(sectionId);
    if (idx >= 0) {
      expanded.splice(idx, 1);
    } else {
      expanded.push(sectionId);
    }
    this.setState({ expandedSections: expanded });
  }

  _handleBack() {
    if (this.state.step === 0) {
      this.setState({ wizardType: ContentWizardType.launcher });
    } else {
      this.setState({ step: this.state.step - 1 });
    }
  }

  _handleNext() {
    // Validate step 0: display name must not be empty
    if (this.state.step === 0) {
      const wizType = this.state.wizardType;
      if (
        (wizType === ContentWizardType.entity &&
          (!this.state.entityDisplayName || this.state.entityDisplayName.trim() === "")) ||
        (wizType === ContentWizardType.block &&
          (!this.state.blockDisplayName || this.state.blockDisplayName.trim() === "")) ||
        (wizType === ContentWizardType.item &&
          (!this.state.itemDisplayName || this.state.itemDisplayName.trim() === ""))
      ) {
        return;
      }
    }
    this.setState({ step: this.state.step + 1 });
  }

  _handleComplete() {
    const definition = this._buildDefinition();
    if (this.props.showProjectNameStep && this.props.onCompleteWithProjectName) {
      this.props.onCompleteWithProjectName(definition, this.state.projectName);
    } else {
      this.props.onComplete(definition);
    }
  }

  _handleCancel() {
    this.props.onCancel();
  }

  _handleWizardTypeSelect(type: ContentWizardType) {
    this.setState({ wizardType: type, step: 0 });
  }

  _getMaxSteps(): number {
    const extra = this.props.showProjectNameStep ? 1 : 0;
    switch (this.state.wizardType) {
      case ContentWizardType.entity:
        return 4 + extra; // Basic, Traits, Stats, Appearance [, Project]
      case ContentWizardType.block:
        return 3 + extra; // Basic, Traits, Properties [, Project]
      case ContentWizardType.item:
        return 3 + extra; // Basic, Traits, Properties [, Project]
      default:
        return 2 + extra;
    }
  }

  _buildDefinition(): IMinecraftContentDefinition {
    const namespace = this.props.project.effectiveDefaultNamespace || "custom";

    switch (this.state.wizardType) {
      case ContentWizardType.entity:
        return {
          schemaVersion: "1.0.0",
          namespace,
          entityTypes: [
            {
              id: this.state.entityId,
              displayName: this.state.entityDisplayName,
              traits: this.state.entityTraits,
              health: this.state.entityHealth,
              attackDamage: this.state.entityDamage,
              movementSpeed: this.state.entitySpeed,
              appearance: {
                bodyType: this.state.entityBodyType as any,
                primaryColor: this.state.entityPrimaryColor,
                secondaryColor: this.state.entitySecondaryColor,
              },
            },
          ],
        };

      case ContentWizardType.block:
        return {
          schemaVersion: "1.0.0",
          namespace,
          blockTypes: [
            {
              id: this.state.blockId,
              displayName: this.state.blockDisplayName,
              traits: this.state.blockTraits,
              destroyTime: this.state.blockDestroyTime,
              lightEmission: this.state.blockLightEmission,
              mapColor: this.state.blockPrimaryColor,
            },
          ],
        };

      case ContentWizardType.item:
        return {
          schemaVersion: "1.0.0",
          namespace,
          itemTypes: [
            {
              id: this.state.itemId,
              displayName: this.state.itemDisplayName,
              traits: this.state.itemTraits.filter((t) => t !== ("custom" as ItemTraitId)),
              maxStackSize: this.state.itemMaxStack,
              durability: this.state.itemDurability > 0 ? this.state.itemDurability : undefined,
              // Note: item color is used by ContentGenerator based on traits
            },
          ],
        };

      default:
        return { schemaVersion: "1.0.0" };
    }
  }

  _renderLauncher() {
    const scriptLanguage = this.props.project?.preferredScriptLanguage;
    const isTypeScript = scriptLanguage === ProjectScriptLanguage.typeScript;
    const expandedSections = this.state.expandedSections;

    // Get gallery items for various categories
    const getGalleryItems = (type: GalleryItemType): IGalleryItem[] => {
      return this.props.creatorTools.getGalleryProjectByType(type) || [];
    };

    const entityItemBlockFiles = getGalleryItems(GalleryItemType.entityItemBlockSingleFiles);
    const visualFiles = getGalleryItems(GalleryItemType.visualSingleFiles);
    const worldGenFiles = getGalleryItems(GalleryItemType.worldGenSingleFiles);
    const catalogFiles = getGalleryItems(GalleryItemType.catalogSingleFiles);
    const spawnLootRecipes = getGalleryItems(GalleryItemType.spawnLootRecipes);
    const spawnRuleItem = spawnLootRecipes.find(
      (item) => item.targetType === ProjectItemType.spawnRuleBehavior || item.id === "spawn_rule"
    );
    const lootTableItem = spawnLootRecipes.find(
      (item) => item.targetType === ProjectItemType.lootTableBehavior || item.id === "loot_table"
    );
    const worldGen = getGalleryItems(GalleryItemType.worldGen);
    const featureRuleItem =
      worldGen.find((item) => item.targetType === ProjectItemType.featureRuleBehavior || item.id === "feature_rule") ||
      undefined;
    const featureItem =
      worldGenFiles.find((item) => item.id === "aggregate_feature") ||
      worldGenFiles.find((item) => item.targetType === ProjectItemType.featureBehavior) ||
      undefined;
    const worldGenAdvanced = featureRuleItem ? worldGen.filter((item) => item.id !== featureRuleItem.id) : worldGen;

    const renderGallerySection = (title: string, sectionId: string, items: IGalleryItem[]) => {
      if (items.length === 0) return null;
      const isExpanded = expandedSections.includes(sectionId);
      return (
        <div className="cwiz-section" key={sectionId}>
          <div className="cwiz-section-header" onClick={() => this._toggleSection(sectionId)}>
            <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} />
            <span>{title}</span>
            <span className="cwiz-section-count">({items.length})</span>
          </div>
          {isExpanded && (
            <div className="cwiz-section-items">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="cwiz-section-item"
                  onClick={() => this._handleGalleryItemClick(item)}
                  title={item.description}
                >
                  <FontAwesomeIcon icon={faFile} className="cwiz-section-item-icon" />
                  <span>{item.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div
        className={
          "cwiz-launcher-wrapper" + (CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? " cwiz-dark" : "")
        }
      >
        <div
          className="cwiz-launcher cwiz-launcher-full"
          style={{ overflowY: "scroll", maxHeight: "calc(70vh - 60px)" }}
        >
          {/* Guided Setup — Recommended for beginners */}
          <div className="cwiz-wizard-section cwiz-guided-section">
            <div className="cwiz-section-headingRow">
              <div>
                <div className="cwiz-wizard-section-title">⭐ Guided Setup — Recommended</div>
                <div className="cwiz-wizard-section-copy">
                  Answer a few simple questions and we'll build the files for you.
                </div>
              </div>
            </div>
            <div className="cwiz-launcher-options">
              <div
                className="cwiz-launcher-option"
                data-testid="wizard-new-mob"
                onClick={() => this._handleWizardTypeSelect(ContentWizardType.entity)}
              >
                <div className="cwiz-launcher-option-icon">
                  <img
                    src={CreatorToolsHost.contentWebRoot + "res/images/icons/new_mob_240.png"}
                    alt="New Mob"
                    className="cwiz-launcher-option-img"
                  />
                </div>
                <div className="cwiz-launcher-option-content">
                  <div className="cwiz-launcher-option-label">New Mob</div>
                  <div className="cwiz-launcher-option-desc">Step-by-step — traits, stats & appearance</div>
                </div>
              </div>
              <div
                className="cwiz-launcher-option"
                data-testid="wizard-new-block"
                onClick={() => this._handleWizardTypeSelect(ContentWizardType.block)}
              >
                <div className="cwiz-launcher-option-icon">
                  <img
                    src={CreatorToolsHost.contentWebRoot + "res/images/icons/new_block_240.png"}
                    alt="New Block"
                    className="cwiz-launcher-option-img"
                  />
                </div>
                <div className="cwiz-launcher-option-content">
                  <div className="cwiz-launcher-option-label">New Block</div>
                  <div className="cwiz-launcher-option-desc">Step-by-step — shape, hardness & texture</div>
                </div>
              </div>
              <div
                className="cwiz-launcher-option"
                data-testid="wizard-new-item"
                onClick={() => this._handleWizardTypeSelect(ContentWizardType.item)}
              >
                <div className="cwiz-launcher-option-icon">
                  <img
                    src={CreatorToolsHost.contentWebRoot + "res/images/icons/new_item_240.png"}
                    alt="New Item"
                    className="cwiz-launcher-option-img"
                  />
                </div>
                <div className="cwiz-launcher-option-content">
                  <div className="cwiz-launcher-option-label">New Item</div>
                  <div className="cwiz-launcher-option-desc">Step-by-step — tool, food, weapon & more</div>
                </div>
              </div>
            </div>
          </div>

          {/* Start from a Minecraft Example */}
          <div className="cwiz-wizard-section cwiz-example-section">
            <div className="cwiz-section-headingRow">
              <div>
                <div className="cwiz-wizard-section-title">Start from an Existing Example</div>
                <div className="cwiz-wizard-section-copy">
                  Use these when you want something familiar to remix — pick from your project or vanilla Minecraft.
                </div>
              </div>
            </div>
            <div className="cwiz-main-options">
              <div
                className="cwiz-main-option"
                data-testid="wizard-mob-from-mc"
                onClick={() => this._handleQuickAction(ContentWizardAction.entityFromVanilla)}
              >
                <img
                  src={CreatorToolsHost.contentWebRoot + "res/images/icons/copy_mob_240.png"}
                  alt=""
                  className="cwiz-main-icon cwiz-main-img"
                />
                <div className="cwiz-main-content">
                  <div className="cwiz-main-label">New Mob Based on Existing</div>
                  <div className="cwiz-main-desc">Customize a mob from your project or any vanilla Minecraft mob</div>
                </div>
              </div>
              <div
                className="cwiz-main-option"
                data-testid="wizard-block-from-mc"
                onClick={() => this._handleQuickAction(ContentWizardAction.basicBlockType)}
              >
                <img
                  src={CreatorToolsHost.contentWebRoot + "res/images/icons/copy_block_240.png"}
                  alt=""
                  className="cwiz-main-icon cwiz-main-img"
                />
                <div className="cwiz-main-content">
                  <div className="cwiz-main-label">New Block Based on Existing</div>
                  <div className="cwiz-main-desc">
                    Customize a block from your project or any vanilla Minecraft block
                  </div>
                </div>
              </div>
              <div
                className="cwiz-main-option"
                data-testid="wizard-item-from-mc"
                onClick={() => this._handleQuickAction(ContentWizardAction.basicItemType)}
              >
                <img
                  src={CreatorToolsHost.contentWebRoot + "res/images/icons/copy_item_240.png"}
                  alt=""
                  className="cwiz-main-icon cwiz-main-img"
                />
                <div className="cwiz-main-content">
                  <div className="cwiz-main-label">New Item Based on Existing</div>
                  <div className="cwiz-main-desc">
                    Customize an item from your project or any vanilla Minecraft item
                  </div>
                </div>
              </div>
              {spawnRuleItem ? (
                <div className="cwiz-main-option" onClick={() => this._handleGalleryItemClick(spawnRuleItem)}>
                  <img
                    src={CreatorToolsHost.contentWebRoot + "res/images/icons/spawn_240.png"}
                    alt=""
                    className="cwiz-main-icon cwiz-main-img"
                  />
                  <div className="cwiz-main-content">
                    <div className="cwiz-main-label">Spawn Rules</div>
                    <div className="cwiz-main-desc">Control where and when mobs appear in the world</div>
                  </div>
                </div>
              ) : (
                <div
                  className="cwiz-main-option"
                  onClick={() => this._handleQuickAction(ContentWizardAction.newSpawnRule)}
                >
                  <img
                    src={CreatorToolsHost.contentWebRoot + "res/images/icons/spawn_240.png"}
                    alt=""
                    className="cwiz-main-icon cwiz-main-img"
                  />
                  <div className="cwiz-main-content">
                    <div className="cwiz-main-label">Spawn Rules</div>
                    <div className="cwiz-main-desc">Control where and when mobs appear in the world</div>
                  </div>
                </div>
              )}
              {lootTableItem ? (
                <div className="cwiz-main-option" onClick={() => this._handleGalleryItemClick(lootTableItem)}>
                  <img
                    src={CreatorToolsHost.contentWebRoot + "res/images/icons/drops_240.png"}
                    alt=""
                    className="cwiz-main-icon cwiz-main-img"
                  />
                  <div className="cwiz-main-content">
                    <div className="cwiz-main-label">Loot Table</div>
                    <div className="cwiz-main-desc">Define what items drop from mobs or chests</div>
                  </div>
                </div>
              ) : (
                <div
                  className="cwiz-main-option"
                  onClick={() => this._handleQuickAction(ContentWizardAction.newLootTable)}
                >
                  <img
                    src={CreatorToolsHost.contentWebRoot + "res/images/icons/drops_240.png"}
                    alt=""
                    className="cwiz-main-icon cwiz-main-img"
                  />
                  <div className="cwiz-main-content">
                    <div className="cwiz-main-label">Loot Table</div>
                    <div className="cwiz-main-desc">Define what items drop from mobs or chests</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* More Content Options */}
          <div className="cwiz-section" key="cwiz-more-content">
            <div className="cwiz-section-header" onClick={() => this._toggleSection("more-content")}>
              <FontAwesomeIcon icon={expandedSections.includes("more-content") ? faChevronDown : faChevronRight} />
              <span>More Options</span>
              {!expandedSections.includes("more-content") && <span className="cwiz-section-badge">2</span>}
            </div>
            {expandedSections.includes("more-content") && (
              <div className="cwiz-section-items">
                <div
                  className="cwiz-section-item"
                  onClick={() => this._handleQuickAction(ContentWizardAction.newTypeScript)}
                  title="Add a new script file (requires coding)"
                >
                  <FontAwesomeIcon icon={faCode} className="cwiz-section-item-icon" />
                  <span>{isTypeScript ? "TypeScript File" : "JavaScript File"} (requires coding)</span>
                </div>
                <div
                  className="cwiz-section-item"
                  onClick={() => this._handleQuickAction(ContentWizardAction.newFunction)}
                  title="Add a .mcfunction file"
                >
                  <FontAwesomeIcon icon={faTerminal} className="cwiz-section-item-icon" />
                  <span>Function File</span>
                </div>
              </div>
            )}
          </div>

          <div className="cwiz-section" key="cwiz-worldgen-top">
            <div className="cwiz-section-header" onClick={() => this._toggleSection("worldgen-top")}>
              <FontAwesomeIcon icon={expandedSections.includes("worldgen-top") ? faChevronDown : faChevronRight} />
              <span>World Generation</span>
              {!expandedSections.includes("worldgen-top") && (
                <span className="cwiz-section-badge">{(featureItem ? 1 : 0) + (featureRuleItem ? 1 : 0) + 1}</span>
              )}
            </div>
            {expandedSections.includes("worldgen-top") && (
              <div className="cwiz-section-items">
                {featureItem && (
                  <div
                    key={`worldgen-feature-${featureItem.id}`}
                    className="cwiz-section-item"
                    onClick={() => this._handleGalleryItemClick(featureItem)}
                    title={featureItem.description}
                  >
                    <FontAwesomeIcon icon={faFile} className="cwiz-section-item-icon" />
                    <span>Feature</span>
                  </div>
                )}
                {featureRuleItem && (
                  <div
                    key={`worldgen-feature-rule-${featureRuleItem.id}`}
                    className="cwiz-section-item"
                    onClick={() => this._handleGalleryItemClick(featureRuleItem)}
                    title={featureRuleItem.description}
                  >
                    <FontAwesomeIcon icon={faFile} className="cwiz-section-item-icon" />
                    <span>Feature Rule</span>
                  </div>
                )}
                <div
                  key="worldgen-structure"
                  className="cwiz-section-item"
                  onClick={() => this._handleQuickAction(ContentWizardAction.newStructure)}
                  title="Create a starter .mcstructure file for use in world generation"
                >
                  <FontAwesomeIcon icon={faFile} className="cwiz-section-item-icon" />
                  <span>Structure</span>
                </div>
              </div>
            )}
          </div>

          {/* Single Files (Advanced) Section */}
          <div className="cwiz-advanced-section">
            <div className="cwiz-advanced-header" onClick={() => this._toggleSection("advanced")}>
              <FontAwesomeIcon icon={expandedSections.includes("advanced") ? faChevronDown : faChevronRight} />
              <span>Advanced File Types</span>
              {!expandedSections.includes("advanced") && (
                <span className="cwiz-section-badge">
                  {entityItemBlockFiles.length +
                    visualFiles.length +
                    worldGenFiles.length +
                    catalogFiles.length +
                    spawnLootRecipes.length +
                    worldGenAdvanced.length}
                </span>
              )}
            </div>
            {expandedSections.includes("advanced") && (
              <div className="cwiz-advanced-content">
                {renderGallerySection("Mob/Item/Block Types", "adv-eib", entityItemBlockFiles)}
                {renderGallerySection("Spawn Rules, Loot Tables & Recipes", "adv-slr", spawnLootRecipes)}
                {renderGallerySection("World Generation", "adv-wg", worldGenAdvanced)}
                {renderGallerySection("World Gen Single Files", "adv-wgsf", worldGenFiles)}
                {renderGallerySection("Visuals", "adv-vis", visualFiles)}
                {renderGallerySection("Catalog Files", "adv-cat", catalogFiles)}
              </div>
            )}
          </div>
        </div>

        {/* Cancel Button - Fixed Footer */}
        <div className="cwiz-footer">
          <button className="cwiz-btn cwiz-btn-stone" onClick={this.props.onCancel}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  _renderEntityWizard() {
    const { step } = this.state;

    let stepContent: JSX.Element | null = null;
    let stepTitle: string = "";

    switch (step) {
      case 0: // Basic Info
        stepTitle = "Basic Information";
        stepContent = (
          <div className="cwiz-step-content">
            <div className="cwiz-field">
              <label>Display Name</label>
              <TextField
                fullWidth
                value={this.state.entityDisplayName}
                onChange={(e) => {
                  const displayName = e.target.value || "";
                  const update: Partial<IContentWizardState> = { entityDisplayName: displayName };
                  if (!this.state.entityIdManuallyEdited) {
                    update.entityId =
                      displayName
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "_")
                        .replace(/^_|_$/g, "") || "my_mob";
                  }
                  this.setState(update as any);
                }}
                placeholder="My Mob"
                size="small"
              />
              <div className="cwiz-field-hint">Name shown in-game</div>
            </div>
            <div className="cwiz-field">
              <label>Mob ID</label>
              <TextField
                fullWidth
                value={this.state.entityId}
                onChange={(e) => {
                  const sanitized = (e.target.value || "").toLowerCase().replace(/[^a-z0-9_]/g, "_");
                  this.setState({
                    entityId: sanitized,
                    entityIdManuallyEdited: true,
                  });
                }}
                placeholder="my_mob"
                size="small"
              />
              <div className="cwiz-field-hint">Unique identifier (a-z, 0-9, underscore only)</div>
            </div>
          </div>
        );
        break;

      case 1: // Traits
        stepTitle = "Select Traits";
        stepContent = (
          <EntityTraitPicker
            traits={this.state.entityTraits}
            onTraitsChanged={(traits) => this.setState({ entityTraits: traits })}
            theme={this.props.theme}
          />
        );
        break;

      case 2: // Stats
        stepTitle = "Mob Stats";
        stepContent = (
          <div className="cwiz-step-content">
            <div className="cwiz-field">
              <label>Health: {this.state.entityHealth}</label>
              <Slider
                min={1}
                max={100}
                value={this.state.entityHealth}
                onChange={(e, value) => this.setState({ entityHealth: Number(value) || 20 })}
                size="small"
              />
            </div>
            <div className="cwiz-field">
              <label>Attack Damage: {this.state.entityDamage}</label>
              <Slider
                min={0}
                max={20}
                value={this.state.entityDamage}
                onChange={(e, value) => this.setState({ entityDamage: Number(value) || 3 })}
                size="small"
              />
            </div>
            <div className="cwiz-field">
              <label>Movement Speed: {this.state.entitySpeed.toFixed(2)}</label>
              <Slider
                min={0.1}
                max={1.0}
                step={0.05}
                value={this.state.entitySpeed}
                onChange={(e, value) => this.setState({ entitySpeed: Number(value) || 0.25 })}
                size="small"
              />
            </div>
          </div>
        );
        break;

      case 3: // Appearance
        stepTitle = "Appearance";
        stepContent = (
          <div className="cwiz-step-content">
            <div className="cwiz-field">
              <label>Body Type</label>
              <Select
                fullWidth
                value={this.state.entityBodyType}
                onChange={(e) => {
                  this.setState({ entityBodyType: e.target.value as string });
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
              <label>Primary Color</label>
              <input
                type="color"
                value={this.state.entityPrimaryColor}
                onChange={(e) => this.setState({ entityPrimaryColor: e.target.value })}
              />
            </div>
            <div className="cwiz-field">
              <label>Secondary Color</label>
              <input
                type="color"
                value={this.state.entitySecondaryColor}
                onChange={(e) => this.setState({ entitySecondaryColor: e.target.value })}
              />
            </div>
          </div>
        );
        break;
    }

    return this._renderWizardFrame("Mob", stepTitle!, stepContent!);
  }

  _renderBlockWizard() {
    const { step } = this.state;

    let stepContent: JSX.Element | null = null;
    let stepTitle: string = "";

    switch (step) {
      case 0: // Basic Info
        stepTitle = "Basic Information";
        stepContent = (
          <div className="cwiz-step-content">
            <div className="cwiz-field">
              <label>Display Name</label>
              <TextField
                fullWidth
                value={this.state.blockDisplayName}
                onChange={(e) => {
                  const displayName = e.target.value || "";
                  const update: Partial<IContentWizardState> = { blockDisplayName: displayName };
                  if (!this.state.blockIdManuallyEdited) {
                    update.blockId =
                      displayName
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "_")
                        .replace(/^_|_$/g, "") || "my_block";
                  }
                  this.setState(update as any);
                }}
                placeholder="My Block"
                size="small"
              />
              <div className="cwiz-field-hint">Name shown in-game</div>
            </div>
            <div className="cwiz-field">
              <label>Block ID</label>
              <TextField
                fullWidth
                value={this.state.blockId}
                onChange={(e) => {
                  const sanitized = (e.target.value || "").toLowerCase().replace(/[^a-z0-9_]/g, "_");
                  this.setState({
                    blockId: sanitized,
                    blockIdManuallyEdited: true,
                  });
                }}
                placeholder="my_block"
                size="small"
              />
              <div className="cwiz-field-hint">Unique identifier (a-z, 0-9, underscore only)</div>
            </div>
          </div>
        );
        break;

      case 1: // Traits
        stepTitle = "Select Traits";
        stepContent = (
          <div className="cwiz-step-content" style={getTraitCardThemeStyle(this.props.theme)}>
            <div className="cwiz-traits-grid">
              {BLOCK_TRAITS.map((trait) => (
                <div
                  key={trait.id}
                  className={`cwiz-trait ${
                    this.state.blockTraits.includes(trait.id as BlockTraitId) ? "cwiz-trait-selected" : ""
                  }`}
                  onClick={() => {
                    const traits = [...this.state.blockTraits];
                    const idx = traits.indexOf(trait.id as BlockTraitId);
                    if (idx >= 0) {
                      traits.splice(idx, 1);
                    } else {
                      traits.push(trait.id as BlockTraitId);
                    }
                    this.setState({ blockTraits: traits });
                  }}
                >
                  <div className="cwiz-trait-icon" style={{ color: getTraitIconColor(trait) }}>
                    {renderBlockTraitIcon(trait.id)}
                  </div>
                  <div className="cwiz-trait-text">
                    <div className="cwiz-trait-label">{trait.label}</div>
                    <div className="cwiz-trait-desc">{trait.description}</div>
                  </div>
                  {this.state.blockTraits.includes(trait.id as BlockTraitId) && (
                    <div className="cwiz-trait-check">&#10003;</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
        break;

      case 2: // Properties
        stepTitle = "Block Properties";
        stepContent = (
          <div className="cwiz-step-content">
            <div className="cwiz-field">
              <label>Mining Speed: {this.state.blockDestroyTime.toFixed(1)}s</label>
              <Slider
                min={0}
                max={10}
                step={0.5}
                value={this.state.blockDestroyTime}
                onChange={(e, value) => this.setState({ blockDestroyTime: Number(value) || 1.5 })}
                size="small"
              />
              <div className="cwiz-field-hint">0 = instant break, higher = harder</div>
            </div>
            <div className="cwiz-field">
              <label>Light Emission: {this.state.blockLightEmission}</label>
              <Slider
                min={0}
                max={15}
                value={this.state.blockLightEmission}
                onChange={(e, value) => this.setState({ blockLightEmission: Number(value) || 0 })}
                size="small"
              />
              <div className="cwiz-field-hint">15 = full brightness like glowstone</div>
            </div>
            <div className="cwiz-field">
              <label>Block Color</label>
              <input
                type="color"
                value={this.state.blockPrimaryColor}
                onChange={(e) => this.setState({ blockPrimaryColor: e.target.value })}
              />
            </div>
          </div>
        );
        break;
    }

    return this._renderWizardFrame("Block", stepTitle!, stepContent!);
  }

  _renderItemWizard() {
    const { step } = this.state;

    let stepContent: JSX.Element | null = null;
    let stepTitle: string = "";

    switch (step) {
      case 0: // Basic Info
        stepTitle = "Basic Information";
        stepContent = (
          <div className="cwiz-step-content">
            <div className="cwiz-field">
              <label>Display Name</label>
              <TextField
                fullWidth
                value={this.state.itemDisplayName}
                onChange={(e) => {
                  const displayName = e.target.value || "";
                  const update: Partial<IContentWizardState> = { itemDisplayName: displayName };
                  if (!this.state.itemIdManuallyEdited) {
                    update.itemId =
                      displayName
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "_")
                        .replace(/^_|_$/g, "") || "my_item";
                  }
                  this.setState(update as any);
                }}
                placeholder="My Item"
                size="small"
              />
              <div className="cwiz-field-hint">Name shown in-game</div>
            </div>
            <div className="cwiz-field">
              <label>Item ID</label>
              <TextField
                fullWidth
                value={this.state.itemId}
                onChange={(e) => {
                  const sanitized = (e.target.value || "").toLowerCase().replace(/[^a-z0-9_]/g, "_");
                  this.setState({
                    itemId: sanitized,
                    itemIdManuallyEdited: true,
                  });
                }}
                placeholder="my_item"
                size="small"
              />
              <div className="cwiz-field-hint">Unique identifier (a-z, 0-9, underscore only)</div>
            </div>
          </div>
        );
        break;

      case 1: // Traits
        stepTitle = "Select Traits";
        stepContent = (
          <div className="cwiz-step-content" style={getTraitCardThemeStyle(this.props.theme)}>
            <div className="cwiz-traits-grid">
              {ITEM_TRAITS.map((trait) => (
                <div
                  key={trait.id}
                  className={`cwiz-trait ${
                    this.state.itemTraits.includes(trait.id as ItemTraitId) ? "cwiz-trait-selected" : ""
                  }`}
                  onClick={() => {
                    const traits = [...this.state.itemTraits];
                    const idx = traits.indexOf(trait.id as ItemTraitId);
                    if (idx >= 0) {
                      traits.splice(idx, 1);
                    } else {
                      traits.push(trait.id as ItemTraitId);
                    }
                    this.setState({ itemTraits: traits });
                  }}
                >
                  <div className="cwiz-trait-icon" style={{ color: getTraitIconColor(trait) }}>
                    {renderItemTraitIcon(trait.id)}
                  </div>
                  <div className="cwiz-trait-text">
                    <div className="cwiz-trait-label">{trait.label}</div>
                    <div className="cwiz-trait-desc">{trait.description}</div>
                  </div>
                  {this.state.itemTraits.includes(trait.id as ItemTraitId) && (
                    <div className="cwiz-trait-check">&#10003;</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
        break;

      case 2: // Properties
        stepTitle = "Item Properties";
        stepContent = (
          <div className="cwiz-step-content">
            <div className="cwiz-field">
              <label>Max Stack Size: {this.state.itemMaxStack}</label>
              <Slider
                min={1}
                max={64}
                value={this.state.itemMaxStack}
                onChange={(e, value) => this.setState({ itemMaxStack: Number(value) || 64 })}
                size="small"
              />
            </div>
            <div className="cwiz-field">
              <label>Durability: {this.state.itemDurability || "None"}</label>
              <Slider
                min={0}
                max={2000}
                step={50}
                value={this.state.itemDurability}
                onChange={(e, value) => this.setState({ itemDurability: Number(value) || 0 })}
                size="small"
              />
              <div className="cwiz-field-hint">0 = no durability (stacks normally)</div>
            </div>
            <div className="cwiz-field">
              <label>Item Color</label>
              <input
                type="color"
                value={this.state.itemPrimaryColor}
                onChange={(e) => this.setState({ itemPrimaryColor: e.target.value })}
              />
            </div>
          </div>
        );
        break;
    }

    return this._renderWizardFrame("Item", stepTitle!, stepContent!);
  }

  _renderWizardFrame(typeName: string, stepTitle: string, stepContent: JSX.Element) {
    const maxSteps = this._getMaxSteps();
    const isLastStep = this.state.step >= maxSteps - 1;

    // If this is the project-name step (final extra step), override title and content
    const isProjectNameStep = this.props.showProjectNameStep && isLastStep;
    const displayTitle = isProjectNameStep ? "Name Your Project" : stepTitle;
    const displayContent = isProjectNameStep ? (
      <div className="cwiz-step-content" style={{ padding: "16px 20px" }}>
        <div className="cwiz-field-hint" style={{ marginBottom: 16 }}>
          Your {typeName.toLowerCase()} is ready! Give your project a name — this is what you'll see in your project
          list. You can always change it later.
        </div>
        <div className="cwiz-field">
          <label>Project Name</label>
          <TextField
            fullWidth
            value={this.state.projectName}
            onChange={(e) => this.setState({ projectName: e.target.value || "" })}
            placeholder="My Add-On"
            size="small"
            autoFocus
          />
          <div className="cwiz-field-hint">
            This is the name of your add-on project, not the {typeName.toLowerCase()} itself.
          </div>
        </div>
      </div>
    ) : (
      stepContent
    );

    return (
      <div className={"cwiz-wizard" + (CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? " cwiz-dark" : "")}>
        <div className="cwiz-wizard-header">
          <div className="cwiz-wizard-title">Create {typeName}</div>
          <div className="cwiz-wizard-step-indicator">
            Step {this.state.step + 1} of {maxSteps}: {displayTitle}
          </div>
          <div className="cwiz-wizard-progress">
            {Array.from({ length: maxSteps }).map((_, i) => (
              <div key={i} className={`cwiz-progress-dot ${i <= this.state.step ? "cwiz-progress-dot-active" : ""}`} />
            ))}
          </div>
        </div>
        <div className="cwiz-wizard-body">{displayContent}</div>
        <div className="cwiz-wizard-footer">
          <button className="cwiz-btn cwiz-btn-stone" onClick={this._handleBack}>
            <FontAwesomeIcon icon={faArrowLeft} />
            Back
          </button>
          <button className="cwiz-btn cwiz-btn-stone" onClick={this._handleCancel}>
            Cancel
          </button>
          {isLastStep ? (
            <button className="cwiz-btn cwiz-btn-primary" onClick={this._handleComplete}>
              <FontAwesomeIcon icon={faCheck} />
              Create
            </button>
          ) : (
            <button className="cwiz-btn cwiz-btn-primary" onClick={this._handleNext}>
              <FontAwesomeIcon icon={faArrowRight} />
              Next
            </button>
          )}
        </div>
      </div>
    );
  }

  render() {
    switch (this.state.wizardType) {
      case ContentWizardType.launcher:
        return this._renderLauncher();
      case ContentWizardType.entity:
        return this._renderEntityWizard();
      case ContentWizardType.block:
        return this._renderBlockWizard();
      case ContentWizardType.item:
        return this._renderItemWizard();
      default:
        return this._renderLauncher();
    }
  }
}
