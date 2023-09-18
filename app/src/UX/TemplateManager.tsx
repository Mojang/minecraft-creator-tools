import React, { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import "./TemplateManager.css";
import { RadioGroup, RadioGroupItemProps } from "@fluentui/react-northstar";
import IPersistable from "./IPersistable";
import WebUtilities from "./WebUtilities";
import { IPackReference, IWorldSettings } from "../minecraft/IWorldSettings";
import Pack from "../app/Pack";
import StorageUtilities from "../storage/StorageUtilities";
import Log from "../core/Log";

interface ITemplateManagerProps extends IAppProps {
  setActivePersistable?: (persistObject: IPersistable) => void;
  forceCompact?: boolean;
  worldSettings?: IWorldSettings;
  packReferences: IPackReference[];
  onPackSetChanged?: (packReferences: IPackReference[]) => void;
}

interface ITemplateManagerState {
  packs?: Pack[];
  errorMessage?: string;
  packReferences: IPackReference[];
}

export default class TemplateManager
  extends Component<ITemplateManagerProps, ITemplateManagerState>
  implements IPersistable
{
  #activeEditorPersistable?: IPersistable;

  constructor(props: ITemplateManagerProps) {
    super(props);

    this.persist = this.persist.bind(this);
    this._handleFileUpload = this._handleFileUpload.bind(this);
    this.load = this.load.bind(this);
    this._handleRadioItemClicked = this._handleRadioItemClicked.bind(this);

    this.state = {
      packs: this.getPacksCopy(),
      packReferences: this.props.packReferences,
    };

    this.load();
  }

  componentDidMount() {
    if (!this.state.packs) {
      this.load();
    }
  }

  private async _handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event.target || !event.target.files || event.target.files.length <= 0 || !this.props.carto.packStorage) {
      return;
    }

    const file = event.target.files[0];

    if (!file) {
      return;
    }

    if (!StorageUtilities.isContainerFile(file.name)) {
      this.setState({
        packs: this.state.packs,
        packReferences: this.state.packReferences,
        errorMessage: "Please upload a Minecraft file of type .mcpack, .mcaddon, .mcworld, .mctemplate, or .zip.",
      });
      return;
    }

    const arrayBuf = await file.arrayBuffer();

    let fileCount = 0;
    let fileName = file.name;
    let packFile = await this.props.carto.packStorage.rootFolder.ensureFileFromRelativePath("/" + fileName);
    let packFileExists = await packFile.exists();

    while (packFileExists) {
      fileCount++;

      fileName =
        StorageUtilities.getBaseFromName(fileName) + " " + fileCount + "." + StorageUtilities.getTypeFromName(fileName);
      packFile = await this.props.carto.packStorage.rootFolder.ensureFileFromRelativePath("/" + fileName);
      packFileExists = await packFile.exists();
    }

    packFile.setContent(new Uint8Array(arrayBuf));
    await packFile.saveContent();
    const pack = await this.props.carto.ensurePackForFile(packFile);

    let nextErrorMessage = undefined;

    if (!pack.isWorldType) {
      nextErrorMessage =
        "You have uploaded a .mcpack or .mcaddon file, but to add to your list of available packs, upload a .zip, .mcworld, or .mctemplate file.";
    }

    this.setState({
      packs: this.props.carto.packs,
      packReferences: this.state.packReferences,
      errorMessage: nextErrorMessage,
    });
  }

  private async load() {
    await this.props.carto.loadPacks();

    const newState = {
      packs: this.getPacksCopy(),
      errorMessage: undefined,
    };

    this.setState(newState);
  }

  getPacksCopy() {
    const packArr = [];

    if (this.props.carto.packs) {
      for (const pack of this.props.carto.packs) {
        packArr.push(pack);
      }
    }

    return packArr;
  }

  _handleNewChildPersistable(newPersistable: IPersistable) {
    this.#activeEditorPersistable = newPersistable;
  }

  async persist() {
    if (this.#activeEditorPersistable !== undefined) {
      await this.#activeEditorPersistable.persist();
    }
  }

  hasPackRef(packName: string) {
    packName = packName.toLowerCase();
    for (let i = 0; i < this.state.packReferences.length; i++) {
      const packBaseName = StorageUtilities.getBaseFromName(this.state.packReferences[i].name).toLowerCase();
      if (packBaseName === packName) {
        return true;
      }
    }

    return false;
  }

  ensurePackRef(packName: string) {
    if (this.hasPackRef(packName)) {
      return;
    }

    const pack = this.props.carto.getPackByName(packName, true);

    if (!pack) {
      Log.unexpectedUndefined("EPF");
      return;
    }

    const newPackRefs = [];

    const newPackRef = pack.createReference();
    newPackRefs.push(newPackRef);

    if (this.props.onPackSetChanged) {
      this.props.onPackSetChanged(newPackRefs);
    }

    this.setState({
      packReferences: newPackRefs,
      errorMessage: undefined,
      packs: this.state.packs,
    });
  }

  removeAllPackRefs() {
    const newPackRefs: IPackReference[] = [];

    if (this.props.onPackSetChanged) {
      this.props.onPackSetChanged(newPackRefs);
    }

    this.setState({
      packReferences: newPackRefs,
      errorMessage: undefined,
      packs: this.state.packs,
    });
  }

  _handleRadioItemClicked(e: SyntheticEvent, data: RadioGroupItemProps | undefined) {
    if (!data || !data.label || !data.name) {
      return;
    }

    if (data.name === "__notemplate") {
      this.removeAllPackRefs();
      return;
    }

    const labelText = data.label.toString();

    if (labelText) {
      this.ensurePackRef(labelText);
    }
  }

  render() {
    if (this.props === undefined || this.state === undefined) {
      return <></>;
    }

    const additional = [];
    let outerClassNameModifier = "";
    const width = WebUtilities.getWidth();

    if (width < 1016 || this.props.forceCompact === true) {
      outerClassNameModifier = "Compact";
    }

    const li = [];
    // let index = 0;
    let defaultValue = undefined;

    if (this.props.carto.packs === undefined) {
      return <div>(Opening packs...)</div>;
    }
    if (this.props.carto.packs.length > 0) {
      li.push({
        name: StorageUtilities.getBaseFromName("__notemplate"),
        value: StorageUtilities.getBaseFromName("__notemplate"),
        key: StorageUtilities.getBaseFromName("__notemplate"),

        label: "No template selected",
      });
      defaultValue = "__notemplate";
    }

    for (let i = 0; i < this.props.carto.packs.length; i++) {
      const pack = this.props.carto.packs[i];

      if (pack.isWorldType) {
        const packName = StorageUtilities.getBaseFromName(pack.name);
        li.push({
          name: packName,
          label: packName,
          key: packName,
          value: packName,
        });

        if (this.hasPackRef(packName)) {
          defaultValue = packName;
        }
      }
    }

    // index += this.props.carto.status.length;

    if (this.state.errorMessage) {
      additional.push(<div>{this.state.errorMessage}</div>);
    }

    return (
      <div className="tmmn-outer">
        <div className={"tmmn-grid" + outerClassNameModifier}>
          <div className="tmmn-list">
            <input type="file" title="uploadPack" onChange={this._handleFileUpload} />
            {additional}
            <RadioGroup
              checkedValue={defaultValue}
              vertical={true}
              defaultValue={defaultValue}
              items={li}
              onCheckedValueChange={this._handleRadioItemClicked}
            />
          </div>
        </div>
      </div>
    );
  }
}
