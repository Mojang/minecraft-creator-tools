import { Component } from "react";
import IFileProps from "../../project/fileExplorer/IFileProps";
import IFile from "../../../storage/IFile";
import "./ItemTypeEditor.css";
import ItemTypeDefinition from "../../../minecraft/ItemTypeDefinition";
import ItemTextureCatalogDefinition from "../../../minecraft/ItemTextureCatalogDefinition";
import TextureDefinition from "../../../minecraft/TextureDefinition";
import StorageUtilities from "../../../storage/StorageUtilities";
import { IItemTextureNode } from "../../../minecraft/IItemTexture";
import Database from "../../../minecraft/Database";
import ProjectItem from "../../../app/ProjectItem";
import ItemTypeComponentSetEditor from "./ItemTypeComponentSetEditor";
import Project from "../../../app/Project";
import CreatorTools from "../../../app/CreatorTools";
import { CustomTabLabel } from "../../shared/components/feedback/labels/Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSquarePlus } from "@fortawesome/free-regular-svg-icons";
import WebUtilities from "../../utils/WebUtilities";
import { faBolt, faCow, faImage } from "@fortawesome/free-solid-svg-icons";
import { Stack, Button } from "@mui/material";
import ItemTypeActionEditor from "./ItemTypeActionEditor";
import ItemTypeAttachableEditor from "./ItemTypeAttachableEditor";
import ImageEditor from "../../media/ImageEditor";
import telemetry from "../../../analytics/Telemetry";
import { TelemetryEvents, TelemetryProperties } from "../../../analytics/TelemetryConstants";
import { EditorHeaderChip, EditorHeaderBar, EditorHeaderTabs } from "../../appShell/EditorHeader";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../../withLocalization";

interface IItemTypeEditorProps extends IFileProps, WithLocalizationProps {
  heightOffset: number;
  readOnly: boolean;
  item: ProjectItem;
  project: Project;
  creatorTools: CreatorTools;
  theme: IProjectTheme;
}

interface IItemTypeEditorState {
  fileToEdit: IFile;
  mode: ItemTypeEditorMode;
  visualsSubMode: ItemTypeVisualsSubMode;
  iconImageItem?: ProjectItem;
  isLoaded: boolean;
}

export enum ItemTypeEditorMode {
  properties = 1,
  visuals = 2,
  actions = 3,
}

export enum ItemTypeVisualsSubMode {
  components = 1,
  image = 2,
}

class ItemTypeEditor extends Component<IItemTypeEditorProps, IItemTypeEditorState> {
  private _lastFileEdited?: IFile;

  constructor(props: IItemTypeEditorProps) {
    super(props);

    this._handleItemTypeLoaded = this._handleItemTypeLoaded.bind(this);
    this._setPropertiesMode = this._setPropertiesMode.bind(this);
    this._setActionsMode = this._setActionsMode.bind(this);
    this._setVisualsMode = this._setVisualsMode.bind(this);
    this._setVisualsComponentsSubMode = this._setVisualsComponentsSubMode.bind(this);
    this._setVisualsImageSubMode = this._setVisualsImageSubMode.bind(this);

    this.state = {
      fileToEdit: props.file,
      mode: ItemTypeEditorMode.properties,
      visualsSubMode: ItemTypeVisualsSubMode.image,
      iconImageItem: undefined,
      isLoaded: false,
    };
  }

  componentDidMount(): void {
    this._updateManager();
  }

  componentDidUpdate(prevProps: Readonly<IItemTypeEditorProps>, prevState: Readonly<IItemTypeEditorState>): void {
    if (this.state && this.props.file !== this.state.fileToEdit) {
      this.setState(
        {
          fileToEdit: this.props.file,
          isLoaded: false,
        },
        () => {
          this._updateManager();
        }
      );
    }
  }

