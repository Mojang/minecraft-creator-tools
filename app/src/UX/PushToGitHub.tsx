import React, { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./PushToGitHub.css";
import { List, InputProps, Input } from "@fluentui/react-northstar";
import DifferenceSet from "../storage/DifferenceSet";

interface IPushToGitHubProps extends IAppProps {
  project: Project;
  onGitHubCommitUpdated: (newCommitMessage: string) => void;
}

interface IPushToGitHubState {
  differences: DifferenceSet | undefined;
}

export default class PushToGitHub extends Component<IPushToGitHubProps, IPushToGitHubState> {
  constructor(props: IPushToGitHubProps) {
    super(props);

    this._handleCommitMessageChanged = this._handleCommitMessageChanged.bind(this);
  }

  componentDidMount() {
    this._loadGitHub();
  }

  async _loadGitHub() {
    await this.props.project.stageChangesToGitHub();

    this.setState({
      differences: this.props.project.differencesFromGitHub,
    });
  }

  _handleCommitMessageChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (
      data === undefined ||
      this.props.project === null ||
      this.state == null ||
      this.state.differences === undefined
    ) {
      return;
    }

    if (this.props && this.props.onGitHubCommitUpdated !== undefined) {
      this.props.onGitHubCommitUpdated(data.value);
    }
  }

  render() {
    if (this.state === null || this.state.differences === undefined) {
      return <div>Loading...</div>;
    }

    const diffListItems = [];

    if (this.props.project) {
      const differences = this.state.differences;

      for (let i = 0; i < differences.fileDifferences.length; i++) {
        const diff = differences.fileDifferences[i];
        let diffPath = diff.path;

        if (diffPath.startsWith("/")) {
          diffPath = diffPath.substring(1, diffPath.length);
        }

        diffListItems.push({
          key: diffPath,
          header: diffPath,
          headerMedia: " ",
          content: " ",
        });
      }
    }

    return (
      <div className="ptgh-outer">
        <div>
          <Input clearable placeholder="Add your commit message" onChange={this._handleCommitMessageChanged} />
        </div>
        <div className="ptgh-changeArea">
          These will be your changes:
          <div className="ptgh-changeListBin">
            <List selectable defaultSelectedIndex={0} items={diffListItems} />
          </div>
        </div>
      </div>
    );
  }
}
