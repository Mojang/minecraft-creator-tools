import { Component } from "react";
import "./ComponentSetEditor.css";
import DataForm, { IDataFormProps } from "../dataform/DataForm";
import Database from "../minecraft/Database";
import { Toolbar, SplitButton, ThemeInput, List, ListProps } from "@fluentui/react-northstar";
import IManagedComponentSetItem from "../minecraft/IManagedComponentSetItem";
import DataFormUtilities from "../dataform/DataFormUtilities";
import Utilities from "../core/Utilities";

interface IComponentSetEditorProps {
  componentSetItem: IManagedComponentSetItem;
  isDefault: boolean;
  heightOffset: number;
  theme: ThemeInput<any>;
}

interface IComponentSetEditorState {
  loadedFormCount?: number;
  activeComponentId: string | undefined;
}

export default class ComponentSetEditor extends Component<IComponentSetEditorProps, IComponentSetEditorState> {
  constructor(props: IComponentSetEditorProps) {
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

  componentDidUpdate(prevProps: IComponentSetEditorProps, prevState: IComponentSetEditorState) {
    if (prevProps.componentSetItem !== this.props.componentSetItem) {
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

      this.props.componentSetItem.addComponent(name, newDataObject);
    }
  }

  getFormIdFromComponentId(componentId: string) {
    return "entity_" + componentId.replace(/:/gi, "_").replace(/_/gi, "_");
  }

  async _updateManager() {
    if (!this.props.componentSetItem) {
      return;
    }

    const components = this.props.componentSetItem.getComponents();

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
      this.props.componentSetItem.removeComponent(componentId);
      this.forceUpdate();
    }
  }

  getUsableComponents() {
    const components = this.props.componentSetItem.getComponents();
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

    const components = this.props.componentSetItem.getComponents();
    const componentForms = [];
    const componentList = [];

    let selectedIndex = 0;

    for (let i = 0; i < components.length; i++) {
      const component = components[i];

      if (typeof component === "object" && component.id !== undefined) {
        const formId = component.id.replace(/:/gi, "_").replace(/_/gi, "_");

        const form = Database.getForm("entity_" + formId);

        componentList.push({
          key: component.id,
          header: Utilities.humanifyMinecraftName(component.id),
          headerMedia: " ",
          content: " ",
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

    /*
    if (this.props.componentSetItem instanceof EntityType) {
      title = <div>Component</div>;
    } else if (this.props.componentSetItem instanceof ManagedComponentGroup) {
      const mcgTitle = (this.props.componentSetItem as ManagedComponentGroup).id;
      title = <div className="cose-title">{mcgTitle} Group</div>;
    }*/

    const areaHeight = "calc(100vh - " + String(this.props.heightOffset + 34) + "px)";

    return (
      <div className="cose-area">
        <div className="cose-componentArea">
          <div className="cose-titleArea">{title}</div>
          <div className="cose-componentToolBarArea">
            <Toolbar aria-label="Editor toolbar overflow menu" items={toolbarItems} />
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
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
            minHeight: areaHeight,
            maxHeight: areaHeight,
          }}
        >
          <List
            selectable
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
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
          }}
        >
          {componentForms}
        </div>
      </div>
    );
  }
}
