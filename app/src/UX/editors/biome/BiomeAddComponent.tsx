import { Component } from "react";
import "./BiomeAddComponent.css";
import Database from "../../../minecraft/Database";
import IPersistable from "../../types/IPersistable";
import { List, ListItem, ListItemButton, ListItemText } from "@mui/material";
import IFormDefinition from "../../../dataform/IFormDefinition";
import IManagedComponent from "../../../minecraft/IManagedComponent";
import BiomeBehaviorDefinition from "../../../minecraft/BiomeBehaviorDefinition";
import Utilities from "../../../core/Utilities";
import IProjectTheme from "../../types/IProjectTheme";

interface IBiomeAddComponentProps {
  theme: IProjectTheme;
  formCategory?: string;
  onSelectedNewComponentId: (id: string) => void;
  existingComponents: IManagedComponent[];
  setActivePersistable?: (persistObject: IPersistable) => void;
}

interface IBiomeAddComponentState {
  biomeComponentList: any[] | undefined;
  selectedComponentId: string | undefined;
  selectedForm: IFormDefinition | undefined;
}

export default class BiomeAddComponent extends Component<IBiomeAddComponentProps, IBiomeAddComponentState> {
  constructor(props: IBiomeAddComponentProps) {
    super(props);

    this._handleCategorySelected = this._handleCategorySelected.bind(this);

    this.state = {
      biomeComponentList: undefined,
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
      const form = await Database.ensureFormLoaded(this.props.formCategory || "biome", this.state.selectedComponentId);

      this.setState({
        biomeComponentList: this.state.biomeComponentList,
        selectedComponentId: this.state.selectedComponentId,
        selectedForm: form,
      });
    }

    if (this.state.biomeComponentList) {
      return;
    }

    const formCategory = this.props.formCategory || "biome";
    const formsFolder = await Database.getFormsFolder(formCategory);

    const componentMenuItems: any[] = [];
    const existingComponentIds = new Set(this.props.existingComponents.map((comp) => comp.id));

    for (const fileName in formsFolder.files) {
      if (fileName.startsWith("minecraft") && fileName.endsWith(".form.json")) {
        const baseName = fileName.substring(0, fileName.length - 10);

        let canonName = "minecraft:" + BiomeBehaviorDefinition.getComponentFromBaseFileName(baseName);

        // Skip if component already exists (compare canonical names)
        if (existingComponentIds.has(canonName)) {
          continue;
        }

        const form = await Database.ensureFormLoaded(formCategory, baseName);

        if (form && !form.isDeprecated && !form.isInternal) {
          componentMenuItems.push({
            id: canonName,
            key: canonName,
            tag: canonName,
            content: Utilities.humanifyMinecraftName(canonName),
            description: form.description || "",
          });
        }
      }
    }

    componentMenuItems.sort((a, b) => {
      if (a.content < b.content) {
        return -1;
      }

      if (a.content > b.content) {
        return 1;
      }

      return 0;
    });

    this.setState({
      biomeComponentList: componentMenuItems,
      selectedComponentId: componentMenuItems.length > 0 ? componentMenuItems[0].id : undefined,
      selectedForm: undefined,
    });

    if (componentMenuItems.length > 0) {
      this.props.onSelectedNewComponentId(componentMenuItems[0].id);
    }
  }

  _handleCategorySelected(index: number) {
    if (this.state.biomeComponentList) {
      if (index >= 0 && index < this.state.biomeComponentList.length) {
        const newComponentId = this.state.biomeComponentList[index].id;

        this.setState({
          biomeComponentList: this.state.biomeComponentList,
          selectedComponentId: newComponentId,
          selectedForm: this.state.selectedForm,
        });

        this.props.onSelectedNewComponentId(newComponentId);
      }
    }
  }

  render() {
    let selectedIndex = -1;

    if (this.state.biomeComponentList) {
      for (let i = 0; i < this.state.biomeComponentList.length; i++) {
        if (this.state.biomeComponentList[i].id === this.state.selectedComponentId) {
          selectedIndex = i;
        }
      }
    }

    if (!this.state.biomeComponentList || this.state.biomeComponentList.length === 0) {
      return <div className="bioc-area">No available components to add</div>;
    }

    return (
      <div className="bioc-area">
        <div className="bioc-form">
          <List dense>
            {this.state.biomeComponentList.map((item, index) => (
              <ListItem key={item.key} disablePadding>
                <ListItemButton selected={index === selectedIndex} onClick={() => this._handleCategorySelected(index)}>
                  <ListItemText primary={item.content} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </div>
      </div>
    );
  }
}
