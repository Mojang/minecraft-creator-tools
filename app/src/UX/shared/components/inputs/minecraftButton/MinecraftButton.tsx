import { Component, ReactNode } from "react";
import "./MinecraftButton.css";
import { Button } from "@mui/material";
import { getThemeColors } from "../../../../hooks/theme/useThemeColors";
import IProjectTheme from "../../../../types/IProjectTheme";

interface IMinecraftButtonProps {
  theme: IProjectTheme;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}

interface IMinecraftButtonState {
  isPushed: boolean;
}

export default class MinecraftButton extends Component<IMinecraftButtonProps, IMinecraftButtonState> {
  constructor(props: IMinecraftButtonProps) {
    super(props);

    this._projectClick = this._projectClick.bind(this);
    this._projectMouseDown = this._projectMouseDown.bind(this);
    this._projectMouseUp = this._projectMouseUp.bind(this);

    this.state = {
      isPushed: false,
    };
  }

  _projectClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (this.props.onClick) {
      this.props.onClick(event);
    }

    this.setState({
      isPushed: false,
    });
  }

  _projectMouseDown(event: React.SyntheticEvent<HTMLElement>) {
    this.setState({
      isPushed: true,
    });
  }

  _projectMouseUp(event: React.SyntheticEvent<HTMLElement>) {
    this.setState({
      isPushed: false,
    });
  }

  render() {
    const colors = getThemeColors();

    if (this.state && this.state.isPushed) {
      return (
        <div className={"micb-outer" + (this.props.className ? " " + this.props.className : "")}>
          <div
            className="micb-grid"
            style={{
              borderColor: colors.mc0,
            }}
          >
            <div
              className="micb-edge micb-7"
              style={{
                backgroundColor: colors.mc1,
              }}
            >
              &#160;
            </div>
            <div
              className="micb-edge micb-8"
              style={{
                backgroundColor: colors.mc2,
              }}
            >
              &#160;
            </div>
            <div
              className="micb-edge micb-9"
              style={{
                backgroundColor: colors.mc3,
              }}
            >
              &#160;
            </div>
            <div
              className="micb-edge micb-4"
              style={{
                backgroundColor: colors.mc2,
              }}
            >
              &#160;
            </div>
            <div
              className="micb-5"
              style={{
                backgroundColor: colors.mc4,
                color: colors.mcc1,
              }}
            >
              <Button
                className="micb-button"
                onClick={this._projectClick}
                onMouseDown={this._projectMouseDown}
                onMouseUp={this._projectMouseUp}
                onMouseLeave={this._projectMouseUp}
              >
                {this.props.children}
              </Button>
            </div>
            <div
              className="micb-edge micb-6"
              style={{
                backgroundColor: colors.mc5,
              }}
            >
              &#160;
            </div>
            <div
              className="micb-edge micb-1"
              style={{
                backgroundColor: colors.mc4,
              }}
            >
              &#160;
            </div>
            <div
              className="micb-edge micb-2"
              style={{
                backgroundColor: colors.mc5,
              }}
            >
              &#160;
            </div>
            <div
              className="micb-edge micb-3"
              style={{
                backgroundColor: colors.mc5,
              }}
            >
              &#160;
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={"micb-outer" + (this.props.className ? " " + this.props.className : "")}>
        <div
          className="micb-grid"
          style={{
            borderColor: colors.mc0,
          }}
        >
          <div
            className="micb-edge micb-7"
            style={{
              backgroundColor: colors.mc5,
            }}
          >
            &#160;
          </div>
          <div
            className="micb-edge micb-8"
            style={{
              backgroundColor: colors.mc5,
            }}
          >
            &#160;
          </div>
          <div
            className="micb-edge micb-9"
            style={{
              backgroundColor: colors.mc3,
            }}
          >
            &#160;
          </div>
          <div
            className="micb-edge micb-4"
            style={{
              backgroundColor: colors.mc5,
            }}
          >
            &#160;
          </div>
          <div
            className="micb-5"
            style={{
              backgroundColor: colors.mc4,
              color: colors.mcc1,
            }}
          >
            <Button
              className="micb-button"
              onClick={this._projectClick}
              onMouseDown={this._projectMouseDown}
              onMouseUp={this._projectMouseUp}
              onMouseLeave={this._projectMouseUp}
            >
              {this.props.children}
            </Button>
          </div>
          <div
            className="micb-edge micb-6"
            style={{
              backgroundColor: colors.mc2,
            }}
          >
            &#160;
          </div>
          <div
            className="micb-edge micb-1"
            style={{
              backgroundColor: colors.mc3,
            }}
          >
            &#160;
          </div>
          <div
            className="micb-edge micb-2"
            style={{
              backgroundColor: colors.mc2,
            }}
          >
            &#160;
          </div>
          <div
            className="micb-edge micb-3"
            style={{
              backgroundColor: colors.mc1,
            }}
          >
            &#160;
          </div>
        </div>
      </div>
    );
  }
}
