import { Component } from "react";
import "./BlockTypeAddComponent.css";
import Database from "../../../minecraft/Database";
import IPersistable from "../../types/IPersistable";
import { List, ListItem, ListItemButton } from "@mui/material";
import Utilities from "../../../core/Utilities";
import IFormDefinition from "../../../dataform/IFormDefinition";
import EntityTypeDefinition from "../../../minecraft/EntityTypeDefinition";
import BlockTypeDefinition from "../../../minecraft/BlockTypeDefinition";
import BlockComponentIcon, { getBlockComponentColor, getBlockComponentCategoryClass } from "./BlockComponentIcon";
import { mcColors } from "../../hooks/theme/mcColors";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import IProjectTheme from "../../types/IProjectTheme";

interface IBlockTypeAddComponentProps {
  theme: IProjectTheme;
  isVisual: boolean;
  onNewComponentSelected: (id: string) => void;
  setActivePersistable?: (persistObject: IPersistable) => void;
}

interface IBlockTypeAddComponentState {
  blockComponentList: any[] | undefined;
  selectedComponentId: string | undefined;
  selectedForm: IFormDefinition | undefined;
}

export default class BlockTypeAddComponent extends Component<IBlockTypeAddComponentProps, IBlockTypeAddComponentState> {
  constructor(props: IBlockTypeAddComponentProps) {
    super(props);

    this._handleCategorySelected = this._handleCategorySelected.bind(this);
    this._handleValueSelected = this._handleValueSelected.bind(this);

    this.state = {
      blockComponentList: undefined,
      selectedComponentId: undefined,
      selectedForm: undefined,
    };
  }

  componentDidMount(): void {
    this._updateManager();
  }

  async _updateManager() {
    if (
      this.state.selectedComponentId &&
      (!this.state.selectedForm || this.state.selectedForm.id !== this.state.selectedComponentId)
    ) {
      const formId = EntityTypeDefinition.getFormIdFromComponentId(this.state.selectedComponentId);
      const form = await Database.ensureFormLoaded("block", formId);
      this.setState({
        blockComponentList: this.state.blockComponentList,
        selectedComponentId: this.state.selectedComponentId,
        selectedForm: form,
      });
    }

    if (this.state.blockComponentList) {
      return;
    }

    const formsFolder = await Database.getFormsFolder("block");

    const componentMenuItems: any[] = [];

    for (const fileName in formsFolder.files) {
      if (fileName.startsWith("minecraft") && fileName.endsWith(".form.json")) {
        const baseName = fileName.substring(0, fileName.length - 10);

        const form = await Database.ensureFormLoaded("block", baseName);

        if (
          form &&
          !form.isDeprecated &&
          !form.isInternal &&
          ((!this.props.isVisual && (!form.tags || !form.tags.includes("visual"))) ||
            (this.props.isVisual && form.tags && form.tags.includes("visual")))
        ) {
          let canonName = "minecraft:" + BlockTypeDefinition.getComponentFromBaseFileName(baseName);
          const categoryClass = getBlockComponentCategoryClass(canonName);
          const color = getBlockComponentColor(canonName);
          const description = form.description || "";
          // Truncate description to ~80 chars for display
          const shortDesc = description.length > 80 ? description.substring(0, 77) + "..." : description;

          componentMenuItems.push({
            key: canonName,
            tag: canonName,
            category: categoryClass,
            content: (
              <div className="btac-chip" style={{ "--chip-color": color } as React.CSSProperties}>
                <div className="btac-chipHeader">
                  <BlockComponentIcon componentId={canonName} size={20} />
                  <span className="btac-chipName">{Utilities.humanifyMinecraftName(canonName)}</span>
                </div>
                {shortDesc && (
                  <div className="btac-chipDesc" title={description}>
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
    const categoryOrder = [
      "geometry",
      "material",
      "light",
      "physics",
      "destruction",
      "interaction",
      "redstone",
      "misc",
    ];
    componentMenuItems.sort((a, b) => {
      const catIndexA = categoryOrder.indexOf(a.category);
      const catIndexB = categoryOrder.indexOf(b.category);
      if (catIndexA !== catIndexB) {
        return catIndexA - catIndexB;
      }
      return a.key.localeCompare(b.key);
    });

    this.setState({
      blockComponentList: componentMenuItems,
    });
  }

  _handleCategorySelected(index: number) {
    this.setState({
      blockComponentList: this.state.blockComponentList,
      selectedComponentId: undefined,
    });
  }

  _handleValueSelected(index: number) {
    if (this.state.blockComponentList) {
      const val = this.state.blockComponentList[index];

      this.props.onNewComponentSelected(val.key);
      this.setState({
        blockComponentList: this.state.blockComponentList,
        selectedComponentId: val.key,
      });
    }
  }

  render() {
    if (this.state === null || !this.state.blockComponentList || Database.uxCatalog === null) {
      return <div>Loading...</div>;
    }

    let formDescrption = <></>;

    if (this.state.selectedForm) {
      formDescrption = (
        <div className="btac-form">
          {this.state.selectedForm.title}: {this.state.selectedForm.description}
        </div>
      );
    }

    const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;

    return (
      <div className="btac-area">
        <div className="btac-mainArea">
          <div
            className="btac-list"
            style={{
              borderColor: isDark ? mcColors.gray5 : mcColors.gray2,
            }}
          >
            <List aria-label="List of categories" dense>
              {this.state.blockComponentList.map((item, index) => (
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
          <div className="btac-description">{formDescrption}</div>
        </div>
      </div>
    );
  }
}
