import { Component, ChangeEvent } from "react";
import IAppProps from "../appShell/IAppProps";
import "./EulaAcceptancePanel.css";
import { Checkbox, Button, CircularProgress } from "@mui/material";
import { getThemeColors } from "../hooks/theme/useThemeColors";
import { RemoteServerAccessLevel } from "../../app/ICreatorToolsData";
import Log from "../../core/Log";
import IProjectTheme from "../types/IProjectTheme";

interface IEulaAcceptancePanelProps extends IAppProps {
  theme: IProjectTheme;
  onEulaAccepted?: () => void;
  permissionLevel?: RemoteServerAccessLevel;
}

interface IEulaAcceptancePanelState {
  isChecked: boolean;
  isSubmitting: boolean;
  error: string | undefined;
  success: boolean;
}

/**
 * EulaAcceptancePanel - UI component for accepting the Minecraft EULA
 *
 * This panel is displayed when the Minecraft EULA has not been accepted,
 * which is required before Bedrock Dedicated Server features can be used.
 * Only admins can accept the EULA.
 */
export default class EulaAcceptancePanel extends Component<IEulaAcceptancePanelProps, IEulaAcceptancePanelState> {
  constructor(props: IEulaAcceptancePanelProps) {
    super(props);

    this._handleCheckboxChanged = this._handleCheckboxChanged.bind(this);
    this._handleAcceptClick = this._handleAcceptClick.bind(this);

    this.state = {
      isChecked: false,
      isSubmitting: false,
      error: undefined,
      success: false,
    };
  }

  _handleCheckboxChanged(e: ChangeEvent<HTMLInputElement>) {
    this.setState({
      isChecked: e.target.checked,
      error: undefined,
    });
  }

  async _handleAcceptClick() {
    if (!this.state.isChecked) {
      this.setState({
        isSubmitting: false,
        error: "You must check the box to accept the EULA.",
        success: false,
      });
      return;
    }

    this.setState({
      isSubmitting: true,
      error: undefined,
      success: false,
    });

    try {
      const response = await fetch("/api/acceptEula", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ accepted: true }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          Log.message("EULA accepted successfully via web UI.");
          this.setState({
            isSubmitting: false,
            error: undefined,
            success: true,
          });

          if (this.props.onEulaAccepted) {
            this.props.onEulaAccepted();
          }
        } else {
          this.setState({
            isSubmitting: false,
            error: result.message || "Failed to accept EULA.",
            success: false,
          });
        }
      } else if (response.status === 401) {
        this.setState({
          isSubmitting: false,
          error: "You must be logged in as an admin to accept the EULA.",
          success: false,
        });
      } else if (response.status === 403) {
        this.setState({
          isSubmitting: false,
          error: "Only administrators can accept the EULA.",
          success: false,
        });
      } else {
        const errorText = await response.text();
        this.setState({
          isSubmitting: false,
          error: `Failed to accept EULA: ${errorText}`,
          success: false,
        });
      }
    } catch (e: any) {
      Log.error("Error accepting EULA: " + e.toString());
      this.setState({
        isSubmitting: false,
        error: "Network error. Please try again.",
        success: false,
      });
    }
  }

  render() {
    const isAdmin = this.props.permissionLevel === RemoteServerAccessLevel.admin;
    const colors = getThemeColors();

    if (this.state.success) {
      return (
        <div className="eap-outer">
          <div className="eap-success">
            <div className="eap-success-icon">✓</div>
            <div className="eap-success-message">
              EULA accepted! Bedrock Dedicated Server features are now available.
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="eap-outer">
        <div className="eap-header">Minecraft EULA Acceptance Required</div>

        <div className="eap-content">
          <p className="eap-intro">
            This server can make use of Minecraft assets and/or the Minecraft Bedrock Dedicated Server. To use these
            features, you must agree to the Minecraft End User License Agreement and Privacy Statement.
          </p>

          <div className="eap-links">
            <div className="eap-link-item">
              <span className="eap-link-label">Minecraft End User License Agreement:</span>
              <a
                className="eap-link"
                href="https://minecraft.net/eula"
                rel="noreferrer noopener"
                target="_blank"
                style={{
                  color: colors.foreground1,
                }}
              >
                https://minecraft.net/eula
              </a>
            </div>
            <div className="eap-link-item">
              <span className="eap-link-label">Minecraft Privacy Statement:</span>
              <a
                className="eap-link"
                href="https://go.microsoft.com/fwlink/?LinkId=521839"
                rel="noreferrer noopener"
                target="_blank"
                style={{
                  color: colors.foreground1,
                }}
              >
                https://go.microsoft.com/fwlink/?LinkId=521839
              </a>
            </div>
          </div>

          {!isAdmin ? (
            <div className="eap-admin-notice">
              <p>Only administrators can accept the EULA. Please log in with admin credentials.</p>
            </div>
          ) : (
            <div className="eap-acceptance">
              <div className="eap-checkbox-row">
                <Checkbox
                  checked={this.state.isChecked}
                  onChange={this._handleCheckboxChanged}
                  disabled={this.state.isSubmitting}
                  size="small"
                />
                <span className="eap-checkbox-label">
                  I agree to the Minecraft End User License Agreement and Privacy Statement
                </span>
              </div>

              {this.state.error && <div className="eap-error">{this.state.error}</div>}

              <div className="eap-button-row">
                {this.state.isSubmitting ? (
                  <CircularProgress size={24} />
                ) : (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={this._handleAcceptClick}
                    disabled={!this.state.isChecked}
                  >
                    Accept and Enable BDS Features
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
}