  async _updateManager(force?: boolean) {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        const itbd = await ItemTypeDefinition.ensureOnFile(this.state.fileToEdit, this._handleItemTypeLoaded, true);

        if (itbd) {
          await itbd.load(true);
        }

        this._lastFileEdited = this.state.fileToEdit;
      }
    }

    await this.props.item.ensureDependencies();

    this._doUpdate();

    // Resolve the icon PNG project item (if any) so the Visuals tab can
    // offer an Image sub-tab pointing the ImageEditor at it. Done as a
    // separate setState so the rest of the editor renders without waiting.
    void this._resolveIconImageItem();
  }

  private async _resolveIconImageItem(): Promise<void> {
    if (!this.state || !this.state.fileToEdit || !this.state.fileToEdit.manager) {
      return;
    }

    const itbd = this.state.fileToEdit.manager as ItemTypeDefinition;
    if (!(itbd instanceof ItemTypeDefinition)) {
      return;
    }

    const iconImageItem = await ItemTypeEditor.findIconImageProjectItem(itbd, this.props.project);

    if (iconImageItem && !iconImageItem.isContentLoaded) {
      await iconImageItem.loadContent();
    }

    if (iconImageItem !== this.state.iconImageItem) {
      this.setState((prevState) => {
        if (prevState.iconImageItem === iconImageItem) {
          return null;
        }
        return { iconImageItem };
      });
    }
  }

  /**
   * Resolves the item's `minecraft:icon` texture short-name to a concrete
   * `ProjectItemType.texture` (PNG) project item by walking the project's
   * item_texture.json catalogs. Returns undefined if no PNG match is found
   * (e.g. the icon resolves to a vanilla texture not present in the project,
   * or the item has no `minecraft:icon` component).
   */
  private static async findIconImageProjectItem(
    itbd: ItemTypeDefinition,
    project: Project
  ): Promise<ProjectItem | undefined> {
    const key = itbd.getIconTextureKey();
    if (!key) {
      return undefined;
    }

    // Some projects key item_texture.json by short name (e.g. "pickaxe")
    // while others use the namespaced identifier (e.g. "mc_myaddons:pickaxe").
    // We try both: the raw value first, then the portion after the last colon.
    const candidateKeys = [key];
    const colonIdx = key.lastIndexOf(":");
    if (colonIdx >= 0 && colonIdx < key.length - 1) {
      candidateKeys.push(key.substring(colonIdx + 1));
    }

    // Resolve short-name -> texture relative path via item_texture.json catalogs.
    let texturePath: string | undefined;
    const catalogItems = project.getItemsByType(ProjectItemType.itemTextureJson);
    for (const catalogItem of catalogItems) {
      if (!catalogItem.isContentLoaded) {
        await catalogItem.loadContent();
      }
      if (!catalogItem.primaryFile) {
        continue;
      }
      const catalog = await ItemTextureCatalogDefinition.ensureOnFile(catalogItem.primaryFile);
      let entry: { textures?: unknown } | undefined;
      for (const ck of candidateKeys) {
        entry = catalog?.data?.texture_data?.[ck];
        if (entry) {
          break;
        }
      }
      if (!entry) {
        continue;
      }
      const t = entry.textures;
      if (typeof t === "string") {
        texturePath = TextureDefinition.canonicalizeTexturePath(t);
      } else if (Array.isArray(t)) {
        for (const candidate of t) {
          if (typeof candidate === "string") {
            texturePath = TextureDefinition.canonicalizeTexturePath(candidate);
          } else if (candidate && typeof (candidate as IItemTextureNode).path === "string") {
            texturePath = TextureDefinition.canonicalizeTexturePath((candidate as IItemTextureNode).path);
          }
          if (texturePath) break;
        }
      } else if (t && typeof (t as IItemTextureNode).path === "string") {
        texturePath = TextureDefinition.canonicalizeTexturePath((t as IItemTextureNode).path);
      }
      if (texturePath) break;
    }

    if (!texturePath) {
      return undefined;
    }

    // Find a PNG project item whose path under its resource-pack root matches.
    const textureItems = project.getItemsByType(ProjectItemType.texture);
    for (const textureItem of textureItems) {
      if (!textureItem.isContentLoaded) {
        await textureItem.loadContent();
      }
      const file = textureItem.primaryFile;
      if (!file || !file.parentFolder) {
        continue;
      }
      const packRootFolder = StorageUtilities.getParentOfParentFolderNamed("textures", file.parentFolder);
      if (!packRootFolder) {
        continue;
      }
      const rel = TextureDefinition.canonicalizeTexturePath(StorageUtilities.getBaseRelativePath(file, packRootFolder));
      if (rel === texturePath) {
        return textureItem;
      }
    }

    return undefined;
  }

  _handleItemTypeLoaded(itemType: ItemTypeDefinition, typeA: ItemTypeDefinition) {
    this._doUpdate();
  }

  async _doUpdate() {
    if (
      this.state.fileToEdit &&
      this.state.fileToEdit.manager !== undefined &&
      this.state.fileToEdit.manager instanceof ItemTypeDefinition &&
      (this.state.fileToEdit.manager as ItemTypeDefinition).isLoaded &&
      !this.state.isLoaded
    ) {
      this.setState({
        fileToEdit: this.props.file,
        isLoaded: true,
      });

      // Now that the item type is loaded, its minecraft:icon component is
      // readable. Re-resolve the icon PNG so the Visuals tab can offer the
      // Image sub-tab. The initial componentDidMount call may have run
      // before isLoaded === true.
      void this._resolveIconImageItem();
    }
  }

  async persist(): Promise<boolean> {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager) {
        const et = file.manager as ItemTypeDefinition;

        return et.persist();
      }
    }

    return false;
  }

  _setPropertiesMode() {
    this._setMode(ItemTypeEditorMode.properties);
  }

  _setVisualsMode() {
    this._setMode(ItemTypeEditorMode.visuals);
  }

  _setActionsMode() {
    this._setMode(ItemTypeEditorMode.actions);
  }

  _setVisualsComponentsSubMode() {
    this._setVisualsSubMode(ItemTypeVisualsSubMode.components);
  }

  _setVisualsImageSubMode() {
    this._setVisualsSubMode(ItemTypeVisualsSubMode.image);
  }

  _setVisualsSubMode(visualsSubMode: ItemTypeVisualsSubMode) {
    this.setState((prevState) => ({
      ...prevState,
      visualsSubMode,
    }));
  }

  _setMode(mode: ItemTypeEditorMode) {
    telemetry.trackEvent({
      name: TelemetryEvents.ITEM_TYPE_EDITOR_VIEW_CHANGE,
      properties: {
        [TelemetryProperties.MODE]: ItemTypeEditorMode[mode],
      },
    });

    this.setState((prevState) => ({
      fileToEdit: prevState.fileToEdit,
      isLoaded: prevState.isLoaded,
      mode: mode,
    }));
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";
    const width = WebUtilities.getWidth();
    let isButtonCompact = false;

    if (width < 716) {
      isButtonCompact = true;
    }

    if (
      this.state === null ||
      this.state.fileToEdit === null ||
      this.state.fileToEdit.manager === undefined ||
      Database.uxCatalog === null
    ) {
      return <div className="ite-loading">Loading...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    const itbd = this.state.fileToEdit.manager as ItemTypeDefinition;

    if (itbd.data === undefined) {
      return <div className="ite-loading">Loading...</div>;
    }

    let mode = <></>;

    if (this.state.mode === ItemTypeEditorMode.properties) {
      mode = (
        <div>
          <ItemTypeComponentSetEditor
            itemTypeDefinition={itbd}
            theme={this.props.theme}
            isDefault={true}
            project={this.props.project}
            creatorTools={this.props.creatorTools}
            isVisualsMode={false}
            heightOffset={this.props.heightOffset + 99}
          />
        </div>
      );
    } else if (this.state.mode === ItemTypeEditorMode.visuals) {
      let attachableItem = undefined;
      if (this.props.item && this.props.item.childItems) {
        for (const childItem of this.props.item.childItems) {
          if (childItem.childItem.itemType === ProjectItemType.attachableResourceJson) {
            attachableItem = childItem.childItem;
          }
        }
      }

      if (attachableItem && attachableItem.primaryFile) {
        mode = (
          <div
            className="ite-attachableArea"
            style={{
              borderColor: getThemeColors().background6,
            }}
          >
            <ItemTypeAttachableEditor
              readOnly={this.props.readOnly}
              theme={this.props.theme}
              displayHeader={false}
              item={attachableItem}
              project={this.props.project}
              creatorTools={this.props.creatorTools}
              file={attachableItem.primaryFile}
              heightOffset={this.props.heightOffset + 106}
            />
          </div>
        );
      } else {
        const iconImageItem = this.state.iconImageItem;
        const hasImageSubTab = iconImageItem !== undefined && iconImageItem.primaryFile !== undefined;
        // When an Image sub-tab is available, render a small sub-tab strip plus
        // the selected sub-view. The Components sub-view keeps the existing
        // visual-components editor; the Image sub-view embeds the pixel
        // ImageEditor pointed at the resolved icon PNG. When no PNG can be
        // resolved we fall back to the existing single-pane components editor
        // so we don't show an orphaned sub-tab bar.
        const componentsSubView = (
          <ItemTypeComponentSetEditor
            itemTypeDefinition={itbd}
            theme={this.props.theme}
            isDefault={true}
            project={this.props.project}
            creatorTools={this.props.creatorTools}
            isVisualsMode={true}
            heightOffset={this.props.heightOffset + (hasImageSubTab ? 152 : 106)}
          />
        );

        if (!hasImageSubTab) {
          mode = <div>{componentsSubView}</div>;
        } else {
          const isImageSubMode = this.state.visualsSubMode === ItemTypeVisualsSubMode.image;
          const subView = isImageSubMode ? (
            <ImageEditor
              theme={this.props.theme}
              creatorTools={this.props.creatorTools}
              projectItem={iconImageItem!}
              name={iconImageItem!.primaryFile!.name}
              content={
                iconImageItem!.primaryFile!.content instanceof Uint8Array
                  ? iconImageItem!.primaryFile!.content
                  : undefined
              }
              heightOffset={this.props.heightOffset + 152}
            />
          ) : (
            componentsSubView
          );

          mode = (
            <div>
              <Stack
                direction="row"
                spacing={0.5}
                className="ite-visualsSubTabs"
                aria-label={this.props.intl.formatMessage({ id: "project_editor.item.aria_actions" })}
              >
                <Button
                  onClick={this._setVisualsComponentsSubMode}
                  title={this.props.intl.formatMessage({ id: "project_editor.item.tooltip_visuals_components" })}
                >
                  <CustomTabLabel
                    icon={<FontAwesomeIcon icon={faSquarePlus} className="fa-lg" />}
                    text={this.props.intl.formatMessage({ id: "project_editor.item.visuals_sub_components" })}
                    isCompact={isButtonCompact}
                    isSelected={!isImageSubMode}
                    theme={this.props.theme}
                  />
                </Button>
                <Button
                  onClick={this._setVisualsImageSubMode}
                  title={this.props.intl.formatMessage({ id: "project_editor.item.tooltip_visuals_image" })}
                >
                  <CustomTabLabel
                    icon={<FontAwesomeIcon icon={faImage} className="fa-lg" />}
                    text={this.props.intl.formatMessage({ id: "project_editor.item.visuals_sub_image" })}
                    isCompact={isButtonCompact}
                    isSelected={isImageSubMode}
                    theme={this.props.theme}
                  />
                </Button>
              </Stack>
              {subView}
            </div>
          );
        }
      }
    } else if (this.state.mode === ItemTypeEditorMode.actions) {
      mode = (
        <div>
          <ItemTypeActionEditor
            isVisualsMode={false}
            itemTypeItem={itbd}
            readOnly={this.props.readOnly}
            item={this.props.item}
            creatorTools={this.props.creatorTools}
            file={this.props.file}
            project={this.props.project}
            theme={this.props.theme}
            heightOffset={this.props.heightOffset + 90}
          />
        </div>
      );
    }

    return (
      <div
        className="ite-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <EditorHeaderChip itemType={ProjectItemType.itemTypeBehavior} theme={this.props.theme}>
          <EditorHeaderBar
            itemId={itbd.id}
            itemType={ProjectItemType.itemTypeBehavior}
            typeName={this.props.intl.formatMessage({ id: "project_editor.item.type_name" })}
            formatVersion={itbd.formatVersion}
          />
          <EditorHeaderTabs>
            <Stack
              direction="row"
              spacing={0.5}
              aria-label={this.props.intl.formatMessage({ id: "project_editor.item.aria_actions" })}
            >
              <Button
                onClick={this._setPropertiesMode}
                title={this.props.intl.formatMessage({ id: "project_editor.item.tooltip_components" })}
              >
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faSquarePlus} className="fa-lg" />}
                  text={"Components"}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === ItemTypeEditorMode.properties}
                  theme={this.props.theme}
                />
              </Button>
              <Button
                onClick={this._setActionsMode}
                title={this.props.intl.formatMessage({ id: "project_editor.item.tooltip_actions" })}
              >
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faBolt} className="fa-lg" />}
                  text={"Actions"}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === ItemTypeEditorMode.actions}
                  theme={this.props.theme}
                />
              </Button>
              <Button
                onClick={this._setVisualsMode}
                title={this.props.intl.formatMessage({ id: "project_editor.item.tooltip_visuals" })}
              >
                <CustomTabLabel
                  icon={<FontAwesomeIcon icon={faCow} className="fa-lg" />}
                  text={"Visuals"}
                  isCompact={isButtonCompact}
                  isSelected={this.state.mode === ItemTypeEditorMode.visuals}
                  theme={this.props.theme}
                />
              </Button>
            </Stack>
          </EditorHeaderTabs>
        </EditorHeaderChip>

        <div className="ite-mainArea">{mode}</div>
      </div>
    );
  }
}

export default withLocalization(ItemTypeEditor);
