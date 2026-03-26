/**
 * ========================================================================
 * FEATURE CONNECTION PICKER
 * ========================================================================
 *
 * A dialog for choosing what to connect when dropping a connection into
 * empty space. Allows the user to either:
 *   - Reference an existing feature from the project
 *   - Create a new feature of a specific type
 *
 * USAGE:
 *   <FeatureConnectionPicker
 *     isOpen={showPicker}
 *     project={project}
 *     theme={theme}
 *     onSelectExisting={(featureId) => handleConnectExisting(featureId)}
 *     onCreateNew={(featureType, featureName) => handleCreateNew(featureType, featureName)}
 *     onClose={() => setShowPicker(false)}
 *   />
 *
 * ========================================================================
 */

import React, { Component } from "react";
import {
  Button as MuiButton,
  Dialog as MuiDialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List as MuiList,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Select,
  MenuItem,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLink, faPlus, faSearch } from "@fortawesome/free-solid-svg-icons";
import Project from "../../../app/Project";
import { ProjectItemType } from "../../../app/IProjectItemData";
import FeatureDefinition from "../../../minecraft/FeatureDefinition";
import { getFeatureTypeName } from "./FeaturePipelineUtilities";
import FeatureTypeIcon from "./FeatureTypeIcon";
import "./FeatureConnectionPicker.css";
import IProjectTheme from "../../types/IProjectTheme";

export interface IFeatureConnectionPickerProps {
  isOpen: boolean;
  project: Project;
  theme: IProjectTheme;
  onSelectExisting: (featureId: string) => void;
  onCreateNew: (featureType: string, featureName: string) => void;
  onClose: () => void;
  /** Optional filter - IDs of features already connected */
  excludeFeatureIds?: string[];
}

interface IFeatureConnectionPickerState {
  mode: "select" | "create";
  searchFilter: string;
  availableFeatures: { id: string; shortId: string; featureType: string }[];
  selectedFeatureId: string | undefined;
  newFeatureName: string;
  selectedNewType: string;
  isLoading: boolean;
}

// Common feature types for quick creation
const COMMON_FEATURE_TYPES = [
  "single_block_feature",
  "ore_feature",
  "scatter_feature",
  "aggregate_feature",
  "sequence_feature",
  "tree_feature",
  "structure_template_feature",
];

export default class FeatureConnectionPicker extends Component<
  IFeatureConnectionPickerProps,
  IFeatureConnectionPickerState
