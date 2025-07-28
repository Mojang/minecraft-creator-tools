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
  itemSet: ProjectInfoSet;
  isBand: boolean;
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

    let message = this.props.itemSet.getEffectiveMessage(item);
    let location = "";
    let actions = <></>;

    if (item.data) {
      if (message && message.length > 0) {
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

    if (message && item.projectItem && item.projectItem.projectPath) {
      location = item.projectItem.projectPath;

      const hashIndex = location.indexOf("#");
      if (location.startsWith("/zip/") && hashIndex > 0) {
        location = location.substring(hashIndex + 1);
      }
    }

    let indicatorCellBg = "";

    if (item.itemType === InfoItemType.internalProcessingError) {
      indicatorCellBg = "piid-failIconCell";
      typeElt = (
        <span className="piid-icon piid-errorIcon" title="Internal Error">
          <FontAwesomeIcon icon={faCircleExclamation} className="fa-lg" />
        </span>
      );
    } else if (item.itemType === InfoItemType.error) {
      indicatorCellBg = "piid-errorIconCell";
      typeElt = (
        <span className="piid-icon piid-errorIcon" title="Error">
          <FontAwesomeIcon icon={faCircleExclamation} className="fa-lg" />
        </span>
      );
    } else if (item.itemType === InfoItemType.recommendation) {
      indicatorCellBg = "piid-infoIconCell";
      typeElt = (
        <span className="piid-icon piid-infoIcon" title="Recommendation">
          <FontAwesomeIcon icon={faCircleArrowUp} className="fa-lg" />
        </span>
      );
    } else if (item.itemType === InfoItemType.warning) {
      indicatorCellBg = "piid-errorIconCell";

      typeElt = (
        <span className="piid-icon piid-errorIcon" title="Warning">
          <FontAwesomeIcon icon={faCircleQuestion} className="fa-lg" />
        </span>
      );
    } else if (item.itemType === InfoItemType.info || item.itemType === InfoItemType.featureAggregate) {
      indicatorCellBg = "piid-infoIconCell";

      typeElt = (
        <span className="piid-icon piid-infoIcon" title="Information">
          <FontAwesomeIcon icon={faCircleInfo} className="fa-lg" />
        </span>
      );
    } else if (item.itemType === InfoItemType.testCompleteSuccess) {
      indicatorCellBg = "piid-successIconCell";

      typeElt = (
        <span className="piid-icon piid-successIcon" title="Test Success">
          <FontAwesomeIcon icon={faCircleCheck} className="fa-lg" />
        </span>
      );
    } else if (item.itemType === InfoItemType.testCompleteFail) {
      indicatorCellBg = "piid-failIconCell";

      typeElt = (
        <span className="piid-icon piid-failIcon" title="Test Failure">
          <FontAwesomeIcon icon={faCircleXmark} className="fa-lg" />
        </span>
      );
    }

    return (
      <tr
        className="piid-outer"
        style={{
          backgroundColor: this.props.isBand
            ? this.props.theme.siteVariables?.colorScheme.brand.background2
            : "transparent",
        }}
      >
        <td
          className={"piid-cell piid-indicator " + indicatorCellBg}
          style={{
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
          }}
        >
          {typeElt}
        </td>
        <td
          className="piid-cell"
          style={{
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
          }}
        >
          {this.props.item.generatorId}
        </td>

        <td
          className="piid-cell"
          style={{
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
          }}
        >
          {this.props.item.generatorIndex}
        </td>
        <td
          className="piid-cell"
          style={{
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
          }}
        >
          {actions}
        </td>
        <td
          className="piid-cell"
          style={{
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
          }}
        >
          {message}
        </td>
        <td
          className="piid-cell piid-link"
          style={{
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
          }}
          title={location}
          onClick={this._projectClick}
        >
          {location}
        </td>
      </tr>
    );
  }
}
