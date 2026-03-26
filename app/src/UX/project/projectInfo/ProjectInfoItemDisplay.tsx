import { Component, SyntheticEvent, KeyboardEvent } from "react";
import "./ProjectInfoItemDisplay.css";
import IAppProps from "../../appShell/IAppProps";
import { InfoItemCommand } from "./ProjectInfoDisplay";
import ProjectInfoItem from "../../../info/ProjectInfoItem";
import { InfoItemType } from "../../../info/IInfoItemData";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircleQuestion,
  faCircleXmark,
  faCircleArrowUp,
  faCircleExclamation,
  faCircleInfo,
  faWrench,
  faInfoCircle,
} from "@fortawesome/free-solid-svg-icons";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  Tooltip,
  IconButton,
} from "@mui/material";
import ProjectInfoSet from "../../../info/ProjectInfoSet";
import Utilities from "../../../core/Utilities";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";

export const PT_TILE_LARGE = 0;
export const PT_TILE_SMALL = 1;

interface IProjectInfoItemDisplayProps extends IAppProps {
  item: ProjectInfoItem;
  itemSet: ProjectInfoSet;
  isBand: boolean;
  theme: IProjectTheme;
  onInfoItemCommand: (command: InfoItemCommand, item: ProjectInfoItem) => Promise<void>;
}

interface IProjectInfoItemDisplayState {
  isInfoDialogOpen: boolean;
  menuAnchorEl: HTMLElement | null;
}

export default class ProjectInfoItemDisplay extends Component<
  IProjectInfoItemDisplayProps,
  IProjectInfoItemDisplayState
