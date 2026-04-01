import { Component, ReactChild } from "react";
import "../../inputs/minecraftButton/MinecraftButton.css";
import { getThemeColors } from "../../../../hooks/theme/useThemeColors";
import IProjectTheme from "../../../../types/IProjectTheme";

interface IMinecraftBoxProps {
  theme: IProjectTheme;
  className?: string;
  children: ReactChild[] | ReactChild;
}

interface IMinecraftBoxState {}

export default class MinecraftBox extends Component<IMinecraftBoxProps, IMinecraftBoxState> {
  render() {
    const colors = getThemeColors();

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
            {this.props.children}
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
