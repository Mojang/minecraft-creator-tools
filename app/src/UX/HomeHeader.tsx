import { Component } from "react";
import "./HomeHeader.css";
import { ThemeInput } from "@fluentui/react-northstar";
import IAppProps from "./IAppProps";
import { constants } from "../core/Constants";
import AppServiceProxy from "../core/AppServiceProxy";
import CartoApp, { CartoThemeStyle } from "../app/CartoApp";
import UrlUtilities from "../core/UrlUtilities";

interface IHomeHeaderProps extends IAppProps {
  theme: ThemeInput<any>;
}

interface IHomeHeaderState {}

export default class HomeHeader extends Component<IHomeHeaderProps, IHomeHeaderState> {
  constructor(props: IHomeHeaderProps) {
    super(props);

    this.state = {};
  }

  render() {
    const webOnlyLinks: any[] = [];

    if (!AppServiceProxy.hasAppService) {
      if (CartoApp.theme !== CartoThemeStyle.dark) {
        webOnlyLinks.push(<span key="darksp">&#160;&#160;/&#160;&#160;</span>);
        webOnlyLinks.push(
          <a key="darkLink" href={UrlUtilities.ensureProtocol(window.location.href, "theme", "dark")}>
            Dark Theme
          </a>
        );
      }
      if (CartoApp.theme !== CartoThemeStyle.light) {
        webOnlyLinks.push(<span key="lightsp">&#160;&#160;/&#160;&#160;</span>);
        webOnlyLinks.push(
          <a key="lightLink" href={UrlUtilities.ensureProtocol(window.location.href, "theme", "light")}>
            Light Theme
          </a>
        );
      }
    }

    return (
      <div className="hhdr">
        <div
          className="hhdr-area"
          style={{
            borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
          }}
        >
          <h1 className="hhdr-image-outer">
            <img src="images/mctoolsbanner.png" alt="Minecraft Creator Tools" className="hhdr-image"></img>
          </h1>
          <div className="hhdr-sublink">
            <a
              href={"https://learn.microsoft.com/minecraft/creator/documents/mctoolsoverview/"}
              className="hhdr-docsLink"
              target="_blank"
              rel="noreferrer noopener"
            >
              Docs
            </a>
            &#160;&#160;/&#160;&#160;
            <a href={constants.repositoryUrl} target="_blank" rel="noreferrer noopener">
              GitHub
            </a>
            {webOnlyLinks}
          </div>
        </div>
      </div>
    );
  }
}
