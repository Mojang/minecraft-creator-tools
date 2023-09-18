import React, { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./ConnectToGitHub.css";
import GitHubManager from "../github/GitHubManager";
import { List, ListProps, Accordion, InputProps, Input } from "@fluentui/react-northstar";
import { GitHubPropertyType } from "./ProjectPropertyEditor";

interface IConnectToGitHubProps extends IAppProps {
  project: Project;
  onGitHubProjectUpdated: (propertyType: GitHubPropertyType, value: string) => void;
}

interface IConnectToGitHubState {
  gitHub: GitHubManager | undefined;
}

export default class ConnectToGitHub extends Component<IConnectToGitHubProps, IConnectToGitHubState> {
  constructor(props: IConnectToGitHubProps) {
    super(props);

    this._handleProjectSelected = this._handleProjectSelected.bind(this);
    this._handleNewProjectName = this._handleNewProjectName.bind(this);
    this._handleNewProjectDescription = this._handleNewProjectDescription.bind(this);

    this._loadGitHub();
  }

  async _loadGitHub() {
    await this.props.carto.userGitHub.ensureUserStateLoaded();

    this.setState({
      gitHub: this.props.carto.userGitHub,
    });
  }

  _handleProjectSelected(elt: any, event: ListProps | undefined) {
    if (
      event === undefined ||
      event.selectedIndex === undefined ||
      this.props.project === null ||
      this.state == null ||
      this.state.gitHub === undefined ||
      this.state.gitHub.repos === undefined
    ) {
      return;
    }

    const repos = this.state.gitHub.repos;

    const selectedRepo = repos[event.selectedIndex];

    if (this.props && this.props.onGitHubProjectUpdated !== undefined) {
      if (this.state.gitHub.authenticatedUser !== undefined && this.state.gitHub.authenticatedUser.name !== null) {
        this.props.onGitHubProjectUpdated(GitHubPropertyType.owner, this.state.gitHub.authenticatedUser.name);
      }

      this.props.onGitHubProjectUpdated(GitHubPropertyType.mode, "existing");
      this.props.onGitHubProjectUpdated(GitHubPropertyType.repoName, selectedRepo.name);
    }
  }

  _handleNewProjectName(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.project === null || this.state == null) {
      return;
    }

    if (this.props && this.props.onGitHubProjectUpdated !== undefined) {
      this.props.onGitHubProjectUpdated(GitHubPropertyType.mode, "new");
      this.props.onGitHubProjectUpdated(GitHubPropertyType.repoName, data.value);
    }
  }

  _handleNewProjectDescription(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.project === null || this.state == null) {
      return;
    }

    if (this.props && this.props.onGitHubProjectUpdated !== undefined) {
      this.props.onGitHubProjectUpdated(GitHubPropertyType.mode, "new");

      this.props.onGitHubProjectUpdated(GitHubPropertyType.newDescription, data.value);
    }
  }

  render() {
    if (this.state === null || this.state.gitHub === undefined || this.state.gitHub.repos === undefined) {
      return <div>Loading...</div>;
    }

    const repoListItems = [];

    if (this.props.project) {
      const repos = this.state.gitHub.repos;

      for (let i = 0; i < repos.length; i++) {
        const repo = repos[i];

        repoListItems.push({
          key: repo.name,
          header: repo.name,
          headerMedia: " ",
          content: " ",
        });
      }
    }

    return (
      <div className="ctgh-outer">
        <Accordion
          defaultActiveIndex={[0]}
          panels={[
            {
              title: "Exiting repository",

              content: (
                <div key="existing" className="ppe-toolArea">
                  Select a repository:
                  <List
                    selectable
                    defaultSelectedIndex={0}
                    items={repoListItems}
                    onSelectedIndexChange={this._handleProjectSelected}
                  />
                </div>
              ),
            },
            {
              title: "New repository",
              content: (
                <div key="new" className="ppe-toolArea">
                  <div>Name:</div>
                  <div>
                    <Input clearable placeholder="Name" onChange={this._handleNewProjectName} />
                  </div>
                  <div>Description:</div>
                  <div>
                    <Input clearable placeholder="Description " onChange={this._handleNewProjectDescription} />
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>
    );
  }
}
