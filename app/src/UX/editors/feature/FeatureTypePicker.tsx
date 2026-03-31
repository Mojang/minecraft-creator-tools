/**
 * ========================================================================
 * FEATURE TYPE PICKER
 * ========================================================================
 *
 * A dialog/menu component for selecting a feature type when creating
 * a new feature. This is used by the FeatureEditor when adding features
 * to the project.
 *
 * FEATURE TYPES:
 * Features are categorized into groups:
 *   - Composite (aggregate, sequence, weighted_random, etc.)
 *   - Placement (scatter, snap_to_surface, search, etc.)
 *   - Block-based (single_block, ore, vegetation_patch, etc.)
 *   - Structure (tree, structure_template, etc.)
 *   - Cave (cave_carver, nether_cave_carver, etc.)
 *
 * USAGE:
 *   <FeatureTypePicker
 *     isOpen={showPicker}
 *     onSelect={(featureType) => handleAddFeature(featureType)}
 *     onClose={() => setShowPicker(false)}
 *     theme={theme}
 *   />
 *
 * ========================================================================
 */

import React, { Component } from "react";
import McDialog from "../../shared/components/feedback/mcDialog/McDialog";
import { FeatureTypes } from "../../../minecraft/FeatureDefinition";
import { getFeatureTypeName } from "./FeaturePipelineUtilities";
import FeatureTypeIcon, { getFeatureColor } from "./FeatureTypeIcon";
import "./FeatureTypePicker.css";
import IProjectTheme from "../../types/IProjectTheme";

export interface IFeatureTypePickerProps {
  isOpen: boolean;
  onSelect: (featureType: string, featureName: string) => void;
  onClose: () => void;
  theme: IProjectTheme;
}

interface IFeatureTypePickerState {
  featureName: string;
  selectedType: string | undefined;
  userEditedName: boolean;
}

interface IFeatureTypeCategory {
  name: string;
  description: string;
  types: string[];
  representativeType: string; // A type to get the icon from
}

// Group feature types into logical categories
const featureCategories: IFeatureTypeCategory[] = [
  {
    name: "Composite",
    description: "Features that combine or sequence other features",
    representativeType: "aggregate_feature",
    types: ["aggregate_feature", "sequence_feature", "weighted_random_feature", "scatter_feature"],
  },
  {
    name: "Placement",
    description: "Features that control how other features are placed",
    representativeType: "search_feature",
    types: [
      "search_feature",
      "snap_to_surface_feature",
      "scan_surface",
      "rect_layout",
      "surface_relative_threshold_feature",
    ],
  },
  {
    name: "Block-Based",
    description: "Features that place specific blocks or patterns",
    representativeType: "ore_feature",
    types: ["single_block_feature", "ore_feature", "multiface_feature", "partially_exposed_blob_feature"],
  },
  {
    name: "Vegetation",
    description: "Features for plants, trees, and organic structures",
    representativeType: "tree_feature",
    types: ["tree_feature", "growing_plant_feature", "vegetation_patch_feature", "sculk_patch_feature"],
  },
  {
    name: "Structures",
    description: "Features for generating structures from templates",
    representativeType: "structure_template_feature",
    types: ["structure_template_feature", "fossil_feature", "geode_feature"],
  },
  {
    name: "Cave",
    description: "Features for carving caves and underground areas",
    representativeType: "cave_carver_feature",
    types: ["cave_carver_feature", "nether_cave_carver_feature", "underwater_cave_carver_feature"],
  },
];

export default class FeatureTypePicker extends Component<IFeatureTypePickerProps, IFeatureTypePickerState> {
  constructor(props: IFeatureTypePickerProps) {
    super(props);
    this.state = {
      featureName: "feature",
      selectedType: undefined,
      userEditedName: false,
    };
  }

  _handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ featureName: e.target.value, userEditedName: true });
  };

  _handleTypeClick = (featureType: string) => {
    // Update selected type
    const newState: Partial<IFeatureTypePickerState> = { selectedType: featureType };

    // Auto-update the name if the user hasn't manually edited it
    if (!this.state.userEditedName) {
      // Convert feature type to a nice default name (e.g., "tree_feature" -> "tree")
      const baseName = featureType.replace(/_feature$/, "");
      newState.featureName = baseName;
    }

    this.setState(newState as IFeatureTypePickerState);
  };

  _handleConfirm = () => {
    const { selectedType, featureName } = this.state;
    if (!selectedType) return;

    const name = featureName.trim() || "feature";
    this.props.onSelect(selectedType, name);
    this.props.onClose();
  };

  _handleTypeSelect = (featureType: string) => {
    const name = this.state.featureName.trim() || "feature";
    this.props.onSelect(featureType, name);
    this.props.onClose();
  };

  _renderTypeButton(featureType: string): JSX.Element {
    const displayName = getFeatureTypeName(featureType);
    const isSelected = this.state.selectedType === featureType;
    const borderColor = getFeatureColor(featureType);

    return (
      <button
        key={featureType}
        className={`ftp-typeButton ${isSelected ? "ftp-typeButtonSelected" : ""}`}
        onClick={() => this._handleTypeClick(featureType)}
        title={featureType}
        style={isSelected ? { borderColor: borderColor, backgroundColor: `${borderColor}22` } : undefined}
      >
        <FeatureTypeIcon featureType={featureType} size={16} />
        <span className="ftp-typeButtonText">{displayName}</span>
      </button>
    );
  }

  _renderCategory(category: IFeatureTypeCategory): JSX.Element {
    return (
      <div className="ftp-category" key={category.name}>
        <div className="ftp-categoryHeader">
          <FeatureTypeIcon featureType={category.representativeType} size={20} className="ftp-categoryIcon" />
          <div className="ftp-categoryInfo">
            <div className="ftp-categoryName">{category.name}</div>
            <div className="ftp-categoryDescription">{category.description}</div>
          </div>
        </div>
        <div className="ftp-categoryTypes">
          {category.types.filter((t) => FeatureTypes.includes(t)).map((t) => this._renderTypeButton(t))}
        </div>
      </div>
    );
  }

  render() {
    if (!this.props.isOpen) {
      return null;
    }

    return (
      <McDialog
        open={this.props.isOpen}
        onCancel={this.props.onClose}
        onConfirm={this._handleConfirm}
        title="Add Feature"
        cancelButton="Cancel"
        confirmButton="OK"
        confirmDisabled={!this.state.selectedType}
        maxWidth="sm"
        fullWidth
      >
        <div className="ftp-content">
          <div className="ftp-nameSection">
            <label className="ftp-nameLabel" htmlFor="featureName">
              Feature Name:
            </label>
            <input
              id="featureName"
              type="text"
              className="ftp-nameInput"
              value={this.state.featureName}
              onChange={this._handleNameChange}
              placeholder="feature"
              autoFocus
            />
            <div className="ftp-nameHint">
              This will be used as the identifier (e.g., mypack:{this.state.featureName})
            </div>
          </div>
          <div className="ftp-description">Select the type of feature to create:</div>
          <div className="ftp-categories">{featureCategories.map((cat) => this._renderCategory(cat))}</div>
        </div>
      </McDialog>
    );
  }
}
