import { Component, SyntheticEvent, UIEvent } from "react";
import "./ProjectInfoDisplay.css";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import ProjectInfoSet from "../info/ProjectInfoSet";
import ProjectInfoItemDisplay from "./ProjectInfoItemDisplay";
import ProjectInfoItem from "../info/ProjectInfoItem";
import Utilities from "../core/Utilities";
import {
  Dropdown,
  DropdownProps,
  Input,
  InputProps,
  MenuItemProps,
  ThemeInput,
  Toolbar,
} from "@fluentui/react-northstar";
import {
  CustomLabel,
  DownArrowLabel,
  DownloadLabel,
  ErrorFilterLabel,
  FailureFilterLabel,
  InfoFilterLabel,
  InfoTabLabel,
  RecommendationsFilterLabel,
  SuccessFilterLabel,
  SummaryTabLabel,
  WarningFilterLabel,
} from "./Labels";

import { InfoItemType, NumberInfoItemTypes } from "../info/IInfoItemData";
import WebUtilities from "./WebUtilities";
import CreatorTools from "../app/CreatorTools";
import IStatus, { StatusTopic } from "../app/Status";
import IProjectInfoData, { ProjectInfoSuite } from "../info/IProjectInfoData";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileCsv, faFileInvoice } from "@fortawesome/free-solid-svg-icons";
import IFile from "../storage/IFile";
import StorageUtilities from "../storage/StorageUtilities";
import ContentIndex from "../core/ContentIndex";
import telemetry from "../analytics/Telemetry";
import { TelemetryEvents, TelemetryProperties } from "../analytics/TelemetryConstants";

interface IProjectInfoDisplayProps extends IAppProps {
  project?: Project;
  heightOffset: number;
  theme: ThemeInput<any>;
  file?: IFile;
  data?: IProjectInfoData;
  indevInfoSet?: ProjectInfoSet;
  indevInfoSetGenerated?: boolean;
  onNotifyInfoSetLoaded?: (infoSet: ProjectInfoSet) => void;
  onInfoItemCommand?: (command: InfoItemCommand, item: ProjectInfoItem) => Promise<void>;
}

interface IProjectInfoDisplayState {
  selectedInfoSet: ProjectInfoSet | undefined;
  viewMode: ProjectInfoDisplayMode;
  activeSuite: ProjectInfoSuite;
  menuState: ProjectInfoDisplayMenuState;
  lastExportKey?: string;
  lastExportFunction: ((e: SyntheticEvent | undefined, data: MenuItemProps | undefined) => Promise<void>) | undefined;
  lastExportData: MenuItemProps | undefined;
  displayErrors: boolean;
  displaySuccess: boolean;
  displayWarnings: boolean;
  displayRecommendation: boolean;
  displayFailure: boolean;
  displayInfo: boolean;
  isLoading: boolean;
  maxItems: number;
  searchTerm?: string;
  loadStatus?: string;
}

export enum ProjectInfoDisplayMode {
  info,
  summary,
}

export enum ProjectInfoDisplayMenuState {
  noMenu,
  exportMenu,
}

export const SuiteTitles = [
  "In-Development Validation",
  "Current Platform Versions",
  "Cooperative Add-On Best Practices",
  "Sharing Best Practices",
];

export enum InfoItemCommand {
  itemSelect,
  runUpdater,
}

export default class ProjectInfoDisplay extends Component<IProjectInfoDisplayProps, IProjectInfoDisplayState> {
  private _isMountedInternal: boolean = false;

  constructor(props: IProjectInfoDisplayProps) {
    super(props);

    this._generateInfoSet = this._generateInfoSet.bind(this);
    this._generateInfoSetInternal = this._generateInfoSetInternal.bind(this);
    this._toggleErrorFilter = this._toggleErrorFilter.bind(this);
    this._toggleWarningFilter = this._toggleWarningFilter.bind(this);
    this._toggleRecommendationFilter = this._toggleRecommendationFilter.bind(this);
    this._toggleInfoFilter = this._toggleInfoFilter.bind(this);
    this._toggleSuccessFilter = this._toggleSuccessFilter.bind(this);
    this._toggleFailureFilter = this._toggleFailureFilter.bind(this);
    this._setInfoMode = this._setInfoMode.bind(this);
    this._setSummaryMode = this._setSummaryMode.bind(this);
    this._handleInfoItemCommand = this._handleInfoItemCommand.bind(this);
    this._handleSuiteChange = this._handleSuiteChange.bind(this);
    this._handleStatusUpdates = this._handleStatusUpdates.bind(this);
    this._downloadHtmlReport = this._downloadHtmlReport.bind(this);
    this._downloadCsvReport = this._downloadCsvReport.bind(this);
    this._handleListScroll = this._handleListScroll.bind(this);
    this._handleExportMenuOpen = this._handleExportMenuOpen.bind(this);
    this._handleSearchTermChanged = this._handleSearchTermChanged.bind(this);

    let suite = this.props.creatorTools.preferredSuite;

    if (suite === undefined) {
      suite = ProjectInfoSuite.defaultInDevelopment;
    }

    this.state = {
      selectedInfoSet: undefined,
      activeSuite: suite,
      viewMode: ProjectInfoDisplayMode.info,
      menuState: ProjectInfoDisplayMenuState.noMenu,
      lastExportKey: undefined,
      lastExportFunction: undefined,
      lastExportData: undefined,
      displayErrors: true,
      displaySuccess: true,
      displayWarnings: true,
      displayRecommendation: true,
      displayFailure: true,
      maxItems: 5000,
      displayInfo: false,
      isLoading: true,
      loadStatus: undefined,
    };
  }

