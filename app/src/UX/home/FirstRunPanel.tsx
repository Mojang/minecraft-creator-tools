/**
 * FirstRunPanel
 *
 * A welcome panel that displays at the top of the Project Actions screen on first run.
 * It allows users to:
 * 1. Learn about Minecraft Creator Tools
 * 2. Choose their default editing experience (easy/intermediate/advanced)
 * 3. Dismiss the panel permanently with "Don't show this again"
 *
 * This is an embedded panel (not a modal) - selections are saved immediately.
 */
import { Component } from "react";
import { Checkbox, FormControlLabel } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWandMagicSparkles, faEye, faCode, faCheckCircle, faTimes } from "@fortawesome/free-solid-svg-icons";
import CreatorTools from "../../app/CreatorTools";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";
import { CreatorToolsEditPreference } from "../../app/ICreatorToolsData";
import "./FirstRunPanel.css";
import IProjectTheme from "../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../withLocalization";

interface IFirstRunPanelProps extends WithLocalizationProps {
  creatorTools: CreatorTools;
  theme: IProjectTheme;
  onDismiss: () => void;
  onEditPreferenceChanged?: () => void;
}

interface IFirstRunPanelState {
  selectedPreference: CreatorToolsEditPreference;
  dontShowAgain: boolean;
}

class FirstRunPanel extends Component<IFirstRunPanelProps, IFirstRunPanelState> {
  constructor(props: IFirstRunPanelProps) {
    super(props);

    this._handleEasyClick = this._handleEasyClick.bind(this);
    this._handleIntermediateClick = this._handleIntermediateClick.bind(this);
    this._handleAdvancedClick = this._handleAdvancedClick.bind(this);
    this._handleDontShowAgainChange = this._handleDontShowAgainChange.bind(this);
    this._handleDismiss = this._handleDismiss.bind(this);

    // Default to editors (full) if not set
    const currentPreference = props.creatorTools.editPreference ?? CreatorToolsEditPreference.editors;

    // Ensure editPreference is actually set on the creatorTools object.
    // Without this, editPreference remains undefined even though the UI shows "Focused" as selected,
    // causing downstream components (like ProjectItemList) to show items meant for non-Focused modes.
    if (props.creatorTools.editPreference === undefined || props.creatorTools.editPreference === null) {
      props.creatorTools.editPreference = currentPreference;
      props.creatorTools.save();
    }

    this.state = {
      selectedPreference: currentPreference,
      dontShowAgain: false,
    };
  }

  private _selectPreference(preference: CreatorToolsEditPreference) {
    this.setState({ selectedPreference: preference, dontShowAgain: true });
    this.props.creatorTools.editPreference = preference;
    this.props.creatorTools.disableFirstRun = true;
    this.props.creatorTools.save();
    if (this.props.onEditPreferenceChanged) {
      this.props.onEditPreferenceChanged();
    }
  }

  private _handleEasyClick() {
    this._selectPreference(CreatorToolsEditPreference.summarized);
  }

  private _handleIntermediateClick() {
    this._selectPreference(CreatorToolsEditPreference.editors);
  }

  private _handleAdvancedClick() {
    this._selectPreference(CreatorToolsEditPreference.raw);
  }

  private _handleDontShowAgainChange(event: React.ChangeEvent<HTMLInputElement>) {
    const checked = event.target.checked;
    this.setState({ dontShowAgain: checked });
    this.props.creatorTools.disableFirstRun = checked;
    this.props.creatorTools.save();
    if (checked) {
      this.props.onDismiss();
    }
  }

  private _handleDismiss() {
    this.props.onDismiss();
  }

