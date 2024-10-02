import { Component, SyntheticEvent } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./EventActionDesign.css";
import BlockType from "../minecraft/BlockType";
import { ThemeInput } from "@fluentui/styles";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import ManagedEvent from "../minecraft/ManagedEvent";
import BlockTypeBehaviorDefinition from "../minecraft/BlockTypeBehaviorDefinition";
import FunctionEditor from "./FunctionEditor";
import ProjectItem from "../app/ProjectItem";
import Utilities from "../core/Utilities";
import { Button, Dropdown, DropdownProps } from "@fluentui/react-northstar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faRemove } from "@fortawesome/free-solid-svg-icons";

interface IEventActionDesignProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  entityType: EntityTypeDefinition;

  item: ProjectItem;
  event: ManagedEvent;
  theme: ThemeInput<any>;
}

interface IEventActionDesignState {
  fileToEdit: IFile;
  isLoaded: boolean;
  state: string;
}

export default class EventActionDesign extends Component<IEventActionDesignProps, IEventActionDesignState> {
  private _lastFileEdited?: IFile;

  constructor(props: IEventActionDesignProps) {
    super(props);

    this.state = {
      fileToEdit: props.file,
      isLoaded: false,
      state: this.props.event.toString(),
    };

    this._handleToggleGroup = this._handleToggleGroup.bind(this);

    this._updateManager(false);
  }

  static getDerivedStateFromProps(props: IEventActionDesignProps, state: IEventActionDesignState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        isLoaded: false,
        state: props.event.toString(),
      };