  private async _generateInfoSet() {
    await this._generateInfoSetInternal(false);
  }

  private async _handleStatusUpdates(creatorTools: CreatorTools, status: IStatus): Promise<void> {
    if (
      status.topic === StatusTopic.projectLoad ||
      status.topic === StatusTopic.validation ||
      status.topic === StatusTopic.processing
    ) {
      return new Promise((resolve: () => void, reject: () => void) => {
        if (this._isMountedInternal) {
          this.setState(
            {
              selectedInfoSet: this.state.selectedInfoSet,
              menuState: this.state.menuState,
              lastExportKey: this.state.lastExportKey,
              lastExportFunction: this.state.lastExportFunction,
              lastExportData: this.state.lastExportData,
              displayErrors: this.state.displayErrors,
              displaySuccess: this.state.displaySuccess,
              displayFailure: this.state.displayFailure,
              displayWarnings: this.state.displayWarnings,
              maxItems: this.state.maxItems,
              displayRecommendation: this.state.displayRecommendation,
              displayInfo: this.state.displayInfo,
              isLoading: this.state.isLoading,
              loadStatus: status.message,
            },
            () => {
              window.setTimeout(() => {
                resolve();
              }, 1);
            }
          );
        }
      });
    }
  }

  private async _generateInfoSetInternal(force: boolean) {
    this.props.creatorTools.subscribeStatusAddedAsync(this._handleStatusUpdates);

    let newInfoSet = undefined;

    if (this.props.data) {
      let contentIndex = undefined;

      if (this.props.data.index) {
        contentIndex = new ContentIndex();
        contentIndex.loadFromData(this.props.data.index);
      }

      newInfoSet = new ProjectInfoSet(
        this.props.project,
        undefined,
        undefined,
        this.props.data.info,
        this.props.data.items,
        contentIndex
      );
    } else if (this.props.file) {
      if (!this.props.file.isContentLoaded) {
        await this.props.file.loadContent(false);
      }

      const jsonO = StorageUtilities.getJsonObject(this.props.file) as IProjectInfoData | undefined;

      if (jsonO) {
        let contentIndex = undefined;

        if (jsonO.index) {
          contentIndex = new ContentIndex();
          contentIndex.loadFromData(jsonO.index);
        }
        newInfoSet = new ProjectInfoSet(
          this.props.project,
          undefined,
          undefined,
          jsonO.info,
          jsonO.items,
          contentIndex
        );
      }
    } else if (this.props.project && this.state.activeSuite === ProjectInfoSuite.defaultInDevelopment) {
      newInfoSet = this.props.project.indevInfoSet;
    } else if (this.props.project) {
      newInfoSet = new ProjectInfoSet(this.props.project, this.state.activeSuite);

      await this.props.project.indevInfoSet.generateForProject(force);
    }

    if (newInfoSet === undefined) {
      return;
    }

    if (!this.props.file && !this.props.data) {
      await newInfoSet.generateForProject(force);

      if (this.state.activeSuite === ProjectInfoSuite.defaultInDevelopment && this.props.onNotifyInfoSetLoaded) {
        this.props.onNotifyInfoSetLoaded(newInfoSet);
      }
    }

    if (
      this._isMountedInternal &&
      (this.state.activeSuite !== newInfoSet.suite || this.state.selectedInfoSet !== newInfoSet)
    ) {
      this.setState({
        activeSuite: newInfoSet.suite,
        selectedInfoSet: newInfoSet,
        menuState: this.state.menuState,
        lastExportKey: this.state.lastExportKey,
        lastExportFunction: this.state.lastExportFunction,
        lastExportData: this.state.lastExportData,
        displayErrors: this.state.displayErrors,
        displaySuccess: this.state.displaySuccess,
        maxItems: this.state.maxItems,
        displayFailure: this.state.displayFailure,
        displayWarnings: this.state.displayWarnings,
        displayRecommendation: this.state.displayRecommendation,
        displayInfo: this.state.displayInfo,
        isLoading: false,
        loadStatus: undefined,
      });
    }

    this.props.creatorTools.unsubscribeStatusAddedAsync(this._handleStatusUpdates);
  }

  componentDidMount() {
    this._isMountedInternal = true;

    this._generateInfoSet();
  }

  componentWillUnmount(): void {
    this._isMountedInternal = false;
  }

  getDataSummary(data: string | number | boolean | undefined) {
    if (data !== undefined) {
      if (typeof data === "number") {
        return Utilities.addCommasToNumber(data);
      } else if (typeof data === "boolean") {
        return data.toString();
      } else if (typeof data === "object") {
        let str = Utilities.consistentStringifyTrimmed(data);
        if (Array.isArray(data)) {
          if (str === "[]") {
            return "(empty)";
          }

          str = str.substring(1, str.length - 1);

          str = str.replace(/","/g, '", "');
        }

        return str;
      }

      return data;
    }

    return "(not defined)";
  }

