// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * RECIPE EDITOR - Main editor shell for Minecraft Bedrock recipes.
 *
 * ARCHITECTURE:
 * Loads a recipe file via RecipeBehaviorDefinition, detects the recipe type
 * (shaped, shapeless, furnace, etc.), and routes to the appropriate
 * sub-editor component. Provides a tabbed header with "Visual" and
 * "Properties" tabs following the EditorHeaderChip pattern used by
 * BlockTypeEditor and EntityTypeEditor.
 *
 * SUPPORTED TYPES:
 * - minecraft:recipe_shaped → ShapedRecipeEditor (drag-and-drop crafting grid)
 * - minecraft:recipe_shapeless → ShapelessRecipeEditor (ingredient list)
 * - Other types → Unsupported placeholder (future: furnace, brewing, smithing)
 *
 * DATA FLOW:
 *   Mount → ensureOnFile → load(preserveComments=true) → detect type → render
 *   Edit → sub-editor fires onRecipeChanged → update definition data → persist
 *
 * RELATED FILES:
 * - RecipeBehaviorDefinition.ts: Data layer (load/persist)
 * - IRecipeBehavior.ts: JSON interfaces
 * - ShapedRecipeEditor.tsx: Visual 3×3 grid editor
 * - ShapelessRecipeEditor.tsx: Ingredient list editor
 * - RecipePropertiesPanel.tsx: Shared properties (identifier, tags, etc.)
 * - ItemSpritePicker.tsx / ItemSpriteIcon.tsx: Item selection & display
 */

import { Component } from "react";
import IFileProps from "../../project/fileExplorer/IFileProps";
import IFile from "../../../storage/IFile";
import "./RecipeEditor.css";
import RecipeBehaviorDefinition from "../../../minecraft/RecipeBehaviorDefinition";
import IRecipeBehavior, { IRecipeShaped, IRecipeShapeless } from "../../../minecraft/IRecipeBehavior";
import ProjectItem from "../../../app/ProjectItem";
import { ProjectItemType } from "../../../app/IProjectItemData";
import ShapedRecipeEditor from "./ShapedRecipeEditor";
import ShapelessRecipeEditor from "./ShapelessRecipeEditor";
import RecipePropertiesPanel from "./RecipePropertiesPanel";
import { CustomTabLabel } from "../../shared/components/feedback/labels/Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHome, faSliders } from "@fortawesome/free-solid-svg-icons";
import { Stack, Button } from "@mui/material";
import { EditorHeaderChip, EditorHeaderBar, EditorHeaderTabs } from "../../appShell/EditorHeader";
import WebUtilities from "../../utils/WebUtilities";
import CreatorTools from "../../../app/CreatorTools";
import Project from "../../../app/Project";
import IProjectTheme from "../../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../../withLocalization";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import Utilities from "../../../core/Utilities";
import StorageUtilities from "../../../storage/StorageUtilities";

export enum RecipeEditorMode {
  visual = 0,
  properties = 1,
}

interface IRecipeEditorProps extends IFileProps, WithLocalizationProps {
  heightOffset: number;
  readOnly: boolean;
  item: ProjectItem;
  project: Project;
  creatorTools: CreatorTools;
  theme: IProjectTheme;
}

interface IRecipeEditorState {
  fileToEdit: IFile;
  mode: RecipeEditorMode;
  isLoaded: boolean;
}

class RecipeEditor extends Component<IRecipeEditorProps, IRecipeEditorState> {
  private _lastFileEdited?: IFile;
  private _isMounted: boolean = false;

  constructor(props: IRecipeEditorProps) {
    super(props);

    this._handleRecipeLoaded = this._handleRecipeLoaded.bind(this);
    this._setVisualMode = this._setVisualMode.bind(this);
    this._setPropertiesMode = this._setPropertiesMode.bind(this);
    this._handleShapedRecipeChanged = this._handleShapedRecipeChanged.bind(this);
    this._handleShapelessRecipeChanged = this._handleShapelessRecipeChanged.bind(this);
    this._handlePropertiesChanged = this._handlePropertiesChanged.bind(this);

    this.state = {
      fileToEdit: props.file,
      mode: RecipeEditorMode.visual,
      isLoaded: false,
    };
  }

