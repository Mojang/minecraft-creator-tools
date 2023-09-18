import { Component, MouseEvent, DragEvent } from "react";
import "./ElectronTitleBar.css";

import {
  WindowMaximizeIcon,
  WindowMinimizeIcon,
  WindowRestoreIcon,
  CloseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from "@fluentui/react-icons-northstar";
import AppServiceProxy, { AppServiceProxyCommands } from "../core/AppServiceProxy";
import { AppMode } from "./App";
import { WindowState } from "../app/ICartoData";

interface IElectronTitleBarProps {
  mode: AppMode;
}

interface IElectronTitleBarState {
  windowState: WindowState;
  lastMainWindowState: WindowState;
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
    };

    this.loadWindowState();
  }

  async loadWindowState() {
    let result = undefined;

    try {
      result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.getWindowState, "");
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
      });
    }
  }

  _handleLeftSideClick(e: MouseEvent<HTMLDivElement>) {
    this.leftSide();
    e.stopPropagation();

    this.setState({
      windowState: WindowState.docked,
      lastMainWindowState: this.state.lastMainWindowState,
    });
  }

  _handleRightSideClick(e: MouseEvent<HTMLDivElement>) {
    this.rightSide();
    e.stopPropagation();

    this.setState({
      windowState: WindowState.docked,
      lastMainWindowState: this.state.lastMainWindowState,
    });
  }

  _handleMinimizeClick(e: MouseEvent<HTMLDivElement>) {
    this.minimize();
    e.stopPropagation();

    this.setState({
      windowState: WindowState.minimized,
      lastMainWindowState: WindowState.minimized,
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
    });
  }

  async restore() {
    await AppServiceProxy.sendAsync(AppServiceProxyCommands.windowRestore, "");
    this.loadWindowState();
  }

  _handleCloseClick() {
    AppServiceProxy.sendAsync(AppServiceProxyCommands.windowClose, "");
  }

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

    let windowMode1 = <></>;
    let windowMode2 = <></>;
    let titleClassName = "etb-title";

    if (
      this.state.windowState === WindowState.maximized ||
      (this.state.windowState === WindowState.docked && this.state.lastMainWindowState === WindowState.maximized)
    ) {
      windowMode1 = (
        <div className="etb-mmrCell etb-windowMode1" onClick={this._handleMinimizeClick}>
          <WindowMinimizeIcon />
        </div>
      );
      windowMode2 = (
        <div className="etb-mmrCell etb-windowMode2" onClick={this._handleRestoreClick}>
          <WindowRestoreIcon />
        </div>
      );
    } else {
      windowMode1 = (
        <div className="etb-mmrCell etb-windowMode1" onClick={this._handleMinimizeClick}>
          <WindowMinimizeIcon />
        </div>
      );
      windowMode2 = (
        <div className="etb-mmrCell etb-windowMode2" onClick={this._handleMaximizeClick}>
          <WindowMaximizeIcon />
        </div>
      );
      titleClassName += " etb-moveDraggable";
    }

    let titleInteriorClassName = "";

    if (
      this.props.mode === AppMode.serverManager ||
      this.props.mode === AppMode.serverManagerMinusTitlebar ||
      this.props.mode === AppMode.serverManagerPlusBack
    ) {
      titleInteriorClassName = "etb-titleInnerSm";
    } else if (this.props.mode !== AppMode.home) {
      titleInteriorClassName = "etb-titleInner";
    }

    return (
      <div className="etb-outer" onDragStartCapture={this._handleDragStart} onDragCapture={this._handleDrag}>
        <div className="etb-grid">
          <div className={titleClassName}>
            <div className={titleInteriorClassName}>&#160;</div>
          </div>
          <div className="etb-mmrCell etb-windowSide1" onClick={this._handleLeftSideClick}>
            <ArrowLeftIcon />
          </div>
          <div className="etb-mmrCell etb-windowSide2" onClick={this._handleRightSideClick}>
            <ArrowRightIcon />
          </div>
          {windowMode1}
          {windowMode2}
          <div className="etb-mmrCell etb-close">
            <CloseIcon onClick={this._handleCloseClick} />
          </div>
        </div>
      </div>
    );
  }
}