  private _toggleErrorFilter() {
    telemetry.trackEvent({
      name: TelemetryEvents.SHOW_FILTER_CLICKED,
      properties: {
        [TelemetryProperties.FILTER_TYPE]: "error",
        [TelemetryProperties.NEW_VALUE]: !this.state.displayErrors,
      },
    });

    this.setState({
      selectedInfoSet: this.state.selectedInfoSet,
      menuState: this.state.menuState,
      lastExportKey: this.state.lastExportKey,
      lastExportFunction: this.state.lastExportFunction,
      lastExportData: this.state.lastExportData,
      viewMode: this.state.viewMode,
      displayErrors: !this.state.displayErrors,
      displaySuccess: this.state.displaySuccess,
      maxItems: this.state.maxItems,
      displayWarnings: this.state.displayWarnings,
      displayRecommendation: this.state.displayRecommendation,
      displayFailure: this.state.displayFailure,
      displayInfo: this.state.displayInfo,
      isLoading: false,
    });
  }

  private _toggleInfoFilter() {
    telemetry.trackEvent({
      name: TelemetryEvents.SHOW_FILTER_CLICKED,
      properties: {
        [TelemetryProperties.FILTER_TYPE]: "info",
        [TelemetryProperties.NEW_VALUE]: !this.state.displayInfo,
      },
    });

    this.setState({
      selectedInfoSet: this.state.selectedInfoSet,
      menuState: this.state.menuState,
      lastExportKey: this.state.lastExportKey,
      lastExportFunction: this.state.lastExportFunction,
      lastExportData: this.state.lastExportData,
      viewMode: this.state.viewMode,
      maxItems: this.state.maxItems,
      displayErrors: this.state.displayErrors,
      displaySuccess: this.state.displaySuccess,
      displayWarnings: this.state.displayWarnings,
      displayRecommendation: this.state.displayRecommendation,
      displayFailure: this.state.displayFailure,
      displayInfo: !this.state.displayInfo,
      isLoading: false,
    });
  }

  private _toggleSuccessFilter() {
    telemetry.trackEvent({
      name: TelemetryEvents.SHOW_FILTER_CLICKED,
      properties: {
        [TelemetryProperties.FILTER_TYPE]: "success",
        [TelemetryProperties.NEW_VALUE]: !this.state.displaySuccess,
      },
    });

    this.setState({
      selectedInfoSet: this.state.selectedInfoSet,
      menuState: this.state.menuState,
      lastExportKey: this.state.lastExportKey,
      lastExportFunction: this.state.lastExportFunction,
      lastExportData: this.state.lastExportData,
      viewMode: this.state.viewMode,
      displayErrors: this.state.displayErrors,
      displaySuccess: !this.state.displaySuccess,
      displayWarnings: this.state.displayWarnings,
      maxItems: this.state.maxItems,
      displayRecommendation: this.state.displayRecommendation,
      displayFailure: this.state.displayFailure,
      displayInfo: this.state.displayInfo,
      isLoading: false,
    });
  }

  private _toggleFailureFilter() {
    telemetry.trackEvent({
      name: TelemetryEvents.SHOW_FILTER_CLICKED,
      properties: {
        [TelemetryProperties.FILTER_TYPE]: "failure",
        [TelemetryProperties.NEW_VALUE]: !this.state.displayFailure,
      },
    });

    this.setState({
      selectedInfoSet: this.state.selectedInfoSet,
      menuState: this.state.menuState,
      lastExportKey: this.state.lastExportKey,
      lastExportFunction: this.state.lastExportFunction,
      lastExportData: this.state.lastExportData,
      viewMode: this.state.viewMode,
      activeSuite: this.state.activeSuite,
      maxItems: this.state.maxItems,
      displayErrors: this.state.displayErrors,
      displaySuccess: this.state.displaySuccess,
      displayWarnings: this.state.displayWarnings,
      displayRecommendation: this.state.displayRecommendation,
      displayFailure: !this.state.displayFailure,
      displayInfo: this.state.displayInfo,
      isLoading: false,
    });
  }

  private _toggleWarningFilter() {
    telemetry.trackEvent({
      name: TelemetryEvents.SHOW_FILTER_CLICKED,
      properties: {
        [TelemetryProperties.FILTER_TYPE]: "warning",
        [TelemetryProperties.NEW_VALUE]: !this.state.displayWarnings,
      },
    });

    this.setState({
      selectedInfoSet: this.state.selectedInfoSet,
      menuState: this.state.menuState,
      lastExportKey: this.state.lastExportKey,
      lastExportFunction: this.state.lastExportFunction,
      lastExportData: this.state.lastExportData,
      viewMode: this.state.viewMode,
      activeSuite: this.state.activeSuite,
      displayErrors: this.state.displayErrors,
      displaySuccess: this.state.displaySuccess,
      displayWarnings: !this.state.displayWarnings,
      displayRecommendation: this.state.displayRecommendation,
      maxItems: this.state.maxItems,
      displayFailure: this.state.displayFailure,
      displayInfo: this.state.displayInfo,
      isLoading: false,
    });
  }

  private _toggleRecommendationFilter() {
    telemetry.trackEvent({
      name: TelemetryEvents.SHOW_FILTER_CLICKED,
      properties: {
        [TelemetryProperties.FILTER_TYPE]: "recommendation",
        [TelemetryProperties.NEW_VALUE]: !this.state.displayRecommendation,
      },
    });

    this.setState({
      selectedInfoSet: this.state.selectedInfoSet,
      menuState: this.state.menuState,
      lastExportKey: this.state.lastExportKey,
      lastExportFunction: this.state.lastExportFunction,
      lastExportData: this.state.lastExportData,
      viewMode: this.state.viewMode,
      activeSuite: this.state.activeSuite,
      maxItems: this.state.maxItems,
      displayErrors: this.state.displayErrors,
      displaySuccess: this.state.displaySuccess,
      displayWarnings: this.state.displayWarnings,
      displayRecommendation: !this.state.displayRecommendation,
      displayFailure: this.state.displayFailure,
      displayInfo: this.state.displayInfo,
      isLoading: false,
    });
  }

