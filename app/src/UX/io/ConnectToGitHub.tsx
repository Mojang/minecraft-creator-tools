import React, { Component } from "react";
import IAppProps from "../appShell/IAppProps";
import Project from "../../app/Project";
import "./ConnectToGitHub.css";
import GitHubManager from "../../github/GitHubManager";
import {
  List,
  ListItemButton,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { GitHubPropertyType } from "../project/ProjectPropertyEditor";

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
    await this.props.creatorTools.userGitHub.ensureUserStateLoaded();

    this.setState({
      gitHub: this.props.creatorTools.userGitHub,
    });
  }

  _handleProjectSelected(selectedIndex: number) {
    if (
      this.props.project === null ||
      this.state == null ||
      this.state.gitHub === undefined ||
      this.state.gitHub.repos === undefined
    ) {
      return;
    }

    const repos = this.state.gitHub.repos;

    const selectedRepo = repos[selectedIndex];

    if (this.props && this.props.onGitHubProjectUpdated !== undefined) {
      if (this.state.gitHub.authenticatedUser !== undefined && this.state.gitHub.authenticatedUser.name !== null) {
        this.props.onGitHubProjectUpdated(GitHubPropertyType.owner, this.state.gitHub.authenticatedUser.name);
      }

      this.props.onGitHubProjectUpdated(GitHubPropertyType.mode, "existing");
      this.props.onGitHubProjectUpdated(GitHubPropertyType.repoName, selectedRepo.name);
    }
  }

  _handleNewProjectName(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.props.project === null || this.state == null) {
      return;
    }

    if (this.props && this.props.onGitHubProjectUpdated !== undefined) {
      this.props.onGitHubProjectUpdated(GitHubPropertyType.mode, "new");
      this.props.onGitHubProjectUpdated(GitHubPropertyType.repoName, e.target.value);
    }
  }

  _handleNewProjectDescription(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.props.project === null || this.state == null) {
      return;
    }

    if (this.props && this.props.onGitHubProjectUpdated !== undefined) {
      this.props.onGitHubProjectUpdated(GitHubPropertyType.mode, "new");

      this.props.onGitHubProjectUpdated(GitHubPropertyType.newDescription, e.target.value);
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
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>Existing repository</AccordionSummary>
          <AccordionDetails>
            <div key="existing" className="ppe-toolArea">
              Select a repository:
              <List>
                {repoListItems.map((item, i) => (
                  <ListItemButton key={item.key} onClick={() => this._handleProjectSelected(i)}>
                    <ListItemText primary={item.header} />
                  </ListItemButton>
                ))}
              </List>
            </div>
          </AccordionDetails>
        </Accordion>
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>New repository</AccordionSummary>
          <AccordionDetails>
            <div key="new" className="ppe-toolArea">
              <div id="cgh-name">Name:</div>
              <div>
                <TextField
                  aria-labelledby="cgh-name"
                  placeholder="Name"
                  onChange={this._handleNewProjectName}
                  size="small"
                />
              </div>
              <div id="cgh-description">Description:</div>
              <div>
                <TextField
                  aria-labelledby="cgh-description"
                  placeholder="Description "
                  onChange={this._handleNewProjectDescription}
                  size="small"
                />
              </div>
            </div>
          </AccordionDetails>
        </Accordion>
      </div>
    );
  }
}
