import { Component } from "react";
import "./GitHubReferenceEditor.css";
import Carto from "../app/Carto";
import Project from "../app/Project";
import { Toolbar } from "@fluentui/react-northstar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearchPlus, faSearchMinus } from "@fortawesome/free-solid-svg-icons";
import IGitHubInfo from "../app/IGitHubInfo";

interface IGitHubReferenceEditorProps {
  heightOffset: number;
  readOnly: boolean;
  preferredTextSize: number;
  project: Project;
  reference: IGitHubInfo;
  carto: Carto;
}

interface IGitHubReferenceEditorState {}

export default class GitHubReferenceEditor extends Component<IGitHubReferenceEditorProps, IGitHubReferenceEditorState> {
  constructor(props: IGitHubReferenceEditorProps) {
    super(props);

    this._handleContentUpdated = this._handleContentUpdated.bind(this);

    this.state = {};
  }

  _handleContentUpdated(newValue: string | undefined, event: any) {}

  async persist() {}

  render() {
    const interior = <>GitHub Reference</>;

    const height = "calc(100vh - " + this.props.heightOffset + "px)";

    const toolbarItems = [
      {
        icon: <FontAwesomeIcon icon={faSearchPlus} className="fa-lg" />,
        key: "zoomIn",
        //                onClick: this.zoomIn,
        title: "Toggle whether hidden items are shown",
      },
      {
        icon: <FontAwesomeIcon icon={faSearchMinus} className="fa-lg" />,
        key: "zoomOut",
        //               onClick: this.zoomOut,
        title: "Toggle whether hidden items are shown",
      },
    ];

    return (
      <div
        className="ghre-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="ghre-toolBar">
          <Toolbar aria-label="GitHub reference editor toolbar" items={toolbarItems} />
        </div>
        {interior}
      </div>
    );
  }
}
