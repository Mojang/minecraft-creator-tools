import { Component } from "react";
import "./ItemTypeAddComponent.css";
import Database from "../minecraft/Database";
import { ThemeInput } from "@fluentui/styles";
import IPersistable from "./IPersistable";
import { List, ListProps, selectableListBehavior } from "@fluentui/react-northstar";
import Utilities from "../core/Utilities";
import IFormDefinition from "../dataform/IFormDefinition";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";

interface IItemTypeAddComponentProps {
  theme: ThemeInput<any>;
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
      const form = await Database.ensureFormLoaded("item", formId);
      this.setState({
        itemComponentList: this.state.itemComponentList,
        selectedComponentId: this.state.selectedComponentId,
        selectedForm: form,
      });
    }

    if (this.state.itemComponentList) {
      return;
    }

    const formsFolder = await Database.getFormsFolder("item");

    const componentMenuItems: any[] = [];

    for (const fileName in formsFolder.files) {
      if (fileName.startsWith("minecraft") && fileName.endsWith(".form.json")) {
        const baseName = fileName.substring(0, fileName.length - 10);

        let canonName = "minecraft:" + EntityTypeDefinition.getComponentFromBaseFileName(baseName);

        componentMenuItems.push({
          key: canonName,
          tag: canonName,
          content: Utilities.humanifyMinecraftName(canonName),
        });
      }
    }

    this.setState({
      itemComponentList: componentMenuItems,
    });
  }

  _handleCategorySelected(elt: any, eventData: ListProps | undefined) {
    if (eventData && eventData.selectedIndex !== undefined) {
      this.setState({
        itemComponentList: this.state.itemComponentList,
        selectedComponentId: undefined,
      });
    }
  }

  _handleValueSelected(elt: any, event: ListProps | undefined) {
    if (event?.selectedIndex !== undefined && this.state.itemComponentList) {
      const val = this.state.itemComponentList[event?.selectedIndex];

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
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            }}
          >
            <List
              selectable
              aria-label="List of categories"
              accessibility={selectableListBehavior}
              defaultSelectedIndex={0}
              items={this.state.itemComponentList}
              onSelectedIndexChange={this._handleValueSelected}
            />
          </div>
          <div className="itac-description">{formDescrption}</div>
        </div>
      </div>
    );
  }
}
