import { Component, ReactChild } from "react";
import "./MinecraftButton.css";
import { Button, ButtonProps, ComponentEventHandler, ThemeInput } from "@fluentui/react-northstar";

interface IMinecraftButtonProps {
  theme: ThemeInput<any>;
  className?: string;
  onClick?: ComponentEventHandler<IMinecraftButtonProps>;
  children: ReactChild[] | ReactChild;
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

  _projectClick(event: React.SyntheticEvent<HTMLElement>, data?: ButtonProps) {
    if (this.props.onClick) {
      this.props.onClick(event, this.props);
    }

    this.setState({
      isPushed: false,
    });
  }

  _projectMouseDown(event: React.SyntheticEvent<HTMLElement>, data?: ButtonProps) {
    this.setState({
      isPushed: true,
    });
  }

  _projectMouseUp(event: React.SyntheticEvent<HTMLElement>, data?: ButtonProps) {
    this.setState({
      isPushed: false,
    });
  }

  render() {
    if (this.state && this.state.isPushed) {
      return (
        <div className={"micb-outer" + (this.props.className ? " " + this.props.className : "")}>
          <div
            className="micb-grid"
            style={{
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.mc0,
            }}
          >
            <div
              className="micb-edge micb-7"
              style={{
                backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.mc1,
              }}
            >
              &#160;
            </div>
            <div
              className="micb-edge micb-8"
              style={{
                backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.mc2,
              }}
            >
              &#160;
            </div>
            <div
              className="micb-edge micb-9"
              style={{
                backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.mc3,
              }}
            >
              &#160;
            </div>
            <div
              className="micb-edge micb-4"
              style={{
                backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.mc2,
              }}
            >
              &#160;
            </div>
            <div
              className="micb-5"
              style={{
                backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.mc4,
                color: this.props.theme.siteVariables?.colorScheme.brand.mcc1,
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
                backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.mc5,
              }}
            >
              &#160;
            </div>
            <div
              className="micb-edge micb-1"
              style={{
                backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.mc4,
              }}
            >
              &#160;
            </div>
            <div
              className="micb-edge micb-2"
              style={{
                backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.mc5,
              }}
            >
              &#160;
            </div>
            <div
              className="micb-edge micb-3"
              style={{
                backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.mc5,
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
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.mc0,
          }}
        >
          <div
            className="micb-edge micb-7"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.mc5,
            }}
          >
            &#160;
          </div>
          <div
            className="micb-edge micb-8"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.mc5,
            }}
          >
            &#160;
          </div>
          <div
            className="micb-edge micb-9"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.mc3,
            }}
          >
            &#160;
          </div>
          <div
            className="micb-edge micb-4"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.mc5,
            }}
          >
            &#160;
          </div>
          <div
            className="micb-5"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.mc4,
              color: this.props.theme.siteVariables?.colorScheme.brand.mcc1,
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
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.mc2,
            }}
          >
            &#160;
          </div>
          <div
            className="micb-edge micb-1"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.mc3,
            }}
          >
            &#160;
          </div>
          <div
            className="micb-edge micb-2"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.mc2,
            }}
          >
            &#160;
          </div>
          <div
            className="micb-edge micb-3"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.mc1,
            }}
          >
            &#160;
          </div>
        </div>
      </div>
    );
  }
}