  render() {
    const { selectedPreference } = this.state;
    const isLightTheme = CreatorToolsHost.theme === CreatorToolsThemeStyle.light;

    return (
      <div className={"frp-panel" + (isLightTheme ? " frp-light" : "")}>
        {/* Dismiss button */}
        <button
          className="frp-dismissButton"
          onClick={this._handleDismiss}
          title={this.props.intl.formatMessage({ id: "first_run.dismiss_title" })}
          aria-label={this.props.intl.formatMessage({ id: "first_run.dismiss_aria" })}
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>

        {/* Welcome Header */}
        <div className="frp-header">
          <div className="frp-headerText">
            <h1 className="frp-title">{this.props.intl.formatMessage({ id: "first_run.welcome_title" })}</h1>
            <p className="frp-subtitle">
              {this.props.intl.formatMessage({ id: "first_run.welcome_subtitle" })}
            </p>
          </div>
        </div>

        {/* Experience Selection */}
        <div className="frp-optionsGrid">
          {/* Easy Mode */}
          <button
            className={`frp-option ${
              selectedPreference === CreatorToolsEditPreference.summarized ? "frp-optionSelected" : ""
            }`}
            onClick={this._handleEasyClick}
            aria-pressed={selectedPreference === CreatorToolsEditPreference.summarized}
          >
            <div className="frp-optionIcon">
              <FontAwesomeIcon icon={faWandMagicSparkles} />
            </div>
            <div className="frp-optionContent">
              <div className="frp-optionTitle">
                {this.props.intl.formatMessage({ id: "first_run.focused" })} <span className="frp-recommendedBadge">{this.props.intl.formatMessage({ id: "first_run.recommended" })}</span>
              </div>
              <div className="frp-optionDesc">
                {this.props.intl.formatMessage({ id: "first_run.focused_desc" })}
              </div>
            </div>
            {selectedPreference === CreatorToolsEditPreference.summarized && (
              <div className="frp-optionCheck">
                <FontAwesomeIcon icon={faCheckCircle} />
              </div>
            )}
          </button>

          {/* Intermediate Mode */}
          <button
            className={`frp-option ${
              selectedPreference === CreatorToolsEditPreference.editors ? "frp-optionSelected" : ""
            }`}
            onClick={this._handleIntermediateClick}
            aria-pressed={selectedPreference === CreatorToolsEditPreference.editors}
          >
            <div className="frp-optionIcon">
              <FontAwesomeIcon icon={faEye} />
            </div>
            <div className="frp-optionContent">
              <div className="frp-optionTitle">{this.props.intl.formatMessage({ id: "first_run.full" })}</div>
              <div className="frp-optionDesc">
                {this.props.intl.formatMessage({ id: "first_run.full_desc" })}
              </div>
            </div>
            {selectedPreference === CreatorToolsEditPreference.editors && (
              <div className="frp-optionCheck">
                <FontAwesomeIcon icon={faCheckCircle} />
              </div>
            )}
          </button>

          {/* Advanced Mode */}
          <button
            className={`frp-option ${
              selectedPreference === CreatorToolsEditPreference.raw ? "frp-optionSelected" : ""
            }`}
            onClick={this._handleAdvancedClick}
            aria-pressed={selectedPreference === CreatorToolsEditPreference.raw}
          >
            <div className="frp-optionIcon">
              <FontAwesomeIcon icon={faCode} />
            </div>
            <div className="frp-optionContent">
              <div className="frp-optionTitle">{this.props.intl.formatMessage({ id: "first_run.raw" })}</div>
              <div className="frp-optionDesc">
                {this.props.intl.formatMessage({ id: "first_run.raw_desc" })}
              </div>
            </div>
            {selectedPreference === CreatorToolsEditPreference.raw && (
              <div className="frp-optionCheck">
                <FontAwesomeIcon icon={faCheckCircle} />
              </div>
            )}
          </button>
        </div>

        {/* Footer with don't show again */}
        <div className="frp-footer">
          <FormControlLabel
            control={<Checkbox checked={this.state.dontShowAgain} onChange={this._handleDontShowAgainChange} />}
            label={this.props.intl.formatMessage({ id: "first_run.dont_show_again" })}
          />
        </div>
      </div>
    );
  }
}

export default withLocalization(FirstRunPanel);
