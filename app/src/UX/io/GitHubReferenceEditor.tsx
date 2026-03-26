import { Component } from "react";
import "./GitHubReferenceEditor.css";
import CreatorTools from "../../app/CreatorTools";
import Project from "../../app/Project";
import { Stack, IconButton } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearchPlus, faSearchMinus } from "@fortawesome/free-solid-svg-icons";
import IGitHubInfo from "../../app/IGitHubInfo";

interface IGitHubReferenceEditorProps {
  heightOffset: number;
  readOnly: boolean;
  preferredTextSize: number;
  project: Project;
  reference: IGitHubInfo;
  creatorTools: CreatorTools;
}

interface IGitHubReferenceEditorState {}

export default class GitHubReferenceEditor extends Component<IGitHubReferenceEditorProps, IGitHubReferenceEditorState> {
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
    const interior = <>GitHub Reference</>;

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
          <Stack direction="row" spacing={0.5} aria-label="GitHub reference editor toolbar">
            <IconButton title="Zoom into the text editor" aria-label="Zoom in">
              <FontAwesomeIcon icon={faSearchPlus} className="fa-lg" />
            </IconButton>
            <IconButton title="Zoom out of the text editor" aria-label="Zoom out">
              <FontAwesomeIcon icon={faSearchMinus} className="fa-lg" />
            </IconButton>
          </Stack>
        </div>
        {interior}
      </div>
    );
  }
}
