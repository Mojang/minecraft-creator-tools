import { Component, SyntheticEvent } from "react";
import "./BiomeAddComponent.css";
import Database from "../minecraft/Database";
import { ThemeInput } from "@fluentui/styles";
import IPersistable from "./IPersistable";
import { List, ListProps, selectableListBehavior } from "@fluentui/react-northstar";
import IFormDefinition from "../dataform/IFormDefinition";
import IManagedComponent from "../minecraft/IManagedComponent";
import BiomeBehaviorDefinition from "../minecraft/BiomeBehaviorDefinition";
import Utilities from "../core/Utilities";

interface IBiomeAddComponentProps {
  theme: ThemeInput<any>;
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
      const form = await Database.ensureFormLoaded("biome", this.state.selectedComponentId);

      this.setState({
        biomeComponentList: this.state.biomeComponentList,
        selectedComponentId: this.state.selectedComponentId,
        selectedForm: form,
      });
    }

    if (this.state.biomeComponentList) {
      return;
    }

    const formsFolder = await Database.getFormsFolder("biome");

    const componentMenuItems: any[] = [];
    const existingComponentIds = new Set(this.props.existingComponents.map((comp) => comp.id));

    for (const fileName in formsFolder.files) {
      if (fileName.startsWith("minecraft") && fileName.endsWith(".form.json")) {
        const baseName = fileName.substring(0, fileName.length - 10);

        // Skip if component already exists
        if (existingComponentIds.has(baseName)) {
          continue;
        }

        const form = await Database.ensureFormLoaded("biome", baseName);

        if (form && !form.isDeprecated && !form.isInternal) {
          let canonName = "minecraft:" + BiomeBehaviorDefinition.getComponentFromBaseFileName(baseName);

          componentMenuItems.push({
            id: canonName,
            key: canonName,
            tag: canonName,
            content: Utilities.humanifyMinecraftName(canonName),
          });
        }
      }
    }

    componentMenuItems.sort((a, b) => {
      if (a.header < b.header) {
        return -1;
      }

      if (a.header > b.header) {
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

  _handleCategorySelected(e: SyntheticEvent, data?: ListProps | undefined) {
    if (data && data.selectedIndex !== undefined && this.state.biomeComponentList) {
      const newIndex = data.selectedIndex;

      if (newIndex >= 0 && newIndex < this.state.biomeComponentList.length) {
        const newComponentId = this.state.biomeComponentList[newIndex].id;

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
          <List
            selectable
            selectedIndex={selectedIndex}
            accessibility={selectableListBehavior}
            items={this.state.biomeComponentList}
            onSelectedIndexChange={this._handleCategorySelected}
          />
        </div>
      </div>
    );
  }
}