  static getDerivedStateFromProps(props: IRecipeEditorProps, state: IRecipeEditorState) {
    if (state === undefined || state === null) {
      return {
        fileToEdit: props.file,
        mode: RecipeEditorMode.visual,
        isLoaded: false,
      };
    }

    if (props.file !== state.fileToEdit) {
      return {
        fileToEdit: props.file,
        isLoaded: false,
      };
    }

    return null;
  }

  componentDidMount(): void {
    this._isMounted = true;
    this._updateManager();
  }

  componentWillUnmount(): void {
    this._isMounted = false;
  }

  componentDidUpdate(prevProps: Readonly<IRecipeEditorProps>): void {
    if (prevProps.file !== this.state.fileToEdit) {
      this._updateManager();
    }
  }

  async _updateManager() {
    if (this.state.fileToEdit !== this._lastFileEdited) {
      this._lastFileEdited = this.state.fileToEdit;
      await RecipeBehaviorDefinition.ensureOnFile(this.state.fileToEdit, this._handleRecipeLoaded);
    }

    if (
      this.state.fileToEdit &&
      this.state.fileToEdit.manager instanceof RecipeBehaviorDefinition &&
      (this.state.fileToEdit.manager as RecipeBehaviorDefinition).isLoaded &&
      !this.state.isLoaded
    ) {
      // Upgrade to comment-preserving load for editing
      await (this.state.fileToEdit.manager as RecipeBehaviorDefinition).load(true);
      this._doUpdate();
    }
  }

  _handleRecipeLoaded(): void {
    if (this._isMounted) {
      this._upgradeAndUpdate();
    }
  }

  async _upgradeAndUpdate(): Promise<void> {
    if (this.state.fileToEdit.manager instanceof RecipeBehaviorDefinition) {
      await (this.state.fileToEdit.manager as RecipeBehaviorDefinition).load(true);
    }
    this._doUpdate();
  }

  _doUpdate(): void {
    if (this._isMounted) {
      this.setState({ isLoaded: true });
    }
  }

  async persist(): Promise<boolean> {
    if (this.state.fileToEdit?.manager instanceof RecipeBehaviorDefinition) {
      return (this.state.fileToEdit.manager as RecipeBehaviorDefinition).persist();
    }
    return false;
  }

  _setVisualMode(): void {
    this.setState({ mode: RecipeEditorMode.visual });
  }

  _setPropertiesMode(): void {
    this.setState({ mode: RecipeEditorMode.properties });
  }

  private _getDefinition(): RecipeBehaviorDefinition | undefined {
    if (this.state.fileToEdit?.manager instanceof RecipeBehaviorDefinition) {
      return this.state.fileToEdit.manager as RecipeBehaviorDefinition;
    }
    return undefined;
  }

  private _getRecipeType(): string {
    const def = this._getDefinition();
    if (!def?.data) return "unknown";

    if (def.data["minecraft:recipe_shaped"]) return "shaped";
    if (def.data["minecraft:recipe_shapeless"]) return "shapeless";
    return "unknown";
  }

  private _handleShapedRecipeChanged(data: IRecipeShaped): void {
    const def = this._getDefinition();
    if (!def?.data) return;

    def.data["minecraft:recipe_shaped"] = data;
    def.persist();
    if (this._isMounted) this.forceUpdate();
  }

  private _handleShapelessRecipeChanged(data: IRecipeShapeless): void {
    const def = this._getDefinition();
    if (!def?.data) return;

    def.data["minecraft:recipe_shapeless"] = data;
    def.persist();
    if (this._isMounted) this.forceUpdate();
  }

  private _handlePropertiesChanged(json: IRecipeBehavior): void {
    const def = this._getDefinition();
    if (!def) return;

    def.data = json;
    def.persist();
    if (this._isMounted) this.forceUpdate();
  }

