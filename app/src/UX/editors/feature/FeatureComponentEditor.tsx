// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * FEATURE COMPONENT EDITOR
 * ========================
 *
 * Form-based editor for individual feature or feature rule settings.
 *
 * This component:
 * - Uses DataForm infrastructure to render forms for selected nodes
 * - Handles both feature types and feature rules
 * - Shows appropriate forms based on the feature type
 * - Shows unfulfilled feature warnings with creation options
 */

import { Component } from "react";
import Project from "../../../app/Project";
import IFile from "../../../storage/IFile";
import CreatorTools from "../../../app/CreatorTools";
import Log from "../../../core/Log";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation, faPlus, faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import { FeaturePipelineNode } from "./FeaturePipelineUtilities";
import DataForm, { IDataFormProps } from "../../../dataformux/DataForm";
import Database from "../../../minecraft/Database";
import FeatureTypePicker from "./FeatureTypePicker";
import { Stack, IconButton } from "@mui/material";
import { ProjectItemType, ProjectItemCreationType } from "../../../app/IProjectItemData";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import { FolderContext } from "../../../app/Project";
import IProperty from "../../../dataform/IProperty";
import IProjectTheme from "../../types/IProjectTheme";

interface IFeatureComponentEditorProps {
  selectedNode: FeaturePipelineNode | undefined;
  project: Project;
  theme: IProjectTheme;
  heightOffset: number;
  setActivePersistable?: (file: IFile | undefined) => void;
  creatorTools: CreatorTools;
  readOnly: boolean;
}

interface IFeatureComponentEditorState {
  formLoaded: boolean;
  dataFormProps: IDataFormProps | undefined;
  showFeatureTypePicker: boolean;
  pendingAddCallback: ((featureId: string | undefined) => void) | undefined;
  currentFile: IFile | undefined;
  currentJsonData: any;
}

export default class FeatureComponentEditor extends Component<
  IFeatureComponentEditorProps,
  IFeatureComponentEditorState