  private _setInfoMode() {
    this.setState({
      selectedInfoSet: this.state.selectedInfoSet,
      viewMode: ProjectInfoDisplayMode.info,
      menuState: this.state.menuState,
      lastExportKey: this.state.lastExportKey,
      lastExportFunction: this.state.lastExportFunction,
      lastExportData: this.state.lastExportData,
      activeSuite: this.state.activeSuite,
      displayErrors: this.state.displayErrors,
      displaySuccess: this.state.displaySuccess,
      maxItems: this.state.maxItems,
      displayWarnings: this.state.displayWarnings,
      displayRecommendation: this.state.displayRecommendation,
      displayFailure: this.state.displayFailure,
      displayInfo: this.state.displayInfo,
      isLoading: this.state.isLoading,
    });
  }

  _handleSuiteChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    let targetedSuite = ProjectInfoSuite.defaultInDevelopment;

    if (data.value === SuiteTitles[1]) {
      targetedSuite = ProjectInfoSuite.currentPlatformVersions;
    } else if (data.value === SuiteTitles[2]) {
      targetedSuite = ProjectInfoSuite.cooperativeAddOn;
    } else if (data.value === SuiteTitles[3]) {
      targetedSuite = ProjectInfoSuite.sharing;
    } else if (data.value === SuiteTitles[4]) {
      targetedSuite = ProjectInfoSuite.sharingStrict;
    }

    if (targetedSuite !== this.props.creatorTools.preferredSuite) {
      this.props.creatorTools.preferredSuite = targetedSuite;
      this.props.creatorTools.save();
    }

    this.setState({
      selectedInfoSet: this.state.selectedInfoSet,
      viewMode: this.state.viewMode,
      menuState: this.state.menuState,
      lastExportKey: this.state.lastExportKey,
      lastExportFunction: this.state.lastExportFunction,
      lastExportData: this.state.lastExportData,
      activeSuite: targetedSuite,
      displayErrors: this.state.displayErrors,
      displaySuccess: this.state.displaySuccess,
      maxItems: this.state.maxItems,
      displayWarnings: this.state.displayWarnings,
      displayRecommendation: this.state.displayRecommendation,
      displayFailure: this.state.displayFailure,
      displayInfo: this.state.displayInfo,
      isLoading: true,
    });