      return state;
    }

    if (props.file !== state.fileToEdit) {
      state.fileToEdit = props.file;
      state.isLoaded = false;

      return state;
    }

    return null; // No change to state
  }

  componentDidUpdate(prevProps: IEventActionDesignProps, prevState: IEventActionDesignState) {
    this._updateManager(true);
  }

  async _updateManager(setState: boolean) {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        await BlockTypeBehaviorDefinition.ensureOnFile(this.state.fileToEdit, this._handleBlockTypeLoaded);
      }
    }

    if (
      this.state.fileToEdit &&
      this.state.fileToEdit.manager !== undefined &&
      this.state.fileToEdit.manager instanceof BlockType &&
      (this.state.fileToEdit.manager as BlockType).isLoaded &&
      !this.state.isLoaded
    ) {
      this._doUpdate(setState);
    }
  }

  _handleBlockTypeLoaded(blockType: BlockTypeBehaviorDefinition, typeA: BlockTypeBehaviorDefinition) {
    this._doUpdate(true);
  }

  async _doUpdate(setState: boolean) {
    if (setState) {
      this.setState({
        fileToEdit: this.state.fileToEdit,
        isLoaded: true,
        state: this.props.event.toString(),
      });
    } else {
      this.state = {
        fileToEdit: this.props.file,
        isLoaded: true,
        state: this.props.event.toString(),
      };
    }
  }

  async persist() {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager !== null) {
        const et = file.manager as BlockType;

        et.persist();
      }
    }
  }

  _handleToggleGroup(event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null) {
    if (!event?.target) {
      return;
    }

    const elt = event.target as HTMLElement;

    if (!elt.className) {
      return;
    }

    const classNames = elt.className.split(" ");

    for (const className of classNames) {
      if (className.startsWith("cg.")) {
        const cgKey = className.split(".");

        if (cgKey.length === 2) {
          const cgId = cgKey[1];

          if (this.props.event.hasAddComponentGroup(cgId)) {
            this.props.event.removeAddComponentGroup(cgId);
            this.props.event.ensureRemoveComponentGroup(cgId);
          } else if (this.props.event.hasRemoveComponentGroup(cgId)) {
            this.props.event.removeRemoveComponentGroup(cgId);
          } else {
            this.props.event.ensureAddComponentGroup(cgId);
          }

          this._doUpdate(true);
        }
      }
    }
  }

  async _handleAddTriggerChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {}

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";

    if (this.state === null || this.state.fileToEdit === null || this.state.fileToEdit.manager === undefined) {
      if (this.state.fileToEdit !== null) {
        if (this.state.fileToEdit.manager === undefined) {
          this._updateManager(true);
        }
      }

      return <div>Loading...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    const defaultTriggers = [];

    if (this.props.event.id === "minecraft:entity_spawned") {
      defaultTriggers.push(
        <div className="ead-instruction">This action is automatically fired when the mob is spawned.</div>
      );
    } else if (this.props.event.id === "minecraft:entity_born") {
      defaultTriggers.push(
        <div className="ead-instruction">This action is automatically fired when the mob is born via breeding.</div>
      );
    } else if (this.props.event.id === "minecraft:transformed") {
      defaultTriggers.push(
        <div className="ead-instruction">
          This action is automatically fired when the mob is changed into a different type of mob.
        </div>
      );
    } else if (this.props.event.id === "minecraft:on_prime") {
      defaultTriggers.push(
        <div className="ead-instruction">This action is automatically fired when the mob is set to explode.</div>
      );
    }

    defaultTriggers.push(
      <div className="ead-instruction">
        This can be triggered via /event command. For example,{" "}
        <span className="ead-codeSnippet">
          /event @e[type={this.props.entityType.id}] {this.props.event.id}
        </span>
      </div>
    );

    const et = this.state.fileToEdit.manager as EntityTypeDefinition;

    if (et.data === undefined) {
      return <div>Loading behavior pack...</div>;
    }

    const groupToggleButtons = [];

    const groups = et.getComponentGroups();

    const groupIds = [];

    for (const etg of groups) {
      groupIds.push(etg.id);
    }

    groupIds.sort();

    for (const groupId of groupIds) {
      let icon = <span className="ead-icon">&nbsp;</span>;

      let cssAdjust = "";
      if (this.props.event.hasAddComponentGroup(groupId)) {
        cssAdjust = " ead-cgAdd";
        icon = (
          <span className="ead-icon">
            <FontAwesomeIcon icon={faCheck} className="fa-lg" />
          </span>
        );
      } else if (this.props.event.hasRemoveComponentGroup(groupId)) {
        cssAdjust = " ead-cgRemove";
        icon = (
          <span className="ead-icon">
            <FontAwesomeIcon icon={faRemove} className="fa-lg" />
          </span>
        );
      }

      groupToggleButtons.push(
        <Button
          key={"eadcg." + groupId}
          className={"ead-cgToggle" + cssAdjust + " cg." + groupId}
          onClick={this._handleToggleGroup}
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1 + " !important",
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
          }}
        >
          {icon}
          <span className={"ead-cgText cg." + groupId}>{Utilities.humanifyMinecraftName(groupId)}</span>
        </Button>
      );
    }

    return (
      <div
        className="ead-area"
        style={{
          minHeight: height,
          maxHeight: height,
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
        }}
      >
        <div className="ead-header">{this.props.event.id}</div>
        <div className="ead-triggerTitle">Triggers</div>
        <div className="ead-info">{defaultTriggers}</div>
        <div className="ead-addTriggerArea">
          <div className="ead-addTriggerInstruction">Add a trigger:</div>
          <div className="ead-addTriggerDropdown">
            <Dropdown items={["on breathe"]} placeholder="<select a trigger>" onChange={this._handleAddTriggerChange} />
          </div>
          <div className="ead-addTriggerButton">
            <Button>Add</Button>
          </div>
        </div>

        <div className="ead-actionsTitle">Actions</div>

        <div className="ead-componentGroupsHeader">Add or remove component groups</div>
        <div className="ead-componentGroupsHeaderInfo">(click to toggle add/remove/neutral)</div>
        <div
          className="ead-componentGroupsBin"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
          }}
        >
          {groupToggleButtons}
        </div>

        <div className="ead-functionsHeader">
          <FunctionEditor
            preferredTextSize={this.props.item.project.carto.preferredTextSize}
            theme={this.props.theme}
            initialContent=""
            title="Run commands"
            readOnly={this.props.readOnly}
            isCommandEditor={false}
            fixedHeight={200}
            carto={this.props.item.project.carto}
          />
        </div>
      </div>
    );
  }
}
