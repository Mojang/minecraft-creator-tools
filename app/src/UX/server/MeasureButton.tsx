import { Component } from "react";
import "./MeasureButton.css";
import IAppProps from "../appShell/IAppProps";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Stack, IconButton } from "@mui/material";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";
import { mcColors } from "../hooks/theme/mcColors";
import IProjectTheme from "../types/IProjectTheme";

interface IMeasureButtonProps extends IAppProps {
  title: string;
  theme: IProjectTheme;

  onRemove: (measureTitle: string) => void;
}

interface IMeasureButtonState {}

export default class MeasureButton extends Component<IMeasureButtonProps, IMeasureButtonState> {
  constructor(props: IMeasureButtonProps) {
    super(props);

    this._closeMeasure = this._closeMeasure.bind(this);
  }

  _closeMeasure() {
    this.props.onRemove(this.props.title);
  }

  render() {
    const title = this.props.title;

    let outerClassName = "mbut-outer";
    const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;

    return (
      <div
        className={outerClassName}
        title={this.props.title}
        style={{
          backgroundColor: isDark ? mcColors.gray4 : mcColors.gray5,
        }}
      >
        <div className="mbut-grid">
          <div className="mbut-mainArea">
            <div
              className="mbut-title"
              style={{
                color: isDark ? mcColors.gray1 : mcColors.gray2,
              }}
            >
              {title}
            </div>
          </div>
          <div className="mbut-toolArea">
            <Stack direction="row" spacing={1} aria-label="Measure actions">
              <IconButton key="closeMeasure" onClick={this._closeMeasure} title="Close this Measure" size="small">
                <FontAwesomeIcon icon={faXmark} className="fa-md" />
              </IconButton>
            </Stack>
          </div>
        </div>
      </div>
    );
  }
}
