import { Component, ReactChild } from "react";
import "./MinecraftButton.css";
import { ThemeInput } from "@fluentui/react-northstar";

interface IMinecraftBoxProps {
  theme: ThemeInput<any>;
  className?: string;
  children: ReactChild[] | ReactChild;
}

interface IMinecraftBoxState {}

export default class MinecraftBox extends Component<IMinecraftBoxProps, IMinecraftBoxState> {
  render() {
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
            {this.props.children}
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
