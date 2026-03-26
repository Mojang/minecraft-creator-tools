import { Component } from "react";
import "./ItemTypeAddComponent.css";
import Database from "../../../minecraft/Database";
import IPersistable from "../../types/IPersistable";
import { List, ListItem, ListItemButton } from "@mui/material";
import Utilities from "../../../core/Utilities";
import IFormDefinition from "../../../dataform/IFormDefinition";
import EntityTypeDefinition from "../../../minecraft/EntityTypeDefinition";
import ItemTypeDefinition from "../../../minecraft/ItemTypeDefinition";
import ItemComponentIcon, { getItemComponentColor, getItemComponentCategoryClass } from "./ItemComponentIcon";
import { mcColors } from "../../hooks/theme/mcColors";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import IProjectTheme from "../../types/IProjectTheme";

interface IItemTypeAddComponentProps {
  theme: IProjectTheme;
  isVisualsMode: boolean;
  onNewComponentSelected: (id: string) => void;
  setActivePersistable?: (persistObject: IPersistable) => void;
}

interface IItemTypeAddComponentState {
  itemComponentList: any[] | undefined;
  selectedComponentId: string | undefined;
  selectedForm: IFormDefinition | undefined;
}

export default class ItemTypeAddComponent extends Component<IItemTypeAddComponentProps, IItemTypeAddComponentState> {
  constructor(props: IItemTypeAddComponentProps) {
    super(props);

    this._handleCategorySelected = this._handleCategorySelected.bind(this);
    this._handleValueSelected = this._handleValueSelected.bind(this);

    this.state = {
      itemComponentList: undefined,
      selectedComponentId: undefined,
      selectedForm: undefined,
    };

    this._updateManager();
  }

  componentDidMount(): void {
    this._updateManager();
  }

  componentDidUpdate(prevProps: IItemTypeAddComponentProps, prevState: IItemTypeAddComponentState) {
    this._updateManager();
  }

  async _updateManager() {
    if (
      this.state.selectedComponentId &&
      (!this.state.selectedForm || this.state.selectedForm.id !== this.state.selectedComponentId)
    ) {
      const formId = EntityTypeDefinition.getFormIdFromComponentId(this.state.selectedComponentId);
      const form = await Database.ensureFormLoaded("item_components", formId);
      this.setState({
        itemComponentList: this.state.itemComponentList,
        selectedComponentId: this.state.selectedComponentId,
        selectedForm: form,
      });
    }

    if (this.state.itemComponentList) {
      return;
    }

    const formsFolder = await Database.getFormsFolder("item_components");

    const componentMenuItems: any[] = [];

    for (const fileName in formsFolder.files) {
      if (fileName.startsWith("minecraft") && fileName.endsWith(".form.json")) {
        const baseName = fileName.substring(0, fileName.length - 10);

        const form = await Database.ensureFormLoaded("item_components", baseName);
        let canonName = "minecraft:" + EntityTypeDefinition.getComponentFromBaseFileName(baseName);

        if (
          form &&
          !form.isDeprecated &&
          !form.isInternal &&
          ItemTypeDefinition.isVisualComponent(canonName) === this.props.isVisualsMode
        ) {
          const categoryClass = getItemComponentCategoryClass(canonName);
          const color = getItemComponentColor(canonName);
          const description = form.description || "";
          // Truncate description to ~80 chars for display
          const shortDesc = description.length > 80 ? description.substring(0, 77) + "..." : description;

          componentMenuItems.push({
            key: canonName,
            tag: canonName,
            category: categoryClass,
            content: (
              <div className="itac-chip" style={{ "--chip-color": color } as React.CSSProperties}>
                <div className="itac-chipHeader">
                  <ItemComponentIcon componentId={canonName} size={20} />
                  <span className="itac-chipName">{Utilities.humanifyMinecraftName(canonName)}</span>
                </div>
                {shortDesc && (
                  <div className="itac-chipDesc" title={description}>
                    {shortDesc}
                  </div>
                )}
              </div>
            ),
          });
        }
      }
    }

    // Sort items alphabetically within their categories, then by category
    const categoryOrder = ["combat", "tools", "food", "appearance", "interaction", "storage", "enchantment", "misc"];
    componentMenuItems.sort((a, b) => {
      const catIndexA = categoryOrder.indexOf(a.category);
      const catIndexB = categoryOrder.indexOf(b.category);
      if (catIndexA !== catIndexB) {
        return catIndexA - catIndexB;
      }
      return a.key.localeCompare(b.key);
    });

    this.setState({
      itemComponentList: componentMenuItems,
    });
  }

  _handleCategorySelected(index: number) {
    this.setState({
      itemComponentList: this.state.itemComponentList,
      selectedComponentId: undefined,
    });
  }

  _handleValueSelected(index: number) {
    if (this.state.itemComponentList) {
      const val = this.state.itemComponentList[index];

      this.props.onNewComponentSelected(val.key);
      this.setState({
        itemComponentList: this.state.itemComponentList,
        selectedComponentId: val.key,
      });
    }
  }

  render() {
    if (this.state === null || !this.state.itemComponentList || Database.uxCatalog === null) {
      return <div>Loading...</div>;
    }

    const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;

    let formDescrption = <></>;

    if (this.state.selectedForm) {
      formDescrption = (
        <div className="itac-form">
          {this.state.selectedForm.title}: {this.state.selectedForm.description}
        </div>
      );
    }

    return (
      <div className="itac-area">
        <div className="itac-mainArea">
          <div
            className="itac-list"
            style={{
              borderColor: isDark ? mcColors.gray5 : mcColors.gray2,
            }}
          >
            <List aria-label="List of categories" dense>
              {this.state.itemComponentList.map((item, index) => (
                <ListItem key={item.key} disablePadding>
                  <ListItemButton
                    selected={item.key === this.state.selectedComponentId}
                    onClick={() => this._handleValueSelected(index)}
                  >
                    {item.content}
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </div>
          <div className="itac-description">{formDescrption}</div>
        </div>
      </div>
    );
  }
}