> {
  constructor(props: IFeatureConnectionPickerProps) {
    super(props);

    this.state = {
      mode: "select",
      searchFilter: "",
      availableFeatures: [],
      selectedFeatureId: undefined,
      newFeatureName: "",
      selectedNewType: "single_block_feature",
      isLoading: true,
    };

    this._handleModeChange = this._handleModeChange.bind(this);
    this._handleSearchChange = this._handleSearchChange.bind(this);
    this._handleFeatureSelect = this._handleFeatureSelect.bind(this);
    this._handleConfirm = this._handleConfirm.bind(this);
    this._handleNewTypeChange = this._handleNewTypeChange.bind(this);
    this._handleNewNameChange = this._handleNewNameChange.bind(this);
  }

  componentDidMount() {
    this._loadAvailableFeatures();
  }

  componentDidUpdate(prevProps: IFeatureConnectionPickerProps) {
    if (this.props.isOpen && !prevProps.isOpen) {
      this._loadAvailableFeatures();
    }
  }

  async _loadAvailableFeatures() {
    this.setState({ isLoading: true });

    const features: { id: string; shortId: string; featureType: string }[] = [];
    const excludeSet = new Set(this.props.excludeFeatureIds || []);

    for (const item of this.props.project.items) {
      if (item.itemType === ProjectItemType.featureBehavior) {
        if (!item.isContentLoaded) {
          await item.loadContent();
        }

        if (item.primaryFile) {
          const featureDef = await FeatureDefinition.ensureOnFile(item.primaryFile);
          if (featureDef && featureDef.id) {
            if (!excludeSet.has(featureDef.id)) {
              features.push({
                id: featureDef.id,
                shortId: this._getShortId(featureDef.id),
                featureType: featureDef.typeString || "unknown",
              });
            }
          }
        }
      }
    }

    // Sort alphabetically by shortId
    features.sort((a, b) => a.shortId.localeCompare(b.shortId));

    this.setState({
      availableFeatures: features,
      isLoading: false,
    });
  }

  _getShortId(id: string): string {
    const colonIndex = id.indexOf(":");
    return colonIndex >= 0 ? id.substring(colonIndex + 1) : id;
  }

  _handleModeChange(mode: "select" | "create") {
    this.setState({ mode });
  }

  _handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ searchFilter: e.target.value || "" });
  }

  _handleFeatureSelect(featureId: string) {
    this.setState({ selectedFeatureId: featureId });
  }

  _handleNewTypeChange(e: any) {
    const value = e.target.value;
    if (typeof value === "string") {
      this.setState({ selectedNewType: value });
    }
  }

  _handleNewNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ newFeatureName: e.target.value || "" });
  }

  _handleConfirm() {
    if (this.state.mode === "select" && this.state.selectedFeatureId) {
      this.props.onSelectExisting(this.state.selectedFeatureId);
    } else if (this.state.mode === "create" && this.state.newFeatureName) {
      this.props.onCreateNew(this.state.selectedNewType, this.state.newFeatureName);
    }
    this.props.onClose();
  }

  _getFilteredFeatures() {
    const filter = this.state.searchFilter.toLowerCase();
    if (!filter) {
      return this.state.availableFeatures;
    }
    return this.state.availableFeatures.filter(
      (f) => f.shortId.toLowerCase().includes(filter) || f.featureType.toLowerCase().includes(filter)
    );
  }

  render() {
    if (!this.props.isOpen) {
      return null;
    }

    const filteredFeatures = this._getFilteredFeatures();
    const canConfirm =
      (this.state.mode === "select" && this.state.selectedFeatureId) ||
      (this.state.mode === "create" && this.state.newFeatureName.trim().length > 0);

    const featureTypeOptions = COMMON_FEATURE_TYPES.map((type) => ({
      key: type,
      header: getFeatureTypeName(type),
      content: type,
    }));

    return (
      <MuiDialog
        open={this.props.isOpen}
        onClose={this.props.onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          style: {
            backgroundColor: this.props.theme.background2,
            color: this.props.theme.foreground2,
          },
        }}
      >
        <DialogTitle>Connect Feature</DialogTitle>
        <DialogContent>
          <div className="fcp-content">
            {/* Mode tabs */}
            <div className="fcp-tabs">
              <MuiButton
                className={this.state.mode === "select" ? "fcp-tab fcp-tab-active" : "fcp-tab"}
                onClick={() => this._handleModeChange("select")}
                startIcon={<FontAwesomeIcon icon={faLink} />}
              >
                Use Existing
              </MuiButton>
              <MuiButton
                className={this.state.mode === "create" ? "fcp-tab fcp-tab-active" : "fcp-tab"}
                onClick={() => this._handleModeChange("create")}
                startIcon={<FontAwesomeIcon icon={faPlus} />}
              >
                Create New
              </MuiButton>
            </div>

            {this.state.mode === "select" ? (
              <div className="fcp-select-mode">
                {/* Search filter */}
                <div className="fcp-search">
                  <TextField
                    InputProps={{
                      startAdornment: <FontAwesomeIcon icon={faSearch} style={{ marginRight: 8 }} />,
                    }}
                    placeholder="Search features..."
                    value={this.state.searchFilter}
                    onChange={this._handleSearchChange}
                    fullWidth
                    size="small"
                  />
                </div>

                {/* Feature list */}
                <div className="fcp-feature-list">
                  {this.state.isLoading ? (
                    <div className="fcp-loading">Loading features...</div>
                  ) : filteredFeatures.length === 0 ? (
                    <div className="fcp-empty">No features found</div>
                  ) : (
                    <MuiList>
                      {filteredFeatures.map((feature, idx) => (
                        <ListItem key={feature.id} disablePadding>
                          <ListItemButton
                            selected={feature.id === this.state.selectedFeatureId}
                            onClick={() => this._handleFeatureSelect(feature.id)}
                          >
                            <ListItemIcon>
                              <FeatureTypeIcon featureType={feature.featureType} size={16} />
                            </ListItemIcon>
                            <ListItemText
                              primary={feature.shortId}
                              secondary={getFeatureTypeName(feature.featureType)}
                            />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </MuiList>
                  )}
                </div>
              </div>
            ) : (
              <div className="fcp-create-mode">
                {/* Feature type dropdown */}
                <div className="fcp-field">
                  <label>Feature Type</label>
                  <Select
                    value={this.state.selectedNewType}
                    onChange={this._handleNewTypeChange}
                    fullWidth
                    size="small"
                  >
                    {featureTypeOptions.map((opt) => (
                      <MenuItem key={opt.key} value={opt.content}>
                        {opt.header}
                      </MenuItem>
                    ))}
                  </Select>
                </div>

                {/* Feature name input */}
                <div className="fcp-field">
                  <label>Feature Name</label>
                  <TextField
                    placeholder="my_feature"
                    value={this.state.newFeatureName}
                    onChange={this._handleNewNameChange}
                    fullWidth
                    size="small"
                  />
                </div>
              </div>
            )}
          </div>
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={this.props.onClose}>Cancel</MuiButton>
          <MuiButton onClick={this._handleConfirm} disabled={!canConfirm} variant="contained">
            {this.state.mode === "select" ? "Connect" : "Create & Connect"}
          </MuiButton>
        </DialogActions>
      </MuiDialog>
    );
  }
}
