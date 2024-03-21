import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./NewItem.css";
import { Input, InputProps, ThemeInput } from "@fluentui/react-northstar";
import IProjectItemSeed from "../app/IProjectItemSeed";
import { ProjectItemType } from "../app/IProjectItemData";
import ProjectItemUtilities from "../app/ProjectItemUtilities";

interface INewItemProps extends IAppProps {
  project: Project;
  theme: ThemeInput<any>;
  itemType: ProjectItemType;
  onNewItemSeedUpdated: (seed: IProjectItemSeed) => void;
}

interface INewItemState {
  name?: string;
  nameIsManuallySet?: boolean;
}

export default class NewItem extends Component<INewItemProps, INewItemState> {
  constructor(props: INewItemProps) {
    super(props);

    this._handleNameChanged = this._handleNameChanged.bind(this);

    this.state = {};
  }

  _handleNameChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.carto === null || this.state == null) {
      return;
    }

    let nextNameIsManuallySet = this.state.nameIsManuallySet;

    if (data.value === undefined || data.value === "") {
      nextNameIsManuallySet = false;
    }

    if (this.props.onNewItemSeedUpdated) {
      this.props.onNewItemSeedUpdated({
        name: data.value,
        itemType: this.props.itemType,
      });
    }

    this.setState({
      name: data.value,
      nameIsManuallySet: nextNameIsManuallySet,
    });
  }

  render() {
    if (this.state === null) {
      return <div>Loading...</div>;
    }

    let inputText = this.state.name;

    if (inputText === undefined) {
      inputText = "";
    }

    return (
      <div className="nitem-outer">
        <div className="nitem-optionsArea">
          <div>
            <Input
              value={inputText}
              defaultValue={inputText}
              placeholder={ProjectItemUtilities.getNewItemName(this.props.itemType)}
              onChange={this._handleNameChanged}
            />
          </div>
        </div>
      </div>
    );
  }
}
