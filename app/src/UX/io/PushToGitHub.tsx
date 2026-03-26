import React, { Component } from "react";
import IAppProps from "../appShell/IAppProps";
import Project from "../../app/Project";
import "./PushToGitHub.css";
import { TextField, List, ListItem, ListItemButton, ListItemText } from "@mui/material";
import DifferenceSet from "../../storage/DifferenceSet";

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
    //   await this.props.project.stageChangesToGitHub();

    this.setState({
      differences: this.props.project.differencesFromGitHub,
    });
  }

  _handleCommitMessageChanged(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.props.project === null || this.state == null || this.state.differences === undefined) {
      return;
    }

    if (this.props && this.props.onGitHubCommitUpdated !== undefined) {
      this.props.onGitHubCommitUpdated(e.target.value);
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
          <TextField
            aria-label="Add your commit message"
            placeholder="Add your commit message"
            onChange={this._handleCommitMessageChanged}
            size="small"
            fullWidth
          />
        </div>
        <div className="ptgh-changeArea">
          These will be your changes:
          <div className="ptgh-changeListBin">
            <List>
              {diffListItems.map((item) => (
                <ListItem key={item.key} disablePadding>
                  <ListItemButton>
                    <ListItemText primary={item.header} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </div>
        </div>
      </div>
    );
  }
}
