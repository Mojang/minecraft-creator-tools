import { Component } from "react";
import IAppProps from "../UX/IAppProps";
import "./MinecraftDisplay.css";
import Project from "../app/Project";
import { ThemeInput } from "@fluentui/react-northstar";

export enum MinecraftDisplayMode {
  activeMinecraft = 0,
  worldSettings = 1,
  info = 2,
  toolEditor = 3,
}

interface IMinecraftDisplayProps extends IAppProps {
  heightOffset: number;
  project?: Project;
  forceCompact?: boolean;
  isServerMode?: boolean;
  theme: ThemeInput<any>;
  widthOffset: number;
  ensureMinecraftOnLogin: boolean;
}

interface IMinecraftDisplayState {
}

export default class MinecraftDisplay extends Component<IMinecraftDisplayProps, IMinecraftDisplayState> {
  constructor(props: IMinecraftDisplayProps) {
    super(props);

    this.state = { };
  }


  render() {
       return <></>;
  }
}