> {
  constructor(props: IProjectInfoItemDisplayProps) {
    super(props);

    this.state = {
      isInfoDialogOpen: false,
      menuAnchorEl: null,
    };

    this._projectClick = this._projectClick.bind(this);
    this._handleRowKeyDown = this._handleRowKeyDown.bind(this);
    this._contextMenuClick = this._contextMenuClick.bind(this);
    this._toggleInfoDialog = this._toggleInfoDialog.bind(this);
    this._handleMenuOpen = this._handleMenuOpen.bind(this);
    this._handleMenuClose = this._handleMenuClose.bind(this);
  }

  _projectClick() {
    if (this.props.onInfoItemCommand !== undefined) {
      this.props.onInfoItemCommand(InfoItemCommand.itemSelect, this.props.item);
    }
  }

  _toggleInfoDialog() {
    this.setState({ isInfoDialogOpen: !this.state.isInfoDialogOpen });
  }

  _handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this._projectClick();
    }
  }

  _handleMenuOpen(e: React.MouseEvent<HTMLElement>) {
    this.setState({ menuAnchorEl: e.currentTarget });
  }

  _handleMenuClose() {
    this.setState({ menuAnchorEl: null });
  }

  async _contextMenuClick(e: SyntheticEvent<HTMLElement, Event>, data?: any | undefined) {
    if (data !== undefined && data.tag !== undefined) {
      await this.props.onInfoItemCommand(InfoItemCommand.runUpdater, data.tag);
    }
  }

  /**
   * Gets the human-readable type label for the item type.
   */
  private getTypeLabel(itemType: InfoItemType): string {
    switch (itemType) {
      case InfoItemType.error:
        return "Error";
      case InfoItemType.warning:
        return "Warning";
      case InfoItemType.recommendation:
        return "Recommendation";
      case InfoItemType.info:
      case InfoItemType.featureAggregate:
        return "Info";
      case InfoItemType.testCompleteSuccess:
        return "Passed";
      case InfoItemType.testCompleteFail:
        return "Failed";
      case InfoItemType.internalProcessingError:
        return "Internal Error";
      default:
        return "";
    }
  }

  /**
   * Gets the appropriate CSS class for the item type badge.
   */
  private getTypeBadgeClass(itemType: InfoItemType): string {
    switch (itemType) {
      case InfoItemType.error:
      case InfoItemType.internalProcessingError:
        return "piid-badge piid-badge-error";
      case InfoItemType.warning:
        return "piid-badge piid-badge-warning";
      case InfoItemType.recommendation:
        return "piid-badge piid-badge-recommendation";
      case InfoItemType.info:
      case InfoItemType.featureAggregate:
        return "piid-badge piid-badge-info";
      case InfoItemType.testCompleteSuccess:
        return "piid-badge piid-badge-success";
      case InfoItemType.testCompleteFail:
        return "piid-badge piid-badge-fail";
      default:
        return "piid-badge";
    }
  }

  render() {
    const colors = getThemeColors();
    const item = this.props.item;
    const topicData = ProjectInfoSet.getTopicData(item.generatorId, item.generatorIndex);

    // Build the message content
    let message = this.props.itemSet.getEffectiveMessage(item);

    if (item.data) {
      if (message && message.length > 0) {
        message += ": ";
      }

      if (typeof item.data === "number") {
        message += Utilities.addCommasToNumber(item.data);
      } else {
        message += item.data.toString();
      }
    }

    // Get location for file link
    let location = "";
    if (item.projectItem && item.projectItem.projectPath) {
      location = item.projectItem.projectPath;

      const hashIndex = location.indexOf("#");
      if (location.startsWith("/zip/") && hashIndex > 0) {
        location = location.substring(hashIndex + 1);
      }
    }

    // Build the rule title - prefer topicData.title, fallback to generatorId
    const ruleTitle = topicData?.title || item.generatorId;
    // Build error code as generatorId + generatorIndex (e.g., "ENTITYTYPE130")
    const errorCode = `${item.generatorId}${item.generatorIndex}`;
    const canNavigate = location.length > 0;

    // Build actions menu if updaters are available
    let actionsElement = <></>;
    if (topicData && topicData.updaters && topicData.updaters.length > 0) {
      const itemMenu = topicData.updaters.map((updater) => ({
        content: updater.action,
        tag: updater,
      }));

      actionsElement = (
        <>
          <IconButton
            size="small"
            className="piid-fixButton"
            aria-label="Fix this issue"
            title="Fix this issue"
            onClick={(event) => {
              event.stopPropagation();
              this._handleMenuOpen(event);
            }}
          >
            <FontAwesomeIcon icon={faWrench} />
          </IconButton>
          <Menu
            anchorEl={this.state.menuAnchorEl}
            open={Boolean(this.state.menuAnchorEl)}
            onClose={this._handleMenuClose}
          >
            {itemMenu.map((menuItem, idx) => (
              <MenuItem
                key={idx}
                onClick={async (e) => {
                  this._handleMenuClose();
                  await this.props.onInfoItemCommand(InfoItemCommand.runUpdater, menuItem.tag as any);
                }}
              >
                {menuItem.content}
              </MenuItem>
            ))}
          </Menu>
        </>
      );
    }

    // Build the type icon
    let typeIcon = <></>;
    const typeLabel = this.getTypeLabel(item.itemType);
    let indicatorCellBg = "";

    if (item.itemType === InfoItemType.internalProcessingError || item.itemType === InfoItemType.error) {
      indicatorCellBg = "piid-indicator-error";
      typeIcon = <FontAwesomeIcon icon={faCircleExclamation} className="piid-typeIcon" aria-hidden="true" />;
    } else if (item.itemType === InfoItemType.recommendation) {
      indicatorCellBg = "piid-indicator-recommendation";
      typeIcon = <FontAwesomeIcon icon={faCircleArrowUp} className="piid-typeIcon" aria-hidden="true" />;
    } else if (item.itemType === InfoItemType.warning) {
      indicatorCellBg = "piid-indicator-warning";
      typeIcon = <FontAwesomeIcon icon={faCircleQuestion} className="piid-typeIcon" aria-hidden="true" />;
    } else if (item.itemType === InfoItemType.info || item.itemType === InfoItemType.featureAggregate) {
      indicatorCellBg = "piid-indicator-info";
      typeIcon = <FontAwesomeIcon icon={faCircleInfo} className="piid-typeIcon" aria-hidden="true" />;
    } else if (item.itemType === InfoItemType.testCompleteSuccess) {
      indicatorCellBg = "piid-indicator-success";
      typeIcon = <FontAwesomeIcon icon={faCircleCheck} className="piid-typeIcon" aria-hidden="true" />;
    } else if (item.itemType === InfoItemType.testCompleteFail) {
      indicatorCellBg = "piid-indicator-fail";
      typeIcon = <FontAwesomeIcon icon={faCircleXmark} className="piid-typeIcon" aria-hidden="true" />;
    }

    // Build tooltip content with description - error code at top
    const hasDescription = topicData?.description;
    const hasHowToUse = topicData?.howToUse;
    const tooltipContent = (
      <div className="piid-tooltip">
        <div className="piid-tooltip-title">{ruleTitle}</div>
        {hasDescription && <div className="piid-tooltip-description">{topicData.description}</div>}
        {hasHowToUse && (
          <div className="piid-tooltip-howToUse">
            <strong>How to fix:</strong> {topicData.howToUse}
          </div>
        )}
        {topicData?.technicalDescription && (
          <div className="piid-tooltip-technical">
            <em>Technical: {topicData.technicalDescription}</em>
          </div>
        )}
        <div className="piid-tooltip-errorCode">Rule code: {errorCode}</div>
      </div>
    );

    // Build accessible dialog content (same as tooltip but in dialog format)
    const dialogContent = (
      <div className="piid-dialog-content">
        <h3 className="piid-dialog-title">{ruleTitle}</h3>
        {hasDescription && <p className="piid-dialog-description">{topicData.description}</p>}
        {hasHowToUse && (
          <div className="piid-dialog-howToUse">
            <strong>How to fix:</strong> {topicData.howToUse}
          </div>
        )}
        {topicData?.technicalDescription && (
          <p className="piid-dialog-technical">
            <strong>Technical Details:</strong> {topicData.technicalDescription}
          </p>
        )}
        {message && (
          <p className="piid-dialog-message">
            <strong>Message:</strong> {message}
          </p>
        )}
        {location && (
          <p className="piid-dialog-location">
            <strong>File:</strong> <code>{location}</code>
          </p>
        )}
        <div className="piid-dialog-errorCode">Rule code: {errorCode}</div>
      </div>
    );

    // Rule info cell content - always wrap in Tooltip to show error code
    const ruleInfoContent = (
      <div className="piid-ruleContainer">
        <span className="piid-ruleTitle">{ruleTitle}</span>
      </div>
    );

    const ruleInfoCell = (
      <Tooltip title={tooltipContent} placement="bottom-start">
        {ruleInfoContent}
      </Tooltip>
    );

    // Accessible info button for keyboard/screen reader users
    const infoButton = (
      <>
        <IconButton
          size="small"
          className="piid-infoButton"
          aria-label={`View details for ${ruleTitle} (rule ${errorCode})`}
          title="View rule details"
          onClick={(event) => {
            event.stopPropagation();
            this._toggleInfoDialog();
          }}
        >
          <FontAwesomeIcon icon={faInfoCircle} aria-hidden="true" />
        </IconButton>
        <Dialog open={this.state.isInfoDialogOpen} onClose={this._toggleInfoDialog}>
          <DialogTitle>{`Rule Details: ${ruleTitle}`}</DialogTitle>
          <DialogContent>{dialogContent}</DialogContent>
          <DialogActions>
            <Button onClick={this._toggleInfoDialog}>Close</Button>
          </DialogActions>
        </Dialog>
      </>
    );

    return (
      <tr
        className={`piid-row${canNavigate ? " piid-rowClickable" : ""}`}
        style={{
          backgroundColor: this.props.isBand ? colors.background2 : "transparent",
        }}
        onClick={canNavigate ? this._projectClick : undefined}
        onKeyDown={canNavigate ? this._handleRowKeyDown : undefined}
        tabIndex={canNavigate ? 0 : -1}
        role={canNavigate ? "button" : undefined}
      >
        {/* Type indicator column */}
        <td className={"piid-cell piid-typeCell " + indicatorCellBg} aria-label={typeLabel}>
          <div className="piid-typeContainer">
            {typeIcon}
            <span className={this.getTypeBadgeClass(item.itemType)}>{typeLabel}</span>
          </div>
        </td>

        {/* Rule info column - title and area */}
        <td
          className="piid-cell piid-ruleCell"
          style={{
            color: colors.foreground2,
          }}
        >
          {ruleInfoCell}
        </td>

        {/* Message column */}
        <td
          className="piid-cell piid-messageCell"
          style={{
            color: colors.foreground2,
          }}
        >
          {message}
        </td>

        {/* File location column */}
        <td
          className="piid-cell piid-locationCell"
          style={{
            color: colors.foreground2,
          }}
          title={location}
          onClick={location ? this._projectClick : undefined}
        >
          {location && <span className="piid-locationLink">{location}</span>}
        </td>

        {/* Actions column - info button + fix button */}
        <td
          className="piid-cell piid-actionsCell"
          style={{
            color: colors.foreground2,
          }}
        >
          <div className="piid-actionsContainer">
            {infoButton}
            {actionsElement}
          </div>
        </td>
      </tr>
    );
  }
}
