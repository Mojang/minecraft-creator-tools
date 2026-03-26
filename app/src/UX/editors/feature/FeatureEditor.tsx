// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * FEATURE EDITOR
 * ==============
 *
 * Main editor component for Features and Feature Rules.
 *
 * This editor displays the complete feature pipeline hierarchy, showing:
 * - Feature Rules at the top (placement conditions)
 * - Composite features (aggregate, scatter, sequence, etc.)
 * - Terminal features (single_block, ore, tree, etc.)
 *
 * KEY CONCEPTS:
 * - Same component handles both Feature Rules and Features
 * - The hierarchy shown is the same regardless of entry point
 * - The selected/focused node differs based on which file was opened
 * - Uses ProjectItemRelations for dependency tracking
 *
 * MODES:
 * - Tree View: Hierarchical list with detail panel
 * - Diagram View: Visual node graph
 * - Settings View: Form-based editing of the selected node
 */

import { Component } from "react";
import IFileProps from "../../project/fileExplorer/IFileProps";
import IFile from "../../../storage/IFile";
import "./FeatureEditor.css";
import ProjectItem from "../../../app/ProjectItem";
import CreatorTools from "../../../app/CreatorTools";
import Project from "../../../app/Project";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { Stack, Button } from "@mui/material";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import { CustomTabLabel } from "../../shared/components/feedback/labels/Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDiagramProject, faList, faPlus } from "@fortawesome/free-solid-svg-icons";
import WebUtilities from "../../utils/WebUtilities";
import FeatureTreeEditor from "./FeatureTreeEditor";
import FeatureDiagramEditor from "./FeatureDiagramEditor";
import { buildFeaturePipeline, IFeaturePipeline, FeaturePipelineNode } from "./FeaturePipelineUtilities";
import FeatureDefinition from "../../../minecraft/FeatureDefinition";
import FeatureRuleDefinition from "../../../minecraft/FeatureRuleDefinition";
import FeatureTypePicker from "./FeatureTypePicker";
import { FolderContext } from "../../../app/Project";
import { ProjectItemCreationType } from "../../../app/IProjectItemData";
import IProjectTheme from "../../types/IProjectTheme";

export enum FeatureEditorMode {
  tree = 0,
  diagram = 1,
}

interface IFeatureEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  item: ProjectItem;
  project: Project;
  creatorTools: CreatorTools;
  theme: IProjectTheme;
}

interface IFeatureEditorState {
  fileToEdit: IFile;
  mode: FeatureEditorMode;
  isLoaded: boolean;
  pipeline: IFeaturePipeline | undefined;
  selectedNode: FeaturePipelineNode | undefined;
  showFeatureTypePicker: boolean;
  diagramRefreshKey: number;
}

export default class FeatureEditor extends Component<IFeatureEditorProps, IFeatureEditorState> {
  private _lastFileEdited?: IFile;

  constructor(props: IFeatureEditorProps) {
    super(props);

    this._handleDefinitionLoaded = this._handleDefinitionLoaded.bind(this);
    this._setTreeMode = this._setTreeMode.bind(this);
    this._setDiagramMode = this._setDiagramMode.bind(this);
    this._handleNodeSelected = this._handleNodeSelected.bind(this);
    this._handleAddFeatureClick = this._handleAddFeatureClick.bind(this);
    this._handleFeatureTypeSelected = this._handleFeatureTypeSelected.bind(this);
    this._handleFeaturePickerClose = this._handleFeaturePickerClose.bind(this);
    this._handlePipelineChanged = this._handlePipelineChanged.bind(this);

    this.state = {
      fileToEdit: props.file,
      mode: FeatureEditorMode.tree,
      isLoaded: false,
      pipeline: undefined,
      selectedNode: undefined,
      showFeatureTypePicker: false,
      diagramRefreshKey: 0,
    };
  }

  static getDerivedStateFromProps(props: IFeatureEditorProps, state: IFeatureEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        mode: FeatureEditorMode.tree,
        isLoaded: false,
        pipeline: undefined,
        selectedNode: undefined,
        showFeatureTypePicker: false,
        diagramRefreshKey: 0,
      };

