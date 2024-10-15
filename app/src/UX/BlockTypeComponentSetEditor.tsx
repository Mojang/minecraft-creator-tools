import { Component } from "react";
import "./BlockTypeComponentSetEditor.css";
import DataForm, { IDataFormProps } from "../dataform/DataForm";
import Database from "../minecraft/Database";
import { Toolbar, SplitButton, ThemeInput, List, ListProps, selectableListBehavior } from "@fluentui/react-northstar";
import IManagedComponentSetItem from "../minecraft/IManagedComponentSetItem";
import DataFormUtilities from "../dataform/DataFormUtilities";
import Utilities from "../core/Utilities";

interface IBlockTypeComponentSetEditorProps {
  blockTypeItem: IManagedComponentSetItem;
  isDefault: boolean;
  heightOffset: number;
  title?: string;
  theme: ThemeInput<any>;
}

interface IBlockTypeComponentSetEditorState {
  loadedFormCount?: number;
  activeComponentId: string | undefined;
}

export default class BlockTypeComponentSetEditor extends Component<
  IBlockTypeComponentSetEditorProps,
  IBlockTypeComponentSetEditorState
> {
  constructor(props: IBlockTypeComponentSetEditorProps) {
    super(props);

    this._addComponentClick = this._addComponentClick.bind(this);
    this._addComponent = this._addComponent.bind(this);
    this._handleCloseClick = this._handleCloseClick.bind(this);
    this._handleComponentSelected = this._handleComponentSelected.bind(this);

    let id = undefined;

    const componentListing = this.getUsableComponents();

    if (componentListing && componentListing.length > 0) {
      id = componentListing[0].id;
    }

    this.state = {
      loadedFormCount: undefined,
      activeComponentId: id,
    };
  }

  componentDidUpdate(prevProps: IBlockTypeComponentSetEditorProps, prevState: IBlockTypeComponentSetEditorState) {
    if (prevProps.blockTypeItem !== this.props.blockTypeItem) {
      let id = undefined;

      const componentListing = this.getUsableComponents();

      if (componentListing && componentListing.length > 0) {
        id = componentListing[0].id;
      }

      this.setState({
        loadedFormCount: Database.loadedFormCount,
        activeComponentId: id,
      });
    }
  }

  _addComponentClick() {
    this.forceUpdate();
  }

  async _addComponent(name: string) {
    if (Database.uxCatalog === null) {
      return;
    }

    const form = await Database.ensureFormLoaded(name);

    if (form !== undefined) {
      const newDataObject = DataFormUtilities.generateDefaultItem(form);

      this.props.blockTypeItem.addComponent(name, newDataObject);
    }
  }

  getFormIdFromComponentId(componentId: string) {
    return "block_" + componentId.replace(/:/gi, "_").replace(/_/gi, "_");
  }

  async _updateManager() {
    if (!this.props.blockTypeItem) {
      return;
    }

    const components = this.props.blockTypeItem.getComponents();

    for (let i = 0; i < components.length; i++) {
      const component = components[i];

      if (typeof component === "object" && component.id !== undefined) {
        const formId = this.getFormIdFromComponentId(component.id);
        await Database.ensureFormLoaded(formId);
      }
    }

    this.setState({
      loadedFormCount: Database.loadedFormCount,
      activeComponentId: this.state.activeComponentId,
    });
  }

  _handleComponentSelected(elt: any, event: ListProps | undefined) {
    if (event === undefined || event.selectedIndex === undefined || this.state == null) {
      return;
    }

    const componentListing = this.getUsableComponents();

    const id = componentListing[event.selectedIndex].id;

    if (id) {
      this.setState({
        activeComponentId: id,
      });
    }
  }

  _handleCloseClick(props: IDataFormProps) {
    if (!props.tag) {
      return;
    }

    const componentId = props.tag;

    if (componentId) {
      this.props.blockTypeItem.removeComponent(componentId);
      this.forceUpdate();
    }
  }

  getUsableComponents() {
    const components = this.props.blockTypeItem.getComponents();
    const componentList = [];

    for (let i = 0; i < components.length; i++) {
      const component = components[i];

      if (typeof component === "object" && component.id !== undefined) {
        componentList.push(component);
      }
    }

    return componentList;
  }

  render() {
    if (this.state === undefined || this.state.loadedFormCount === undefined) {
      this._updateManager();

      return <div>Loading...</div>;
    }

    const components = this.props.blockTypeItem.getComponents();
    const componentForms = [];
    const componentList = [];

    let selectedIndex = 0;

    for (let i = 0; i < components.length; i++) {
      const component = components[i];

      if (typeof component === "object" && component.id !== undefined) {
        const formId = component.id.replace(/:/gi, "_").replace(/_/gi, "_");

        const form = Database.getForm("block_" + formId);

        componentList.push({
          key: component.id,
          content: (
            <div
              className="cose-componentWrapper"
              style={{
                backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
                borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
              }}
            >
              {Utilities.humanifyMinecraftName(component.id)}
            </div>
          ),
        });

        if (component && component.id) {
          if (form !== undefined && component.id === this.state?.activeComponentId) {
            selectedIndex = i;
            componentForms.push(
              <div className="cose-componentForm">
                <DataForm
                  displayTitle={true}
                  displayDescription={true}
                  readOnly={false}
                  tag={component.id}
                  theme={this.props.theme}
                  objectKey={component.id}
                  closeButton={false}
                  definition={form}
                  getsetPropertyObject={component}
                ></DataForm>
              </div>
            );
          } else if (component.id === this.state?.activeComponentId) {
            selectedIndex = i;
            componentForms.push(
              <div className="cose-noeditor">(No editor is available for the {component.id} type.)</div>
            );
          }
        }
      }
    }

    const toolbarItems: any[] = [];

    const splitButtonMenuItems = [
      {
        id: "tameable",
        key: "tameable",
        onClick: this._addComponentClick,
        content: "Add tameability",
      },
      {
        id: "rideable",
        key: "rideable",
        onClick: this._addComponentClick,
        content: "Add rideability",
      },
      {
        id: "inventory",
        key: "inventory",
        onClick: this._addComponentClick,
        content: "Add inventory capabilities",
      },
      {
        id: "healable",
        key: "healable",
        onClick: this._addComponentClick,
        content: "Add healability",
      },
    ];

    let title = <></>;

    if (this.props.title) {
      title = <span>{this.props.title}</span>;
    }

    const areaHeight = "calc(100vh - " + String(this.props.heightOffset + 34) + "px)";

    return (
      <div className="cose-area">
        <div className="cose-componentArea">
          <div className="cose-titleArea">{title}</div>
          <div className="cose-componentToolBarArea">
            <Toolbar aria-label="Component editing toolbar" items={toolbarItems} />
          </div>
          <div className="cose-extraArea">
            <SplitButton
              menu={splitButtonMenuItems}
              button={{
                content: "Add component",
                "aria-roledescription": "splitbutton",
                "aria-describedby": "instruction-message-primary-button",
              }}
              primary
              toggleButton={{
                "aria-label": "more options",
              }}
              onMainButtonClick={this._addComponentClick}
            />
          </div>
        </div>
        <div
          className="cose-componentList"
          style={{
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.background6,
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
            minHeight: areaHeight,
            maxHeight: areaHeight,
          }}
        >
          <List
            selectable
            aria-label="List of components"
            accessibility={selectableListBehavior}
            defaultSelectedIndex={selectedIndex}
            selectedIndex={selectedIndex}
            items={componentList}
            onSelectedIndexChange={this._handleComponentSelected}
          />
        </div>
        <div
          className="cose-componentBin"
          style={{
            minHeight: areaHeight,
            maxHeight: areaHeight,
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.background6,
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
          }}
        >
          {componentForms}
        </div>
      </div>
    );
  }
}