  render() {
    const height = "calc(100vh - " + (this.props.heightOffset - 1) + "px)";
    const width = WebUtilities.getWidth();
    const isButtonCompact = width < 900;
    const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;

    if (!this.state.isLoaded) {
      return <div className="rcre-loading">Loading recipe...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    const def = this._getDefinition();
    if (!def?.data) {
      return <div className="rcre-loading">Could not load recipe definition.</div>;
    }

    const recipeType = this._getRecipeType();
    const typeName =
      recipeType === "shaped" ? "Shaped Recipe" : recipeType === "shapeless" ? "Shapeless Recipe" : "Recipe";

    // Build the mode-specific content
    let modeArea: React.ReactNode;

    if (this.state.mode === RecipeEditorMode.visual) {
      if (recipeType === "shaped" && def.data["minecraft:recipe_shaped"]) {
        modeArea = (
          <div className="rcre-content-area">
            <ShapedRecipeEditor
              recipeData={def.data["minecraft:recipe_shaped"]}
              project={this.props.project}
              darkTheme={isDark}
              onRecipeChanged={this._handleShapedRecipeChanged}
              readOnly={this.props.readOnly}
            />
          </div>
        );
      } else if (recipeType === "shapeless" && def.data["minecraft:recipe_shapeless"]) {
        modeArea = (
          <div className="rcre-content-area">
            <ShapelessRecipeEditor
              recipeData={def.data["minecraft:recipe_shapeless"]}
              project={this.props.project}
              darkTheme={isDark}
              onRecipeChanged={this._handleShapelessRecipeChanged}
              readOnly={this.props.readOnly}
            />
          </div>
        );
      } else {
        // Recipe shape isn't shaped or shapeless (could be furnace, brewing, smithing, etc.,
        // or an empty stub from the wizard). Surface a clearer hint and a one-click seed for
        // the most common case so the user isn't left at a dead end.
        const isEmpty = recipeType === "unknown";
        modeArea = (
          <div className="rcre-unsupported">
            <div className="rcre-unsupported-type">{isEmpty ? "Empty recipe" : `${recipeType} recipe`}</div>
            <div className="rcre-unsupported-hint">
              {isEmpty
                ? "This recipe has no content yet. Use the Properties tab to choose a recipe type, or click below to start with a shapeless recipe."
                : "Visual editor not yet available for this recipe type. Use the Properties tab or switch to raw JSON view."}
            </div>
            {isEmpty && (
              <Button
                variant="contained"
                onClick={() =>
                  this._handleShapelessRecipeChanged({
                    description: { identifier: def.id || "" },
                    tags: ["crafting_table"],
                    ingredients: [],
                    result: { item: "" },
                  } as IRecipeShapeless)
                }
                style={{ marginTop: 12 }}
              >
                Start as shapeless recipe
              </Button>
            )}
          </div>
        );
      }
    } else {
      modeArea = (
        <div className="rcre-content-area">
          <RecipePropertiesPanel
            recipeJson={def.data}
            darkTheme={isDark}
            readOnly={this.props.readOnly}
            onChanged={this._handlePropertiesChanged}
          />
        </div>
      );
    }

    return (
      <div
        className="rcre-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <EditorHeaderChip itemType={ProjectItemType.recipeBehavior} theme={this.props.theme}>
          <EditorHeaderBar
            itemId={
              def.id ||
              (this.state.fileToEdit?.name
                ? Utilities.humanifyMinecraftName(StorageUtilities.getBaseFromName(this.state.fileToEdit.name))
                : "(new recipe)")
            }
            itemType={ProjectItemType.recipeBehavior}
            typeName={typeName}
            formatVersion={def.data.format_version}
          />
          <EditorHeaderTabs>
            <Stack direction="row" spacing={0.5} aria-label="Recipe editor tabs">
              <Button onClick={this._setVisualMode} title="Visual recipe editor">
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faHome} className="fa-lg" />}
                  text="Visual"
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === RecipeEditorMode.visual}
                  theme={this.props.theme}
                />
              </Button>
              <Button onClick={this._setPropertiesMode} title="Recipe properties">
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faSliders} className="fa-lg" />}
                  text="Properties"
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === RecipeEditorMode.properties}
                  theme={this.props.theme}
                />
              </Button>
            </Stack>
          </EditorHeaderTabs>
        </EditorHeaderChip>

        <div className="rcre-main-area">{modeArea}</div>
      </div>
    );
  }
}

export default withLocalization(RecipeEditor);
