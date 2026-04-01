import { Component } from "react";
import "./EntityTypeAddComponent.css";
import Database from "../../../minecraft/Database";
import IPersistable from "../../types/IPersistable";
import { Button, List, ListItem, ListItemButton, ListItemText } from "@mui/material";
import EntityTypeDefinition, { EntityTypeComponentExtendedCategory } from "../../../minecraft/EntityTypeDefinition";
import Utilities from "../../../core/Utilities";
import IFormDefinition from "../../../dataform/IFormDefinition";
import ComponentIcon, { getComponentColor } from "../../shared/components/icons/ComponentIcon";
import { mcColors } from "../../hooks/theme/mcColors";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import IProjectTheme from "../../types/IProjectTheme";

interface IEntityTypeAddComponentProps {
  theme: IProjectTheme;
  onNewComponentSelected: (id: string) => void;
  setActivePersistable?: (persistObject: IPersistable) => void;
  initialCategory?: EntityTypeComponentExtendedCategory;
  /** When true, hide the category picker and only show components from initialCategory */
  singleCategory?: boolean;
}

interface IEntityTypeAddComponentState {
  categoryLists: any[][] | undefined;
  selectedCategory: EntityTypeComponentExtendedCategory;
  selectedComponentId: string | undefined;
  selectedForm: IFormDefinition | undefined;
  searchFilter: string;
  loadingSlow: boolean;
  loadingError?: string;
}

export default class EntityTypeAddComponent extends Component<
  IEntityTypeAddComponentProps,
  IEntityTypeAddComponentState