    window.setTimeout(this._generateInfoSet, 1);
  }

  _handleListScroll(event: UIEvent<HTMLDivElement>) {
    if (event.currentTarget && this.state && this.state.selectedInfoSet && this.state.selectedInfoSet.items) {
      if (
        event.currentTarget.scrollTop >
          event.currentTarget.scrollHeight -
            (event.currentTarget.offsetHeight + event.currentTarget.scrollHeight / 20) &&
        this.state.maxItems < this.state.selectedInfoSet.items.length &&
        this.state.maxItems < 25000
      ) {
        this.setState({
          selectedInfoSet: this.state.selectedInfoSet,
          viewMode: this.state.viewMode,
          menuState: this.state.menuState,
          lastExportKey: this.state.lastExportKey,
          lastExportFunction: this.state.lastExportFunction,
          lastExportData: this.state.lastExportData,
          activeSuite: this.state.activeSuite,
          displayErrors: this.state.displayErrors,
          displaySuccess: this.state.displaySuccess,
          maxItems: this.state.maxItems + 5000,
          displayWarnings: this.state.displayWarnings,
          displayRecommendation: this.state.displayRecommendation,
          displayFailure: this.state.displayFailure,
          displayInfo: this.state.displayInfo,
          isLoading: this.state.isLoading,
        });
      }
    }
  }

  private _setSummaryMode() {
    this.setState({
      selectedInfoSet: this.state.selectedInfoSet,
      viewMode: ProjectInfoDisplayMode.summary,
      menuState: this.state.menuState,
      lastExportKey: this.state.lastExportKey,
      lastExportFunction: this.state.lastExportFunction,
      lastExportData: this.state.lastExportData,
      activeSuite: this.state.activeSuite,
      displayErrors: this.state.displayErrors,
      displaySuccess: this.state.displaySuccess,
      displayWarnings: this.state.displayWarnings,
      displayRecommendation: this.state.displayRecommendation,
      displayFailure: this.state.displayFailure,
      displayInfo: this.state.displayInfo,
      isLoading: this.state.isLoading,
    });
  }

  private _handleExportMenuOpen() {
    let menuVal = ProjectInfoDisplayMenuState.noMenu;

    if (this.state.menuState === ProjectInfoDisplayMenuState.noMenu) {
      menuVal = ProjectInfoDisplayMenuState.exportMenu;
    }

    this.setState({
      selectedInfoSet: this.state.selectedInfoSet,
      viewMode: this.state.viewMode,
      menuState: menuVal,
      lastExportKey: this.state.lastExportKey,
      lastExportFunction: this.state.lastExportFunction,
      lastExportData: this.state.lastExportData,
      activeSuite: this.state.activeSuite,
      displayErrors: this.state.displayErrors,
      displaySuccess: this.state.displaySuccess,
      displayWarnings: this.state.displayWarnings,
      displayRecommendation: this.state.displayRecommendation,
      displayFailure: this.state.displayFailure,
      displayInfo: this.state.displayInfo,
      isLoading: this.state.isLoading,
    });
  }

  private _setNewExportKey(
    exportKey: string,
    exportFunction: ((e: SyntheticEvent | undefined, data: MenuItemProps | undefined) => Promise<void>) | undefined,
    exportData: MenuItemProps | undefined
  ) {
    window.setTimeout(() => {
      this.setState({
        selectedInfoSet: this.state.selectedInfoSet,
        viewMode: this.state.viewMode,
        menuState: this.state.menuState,
        lastExportKey: exportKey,
        lastExportFunction: exportFunction,
        lastExportData: exportData,
        activeSuite: this.state.activeSuite,
        displayErrors: this.state.displayErrors,
        displaySuccess: this.state.displaySuccess,
        displayWarnings: this.state.displayWarnings,
        displayRecommendation: this.state.displayRecommendation,
        displayFailure: this.state.displayFailure,
        displayInfo: this.state.displayInfo,
        isLoading: this.state.isLoading,
      });
    }, 2);
  }

  private async _downloadHtmlReport(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    if (this.props.project === null || this.state.selectedInfoSet === undefined) {
      return;
    }

    const date = new Date();
    const projName = this.props.project ? this.props.project.simplifiedName : "report";

    const reportHtml = this.state.selectedInfoSet.getReportHtml(projName, projName, date.getTime().toString());

    saveAs(new Blob([reportHtml]), projName + " " + SuiteTitles[this.state.activeSuite] + ".html");

    if (data && data.icon && (data.icon as any).key) {
      this._setNewExportKey((data.icon as any).key, this._downloadHtmlReport, data);
    }
  }

  private async _downloadCsvReport(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    if (this.props.project === null || this.state.selectedInfoSet === undefined) {
      return;
    }

    const pisLines = this.state.selectedInfoSet.getItemCsvLines();

    const projName = this.props.project ? this.props.project.name : "report";
    const csvContent = ProjectInfoSet.CommonCsvHeader + "\n" + pisLines.join("\n");

    saveAs(new Blob([csvContent]), projName + " " + SuiteTitles[this.state.activeSuite] + ".csv");

    if (data && data.icon && (data.icon as any).key) {
      this._setNewExportKey((data.icon as any).key, this._downloadCsvReport, data);
    }
  }

  private async _handleInfoItemCommand(command: InfoItemCommand, item: ProjectInfoItem) {
    if (this.props.onInfoItemCommand) {
      await this.props.onInfoItemCommand(command, item);
    }
    //    await this._generateInfoSetInternal(true);
  }

  matchesSearch(key: string) {
    if (!this.state.searchTerm || this.state.searchTerm.length < 3) {
      return true;
    }

    const searchTerms = this.state.searchTerm.toLowerCase().split(" ");

    for (const term of searchTerms) {
      if (key.toLowerCase().indexOf(term) < 0) {
        return false;
      }
    }

    return true;
  }

  _handleSearchTermChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.creatorTools === null || this.state == null) {
      return;
    }

    this.setState({
      searchTerm: data.value,
      activeSuite: this.state.activeSuite,
      selectedInfoSet: this.state.selectedInfoSet,
      menuState: this.state.menuState,
      lastExportKey: this.state.lastExportKey,
      lastExportFunction: this.state.lastExportFunction,
      lastExportData: this.state.lastExportData,
      displayErrors: this.state.displayErrors,
      displaySuccess: this.state.displaySuccess,
      maxItems: this.state.maxItems,
      displayFailure: this.state.displayFailure,
      displayWarnings: this.state.displayWarnings,
      displayRecommendation: this.state.displayRecommendation,
      displayInfo: this.state.displayInfo,
      isLoading: this.state.isLoading,
      loadStatus: this.state.loadStatus,
    });
  }

  render() {
    let contentAreaHeightSmall = "calc(100vh - " + (this.props.heightOffset + 120) + "px)";
    let contentAreaHeightLarge = "calc(100vh - " + (this.props.heightOffset + 89) + "px)";
    const width = WebUtilities.getWidth();

    const height = WebUtilities.getHeight();

    const lines = [];
    const contentSummaryLines = [];
    const actionToolbarItems: any[] = [];

    let exportKeys: { [exportOptionKey: string]: any } = {};
    const exportMenu: any = [];

    let nextExportKey = "htmlReport";

    exportKeys[nextExportKey] = {
      key: nextExportKey,
      icon: <FontAwesomeIcon icon={faFileInvoice} key={nextExportKey} className="fa-lg" />,
      content: "HTML Report",
      onClick: this._downloadHtmlReport,
      title: "Get an HTML full report of this content.",
    };

    exportMenu.push(exportKeys[nextExportKey]);

    nextExportKey = "csvFile";

    exportKeys[nextExportKey] = {
      key: nextExportKey,
      icon: <FontAwesomeIcon icon={faFileCsv} key={nextExportKey} className="fa-lg" />,
      content: "CSV File",
      onClick: this._downloadCsvReport,
      title: "Get an CSV file of errors and items.",
    };

    exportMenu.push(exportKeys[nextExportKey]);

    if (!this.state.lastExportKey) {
      actionToolbarItems.push({
        icon: <DownloadLabel isCompact={width < 1116} />,
        key: "downloadReportA",
        onMenuOpenChange: this._handleExportMenuOpen,
        menuOpen: this.state.menuState === ProjectInfoDisplayMenuState.exportMenu,
        menu: exportMenu,
        active: true,
        title: "Deploy",
      });
    } else {
      const exportItem = exportKeys[this.state.lastExportKey];

      actionToolbarItems.push({
        icon: <CustomLabel icon={exportItem.icon} text={exportItem.content} isCompact={false} />,
        key: exportItem.key + "I",
        onClick: exportItem.onClick,
        active: true,
        title: exportItem.title,
      });

      actionToolbarItems.push({
        icon: <DownArrowLabel />,
        key: "deploy",
        onMenuOpenChange: this._handleExportMenuOpen,
        menuOpen: this.state.menuState === ProjectInfoDisplayMenuState.exportMenu,
        menu: exportMenu,
        active: true,
        title: "Export Options",
      });
    }

    const countsByType: number[] = [];

    for (let i = 0; i < NumberInfoItemTypes; i++) {
      countsByType[i] = 0;
    }

    if (this.state && this.state.selectedInfoSet) {
      for (const item of this.state.selectedInfoSet.items) {
        countsByType[item.itemType]++;
      }
    }

    const toolbarItems = [
      {
        icon: (
          <ErrorFilterLabel
            theme={this.props.theme}
            isSelected={this.state.displayErrors}
            role="tab"
            aria-selected={this.state.viewMode === ProjectInfoDisplayMode.summary}
            value={countsByType[InfoItemType.error] + countsByType[InfoItemType.internalProcessingError]}
            isCompact={width < 1116}
          />
        ),
        key: "errorFilter",
        kind: "toggle",
        onClick: this._toggleErrorFilter,
        title: "Toggle whether error items show",
      },
      {
        icon: (
          <WarningFilterLabel
            theme={this.props.theme}
            isSelected={this.state.displayWarnings}
            value={countsByType[InfoItemType.warning]}
            isCompact={width < 1116}
          />
        ),
        key: "warningFilter",
        kind: "toggle",
        onClick: this._toggleWarningFilter,
        title: "Toggle whether warning items show",
      },
      {
        icon: (
          <RecommendationsFilterLabel
            theme={this.props.theme}
            value={countsByType[InfoItemType.recommendation]}
            isSelected={this.state.displayRecommendation}
            isCompact={width < 1116}
          />
        ),
        key: "recoFilter",
        kind: "toggle",
        onClick: this._toggleRecommendationFilter,
        title: "Toggle whether error items show",
      },
      {
        icon: <InfoFilterLabel theme={this.props.theme} isSelected={this.state.displayInfo} isCompact={width < 1116} />,
        key: "infoFilter",
        kind: "toggle",
        onClick: this._toggleInfoFilter,
        title: "Toggle whether information items show",
      },
      {
        icon: (
          <SuccessFilterLabel
            theme={this.props.theme}
            isSelected={this.state.displaySuccess}
            value={countsByType[InfoItemType.testCompleteSuccess]}
            isCompact={width < 1116}
          />
        ),
        key: "successFilter",
        kind: "toggle",
        onClick: this._toggleSuccessFilter,
        title: "Toggle whether success items show",
      },
      {
        icon: (
          <FailureFilterLabel
            theme={this.props.theme}
            isSelected={this.state.displayFailure}
            value={countsByType[InfoItemType.testCompleteFail]}
            isCompact={width < 1116}
          />
        ),
        key: "failureFilter",
        kind: "toggle",
        onClick: this._toggleFailureFilter,
        title: "Toggle whether success items show",
      },
    ];

    let title = undefined;

    if (this.props.file && this.state.selectedInfoSet) {
      const info = this.state.selectedInfoSet.info as any;
      title = info["cardTitle"] ? info["cardTitle"] : info.defaultResourcePackName;
    } else {
      title = this.props.project ? this.props.project.loc.getTokenValueOrDefault(this.props.project.title) : "Report";
    }

    let outer = <></>;
    let rowCount = 0;

    if (this.state.isLoading) {
      outer = (
        <div
          className="pid-areaOuter"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
          }}
        >
          <div
            className="pid-validating"
            style={{
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
            }}
          >
            Please wait... {this.state.loadStatus ? "(" + this.state.loadStatus + ")" : ""}
          </div>
        </div>
      );
    } else if (this.state.viewMode === ProjectInfoDisplayMode.summary) {
      let summaryKeyVals = undefined;

      if ((this.props.file || this.props.data) && this.state.selectedInfoSet) {
        summaryKeyVals = this.state.selectedInfoSet.info as { [index: string]: any };
      } else if (this.props.indevInfoSet && this.props.indevInfoSet.info.featureSets) {
        summaryKeyVals = this.props.indevInfoSet.info as { [index: string]: any };
      }

      if (summaryKeyVals) {
        const keys = Object.keys(summaryKeyVals);
        keys.sort();

        lines.push(<div className="pis-areaHeader">Key Items</div>);
        const rows = [];

        for (const key of keys) {
          if (key !== "featureSets" && key !== "summary" && key !== "features") {
            const val = summaryKeyVals[key];

            const cells = [];

            if (this.matchesSearch(key) || this.matchesSearch(this.getDataSummary(val + ""))) {
              if (key === "defaultIcon" && val && val.length > 100) {
                cells.push(
                  <td className="pis-itemHeader" key={key + "headerA"}>
                    {Utilities.humanifyJsName(key)}
                  </td>
                );
                cells.push(
                  <td className="pis-itemData pis-image" key={key + "dataC"}>
                    <div
                      style={{
                        width: 256,
                        height: 256,
                        backgroundImage: "url('data:image/png;base64, " + val + "')",
                      }}
                    >
                      &#160;
                    </div>
                  </td>
                );
              } else if (val !== undefined) {
                cells.push(
                  <td className="pis-itemHeader" key={key + "headerA"}>
                    <div>{Utilities.humanifyJsName(key)}</div>
                  </td>
                );

                cells.push(
                  <td className="pis-itemDataCell" key={key + "dataA"}>
                    <div className="pis-itemData">{this.getDataSummary(val)}</div>
                  </td>
                );
              }

              if (cells.length > 0) {
                rows.push(<tr key={"mainRow" + rowCount}>{cells}</tr>);
                rowCount++;
              }
            }
          }
        }

        lines.push(
          <table className="pis-detailTable">
            <thead>
              <tr>
                <td className="pis-itemDataHeader">Item</td>
                <td className="pis-itemValueHeader">Value</td>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        );

        let infoSet = this.props.indevInfoSet;

        if (infoSet === undefined) {
          infoSet = this.state.selectedInfoSet;
        }

        if (infoSet) {
          let rowCount = 2;

          if (infoSet.info.featureSets) {
            const featNames = Object.keys(infoSet.info.featureSets);
            featNames.sort();

            const rows = [];
            for (const featName of featNames) {
              const featureSet = infoSet.info.featureSets[featName];

              if (this.matchesSearch(featName) && featureSet) {
                if (
                  featureSet["total"] !== undefined &&
                  featureSet["average"] !== undefined &&
                  featureSet["instanceCount"] !== undefined &&
                  featureSet["max"] !== undefined &&
                  featureSet["min"] !== undefined
                ) {
                  let featNameAdj = featName;

                  contentSummaryLines.push(
                    <div
                      className="pis-itemSummName"
                      key={featName + "NameheaderB"}
                      style={{
                        gridRow: rowCount,
                      }}
                    >
                      {Utilities.humanifyJsName(featNameAdj)}
                    </div>
                  );
                  contentSummaryLines.push(
                    <div
                      className="pis-itemSummCt"
                      key={featName + "CtDataB"}
                      style={{
                        gridRow: rowCount,
                      }}
                    >
                      {this.getDataSummary(featureSet["instanceCount"])}
                    </div>
                  );
                  contentSummaryLines.push(
                    <div
                      className="pis-itemDataSummTotal"
                      key={featName + "TotalDataB"}
                      style={{
                        gridRow: rowCount,
                      }}
                    >
                      {this.getDataSummary(featureSet["total"])}
                    </div>
                  );
                  contentSummaryLines.push(
                    <div
                      className="pis-itemSummMax"
                      key={featName + "MaxDataB"}
                      style={{
                        gridRow: rowCount,
                      }}
                    >
                      {this.getDataSummary(featureSet["max"])}
                    </div>
                  );
                  contentSummaryLines.push(
                    <div
                      className="pis-itemSummAvg"
                      key={featName + "AvgDataB"}
                      style={{
                        gridRow: rowCount,
                      }}
                    >
                      {this.getDataSummary(featureSet["average"])}
                    </div>
                  );

                  contentSummaryLines.push(
                    <div
                      className="pis-itemSummMin"
                      key={featName + "MinDataB"}
                      style={{
                        gridRow: rowCount,
                      }}
                    >
                      {this.getDataSummary(featureSet["min"])}
                    </div>
                  );
                  rowCount++;
                } else {
                  for (const measureName in featureSet) {
                    const measureVal = featureSet[measureName];

                    if (typeof measureVal === "number") {
                      const cells = [];
                      cells.push(
                        <td className="pis-itemHeader" key={featName + measureName + "headerB"}>
                          <div>{Utilities.humanifyJsName(featName + " " + measureName)}</div>
                        </td>
                      );
                      cells.push(
                        <td className="pis-itemDataCell" key={featName + measureName + "dataB"}>
                          <div className="pis-itemData">{this.getDataSummary(measureVal)}</div>
                        </td>
                      );
                      if (cells.length > 0) {
                        rows.push(<tr key={"detailRow" + rowCount}>{cells}</tr>);
                        rowCount++;
                      }
                    }
                  }
                }
              }
            }
            lines.push(<div className="pis-areaHeader">Details</div>);

            lines.push(
              <table className="pis-detailTable">
                <tbody>{rows}</tbody>
              </table>
            );
          }
        }
      }

      outer = (
        <div className="pid-areaOuter">
          <div
            className="pid-summaryArea"
            style={{
              maxHeight: contentAreaHeightLarge,
            }}
          >
            <div className="pid-header">Summary</div>
            <div className="pis-searchArea">
              <Input
                aria-labelledby="dssp-pathlabel"
                value={this.state.searchTerm}
                onChange={this._handleSearchTermChanged}
                placeholder="<filter summary properties>"
              />
            </div>
            <div className="pid-summary">
              <div className="pis-summaryArea">{lines}</div>
              <div className="pis-contentSummaryHeader">Content Summary</div>
              <div className="pis-contentSummaryArea">
                <div className="pis-itemSummName pis-itemHeadCell">Item</div>
                <div className="pis-itemSummCount pis-itemHeadCell">Count</div>
                <div className="pis-itemSummTotal pis-itemHeadCell"> (Lines/Size) Total</div>
                <div className="pis-itemSummMax pis-itemHeadCell">Max</div>
                <div className="pis-itemSummAvg pis-itemHeadCell">Average</div>
                <div className="pis-itemSummMin pis-itemHeadCell">Min</div>
                {contentSummaryLines}
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      let itemsShown = 0;
      const itemRows = [];
      if (this.state && this.state.selectedInfoSet && this.props.indevInfoSet) {
        const items = this.state.selectedInfoSet.items.slice();

        items.sort((a: ProjectInfoItem, b: ProjectInfoItem): number => {
          if (a.generatorId !== b.generatorId) {
            return a.generatorId.localeCompare(b.generatorId);
          }

          if (a.generatorIndex !== b.generatorIndex) {
            // sort summary results which should be consistently < 10 across tests (e.g., test success or fail)
            // to the bottom in their category
            if ((a.generatorIndex < 10 && b.generatorIndex > 10) || (b.generatorIndex < 10 && a.generatorIndex > 10)) {
              return b.generatorIndex - a.generatorIndex;
            }
            return a.generatorIndex - b.generatorIndex;
          }

          if (a.projectItem?.projectPath && b.projectItem?.projectPath) {
            return a.projectItem?.projectPath.localeCompare(b.projectItem?.projectPath);
          }

          if (a.message && b.message) {
            return a.message.localeCompare(b.message);
          }
          return 0;
        });

        for (let i = 0; i < items.length && itemsShown < this.state.maxItems; i++) {
          const item = items[i];

          if (
            (this.state.displayWarnings && item.itemType === InfoItemType.warning) ||
            (this.state.displayRecommendation && item.itemType === InfoItemType.recommendation) ||
            (this.state.displayErrors &&
              (item.itemType === InfoItemType.error || item.itemType === InfoItemType.internalProcessingError)) ||
            (this.state.displaySuccess && item.itemType === InfoItemType.testCompleteSuccess) ||
            (this.state.displayFailure && item.itemType === InfoItemType.testCompleteFail) ||
            (this.state.displayInfo && item.itemType === InfoItemType.info)
          ) {
            itemRows.push(
              <ProjectInfoItemDisplay
                itemSet={this.state.selectedInfoSet}
                item={item}
                isBand={itemsShown % 2 === 1}
                theme={this.props.theme}
                key={"pid" + i}
                creatorTools={this.props.creatorTools}
                onInfoItemCommand={this._handleInfoItemCommand}
              />
            );
            itemsShown++;
          }
        }
      }
      outer = (
        <div className="pid-areaOuter">
          <div className="pid-filterToolbar">
            <Toolbar aria-label="Filter actions" items={toolbarItems} />
          </div>
          <div
            className="pid-tableWrapper"
            style={{
              maxHeight: height > 300 ? contentAreaHeightSmall : "inherit",
              overflowY: height > 300 ? "auto" : "inherit",
            }}
            tabIndex={height > 300 ? 0 : -1}
            onScroll={this._handleListScroll}
          >
            <table
              className="pid-area"
              style={{
                backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
                color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
              }}
              cellPadding={0}
              cellSpacing={0}
            >
              <thead>
                <tr
                  className="pid-headerRow"
                  style={{
                    backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
                    color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
                  }}
                >
                  <th className="pid-headerCell pid-headerTypeCell">Type</th>
                  <th className="pid-headerCell">Area</th>
                  <th className="pid-headerCell">Test</th>
                  <th className="pid-headerCell">Actions</th>
                  <th className="pid-headerCell">Message</th>
                  <th className="pid-headerCell">File</th>
                </tr>
              </thead>
              <tbody>{itemRows}</tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
        }}
      >
        <div
          className="pid-outer"
          style={{
            maxHeight: height < 300 ? "calc(100vh - " + (this.props.heightOffset - 3) + "px)" : "inherit",
            overflowY: height < 300 ? "auto" : "inherit",
          }}
          tabIndex={height < 300 ? 0 : -1}
        >
          <h2
            className="pid-title"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
            }}
          >
            Project Inspector for {title}
          </h2>
          <div className="pid-toolArea">
            <div className="pid-topToolbar" role="tablist">
              <button onClick={this._setSummaryMode} title={"Summary Tab"} role="tab" className="pid-hiddenButton">
                <SummaryTabLabel
                  theme={this.props.theme}
                  aria-selected={this.state.viewMode === ProjectInfoDisplayMode.summary}
                  isSelected={this.state.viewMode === ProjectInfoDisplayMode.summary}
                  isCompact={width < 1100}
                />
              </button>
              <button onClick={this._setInfoMode} title={"Info Tab"} role="tab" className="pid-hiddenButton">
                <InfoTabLabel
                  theme={this.props.theme}
                  aria-selected={this.state.viewMode === ProjectInfoDisplayMode.info}
                  isSelected={this.state.viewMode === ProjectInfoDisplayMode.info}
                  isCompact={width < 1100}
                />
              </button>
            </div>
            <div className="pid-suiteTitle" id="pid-suiteTitle">
              Suite:
            </div>
            <div className="pid-suiteDropdown">
              <Dropdown
                items={SuiteTitles}
                aria-labelledby="pid-suiteTitle"
                defaultValue={SuiteTitles[this.state.activeSuite]}
                key="testSuiteDropdown"
                onChange={this._handleSuiteChange}
              />
            </div>
            <div className="pid-actionToolbar">
              <Toolbar aria-label="Report actions" items={actionToolbarItems} />
            </div>
          </div>
          {outer}
        </div>
      </div>
    );
  }
}
