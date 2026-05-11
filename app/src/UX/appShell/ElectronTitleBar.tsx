import { Component, MouseEvent, DragEvent } from "react";
import "./ElectronTitleBar.css";

import AppServiceProxy, { AppServiceProxyCommands } from "../../core/AppServiceProxy";
import { AppMode } from "./App";
import { WindowState } from "../../app/ICreatorToolsData";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSquareCaretLeft, faSquareCaretRight } from "@fortawesome/free-regular-svg-icons";
import { faTimes, faWindowMaximize, faWindowMinimize, faWindowRestore } from "@fortawesome/free-solid-svg-icons";

interface IElectronTitleBarProps {
  mode: AppMode;
}

interface IElectronTitleBarState {
  windowState: WindowState;
  lastMainWindowState: WindowState;
  platform: string; // 'darwin' for macOS, 'win32' for Windows, 'linux' for Linux
}

export default class ElectronTitleBar extends Component<IElectronTitleBarProps, IElectronTitleBarState> {
  _lastDragX = -1;
  _lastDragY = -1;
  _nextIsStartOfDrag = false;

  constructor(props: IElectronTitleBarProps) {
    super(props);

    this._handleMinimizeClick = this._handleMinimizeClick.bind(this);
    this._handleRestoreClick = this._handleRestoreClick.bind(this);
    this._handleMaximizeClick = this._handleMaximizeClick.bind(this);
    this._handleLeftSideClick = this._handleLeftSideClick.bind(this);
    this._handleRightSideClick = this._handleRightSideClick.bind(this);

    this._handleDragStart = this._handleDragStart.bind(this);
    this._handleDrag = this._handleDrag.bind(this);

    this.state = {
      windowState: WindowState.regular,
      lastMainWindowState: WindowState.regular,
      platform: "win32", // Default to Windows, will be updated on mount
    };
  }

  componentDidMount(): void {
    this.loadWindowState();
    this.loadPlatform();
  }

  async loadPlatform() {
    let result = undefined;

    try {
      result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.getPlatform, "", true);
    } catch (e) {
      return;
    }

    if (result === undefined) {
      return;
    }

