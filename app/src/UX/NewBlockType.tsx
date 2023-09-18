import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./NewBlockType.css";
import { Accordion, Input, InputProps } from "@fluentui/react-northstar";
import Database from "./../minecraft/Database";
import Log from "./../core/Log";
import IFolder from "./../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import BlockTypeTile from "./BlockTypeTile";

interface INewBlockTypeProps extends IAppProps {
  project: Project;
  onNewBlockTypeUpdated: (blockTypeId?: string, name?: string) => void;
}

interface INewBlockTypeState {
  blockTypesFolder?: IFolder;
  selectedBlockTypeId?: string;
  name?: string;
}

export default class NewBlockType extends Component<INewBlockTypeProps, INewBlockTypeState> {
  constructor(props: INewBlockTypeProps) {
    super(props);

    this._handleBlockTypeCommand = this._handleBlockTypeCommand.bind(this);
    this._handleNameChanged = this._handleNameChanged.bind(this);
    this._ensureLoaded = this._ensureLoaded.bind(this);

    this.state = {};

    window.setTimeout(this._ensureLoaded, 1);
  }

  async _ensureLoaded() {
    await Database.loadDefaultBehaviorPack();

    if (Database.defaultBehaviorPackFolder === undefined || Database.defaultBehaviorPackFolder === null) {
      Log.fail("Unexpectedly could not load default BP folder.");
      return;
    }

    const blocksFolder = Database.defaultBehaviorPackFolder.ensureFolder("blocks");

    await blocksFolder.load(false);

    this.setState({
      blockTypesFolder: blocksFolder,
      selectedBlockTypeId: this.state.selectedBlockTypeId,
      name: this.state.name,
    });
  }

  _handleBlockTypeCommand(blockTypeId: string) {
    if (this.props && this.props.onNewBlockTypeUpdated !== undefined) {
      const newName = this.state.name;
      this.props.onNewBlockTypeUpdated(blockTypeId, newName);

      this.setState({
        name: newName,
        selectedBlockTypeId: blockTypeId,
      });
    }
  }

  _handleNameChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.carto === null || this.state == null) {
      return;
    }

    if (this.state.name) {
      this.props.onNewBlockTypeUpdated(this.state.name);
    }

    this.setState({
      name: data.value,
    });
  }

  render() {
    if (
      this.state === null ||
      Database.defaultBehaviorPackFolder === null ||
      this.state.blockTypesFolder === undefined
    ) {
      return <div>Loading...</div>;
    }

    const blockTypesFolder = this.state.blockTypesFolder;

    const blockTypeTiles = [];

    if (blockTypesFolder === undefined) {
      return;
    }

    for (const fileName in blockTypesFolder.files) {
      const baseName = StorageUtilities.getBaseFromName(fileName);

      blockTypeTiles.push(
        <BlockTypeTile
          isSelected={baseName === this.state.selectedBlockTypeId}
          key={"item" + fileName}
          onClick={this._handleBlockTypeCommand}
          carto={this.props.carto}
          blockTypeId={baseName}
        />
      );
    }

    let inputText = this.state.name;

    if (inputText === undefined) {
      inputText = "";
    }

    return (
      <div className="net-outer">
        <div className="net-optionsArea">
          <div>
            <Input value={inputText} defaultValue={inputText} onChange={this._handleNameChanged} />
          </div>
        </div>
        <Accordion
          defaultActiveIndex={0}
          exclusive
          panels={[
            {
              title: "Block Types",
              content: <div className="net-gallery">{blockTypeTiles}</div>,
            },
          ]}
        />
      </div>
    );
  }
}
