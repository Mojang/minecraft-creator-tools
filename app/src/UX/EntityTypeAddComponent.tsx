import { Component } from "react";
import "./EntityTypeAddComponent.css";
import Database from "../minecraft/Database";
import { ThemeInput } from "@fluentui/styles";
import IPersistable from "./IPersistable";
import { List, ListProps, selectableListBehavior } from "@fluentui/react-northstar";
import EntityTypeDefinition, { EntityTypeComponentExtendedCategory } from "../minecraft/EntityTypeDefinition";
import Utilities from "../core/Utilities";
import IFormDefinition from "../dataform/IFormDefinition";

interface IEntityTypeAddComponentProps {
  theme: ThemeInput<any>;
  onNewComponentSelected: (id: string) => void;
  setActivePersistable?: (persistObject: IPersistable) => void;
}

interface IEntityTypeAddComponentState {
  categoryLists: any[][] | undefined;
  selectedCategory: EntityTypeComponentExtendedCategory;
  selectedComponentId: string | undefined;
  selectedForm: IFormDefinition | undefined;
}

export default class EntityTypeAddComponent extends Component<
  IEntityTypeAddComponentProps,
  IEntityTypeAddComponentState
> {
  constructor(props: IEntityTypeAddComponentProps) {
    super(props);

    this._handleCategorySelected = this._handleCategorySelected.bind(this);
    this._handleValueSelected = this._handleValueSelected.bind(this);

    this.state = {
      selectedCategory: EntityTypeComponentExtendedCategory.behavior,
      categoryLists: undefined,
      selectedComponentId: undefined,
      selectedForm: undefined,
    };

    this._updateManager();
  }

  componentDidMount(): void {
    this._updateManager();
  }

  componentDidUpdate(prevProps: IEntityTypeAddComponentProps, prevState: IEntityTypeAddComponentState) {
    this._updateManager();
  }

  async _updateManager() {
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

    const formsFolder = await Database.getFormsFolder("entity");

    const componentMenuItems: any[][] = [];

    for (let i = 0; i < 14; i++) {
      componentMenuItems[i] = [];
    }

    for (const fileName in formsFolder.files) {
      if (fileName.startsWith("minecraft") && fileName.endsWith(".form.json")) {
        const baseName = fileName.substring(0, fileName.length - 10);

        let canonName = "minecraft:" + EntityTypeDefinition.getComponentFromBaseFileName(baseName);
        const category = EntityTypeDefinition.getExtendedComponentCategory(canonName);

        componentMenuItems[category as number].push({
          key: canonName,
          tag: canonName,
          content: Utilities.humanifyMinecraftName(canonName),
        });
      }
    }

    this.setState({
      categoryLists: componentMenuItems,
    });
  }

  _handleCategorySelected(elt: any, eventData: ListProps | undefined) {
    if (eventData && eventData.selectedIndex !== undefined) {
      this.setState({
        categoryLists: this.state.categoryLists,
        selectedCategory: eventData.selectedIndex as EntityTypeComponentExtendedCategory,
        selectedComponentId: undefined,
      });
    }
  }

  _handleValueSelected(elt: any, event: ListProps | undefined) {
    if (event?.selectedIndex !== undefined && this.state.categoryLists) {
      const val = this.state.categoryLists[this.state.selectedCategory][event?.selectedIndex];

      this.props.onNewComponentSelected(val.key);
      this.setState({
        categoryLists: this.state.categoryLists,
        selectedCategory: this.state.selectedCategory,
        selectedComponentId: val.key,
      });
    }
  }

  render() {
    if (this.state === null || !this.state.categoryLists || Database.uxCatalog === null) {
      return <div>Loading...</div>;
    }

    let formDescrption = <></>;

    if (this.state.selectedForm) {
      formDescrption = (
        <div className="etac-form">
          {this.state.selectedForm.title}: {this.state.selectedForm.description}
        </div>
      );
    }

    return (
      <div className="etac-area">
        <div className="etac-mainArea">
          <div
            className="etac-category"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            }}
          >
            <List
              selectable
              aria-label="List of repositories"
              accessibility={selectableListBehavior}
              defaultSelectedIndex={0}
              items={[
                {
                  id: "attributes",
                  key: "attributes",
                  content: "Attributes",
                },
                {
                  id: "components",
                  key: "components",
                  content: "General Components",
                },
                {
                  id: "behaviors",
                  key: "behaviors",
                  content: "AI Components (Behaviors)",
                },
                {
                  id: "triggers",
                  key: "triggers",
                  content: "Triggers",
                },
                {
                  id: "movBehaviors",
                  key: "movBehaviors",
                  content: "Movement Behaviors",
                },
                {
                  id: "mobBehaviors",
                  key: "mobBehaviors",
                  content: "Mob-specific Behaviors",
                },
                {
                  id: "movecomponents",
                  key: "movecomponents",
                  content: "Movement Components",
                },
                {
                  id: "chcomponents",
                  key: "chcomponents",
                  content: "Combat and Health Components",
                },
                {
                  id: "senscomponents",
                  key: "senscomponents",
                  content: "Sensor Components",
                },
              ]}
              onSelectedIndexChange={this._handleCategorySelected}
            />
          </div>
          <div
            className="etac-list"
            style={{
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            }}
          >
            <List
              selectable
              aria-label="List of categories"
              accessibility={selectableListBehavior}
              defaultSelectedIndex={0}
              items={this.state.categoryLists[this.state.selectedCategory]}
              onSelectedIndexChange={this._handleValueSelected}
            />
          </div>
          <div className="etac-description">{formDescrption}</div>
        </div>
      </div>
    );
  }
}
