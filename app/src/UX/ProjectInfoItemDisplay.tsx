import { Component, SyntheticEvent } from "react";
import "./ProjectInfoItemDisplay.css";
import IAppProps from "./IAppProps";
import { InfoItemCommand } from "./ProjectInfoDisplay";
import ProjectInfoItem from "../info/ProjectInfoItem";
import { InfoItemType } from "../info/IInfoItemData";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircleQuestion,
  faCircleXmark,
  faCircleArrowUp,
  faCircleExclamation,
  faCircleInfo,
} from "@fortawesome/free-solid-svg-icons";
import { Button, MenuButton, ThemeInput } from "@fluentui/react-northstar";
import ProjectInfoSet from "../info/ProjectInfoSet";

export const PT_TILE_LARGE = 0;
export const PT_TILE_SMALL = 1;

interface IProjectInfoItemDisplayProps extends IAppProps {
  item: ProjectInfoItem;
  theme: ThemeInput<any>;
  onInfoItemCommand: (command: InfoItemCommand, item: ProjectInfoItem) => Promise<void>;
}

interface IProjectInfoItemDisplayState {}

export default class ProjectInfoItemDisplay extends Component<
  IProjectInfoItemDisplayProps,
  IProjectInfoItemDisplayState
> {
  constructor(props: IProjectInfoItemDisplayProps) {
    super(props);

    this._projectClick = this._projectClick.bind(this);
    this._contextMenuClick = this._contextMenuClick.bind(this);
  }

  _projectClick() {
    if (this.props.onInfoItemCommand !== undefined) {
      this.props.onInfoItemCommand(InfoItemCommand.itemSelect, this.props.item);
    }
  }

  async _contextMenuClick(e: SyntheticEvent<HTMLElement, Event>, data?: any | undefined) {
    if (data !== undefined && data.tag !== undefined) {
      await this.props.onInfoItemCommand(InfoItemCommand.runUpdater, data.tag);
      //      const projectItem = this.props.project.getItemByStoragePath(data.tag);
      //    if (projectItem !== null) {
      //  }
    }
  }

  render() {
    const item = this.props.item;

    let typeElt = <></>;

    let message = item.message;
    let location = "";
    let actions = <></>;

    if (item.data) {
      if (message.length > 0) {
        message += ": ";
      }

      message += item.data.toString();
    }

    const topicData = ProjectInfoSet.getTopicData(item.generatorId, item.generatorIndex);

    if (topicData && topicData.updaters && topicData.updaters.length > 0) {
      const itemMenu = [];

      for (const updater of topicData.updaters) {
        itemMenu.push({
          content: "Fix: " + updater.action,
          tag: updater,
        });
      }

      actions = (
        <MenuButton
          trigger={
            <span className="piid-contextMenuButton">
              <Button content="..." aria-label="Click button" />
            </span>
          }
          menu={itemMenu}
          onMenuItemClick={this._contextMenuClick}
        />
      );
    }

    if (message && item.projectItem && item.projectItem.storagePath) {
      location = item.projectItem.storagePath;

      const hashIndex = location.indexOf("#");
      if (location.startsWith("/zip/") && hashIndex > 0) {
        location = location.substring(hashIndex + 1);
      }
    }

    let indicatorCellBg = "";

    if (item.itemType === InfoItemType.error) {
      indicatorCellBg = "piid-errorIconCell";
      typeElt = (
        <span className="piid-icon piid-errorIcon">
          <FontAwesomeIcon icon={faCircleExclamation} className="fa-lg" />
        </span>
      );
    } else if (item.itemType === InfoItemType.recommendation) {
      indicatorCellBg = "piid-infoIconCell";
      typeElt = (
        <span className="piid-icon piid-infoIcon">
          <FontAwesomeIcon icon={faCircleArrowUp} className="fa-lg" />
        </span>
      );
    } else if (item.itemType === InfoItemType.warning) {
      indicatorCellBg = "piid-errorIconCell";

      typeElt = (
        <span className="piid-icon piid-errorIcon">
          <FontAwesomeIcon icon={faCircleQuestion} className="fa-lg" />
        </span>
      );
    } else if (item.itemType === InfoItemType.info) {
      indicatorCellBg = "piid-infoIconCell";

      typeElt = (
        <span className="piid-icon piid-infoIcon">
          <FontAwesomeIcon icon={faCircleInfo} className="fa-lg" />
        </span>
      );
    } else if (item.itemType === InfoItemType.testCompleteSuccess) {
      indicatorCellBg = "piid-successIconCell";

      typeElt = (
        <span className="piid-icon piid-successIcon">
          <FontAwesomeIcon icon={faCircleCheck} className="fa-lg" />
        </span>
      );
    } else if (item.itemType === InfoItemType.testCompleteFail) {
      indicatorCellBg = "piid-failIconCell";

      typeElt = (
        <span className="piid-icon piid-failIcon">
          <FontAwesomeIcon icon={faCircleXmark} className="fa-lg" />
        </span>
      );
    } else if (item.itemType === InfoItemType.internalProcessingError) {
      indicatorCellBg = "piid-errorIconCell";

      typeElt = (
        <span className="piid-icon piid-errorIcon">
          <FontAwesomeIcon icon={faCircleExclamation} className="fa-lg" />
        </span>
      );
    }

    return (
      <div className="piid-outer">
        <div
          className={"piid-cell piid-indicator " + indicatorCellBg}
          style={{
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          }}
        >
          {typeElt}
        </div>
        <div
          className="piid-cell"
          style={{
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          }}
        >
          {actions}
        </div>
        <div
          className="piid-cell"
          style={{
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          }}
        >
          {message}
        </div>
        <div
          className="piid-cell piid-link"
          style={{
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          }}
          title={location}
          onClick={this._projectClick}
        >
          {location}
        </div>
      </div>
    );
  }
}
