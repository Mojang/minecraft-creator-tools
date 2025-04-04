import { Component } from "react";
import "./HomeFooter.css";
import { ThemeInput } from "@fluentui/react-northstar";
import IAppProps from "./IAppProps";
import { constants } from "../core/Constants";
import Utilities from "../core/Utilities";
import AppServiceProxy from "../core/AppServiceProxy";

interface IHomeFooterProps extends IAppProps {
  theme: ThemeInput<any>;
  displayStorageHandling: boolean;
  onExportAllRequested?: () => void;
}

interface IHomeFooterState {}

export default class HomeFooter extends Component<IHomeFooterProps, IHomeFooterState> {
  constructor(props: IHomeFooterProps) {
    super(props);

    this._handleExportAllKey = this._handleExportAllKey.bind(this);
    this._handleExportAllClick = this._handleExportAllClick.bind(this);

    this.state = {};
  }

  private _doManageConsent() {
    if ((window as any).manageConsent) {
      (window as any).manageConsent();
    }
  }

  async _handleExportAllKey(event: React.KeyboardEvent) {
    if (event.key === "Enter" && this.props.onExportAllRequested) {
      this.props.onExportAllRequested();
    }
  }

  async _handleExportAllClick() {
    if (this.props.onExportAllRequested) {
      this.props.onExportAllRequested();
    }
  }

  render() {
    let storageAction = <></>;
    let storageMessage = undefined;
    let topFirstLinkCss = "hftr-docsLinkNoPad";

    if (this.props.displayStorageHandling) {
      if (AppServiceProxy.hasAppService) {
        storageMessage = "projects are saved in the mctools subfolder of your Documents library.";
      } else {
        storageMessage = "take care: projects are saved locally in your browser's storage on your device.";
        storageAction = (
          <span>
            &#160;&#160;
            <span
              className="hftr-clickLink"
              tabIndex={0}
              role="button"
              onClick={this._handleExportAllClick}
              onKeyDown={this._handleExportAllKey}
            >
              Save backups
            </span>
            .
          </span>
        );
      }
      topFirstLinkCss = "hftr-docsLink";
    }

    let termsArea = (
      <span>
        <a
          href={constants.repositoryUrl + "/blob/main/LICENSE"}
          className="hftr-docsLink"
          target="_blank"
          rel="noreferrer noopener"
          style={{
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
          }}
        >
          License
        </a>
        .
      </span>
    );
    let privacyArea = <></>;
    let manageConsentArea = <></>;
    let trademarksArea = <></>;

    if ((window as any).creatorToolsSite?.termsOfUseUrl) {
      termsArea = (
        <span>
          <a
            href={(window as any).creatorToolsSite.termsOfUseUrl}
            className="hftr-docsLink"
            target="_blank"
            rel="noreferrer noopener"
            style={{
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
            }}
          >
            Terms of use
          </a>
          .
        </span>
      );
    }

    if ((window as any).creatorToolsSite?.privacyUrl) {
      privacyArea = (
        <span>
          <a
            href={(window as any).creatorToolsSite.privacyUrl}
            className="hftr-docsLink"
            target="_blank"
            rel="noreferrer noopener"
            style={{
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
            }}
          >
            Privacy and Cookies
          </a>
          .
        </span>
      );
    }

    if ((window as any).manageConsent && (window as any).siteConsent && (window as any).siteConsent.isConsentRequired) {
      manageConsentArea = (
        <span>
          <button
            id="hftr-manage-cookies"
            className="hftr-docsLink"
            onClick={this._doManageConsent}
            style={{
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
            }}
          >
            Manage Cookies
          </button>
          .
        </span>
      );
    }

    if ((window as any).creatorToolsSite?.trademarksUrl) {
      trademarksArea = (
        <span>
          <a
            href={(window as any).creatorToolsSite.trademarksUrl}
            className="hftr-docsLink"
            target="_blank"
            rel="noreferrer noopener"
            style={{
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
            }}
          >
            Trademarks
          </a>
          .
        </span>
      );
    }
    return (
      <div>
        <div
          aria-label="Usage section"
          className="hftr-usage"
          style={{
            borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
          }}
        >
          <div
            className="hftr-usage-interior"
            style={{
              borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            }}
          >
            {storageMessage}
            {storageAction}
            <a
              href={"https://learn.microsoft.com/minecraft/creator/documents/mctoolsoverview/"}
              className={topFirstLinkCss}
              target="_blank"
              rel="noreferrer noopener"
              style={{
                color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
              }}
            >
              Docs
            </a>{" "}
            and
            <a
              href={constants.repositoryUrl}
              className="hftr-docsLink"
              target="_blank"
              rel="noreferrer noopener"
              style={{
                color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
              }}
            >
              GitHub repo
            </a>
            .
            <a
              href={Utilities.ensureEndsWithSlash(constants.repositoryUrl + "/issues/new")}
              className="hftr-docsLink"
              target="_blank"
              rel="noreferrer noopener"
              style={{
                color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
              }}
            >
              Report an issue
            </a>
            .
          </div>
        </div>
        <div
          className="hftr-legal"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
          }}
        >
          version {constants.version} - early preview.
          {termsArea}
          {privacyArea}
          {manageConsentArea}
          {trademarksArea}
          <a
            href={constants.homeUrl + "/docs/notice.html"}
            className="hftr-docsLink"
            target="_blank"
            rel="noreferrer noopener"
            style={{
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
            }}
          >
            Attribution
          </a>
          .<span className="hftr-textArea">© 2025 Mojang AB.</span>
        </div>
      </div>
    );
  }
}