> {
  private static _recentComponents: string[] = [];
  private static readonly MAX_RECENT = 5;
  private static _cachedCategoryLists: any[][] | undefined;
  private static _loadingCategoryListsPromise: Promise<any[][]> | undefined;
  private _slowLoadingTimer: ReturnType<typeof setTimeout> | undefined;
  private _isLoadingCategories = false;

  static addToRecent(componentId: string) {
    EntityTypeAddComponent._recentComponents = EntityTypeAddComponent._recentComponents.filter(
      (id) => id !== componentId
    );
    EntityTypeAddComponent._recentComponents.unshift(componentId);
    if (EntityTypeAddComponent._recentComponents.length > EntityTypeAddComponent.MAX_RECENT) {
      EntityTypeAddComponent._recentComponents.length = EntityTypeAddComponent.MAX_RECENT;
    }
  }

  constructor(props: IEntityTypeAddComponentProps) {
    super(props);

    this._handleCategorySelected = this._handleCategorySelected.bind(this);
    this._handleValueSelected = this._handleValueSelected.bind(this);
    this._retryLoad = this._retryLoad.bind(this);

    this.state = {
      selectedCategory: props.initialCategory ?? EntityTypeComponentExtendedCategory.behavior,
      categoryLists: undefined,
      selectedComponentId: undefined,
      selectedForm: undefined,
      searchFilter: "",
      loadingSlow: false,
      loadingError: undefined,
    };
  }

  componentDidMount(): void {
    this._scheduleSlowLoadingHint();
    this._updateManager();
  }

  componentWillUnmount(): void {
    this._clearSlowLoadingHint();
  }

  componentDidUpdate(prevProps: IEntityTypeAddComponentProps, prevState: IEntityTypeAddComponentState) {
    this._updateManager();
  }

  private static async _buildCategoryLists(): Promise<any[][]> {
    const formsFolder = await Database.getFormsFolder("entity");

    const componentMenuItems: any[][] = [];

    for (let i = 0; i < 14; i++) {
      componentMenuItems[i] = [];
    }

    const baseNames = Object.keys(formsFolder.files)
      .filter((fileName) => fileName.startsWith("minecraft") && fileName.endsWith(".form.json"))
      .map((fileName) => fileName.substring(0, fileName.length - 10));

    const forms = await Promise.all(
      baseNames.map(async (baseName) => {
        return {
          baseName: baseName,
          form: await Database.ensureFormLoaded("entity", baseName),
        };
      })
    );

    for (const loadedForm of forms) {
      const form = loadedForm.form;

      if (form && !form.isDeprecated && !form.isInternal) {
        const canonName = "minecraft:" + EntityTypeDefinition.getComponentFromBaseFileName(loadedForm.baseName);
        const category = EntityTypeDefinition.getExtendedComponentCategory(canonName);
        const slotColor = getComponentColor(canonName);
        const description = form.description || "";

        componentMenuItems[category as number].push({
          key: canonName,
          tag: canonName,
          slotColor: slotColor,
          content: Utilities.humanifyMinecraftName(canonName),
          description: description,
        });
      }
    }

    return componentMenuItems;
  }

  private static async _getOrLoadCategoryLists(): Promise<any[][]> {
    if (EntityTypeAddComponent._cachedCategoryLists) {
      return EntityTypeAddComponent._cachedCategoryLists;
    }

    if (!EntityTypeAddComponent._loadingCategoryListsPromise) {
      EntityTypeAddComponent._loadingCategoryListsPromise = EntityTypeAddComponent._buildCategoryLists().then(
        (categoryLists) => {
          EntityTypeAddComponent._cachedCategoryLists = categoryLists;

          return categoryLists;
        }
      );
    }

    try {
      return await EntityTypeAddComponent._loadingCategoryListsPromise;
    } finally {
      EntityTypeAddComponent._loadingCategoryListsPromise = undefined;
    }
  }

  async _updateManager() {
    if (this.state.loadingError) {
      return;
    }

    if (
      this.state.selectedComponentId &&
      (!this.state.selectedForm || this.state.selectedForm.id !== this.state.selectedComponentId)
    ) {
      const formId = EntityTypeDefinition.getFormIdFromComponentId(this.state.selectedComponentId);
      const form = await Database.ensureFormLoaded("entity", formId);

      this.setState({
        categoryLists: this.state.categoryLists,
        selectedComponentId: this.state.selectedComponentId,
        selectedForm: form,
      });
    }

    if (this.state.categoryLists) {
      return;
    }

    if (this._isLoadingCategories) {
      return;
    }

    this._isLoadingCategories = true;

    try {
      const componentMenuItems = await EntityTypeAddComponent._getOrLoadCategoryLists();

      this._clearSlowLoadingHint();
      this.setState({
        categoryLists: componentMenuItems,
        loadingSlow: false,
        loadingError: undefined,
      });
    } catch {
      this._clearSlowLoadingHint();
      this.setState({
        loadingError: "Behavior categories aren't available yet. Please try again.",
        loadingSlow: false,
      });
    } finally {
      this._isLoadingCategories = false;
    }
  }

  private _scheduleSlowLoadingHint() {
    this._clearSlowLoadingHint();
    this._slowLoadingTimer = setTimeout(() => {
      if (!this.state.categoryLists && !this.state.loadingError) {
        this.setState({
          loadingSlow: true,
        });
      }
    }, 10000);
  }

  private _clearSlowLoadingHint() {
    if (this._slowLoadingTimer) {
      clearTimeout(this._slowLoadingTimer);
      this._slowLoadingTimer = undefined;
    }
  }

  private _retryLoad() {
    this.setState(
      {
        categoryLists: undefined,
        loadingError: undefined,
        loadingSlow: false,
      },
      () => {
        this._scheduleSlowLoadingHint();
        this._updateManager();
      }
    );
  }

  _handleCategorySelected(index: number) {
    this.setState({
      categoryLists: this.state.categoryLists,
      selectedCategory: index as EntityTypeComponentExtendedCategory,
      selectedComponentId: undefined,
    });
  }

  _handleValueSelected(index: number) {
    if (this.state.categoryLists) {
      const val = this.state.categoryLists[this.state.selectedCategory][index];

      this.props.onNewComponentSelected(val.key);
      this.setState({
        categoryLists: this.state.categoryLists,
        selectedCategory: this.state.selectedCategory,
        selectedComponentId: val.key,
      });
    }
  }

  _getCategoryTitle(category: EntityTypeComponentExtendedCategory): string {
    switch (category) {
      case EntityTypeComponentExtendedCategory.attribute:
        return "Stats (Attributes)";
      case EntityTypeComponentExtendedCategory.complex:
        return "Core Behaviors";
      case EntityTypeComponentExtendedCategory.movementComplex:
        return "Movement Settings";
      case EntityTypeComponentExtendedCategory.combatAndHealthComplex:
        return "Combat & Health";
      case EntityTypeComponentExtendedCategory.sensorComponents:
        return "Senses";
      case EntityTypeComponentExtendedCategory.trigger:
        return "Triggers";
      case EntityTypeComponentExtendedCategory.behavior:
        return "AI Behaviors";
      case EntityTypeComponentExtendedCategory.movementBehavior:
        return "Movement Behaviors";
      default:
        return "Behaviors";
    }
  }

  _getCategoryDescription(category: EntityTypeComponentExtendedCategory): string {
    switch (category) {
      case EntityTypeComponentExtendedCategory.attribute:
        return "Basic stats like health, speed, and damage";
      case EntityTypeComponentExtendedCategory.complex:
        return "Core features like physics, inventory, and interactions";
      case EntityTypeComponentExtendedCategory.movementComplex:
        return "How this mob moves through the world";
      case EntityTypeComponentExtendedCategory.combatAndHealthComplex:
        return "Combat abilities, damage, and healing";
      case EntityTypeComponentExtendedCategory.sensorComponents:
        return "How this mob detects players and other entities";
      case EntityTypeComponentExtendedCategory.trigger:
        return "Reactions to events like damage or environment changes";
      case EntityTypeComponentExtendedCategory.behavior:
        return "AI goals that drive what this mob does";
      case EntityTypeComponentExtendedCategory.movementBehavior:
        return "AI pathfinding and movement patterns";
      default:
        return "";
    }
  }

  render() {
    if (this.state.loadingError) {
      return (
        <div className="eatac-loading" role="alert">
          <div className="eatac-loadingStatus">
            <div className="eatac-loadingText">Couldn't load behaviors.</div>
            <div className="eatac-loadingDetail">{this.state.loadingError}</div>
            <div className="eatac-loadingActions">
              <Button size="small" onClick={this._retryLoad}>
                Retry
              </Button>
            </div>
          </div>
        </div>
      );
    }

    const showCategoryPicker = this.props.initialCategory === undefined;
    const categoriesLoaded = !!this.state.categoryLists;

    if (this.state === null || (!showCategoryPicker && !categoriesLoaded)) {
      return (
        <div className="eatac-loading" role="status" aria-live="polite">
          <div className="eatac-spinner"></div>
          <div className="eatac-loadingStatus">
            <div className="eatac-loadingText">Loading behaviors...</div>
            {this.state.loadingSlow && (
              <div className="eatac-loadingDetail">
                Still loading... this is taking longer than expected. You can wait or close this dialog and try again.
              </div>
            )}
          </div>
        </div>
      );
    }

    const currentCategory = this.state.selectedCategory;
    const categoryTitle = this._getCategoryTitle(currentCategory);
    const categoryComponents = categoriesLoaded ? this.state.categoryLists![currentCategory] || [] : [];

    // Build the component slot grid for the selected category
    const filterText = this.state.searchFilter.toLowerCase();
    const filteredItems = categoryComponents.filter((item: any) => {
      if (!filterText) return true;
      return (item.content && item.content.toLowerCase().includes(filterText)) ||
             (item.key && item.key.toLowerCase().includes(filterText)) ||
             (item.description && item.description.toLowerCase().includes(filterText));
    });
    const componentSlots = filteredItems.map((item: any) => {
      const isSelected = item.key === this.state.selectedComponentId;
      const slotColor = item.slotColor || "#52a535";
      // Get a short display name (remove minecraft: prefix and category prefix)
      const shortName = item.content || Utilities.humanifyMinecraftName(item.key);

      return (
        <div
          key={item.key}
          className={`etac-componentSlot ${isSelected ? "etac-slotSelected" : ""}`}
          style={{ "--slot-color": slotColor } as React.CSSProperties}
          onClick={() => {
            EntityTypeAddComponent.addToRecent(item.key);
            this.props.onNewComponentSelected(item.key);
            this.setState({
              categoryLists: this.state.categoryLists,
              selectedCategory: this.state.selectedCategory,
              selectedComponentId: item.key,
            });
          }}
          title={item.content}
        >
          <div className="etac-slotChip">
            <div className="etac-slotIcon">
              <ComponentIcon componentId={item.key} size={20} />
            </div>
            <div className="etac-slotLabel">
              <span className="etac-slotText">{shortName}</span>
            </div>
            {item.description && (
              <div className="etac-slotDesc" title={item.description}>
                {item.description.length > 120 ? item.description.substring(0, 117) + "..." : item.description}
              </div>
            )}
          </div>
        </div>
      );
    });

    // Single category mode (from add slot button click)
    if (!showCategoryPicker) {
      return (
        <div className="etac-area etac-singleCategory">
          <div className="etac-singleHeader">
            <span className="etac-categoryTitle">{categoryTitle}</span>
          </div>
          <div className="etac-beginnerTip">
            Tip: pick a behavior to add, then tune it in the editor. You can search by plain words like{" "}
            <strong>melee</strong>, <strong>follow</strong>, or <strong>swim</strong>.
          </div>
          <div style={{ padding: "4px 8px" }}>
            <input
              type="text"
              placeholder="Search behaviors..."
              value={this.state.searchFilter}
              onChange={(e) => this.setState({ ...this.state, searchFilter: e.target.value })}
              style={{
                width: "100%",
                padding: "4px 8px",
                fontSize: "12px",
                border: "1px solid rgba(128,128,128,0.3)",
                borderRadius: "2px",
                backgroundColor: "transparent",
                color: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div className="etac-slotGrid">{componentSlots}</div>
          {this.state.selectedComponentId && (
            <div className="etac-selectedInfo">
              <span className="etac-selectedLabel">Selected behavior:</span>
              <span className="etac-selectedName">
                {Utilities.humanifyMinecraftName(this.state.selectedComponentId)}
              </span>
            </div>
          )}
        </div>
      );
    }

    const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;

    const categoryItems = [
      { id: "attributes", key: "attributes", content: "Stats (Attributes)" },
      { id: "components", key: "components", content: "Core Behaviors" },
      { id: "movecomponents", key: "movecomponents", content: "Movement Settings" },
      { id: "chcomponents", key: "chcomponents", content: "Combat & Health" },
      { id: "senscomponents", key: "senscomponents", content: "Senses" },
      { id: "triggers", key: "triggers", content: "Triggers" },
      { id: "behaviors", key: "behaviors", content: "AI Behaviors" },
      { id: "movBehaviors", key: "movBehaviors", content: "Movement Behaviors" },
      { id: "mobBehaviors", key: "mobBehaviors", content: "Mob-specific" },
    ];

    // Full category picker mode
    return (
      <div className="etac-area">
        <div className="etac-mainArea">
          <div
            className="etac-category"
            style={{
              backgroundColor: isDark ? mcColors.gray4 : mcColors.gray3,
              borderColor: isDark ? mcColors.gray5 : mcColors.gray2,
            }}
          >
            <List aria-label="Component categories" dense>
              {categoryItems.map((item, index) => (
                <ListItem key={item.key} disablePadding>
                  <ListItemButton
                    selected={index === currentCategory}
                    onClick={() => this._handleCategorySelected(index)}
                  >
                    <ListItemText primary={item.content} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </div>
          <div
            className="etac-componentPane"
            style={{
              borderColor: isDark ? mcColors.gray5 : mcColors.gray2,
            }}
          >
            <div className="etac-beginnerTip">
              Tip: choose a category on the left, then pick a behavior to add on the right.
            </div>
            <div style={{ padding: "8px 8px 4px 8px" }}>
              <input
                type="text"
                placeholder="Search behaviors (e.g., melee, swim, follow)..."
                value={this.state.searchFilter}
                onChange={(e) => this.setState({ ...this.state, searchFilter: e.target.value })}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  fontSize: "13px",
                  border: `1px solid ${isDark ? mcColors.gray5 : mcColors.gray3}`,
                  borderRadius: "2px",
                  backgroundColor: isDark ? mcColors.gray6 : mcColors.offWhite,
                  color: isDark ? mcColors.white : mcColors.gray6,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            {this._getCategoryDescription(currentCategory) && (
              <div style={{
                padding: "2px 10px 4px 10px",
                fontSize: "11px",
                opacity: 0.7,
                fontStyle: "italic",
              }}>
                {this._getCategoryDescription(currentCategory)}
              </div>
            )}
            {!categoriesLoaded && (
              <div className="eatac-loadingDetail" role="status" aria-live="polite" style={{ padding: "2px 10px 4px 10px" }}>
                Loading behaviors...
                {this.state.loadingSlow && " Still loading... this is taking longer than expected."}
              </div>
            )}
            {EntityTypeAddComponent._recentComponents.length > 0 && categoriesLoaded && (
              <div className="etac-recentSection">
                <div className="etac-recentLabel">Recently Used</div>
                <div className="etac-slotGrid">
                  {EntityTypeAddComponent._recentComponents.map((compId) => {
                    const shortName = Utilities.humanifyMinecraftName(compId);
                    const slotColor = getComponentColor(compId);
                    const isSelected = compId === this.state.selectedComponentId;
                    return (
                      <div
                        key={"recent-" + compId}
                        className={`etac-componentSlot ${isSelected ? "etac-slotSelected" : ""}`}
                        style={{ "--slot-color": slotColor } as React.CSSProperties}
                        onClick={() => {
                          EntityTypeAddComponent.addToRecent(compId);
                          this.props.onNewComponentSelected(compId);
                          this.setState({
                            categoryLists: this.state.categoryLists,
                            selectedCategory: this.state.selectedCategory,
                            selectedComponentId: compId,
                          });
                        }}
                        title={shortName}
                      >
                        <div className="etac-slotChip">
                          <div className="etac-slotIcon">
                            <ComponentIcon componentId={compId} size={20} />
                          </div>
                          <div className="etac-slotLabel">
                            <span className="etac-slotText">{shortName}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="etac-slotGrid">{componentSlots}</div>
          </div>
        </div>
        {this.state.selectedComponentId && (
          <div className="etac-selectedInfo">
            <span className="etac-selectedLabel">Selected behavior:</span>
            <span className="etac-selectedName">{Utilities.humanifyMinecraftName(this.state.selectedComponentId)}</span>
          </div>
        )}
      </div>
    );
  }
}
