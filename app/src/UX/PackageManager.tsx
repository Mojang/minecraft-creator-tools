import React, { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import "./PackageManager.css";
import { Checkbox, CheckboxProps, List, selectableListBehavior } from "@fluentui/react-northstar";
import IPersistable from "./IPersistable";
import WebUtilities from "./WebUtilities";
import { IPackageReference, IWorldSettings } from "../minecraft/IWorldSettings";
import Package from "../app/Package";
import StorageUtilities from "../storage/StorageUtilities";
import Log from "../core/Log";

interface IPackManagerProps extends IAppProps {
  setActivePersistable?: (persistObject: IPersistable) => void;
  forceCompact?: boolean;
  worldSettings?: IWorldSettings;
  isWorldFocused: boolean;
  packReferences: IPackageReference[];
  onPackSetChanged?: (packReferences: IPackageReference[]) => void;
}

interface IPackManagerState {
  packs?: Package[];
  errorMessage?: string;
  packReferences: IPackageReference[];
}

export default class PackManager extends Component<IPackManagerProps, IPackManagerState> {
  #activeEditorPersistable?: IPersistable;

  constructor(props: IPackManagerProps) {
    super(props);

    this.persist = this.persist.bind(this);
    this._handleFileUpload = this._handleFileUpload.bind(this);
    this.load = this.load.bind(this);
    this._handleCheckboxClicked = this._handleCheckboxClicked.bind(this);
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
    if (
      !event.target ||
      !event.target.files ||
      event.target.files.length <= 0 ||
      !this.props.creatorTools.packStorage
    ) {
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
    let packFile = await this.props.creatorTools.packStorage.rootFolder.ensureFileFromRelativePath("/" + fileName);
    let packFileExists = await packFile.exists();

    while (packFileExists) {
      fileCount++;

      fileName =
        StorageUtilities.getBaseFromName(fileName) + " " + fileCount + "." + StorageUtilities.getTypeFromName(fileName);
      packFile = await this.props.creatorTools.packStorage.rootFolder.ensureFileFromRelativePath("/" + fileName);
      packFileExists = await packFile.exists();
    }

    if (packFile.setContentIfSemanticallyDifferent(new Uint8Array(arrayBuf))) {
      await packFile.saveContent();
    }

    const pack = await this.props.creatorTools.ensurePackForFile(packFile);

    let nextErrorMessage = undefined;

    if (pack.isWorldType && !this.props.isWorldFocused) {
      nextErrorMessage =
        "You have uploaded a .mcworld or .mctemplate file, but to add to your list of available packs, upload a .zip, .mcpack, or .mcaddon file.";
    } else if (!pack.isWorldType && this.props.isWorldFocused) {
      nextErrorMessage =
        "You have uploaded a .mcpack or .mcaddon file, but to add to your list of available packs, upload a .zip, .mcworld, or .mctemplate file.";
    }

    this.setState({
      packs: this.props.creatorTools.packs,
      packReferences: this.state.packReferences,
      errorMessage: nextErrorMessage,
    });
  }

  private async load() {
    await this.props.creatorTools.loadPacks();

    const newState = {
      packs: this.getPacksCopy(),
      errorMessage: undefined,
    };

    this.setState(newState);
  }

  getPacksCopy() {
    const packArr = [];

    if (this.props.creatorTools.packs) {
      for (const pack of this.props.creatorTools.packs) {
        packArr.push(pack);
      }
    }

    return packArr;
  }

  _handleNewChildPersistable(newPersistable: IPersistable) {
    this.#activeEditorPersistable = newPersistable;
  }

  async persist(): Promise<boolean> {
    if (this.#activeEditorPersistable !== undefined) {
      return await this.#activeEditorPersistable.persist();
    }

    return false;
  }

  hasPackRef(packName: string) {
    packName = StorageUtilities.getBaseFromName(packName).toLowerCase();
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

    const pack = this.props.creatorTools.getPackByName(packName, this.props.isWorldFocused);

    if (!pack) {
      Log.unexpectedUndefined("EPF");
      return;
    }

    const newPackRef = pack.createReference();
    this.state.packReferences.push(newPackRef);

    if (this.props.onPackSetChanged) {
      this.props.onPackSetChanged(this.state.packReferences);
    }

    this.forceUpdate();
  }

  removePackRef(packName: string) {
    const newPackRefs = [];

    for (let i = 0; i < this.state.packReferences.length; i++) {
      const packBaseName = StorageUtilities.getBaseFromName(this.state.packReferences[i].name).toLowerCase();
      if (packBaseName !== packName.toLowerCase()) {
        newPackRefs.push(this.state.packReferences[i]);
      }
    }

    if (this.props.onPackSetChanged) {
      this.props.onPackSetChanged(newPackRefs);
    }

    this.setState({
      packReferences: newPackRefs,
      errorMessage: undefined,
      packs: this.state.packs,
    });
  }

  _handleCheckboxClicked(e: SyntheticEvent, data: (CheckboxProps & { checked: boolean }) | undefined) {
    if (!data || !data.label) {
      return;
    }

    const labelText = data.label.toString();

    if (data.checked && labelText) {
      this.ensurePackRef(labelText);
    } else if (labelText) {
      this.removePackRef(labelText);
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
    let index = 0;

    if (this.props.creatorTools.packs === undefined) {
      return <div>(Opening packs...)</div>;
    }

    for (let i = 0; i < this.props.creatorTools.packs.length; i++) {
      const pack = this.props.creatorTools.packs[i];
      if ((this.props.isWorldFocused && pack.isWorldType) || (!this.props.isWorldFocused && !pack.isWorldType)) {
        li.push({
          key: "pcki" + i,
          content: (
            <div className="pcmn-list-item" title={pack.name}>
              <Checkbox
                checked={this.hasPackRef(pack.name)}
                onClick={this._handleCheckboxClicked}
                label={StorageUtilities.getBaseFromName(pack.name)}
              />
            </div>
          ),
        });
      }
    }
    index += this.props.creatorTools.status.length;

    if (this.state.errorMessage) {
      additional.push(<div>{this.state.errorMessage}</div>);
    }

    return (
      <div className="pcmn-outer">
        <div className={"pcmn-grid" + outerClassNameModifier}>
          <div className="pcmn-list">
            <input type="file" title="uploadPack" onChange={this._handleFileUpload} />
            {additional}
            <List
              className="pcmn-list"
              aria-label="List of modules"
              accessibility={selectableListBehavior}
              selectable
              items={li}
              selectedIndex={index}
              defaultSelectedIndex={index}
            />
          </div>
        </div>
      </div>
    );
  }
}