      return state;
    }

    if (props.file !== state.fileToEdit) {
      state.fileToEdit = props.file;
      state.isLoaded = false;
      state.pipeline = undefined;
      state.selectedNode = undefined;
      state.showFeatureTypePicker = false;

      return state;
    }

    return null;
  }

  componentDidMount(): void {
    this._updateManager(true);
  }

  componentDidUpdate(prevProps: IFeatureEditorProps, prevState: IFeatureEditorState): void {
    if (prevProps.file !== this.props.file) {
      this._updateManager(true);
    }
  }

  async _updateManager(setState: boolean) {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;
        await this._doUpdate(setState);
      }
    }
  }

  _handleDefinitionLoaded() {
    if (this.state) {
      this._doUpdate(true);
    }
  }

  async _doUpdate(setState: boolean) {
    const item = this.props.item;

    // Load the definition
    if (item.itemType === ProjectItemType.featureRuleBehavior) {
      if (this.state.fileToEdit) {
        const ruleDef = await FeatureRuleDefinition.ensureOnFile(this.state.fileToEdit);
        if (ruleDef && !ruleDef.isLoaded) {
          ruleDef.onLoaded.subscribe(this._handleDefinitionLoaded);
          return;
        }
      }
    } else if (item.itemType === ProjectItemType.featureBehavior) {
      if (this.state.fileToEdit) {
        const featureDef = await FeatureDefinition.ensureOnFile(this.state.fileToEdit);
        if (featureDef && !featureDef.isLoaded) {
          featureDef.onLoaded.subscribe(this._handleDefinitionLoaded);
          return;
        }
      }
    }

    // Build the pipeline
    const pipeline = await buildFeaturePipeline(this.props.project, item);

    if (setState) {
      this.setState({
        fileToEdit: this.state.fileToEdit,
        mode: this.state.mode,
        isLoaded: true,
        pipeline: pipeline,
        selectedNode: pipeline.startingNode,
      });
    }
  }

  _setTreeMode() {
    this.setState({
      ...this.state,
      mode: FeatureEditorMode.tree,
    });
  }

  _setDiagramMode() {
    this.setState({
      ...this.state,
      mode: FeatureEditorMode.diagram,
    });
  }

  _handleAddFeatureClick() {
    this.setState({
      ...this.state,
      showFeatureTypePicker: true,
    });
  }

  _handleFeaturePickerClose() {
    this.setState({
      ...this.state,
      showFeatureTypePicker: false,
    });
  }

  async _handleFeatureTypeSelected(featureType: string, featureName: string) {
    this.setState({
      ...this.state,
      showFeatureTypePicker: false,
    });

    const project = this.props.project;
    if (!project) {
      return;
    }

    // Get the project's short name/namespace
    const projectName = project.name?.toLowerCase().replace(/[^a-z0-9_]/g, "_") || "mypack";

    // Clean the feature name
    let cleanName = featureName.toLowerCase().replace(/[^a-z0-9_]/g, "_");

    // Find the behavior pack folder
    const bpFolder = await project.getDefaultBehaviorPackFolder();
    if (!bpFolder) {
      return;
    }

    // Check for existing features with the same name and auto-increment if needed
    const featuresFolder = bpFolder.ensureFolder("features");
    await featuresFolder.load();

    let suffix = 0;
    let finalName = cleanName;
    while (featuresFolder.fileExists(`${finalName}.json`)) {
      suffix++;
      finalName = `${cleanName}_${suffix}`;
    }
    cleanName = finalName;

    // Create the identifier
    const identifier = `${projectName}:${cleanName}`;

    // Create the feature JSON content
    const featureContent = {
      format_version: "1.13.0",
      [`minecraft:${featureType}`]: {
        description: {
          identifier: identifier,
        },
      },
    };

    // Create the file
    const file = featuresFolder.ensureFile(`${cleanName}.json`);

    file.setContent(JSON.stringify(featureContent, null, 2));

    // Save the file
    await file.saveContent();

    // Add the new file as a project item
    project.ensureItemFromFile(
      file,
      ProjectItemType.featureBehavior,
      FolderContext.behaviorPack,
      ProjectItemCreationType.normal
    );

    // Refresh the pipeline and increment the refresh key to show the new feature in the diagram
    this.setState({ diagramRefreshKey: this.state.diagramRefreshKey + 1 }, async () => {
      await this._handlePipelineChanged();
    });
  }

  _handleNodeSelected(node: FeaturePipelineNode | undefined) {
    this.setState({
      ...this.state,
      selectedNode: node,
    });
  }

  async _handlePipelineChanged() {
    // Reload the pipeline after a connection change
    const item = this.props.item;
    if (item.itemType === ProjectItemType.featureRuleBehavior) {
      if (this.state.fileToEdit) {
        const ruleDef = await FeatureRuleDefinition.ensureOnFile(this.state.fileToEdit);
        if (ruleDef) {
          const pipeline = await buildFeaturePipeline(this.props.project, item);
          this.setState({ pipeline, isLoaded: true });
        }
      }
    } else if (item.itemType === ProjectItemType.featureBehavior) {
      if (this.state.fileToEdit) {
        const featureDef = await FeatureDefinition.ensureOnFile(this.state.fileToEdit);
        if (featureDef) {
          const pipeline = await buildFeaturePipeline(this.props.project, item);
          this.setState({ pipeline, isLoaded: true });
        }
      }
    }
  }

  _getTitle(): string {
    if (!this.state.pipeline?.startingNode) {
      return "Feature Editor";
    }

    const node = this.state.pipeline.startingNode;
    if (node.nodeType === "unfulfilledFeature") {
      return node.referencedId;
    }

    return node.id || "Feature Editor";
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";
    const colors = getThemeColors();

    if (!this.state.isLoaded || !this.state.pipeline) {
      return (
        <div
          className="fe-area"
          style={{
            minHeight: height,
            maxHeight: height,
            backgroundColor: colors.sectionHeaderBackground,
            color: colors.sectionHeaderForeground,
          }}
        >
          <div className="fe-loading">Loading feature pipeline...</div>
        </div>
      );
    }

    const pipeline = this.state.pipeline;

    let modeArea = <></>;

    if (this.state.mode === FeatureEditorMode.tree) {
      modeArea = (
        <FeatureTreeEditor
          pipeline={pipeline}
          selectedNode={this.state.selectedNode}
          onNodeSelected={this._handleNodeSelected}
          project={this.props.project}
          creatorTools={this.props.creatorTools}
          theme={this.props.theme}
          heightOffset={this.props.heightOffset + 90}
          readOnly={this.props.readOnly}
        />
      );
    } else if (this.state.mode === FeatureEditorMode.diagram) {
      modeArea = (
        <FeatureDiagramEditor
          pipeline={pipeline}
          selectedNode={this.state.selectedNode}
          onNodeSelected={this._handleNodeSelected}
          onPipelineChanged={this._handlePipelineChanged}
          project={this.props.project}
          creatorTools={this.props.creatorTools}
          theme={this.props.theme}
          heightOffset={this.props.heightOffset + 90}
          readOnly={this.props.readOnly}
          refreshKey={this.state.diagramRefreshKey}
        />
      );
    }

    return (
      <div
        className="fe-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div
          className="fe-header"
          style={{
            backgroundColor: colors.contentBackground,
            color: colors.contentForeground,
          }}
        >
          {this._getTitle()}
        </div>

        <div className="fe-mainArea">
          <div
            className="fe-toolBarArea"
            style={{
              backgroundColor: colors.contentBackground,
              color: colors.contentForeground,
            }}
          >
            <Stack direction="row" spacing={1} aria-label="Feature editor actions">
              <Button onClick={this._setTreeMode} title="View feature hierarchy as a tree">
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faList} className="fa-lg" />}
                  text={"Tree"}
                  isCompact={WebUtilities.getWidth() < 1016}
                  isSelected={this.state.mode === FeatureEditorMode.tree}
                  theme={this.props.theme}
                />
              </Button>
              <Button onClick={this._setDiagramMode} title="View feature hierarchy as a diagram">
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faDiagramProject} className="fa-lg" />}
                  text={"Diagram"}
                  isCompact={WebUtilities.getWidth() < 1016}
                  isSelected={this.state.mode === FeatureEditorMode.diagram}
                  theme={this.props.theme}
                />
              </Button>
              <Button onClick={this._handleAddFeatureClick} title="Add a new feature to the project">
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faPlus} className="fa-lg" />}
                  text={"Add Feature"}
                  isCompact={WebUtilities.getWidth() < 1016}
                  isSelected={false}
                  theme={this.props.theme}
                />
              </Button>
            </Stack>
          </div>
          <div
            className="fe-contentArea"
            style={{
              backgroundColor: colors.sectionHeaderBackground,
              color: colors.sectionHeaderForeground,
            }}
          >
            {modeArea}
          </div>
        </div>
        {this.state.showFeatureTypePicker && (
          <FeatureTypePicker
            isOpen={this.state.showFeatureTypePicker}
            theme={this.props.theme}
            onSelect={this._handleFeatureTypeSelected}
            onClose={this._handleFeaturePickerClose}
          />
        )}
      </div>
    );
  }
}