    if (this.state === null || result !== this.state.platform) {
      this.setState({
        windowState: this.state.windowState,
        lastMainWindowState: this.state.lastMainWindowState,
        platform: result,
      });
    }
  }

  async loadWindowState() {
    let result = undefined;

    try {
      result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.getWindowState, "", true);
    } catch (e) {
      return;
    }

    if (result === undefined) {
      return;
    }

    const resultInt = parseInt(result);

    if (this.state === null || resultInt !== this.state.windowState) {
      let lastMain = WindowState.regular;

      if (resultInt === WindowState.maximized) {
        lastMain = WindowState.maximized;
      }

      this.setState({
        windowState: resultInt,
        lastMainWindowState: lastMain,
        platform: this.state.platform, // Preserve platform state
      });
    }
  }

  _handleLeftSideClick(e: MouseEvent<HTMLDivElement>) {
    this.leftSide();
    e.stopPropagation();

    this.setState({
      windowState: WindowState.docked,
      lastMainWindowState: this.state.lastMainWindowState,
      platform: this.state.platform,
    });
  }

  _handleRightSideClick(e: MouseEvent<HTMLDivElement>) {
    this.rightSide();
    e.stopPropagation();

    this.setState({
      windowState: WindowState.docked,
      lastMainWindowState: this.state.lastMainWindowState,
      platform: this.state.platform,
    });
  }

  _handleMinimizeClick(e: MouseEvent<HTMLDivElement>) {
    this.minimize();
    e.stopPropagation();

    this.setState({
      windowState: WindowState.minimized,
      lastMainWindowState: WindowState.minimized,
      platform: this.state.platform,
    });
  }

  async minimize() {
    await AppServiceProxy.sendAsync(AppServiceProxyCommands.windowMinimize, "");
    this.loadWindowState();
  }

  _handleMaximizeClick(e: MouseEvent<HTMLDivElement>) {
    this.maximize();
    e.stopPropagation();

    this.setState({
      windowState: WindowState.maximized,
      lastMainWindowState: WindowState.maximized,
      platform: this.state.platform,
    });
  }

  async leftSide() {
    await AppServiceProxy.sendAsync(AppServiceProxyCommands.windowLeftSide, "");
    this.loadWindowState();
  }

  async rightSide() {
    await AppServiceProxy.sendAsync(AppServiceProxyCommands.windowRightSide, "");
    this.loadWindowState();
  }

  async maximize() {
    await AppServiceProxy.sendAsync(AppServiceProxyCommands.windowMaximize, "");
    this.loadWindowState();
  }

  _handleRestoreClick(e: MouseEvent<HTMLDivElement>) {
    this.restore();
    e.stopPropagation();

    this.setState({
      windowState: WindowState.regular,
      lastMainWindowState: WindowState.regular,
      platform: this.state.platform,
    });
  }

  async restore() {
    await AppServiceProxy.sendAsync(AppServiceProxyCommands.windowRestore, "");
    this.loadWindowState();
  }

  _handleCloseClick = () => {
    AppServiceProxy.sendAsync(AppServiceProxyCommands.windowClose, "");
  };

  _handleDragStart(e: DragEvent<HTMLDivElement>) {
    AppServiceProxy.sendAsync(AppServiceProxyCommands.windowUpdate, "");

    e.stopPropagation();
    e.preventDefault();
  }

  _handleDrag(e: DragEvent<HTMLDivElement>) {
    AppServiceProxy.sendAsync(AppServiceProxyCommands.windowUpdate, "");

    e.stopPropagation();
    e.preventDefault();
  }

  render() {
    if (this.props === undefined || this.state == null) {
      return;
    }

    const isMac = this.state.platform === "darwin";

    // macOS-style title bar: no window controls (macOS provides its own), title on right
    if (isMac) {
      return this.renderMacTitleBar();
    }

    // Windows/Linux style title bar with window controls
    return this.renderWindowsTitleBar();
  }

  renderMacTitleBar() {
    let titleClassName = "etb-title etb-title-mac etb-moveDraggable";

    let titleInteriorClassName = "etb-titleInner-mac ";

    if (this.props.mode !== AppMode.home) {
      if (CreatorToolsHost.theme === CreatorToolsThemeStyle.light) {
        titleInteriorClassName += "etb-logo-d";
      } else {
        titleInteriorClassName += "etb-logo-l";
      }
    }

    return (
      <div
        className="etb-outer etb-outer-mac"
        onDragStartCapture={this._handleDragStart}
        onDragCapture={this._handleDrag}
      >
        <div className="etb-grid-mac">
          {/* Empty space on left for macOS traffic lights */}
          <div className="etb-trafficLightSpacer">&#160;</div>
          {/* Title/logo on right side */}
          <div className={titleClassName}>
            <div className={titleInteriorClassName}>&#160;</div>
          </div>
        </div>
      </div>
    );
  }

  renderWindowsTitleBar() {
    let windowMode1 = <></>;
    let windowMode2 = <></>;
    let titleClassName = "etb-title";

    if (
      this.state.windowState === WindowState.maximized ||
      (this.state.windowState === WindowState.docked && this.state.lastMainWindowState === WindowState.maximized)
    ) {
      windowMode1 = (
        <div className="etb-mmrCell etb-windowMode1" onClick={this._handleMinimizeClick}>
          <FontAwesomeIcon icon={faWindowMinimize} />
        </div>
      );
      windowMode2 = (
        <div className="etb-mmrCell etb-windowMode2" onClick={this._handleRestoreClick}>
          <FontAwesomeIcon icon={faWindowRestore} />
        </div>
      );
    } else {
      windowMode1 = (
        <div className="etb-mmrCell etb-windowMode1" onClick={this._handleMinimizeClick}>
          <FontAwesomeIcon icon={faWindowMinimize} />
        </div>
      );
      windowMode2 = (
        <div className="etb-mmrCell etb-windowMode2" onClick={this._handleMaximizeClick}>
          <FontAwesomeIcon icon={faWindowMaximize} />
        </div>
      );
      titleClassName += " etb-moveDraggable";
    }

    let titleInteriorClassName = "";

    if (this.props.mode !== AppMode.home) {
      titleInteriorClassName = "etb-titleInner ";
      if (CreatorToolsHost.theme === CreatorToolsThemeStyle.light) {
        titleInteriorClassName += "etb-logo-d";
      } else {
        titleInteriorClassName += "etb-logo-l";
      }
    }

    return (
      <div className="etb-outer" onDragStartCapture={this._handleDragStart} onDragCapture={this._handleDrag}>
        <div className="etb-grid">
          <div className={titleClassName}>
            <div className={titleInteriorClassName}>&#160;</div>
          </div>
          <div className="etb-mmrCell etb-windowSide1" onClick={this._handleLeftSideClick}>
            <FontAwesomeIcon icon={faSquareCaretLeft} className="fa-lg" />
          </div>
          <div className="etb-mmrCell etb-windowSide2" onClick={this._handleRightSideClick}>
            <FontAwesomeIcon icon={faSquareCaretRight} className="fa-lg" />
          </div>
          {windowMode1}
          {windowMode2}
          <div className="etb-mmrCell etb-close" onClick={this._handleCloseClick}>
            <FontAwesomeIcon icon={faTimes} />
          </div>
        </div>
      </div>
    );
  }
}
