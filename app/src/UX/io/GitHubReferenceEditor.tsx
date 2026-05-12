import { Component } from "react";
import "./GitHubReferenceEditor.css";
import CreatorTools from "../../app/CreatorTools";
import Project from "../../app/Project";
import { Stack, IconButton } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearchPlus, faSearchMinus } from "@fortawesome/free-solid-svg-icons";
import IGitHubInfo from "../../app/IGitHubInfo";
import { WithLocalizationProps, withLocalization } from "../withLocalization";

interface IGitHubReferenceEditorProps extends WithLocalizationProps {
  heightOffset: number;
  readOnly: boolean;
  preferredTextSize: number;
  project: Project;
  reference: IGitHubInfo;
  creatorTools: CreatorTools;
}

interface IGitHubReferenceEditorState {}

class GitHubReferenceEditor extends Component<IGitHubReferenceEditorProps, IGitHubReferenceEditorState> {
  constructor(props: IGitHubReferenceEditorProps) {
    super(props);

    this._handleContentUpdated = this._handleContentUpdated.bind(this);

    this.state = {};
  }

  _handleContentUpdated(newValue: string | undefined, event: any) {}

  async persist(): Promise<boolean> {
    return false;
  }

  render() {
    const interior = <>{this.props.intl.formatMessage({ id: "project_editor.github_ref.title" })}</>;

    const height = "calc(100vh - " + this.props.heightOffset + "px)";

    return (
      <div
        className="ghre-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="ghre-toolBar">
          <Stack direction="row" spacing={0.5} aria-label={this.props.intl.formatMessage({ id: "project_editor.github_ref.toolbar_aria" })}>
            <IconButton title={this.props.intl.formatMessage({ id: "project_editor.github_ref.zoom_in_title" })} aria-label={this.props.intl.formatMessage({ id: "project_editor.github_ref.zoom_in" })}>
              <FontAwesomeIcon icon={faSearchPlus} className="fa-lg" />
            </IconButton>
            <IconButton title={this.props.intl.formatMessage({ id: "project_editor.github_ref.zoom_out_title" })} aria-label={this.props.intl.formatMessage({ id: "project_editor.github_ref.zoom_out" })}>
              <FontAwesomeIcon icon={faSearchMinus} className="fa-lg" />
            </IconButton>
          </Stack>
        </div>
        {interior}
      </div>
    );
  }
}

export default withLocalization(GitHubReferenceEditor);
