import { Component } from "react";
import "./BlockTypeAddComponent.css";
import Database from "../minecraft/Database";
import { ThemeInput } from "@fluentui/styles";
import IPersistable from "./IPersistable";
import { List, ListProps, selectableListBehavior } from "@fluentui/react-northstar";
import Utilities from "../core/Utilities";
import IFormDefinition from "../dataform/IFormDefinition";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import BlockTypeDefinition from "../minecraft/BlockTypeDefinition";

interface IBlockTypeAddComponentProps {
  theme: ThemeInput<any>;
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

          componentMenuItems.push({
            key: canonName,
            tag: canonName,
            content: Utilities.humanifyMinecraftName(canonName),
          });
        }
      }
    }

    this.setState({
      blockComponentList: componentMenuItems,
    });
  }

  _handleCategorySelected(elt: any, eventData: ListProps | undefined) {
    if (eventData && eventData.selectedIndex !== undefined) {
      this.setState({
        blockComponentList: this.state.blockComponentList,
        selectedComponentId: undefined,
      });
    }
  }

  _handleValueSelected(elt: any, event: ListProps | undefined) {
    if (event?.selectedIndex !== undefined && this.state.blockComponentList) {
      const val = this.state.blockComponentList[event?.selectedIndex];

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

    return (
      <div className="btac-area">
        <div className="btac-mainArea">
          <div
            className="btac-list"
            style={{
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            }}
          >
            <List
              selectable
              aria-label="List of categories"
              accessibility={selectableListBehavior}
              defaultSelectedIndex={0}
              items={this.state.blockComponentList}
              onSelectedIndexChange={this._handleValueSelected}
            />
          </div>
          <div className="btac-description">{formDescrption}</div>
        </div>
      </div>
    );
  }
}