> {
  private _isMounted = false;

  constructor(props: IFeatureComponentEditorProps) {
    super(props);
    this.state = {
      formLoaded: false,
      dataFormProps: undefined,
      showFeatureTypePicker: false,
      pendingAddCallback: undefined,
      currentFile: undefined,
      currentJsonData: undefined,
    };
  }

  _handleAddFeatureClick = () => {
    this.setState({ showFeatureTypePicker: true, pendingAddCallback: undefined });
  };

  _handleAddItemFromLookup = async (lookupId: string): Promise<string | undefined> => {
    if (lookupId !== "feature") {
      return undefined;
    }

    // Show picker and wait for result
    return new Promise((resolve) => {
      this.setState({
        showFeatureTypePicker: true,
        pendingAddCallback: (featureId: string | undefined) => {
          resolve(featureId);
        },
      });
    });
  };

  _handleFeatureTypeSelected = async (featureType: string, featureName: string) => {
    const { pendingAddCallback } = this.state;
    this.setState({ showFeatureTypePicker: false, pendingAddCallback: undefined });

    // Create the feature file
    const newFeatureId = await this._createFeature(featureType, featureName);

    if (pendingAddCallback) {
      pendingAddCallback(newFeatureId);
    }
  };

  _handleFeaturePickerClose = () => {
    const { pendingAddCallback } = this.state;
    this.setState({ showFeatureTypePicker: false, pendingAddCallback: undefined });

    if (pendingAddCallback) {
      pendingAddCallback(undefined);
    }
  };

  async _createFeature(featureType: string, featureName: string): Promise<string | undefined> {
    const { project } = this.props;

    // Get the project's short name/namespace
    const projectName = project.name?.toLowerCase().replace(/[^a-z0-9_]/g, "_") || "mypack";

    // Clean the feature name
    const cleanName = featureName.toLowerCase().replace(/[^a-z0-9_]/g, "_");

    // Create the identifier
    const identifier = `${projectName}:${cleanName}`;

    // Find the behavior pack folder
    const bpFolder = await project.getDefaultBehaviorPackFolder();
    if (!bpFolder) {
      return undefined;
    }

    // Create the feature JSON content
    const featureContent = {
      format_version: "1.13.0",
      [`minecraft:${featureType}`]: {
        description: {
          identifier: identifier,
        },
      },
    };

    // Determine file path
    const filePath = `features/${cleanName}.json`;

    // Create the file
    const featuresFolder = bpFolder.ensureFolder("features");
    const file = featuresFolder.ensureFile(`${cleanName}.json`);

    file.setContent(JSON.stringify(featureContent, null, 2));

    // Save the file
    await file.saveContent();

    if (file.manager) {
      await file.manager.persist();
    }

    // Add the new file as a project item
    project.ensureItemFromFile(
      file,
      ProjectItemType.featureBehavior,
      FolderContext.behaviorPack,
      ProjectItemCreationType.normal
    );

    return identifier;
  }

  _canAddItem = (lookupId: string): boolean => {
    return lookupId === "feature";
  };

  _handlePropertyChanged = async (props: IDataFormProps, property: IProperty, newValue: any, updatingObject?: any) => {
    const { currentFile, currentJsonData } = this.state;

    if (currentFile && currentJsonData) {
      // Save the modified JSON back to the file
      currentFile.setContent(JSON.stringify(currentJsonData, null, 2));
      await currentFile.saveContent();

      if (currentFile.manager) {
        await currentFile.manager.persist();
      }
    }
  };

  componentDidMount() {
    this._isMounted = true;
    this._loadFormForNode();
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  componentDidUpdate(prevProps: IFeatureComponentEditorProps) {
    if (prevProps.selectedNode !== this.props.selectedNode) {
      this._loadFormForNode();
    }
  }

  async _loadFormForNode() {
    const node = this.props.selectedNode;
    if (!node) {
      if (this._isMounted) {
        this.setState({ formLoaded: true, dataFormProps: undefined });
      }
      return;
    }

    // For unfulfilled features, we don't show a form
    if (node.nodeType === "unfulfilledFeature") {
      if (this._isMounted) {
        this.setState({ formLoaded: true, dataFormProps: undefined });
      }
      return;
    }

    // Try to load the appropriate form
    let formName: string | undefined;
    let formCategory: string;

    if (node.nodeType === "featureRule") {
      formCategory = "feature";
      formName = "feature_rule_definition";
    } else {
      formCategory = "features";
      // Forms are named with minecraft_ prefix
      formName = "minecraft_" + node.featureType;
    }

    if (formName) {
      try {
        await Database.ensureFormLoaded(formCategory, formName);
        const form = Database.getForm(formCategory, formName);
        if (form && form.fields) {
          // Get the actual file data for the form
          const file = node.item.primaryFile;
          if (file) {
            await file.loadContent(false);
            const content = file.content;
            if (typeof content === "string") {
              try {
                const jsonData = JSON.parse(content);
                // Navigate to the correct data path within the JSON
                let formData = jsonData;
                if (node.nodeType === "featureRule" && formData["minecraft:feature_rules"]) {
                  formData = formData["minecraft:feature_rules"];
                } else if (formData["minecraft:" + node.featureType]) {
                  formData = formData["minecraft:" + node.featureType];
                }

                // Determine noun for summarizer based on node type
                const summarizerNoun = node.nodeType === "featureRule" ? "feature rule" : "feature";

                if (this._isMounted) {
                  this.setState({
                    formLoaded: true,
                    currentFile: file,
                    currentJsonData: jsonData,
                    dataFormProps: {
                      directObject: formData,
                      definition: form,
                      theme: this.props.theme,
                      readOnly: this.props.readOnly,
                      objectKey: undefined,
                      project: this.props.project,
                      lookupProvider: this.props.project,
                      onPropertyChanged: this._handlePropertyChanged,
                      summarizerNoun: summarizerNoun,
                    },
                  });
                }
                return;
              } catch (e) {
                Log.verbose("JSON parse error in FeatureComponentEditor: " + e);
              }
            }
          }
        }
      } catch (e) {
        Log.verbose("Form load error in FeatureComponentEditor: " + e);
      }
    }

    if (this._isMounted) {
      this.setState({ formLoaded: true, dataFormProps: undefined });
    }
  }

  _handleGoToFile = () => {
    const node = this.props.selectedNode;
    if (!node || node.nodeType === "unfulfilledFeature") return;

    const file = node.item.primaryFile;
    if (file && this.props.setActivePersistable) {
      this.props.setActivePersistable(file);
    }
  };

  _renderUnfulfilledNode(node: FeaturePipelineNode): JSX.Element {
    if (node.nodeType !== "unfulfilledFeature") {
      return <></>;
    }

    const isVanilla = node.isVanillaReference;
    const referencedId = node.referencedId;

    return (
      <div className="fce-unfulfilled">
        <div className="fce-unfulfilledIcon">
          <FontAwesomeIcon icon={faTriangleExclamation} />
        </div>
        <div className="fce-unfulfilledTitle">
          {isVanilla ? "Vanilla Feature Reference" : "Missing Feature Reference"}
        </div>
        <div className="fce-unfulfilledId">{referencedId}</div>
        <div className="fce-unfulfilledMessage">
          {isVanilla
            ? "This references a vanilla Minecraft feature that is built into the game."
            : "This feature is referenced but cannot be found in the project."}
        </div>
        {!isVanilla && (
          <div className="fce-unfulfilledActions">
            <button className="fce-createButton" disabled aria-label="Create feature">
              <FontAwesomeIcon icon={faPlus} /> Create Feature
            </button>
          </div>
        )}
      </div>
    );
  }

  _renderNodeHeader(node: FeaturePipelineNode): JSX.Element {
    // Header is now simplified - the DataForm shows the identifier info
    // We only show a minimal header for unfulfilled features
    if (node.nodeType === "unfulfilledFeature") {
      return <></>;
    }

    return <></>;
  }

  _renderNodeDetails(node: FeaturePipelineNode): JSX.Element {
    if (node.nodeType === "unfulfilledFeature") {
      return this._renderUnfulfilledNode(node);
    }

    const { dataFormProps } = this.state;

    if (dataFormProps) {
      // Create a wrapper lookup provider that adds our canAddItem capability
      const baseLookupProvider = dataFormProps.lookupProvider;
      const wrappedLookupProvider = {
        getLookupChoices: baseLookupProvider
          ? baseLookupProvider.getLookupChoices.bind(baseLookupProvider)
          : async () => undefined,
        canAddItem: this._canAddItem,
        addItem: baseLookupProvider?.addItem,
      };

      return (
        <div className="fce-form">
          <DataForm
            {...dataFormProps}
            lookupProvider={wrappedLookupProvider}
            onAddItem={this._handleAddItemFromLookup}
          />
        </div>
      );
    }

    // No form available - show raw info
    return (
      <div className="fce-noForm">
        <div className="fce-noFormMessage">Form editor not available for this feature type.</div>
        <button className="fce-goToFileButton" onClick={this._handleGoToFile} aria-label="Edit raw JSON">
          <FontAwesomeIcon icon={faExternalLinkAlt} /> Edit Raw JSON
        </button>
      </div>
    );
  }

  _renderToolbar(): JSX.Element {
    return (
      <div className="fce-toolbar">
        <Stack direction="row" spacing={0.5} aria-label="Feature editor actions">
          <IconButton onClick={this._handleAddFeatureClick} title="Add Feature" aria-label="Add feature">
            <FontAwesomeIcon icon={faPlus} className="fa-lg" />
          </IconButton>
        </Stack>
      </div>
    );
  }

  render() {
    const node = this.props.selectedNode;
    const height = "calc(100vh - " + this.props.heightOffset + "px)";

    const colors = getThemeColors();

    if (!node) {
      return (
        <div
          className="fce-area"
          style={{
            minHeight: height,
            maxHeight: height,
            backgroundColor: colors.background2,
          }}
        >
          {this._renderToolbar()}
          <div className="fce-emptyState">
            <div className="fce-emptyStateMessage">Select a node from the tree or diagram to view its properties.</div>
          </div>
          {this.state.showFeatureTypePicker && (
            <FeatureTypePicker
              isOpen={true}
              theme={this.props.theme}
              onSelect={this._handleFeatureTypeSelected}
              onClose={this._handleFeaturePickerClose}
            />
          )}
        </div>
      );
    }

    return (
      <div
        className="fce-area"
        style={{
          minHeight: height,
          maxHeight: height,
          backgroundColor: colors.background2,
        }}
      >
        {this._renderToolbar()}
        {this._renderNodeHeader(node)}
        <div className="fce-content">
          {!this.state.formLoaded ? <div className="fce-loading">Loading...</div> : this._renderNodeDetails(node)}
        </div>
        {this.state.showFeatureTypePicker && (
          <FeatureTypePicker
            isOpen={true}
            theme={this.props.theme}
            onSelect={this._handleFeatureTypeSelected}
            onClose={this._handleFeaturePickerClose}
          />
        )}
      </div>
    );
  }
}
