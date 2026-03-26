import { Component, UIEvent } from "react";
import "./ProjectInfoDisplay.css";
import IAppProps from "../../appShell/IAppProps";
import Project from "../../../app/Project";
import ProjectInfoSet from "../../../info/ProjectInfoSet";
import ProjectInfoItemDisplay from "./ProjectInfoItemDisplay";
import ProjectInfoItem from "../../../info/ProjectInfoItem";
import Utilities from "../../../core/Utilities";
import {
  Button,
  FormControl,
  IconButton,
  Menu,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
} from "@mui/material";

// Local type to replace Northstar's McMenuItemData
interface McMenuItemData {
  icon?: { key?: string } | React.ReactNode;
  [key: string]: any;
}
import { CustomLabel, DownArrowLabel, DownloadLabel, InfoTabLabel, SummaryTabLabel } from "../../shared/components/feedback/labels/Labels";

import { InfoItemType, NumberInfoItemTypes } from "../../../info/IInfoItemData";
import WebUtilities from "../../utils/WebUtilities";
import CreatorTools from "../../../app/CreatorTools";
import IStatus, { StatusTopic } from "../../../app/Status";
import IProjectInfoData, { ProjectInfoSuite } from "../../../info/IProjectInfoData";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileCsv,
  faFileInvoice,
  faCube,
  faCubes,
  faCode,
  faImage,
  faFileCode,
  faLayerGroup,
} from "@fortawesome/free-solid-svg-icons";
import IFile from "../../../storage/IFile";
import StorageUtilities from "../../../storage/StorageUtilities";
import ContentIndex from "../../../core/ContentIndex";
import telemetry from "../../../analytics/Telemetry";
import { TelemetryEvents, TelemetryProperties } from "../../../analytics/TelemetryConstants";
import InfoGeneratorTopicUtilities from "../../../info/InfoGeneratorTopicUtilities";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import { ProjectItemType } from "../../../app/IProjectItemData";
import LocTokenBox from "../../shared/components/inputs/locTokenBox/LocTokenBox";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";
import McChip from "../../shared/components/inputs/mcChip/McChip";

interface IProjectInfoDisplayProps extends IAppProps {
  project?: Project;
  heightOffset: number;
  theme: IProjectTheme;
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
  exportMenuAnchorEl: HTMLElement | null;
  lastExportKey?: string;
  lastExportFunction: (() => Promise<void>) | undefined;
  lastExportData: undefined;
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
  expandedCategories: { [category: string]: boolean };
  showDetails: boolean;
}

/**
 * Category definitions for grouping feature sets in the summary view.
 * Maps category keys to display names and associated generator prefixes.
 * Matches the stats bar categories for consistency.
 * Order matters - more specific categories should be listed first to avoid false matches.
 */
const STAT_CATEGORIES: { [key: string]: { title: string; icon: string; prefixes: string[] } } = {
  textures: {
    title: "Textures & Media",
    icon: "🖼️",
    prefixes: [
      "textureimage",
      "texture",
      "sound",
      "audio",
      "animation",
      "model",
      "geometry",
      "particle",
      "material",
      "rendercontroller",
    ],
  },
  scripts: {
    title: "Scripts & Functions",
    icon: "📜",
    prefixes: [
      "apisused",
      "typescript",
      "javascript",
      "script",
      "api",
      "mcfunction",
      "executesubcommand",
      "command",
      "prettier",
    ],
  },
  entities: {
    title: "Mob Types",
    icon: "🐾",
    prefixes: ["entitytype", "entitymetadata", "entityidentifier", "spawnrule"],
  },
  blocks: {
    title: "Block Types",
    icon: "🧱",
    prefixes: ["blocktype", "blockcatalog", "blockculling"],
  },
  items: {
    title: "Item Types",
    icon: "⚔️",
    prefixes: ["itemtype"],
  },
  other: {
    title: "Other Statistics",
    icon: "📊",
    prefixes: [],
  },
};

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
  "Sharing Best Practices (Strict)",
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
    this._showAllFilters = this._showAllFilters.bind(this);
    this._setInfoMode = this._setInfoMode.bind(this);
    this._setSummaryMode = this._setSummaryMode.bind(this);
    this._handleTabKeyDown = this._handleTabKeyDown.bind(this);
    this._handleInfoItemCommand = this._handleInfoItemCommand.bind(this);
    this._handleSuiteChange = this._handleSuiteChange.bind(this);
    this._handleStatusUpdates = this._handleStatusUpdates.bind(this);
    this._downloadHtmlReport = this._downloadHtmlReport.bind(this);
    this._downloadCsvReport = this._downloadCsvReport.bind(this);
    this._handleListScroll = this._handleListScroll.bind(this);
    this._handleExportMenuOpen = this._handleExportMenuOpen.bind(this);
    this._handleExportMenuClose = this._handleExportMenuClose.bind(this);
    this._handleSearchTermChanged = this._handleSearchTermChanged.bind(this);
    this._toggleCategory = this._toggleCategory.bind(this);
    this._toggleDetails = this._toggleDetails.bind(this);

    let suite = this.props.creatorTools.preferredSuite;

    if (suite === undefined) {
      suite = ProjectInfoSuite.defaultInDevelopment;
    }

    this.state = {
      selectedInfoSet: undefined,
      activeSuite: suite,
      viewMode: ProjectInfoDisplayMode.info,
      menuState: ProjectInfoDisplayMenuState.noMenu,
      exportMenuAnchorEl: null,
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
      expandedCategories: { textures: true, scripts: true, entities: true, blocks: true, items: true, other: true },
      showDetails: false,
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
        } else {
          // Component unmounted, resolve immediately to avoid hanging
          resolve();
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
      // For the default in-development suite, use ensureInfoSetGenerated which:
      // 1. Returns immediately if already generated
      // 2. Waits for any in-progress worker operation (showing status updates)
      // 3. Falls back to main thread if workers not available
      newInfoSet = await this.props.project.ensureIndevInfoSetGenerated();
    } else if (this.props.project) {
      newInfoSet = new ProjectInfoSet(this.props.project, this.state.activeSuite);

      // Use ensureInfoSetGenerated for the default info set to leverage web worker optimization
      await this.props.project.ensureIndevInfoSetGenerated();
    }

    if (newInfoSet === undefined) {
      return;
    }

    if (!this.props.file && !this.props.data && !newInfoSet.completedGeneration) {
      await newInfoSet.generateForProject(force);

      if (this.state.activeSuite === ProjectInfoSuite.defaultInDevelopment && this.props.onNotifyInfoSetLoaded) {
        this.props.onNotifyInfoSetLoaded(newInfoSet);
      }
    } else if (
      this.state.activeSuite === ProjectInfoSuite.defaultInDevelopment &&
      this.props.onNotifyInfoSetLoaded &&
      newInfoSet.completedGeneration
    ) {
      // Notify that we have a loaded info set (even if it was already generated)
      this.props.onNotifyInfoSetLoaded(newInfoSet);
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

  /**
   * Formats a feature set name for display by looking up proper titles from form.json files.
   * Handles names in the fallback format like "ENTITYTYPE54.entityTypePropertyCount" by
   * parsing the generator ID and index, looking up the title from form.json, and combining
   * it with the humanified suffix.
   * @param featName The raw feature set name (e.g., "ENTITYTYPE54.entityTypePropertyCount")
   * @returns A properly formatted display name (e.g., "Entity Metadata: Entity Type Property Count")
   */
  formatFeatureSetName(featName: string): string {
    // Check if the name is in the fallback format: GENERATORID<number>.<suffix>
    // The fallback format is used when form.json wasn't loaded synchronously during aggregation
    const dotIndex = featName.indexOf(".");
    if (dotIndex > 0) {
      const prefix = featName.substring(0, dotIndex);
      const suffix = featName.substring(dotIndex + 1);

      // Try to extract generator ID and index from prefix like "ENTITYTYPE54"
      // Generator IDs are uppercase letters, followed by numbers
      const match = prefix.match(/^([A-Z]+)(\d+)$/);
      if (match) {
        const generatorId = match[1];
        const topicIndex = parseInt(match[2], 10);

        // Try to get the proper title from form.json
        const topicData = InfoGeneratorTopicUtilities.getTopicDataSync(generatorId, topicIndex);
        if (topicData && topicData.title) {
          // Combine the form.json title with the humanified suffix
          return topicData.title + ": " + Utilities.humanifyJsName(suffix);
        }
      }
    }

    // For names that have dots (e.g., "textureImages.vanillaGameTextureCoverage")
    // Split and humanify each part, then join with a cleaner separator
    if (featName.includes(".")) {
      const parts = featName.split(".");
      // Humanify and join with " - " for cleaner display
      return parts.map((p) => Utilities.humanifyJsName(p)).join(" - ");
    }

    // Fallback to simple humanification for normal names
    return Utilities.humanifyJsName(featName);
  }

  /**
   * Categorizes a feature set name into one of the predefined categories.
   * @param featName The feature set name to categorize
   * @returns The category key (e.g., "entities", "scripts", "other")
   */
  categorizeFeatureSet(featName: string): string {
    const lowerName = featName.toLowerCase().replace(/[^a-z]/g, "");

    for (const [categoryKey, categoryInfo] of Object.entries(STAT_CATEGORIES)) {
      if (categoryKey === "other") continue;
      for (const prefix of categoryInfo.prefixes) {
        if (lowerName.startsWith(prefix) || lowerName.includes(prefix)) {
          return categoryKey;
        }
      }
    }

    return "other";
  }

  /**
   * Combines related feature sets (like "Atmospherics.lines" and "Atmospherics.size")
   * into a single combined entry with all metrics.
   * @param featureSets The raw feature sets from the info set
   * @returns Combined feature sets keyed by base name (e.g., "Atmospherics")
   */
  combineRelatedFeatureSets(featureSets: {
    [key: string]: { [measureName: string]: number | undefined } | undefined;
  }): {
    [baseName: string]: {
      lines?: { [k: string]: number | undefined };
      size?: { [k: string]: number | undefined };
      other: { [metricType: string]: { [k: string]: number | undefined } };
    };
  } {
    const combined: {
      [baseName: string]: {
        lines?: { [k: string]: number | undefined };
        size?: { [k: string]: number | undefined };
        other: { [metricType: string]: { [k: string]: number | undefined } };
      };
    } = {};

    for (const [fullName, data] of Object.entries(featureSets)) {
      if (!data) continue;

      // Check for ".lines" or ".size" suffix
      let baseName = fullName;
      let metricType = "";

      if (fullName.endsWith(".lines")) {
        baseName = fullName.substring(0, fullName.length - 6);
        metricType = "lines";
      } else if (fullName.endsWith(".size")) {
        baseName = fullName.substring(0, fullName.length - 5);
        metricType = "size";
      }

      if (!combined[baseName]) {
        combined[baseName] = { other: {} };
      }

      if (metricType === "lines") {
        combined[baseName].lines = data;
      } else if (metricType === "size") {
        combined[baseName].size = data;
      } else {
        // No suffix - store with full name as the metric type
        combined[baseName].other[fullName] = data;
      }
    }

    return combined;
  }

  /**
   * Groups feature sets by category for organized display.
   * @param featureSets The feature sets to categorize
   * @returns An object mapping category keys to arrays of combined feature set entries
   */
  groupFeatureSetsByCategory(featureSets: {
    [key: string]: { [measureName: string]: number | undefined } | undefined;
  }): {
    [category: string]: Array<{
      baseName: string;
      lines?: { [k: string]: number | undefined };
      size?: { [k: string]: number | undefined };
      other: { [metricType: string]: { [k: string]: number | undefined } };
    }>;
  } {
    const combined = this.combineRelatedFeatureSets(featureSets);

    const grouped: {
      [category: string]: Array<{
        baseName: string;
        lines?: { [k: string]: number | undefined };
        size?: { [k: string]: number | undefined };
        other: { [metricType: string]: { [k: string]: number | undefined } };
      }>;
    } = {};

    // Initialize all categories
    for (const categoryKey of Object.keys(STAT_CATEGORIES)) {
      grouped[categoryKey] = [];
    }

    // Sort combined feature sets into categories
    for (const [baseName, combinedData] of Object.entries(combined)) {
      if (this.matchesSearch(baseName)) {
        const category = this.categorizeFeatureSet(baseName);
        grouped[category].push({ baseName, ...combinedData });
      }
    }

    // Sort each category by name
    for (const category of Object.keys(grouped)) {
      grouped[category].sort((a, b) => a.baseName.localeCompare(b.baseName));
    }

    return grouped;
  }

  private _toggleCategory(categoryKey: string) {
    this.setState((prevState) => ({
      ...prevState,
      expandedCategories: {
        ...prevState.expandedCategories,
        [categoryKey]: !prevState.expandedCategories[categoryKey],
      },
    }));
  }

  private _toggleDetails() {
    this.setState((prevState) => ({
      showDetails: !prevState.showDetails,
    }));
  }

  /**
   * Formats a count with proper singular/plural form.
   * @param count The count value
   * @param singular The singular form of the word (e.g., "item")
   * @param plural Optional plural form (defaults to singular + "s")
   */
  formatCount(count: number, singular: string, plural?: string): string {
    const formattedCount = Utilities.addCommasToNumber(count);
    const word = count === 1 ? singular : plural || singular + "s";
    return `${formattedCount} ${word}`;
  }

  /**
   * Formats bytes into a human-readable size string.
   * @param bytes The number of bytes
   * @returns Formatted string like "1.5 KB" or "2.3 MB"
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);
    // Show decimals only if not a whole number and size is >= 1 KB
    if (i === 0 || value === Math.floor(value)) {
      return Utilities.addCommasToNumber(Math.floor(value)) + " " + units[i];
    }
    return value.toFixed(1) + " " + units[i];
  }

  /**
   * Extracts the common prefix from a metric name for grouping.
   * E.g., "Texture Images - Block Atlas" -> "Texture Images"
   *       "APIs Used - Entity: Count" -> "APIs Used"
   *       "Entity Metadata - Property Count" -> "Entity Metadata"
   *       "Resource Animation Bone Position" -> "Resource Animation Bone"
   */
  extractMetricPrefix(name: string): { prefix: string; suffix: string } {
    // Try splitting on common separators first
    const separators = [" - ", " – "];
    for (const sep of separators) {
      const idx = name.indexOf(sep);
      if (idx > 0) {
        return {
          prefix: name.substring(0, idx).trim(),
          suffix: name.substring(idx + sep.length).trim(),
        };
      }
    }

    // Check for colon separator (but only if there's content after it)
    const colonIdx = name.indexOf(": ");
    if (colonIdx > 0 && colonIdx < name.length - 2) {
      return {
        prefix: name.substring(0, colonIdx).trim(),
        suffix: name.substring(colonIdx + 2).trim(),
      };
    }

    // No separator found, use the full name
    return { prefix: name, suffix: "" };
  }

  /**
   * Finds common word prefixes among a set of names.
   * E.g., ["Resource Animation Bone Position", "Resource Animation Bone Rotation"]
   *       -> common prefix is "Resource Animation Bone"
   */
  findCommonWordPrefix(names: string[]): string {
    if (names.length === 0) return "";
    if (names.length === 1) return "";

    // Split all names into words
    const wordArrays = names.map((n) => n.split(/\s+/));
    const minLength = Math.min(...wordArrays.map((w) => w.length));

    // Find how many words are common across all names
    let commonCount = 0;
    for (let i = 0; i < minLength - 1; i++) {
      // Leave at least one word for suffix
      const word = wordArrays[0][i];
      if (wordArrays.every((arr) => arr[i] === word)) {
        commonCount++;
      } else {
        break;
      }
    }

    // Need at least 2 common words to form a meaningful prefix
    if (commonCount >= 2) {
      return wordArrays[0].slice(0, commonCount).join(" ");
    }

    return "";
  }

  /**
   * Groups items within a category by their common prefix for cleaner display.
   * Uses two-pass approach: first by separator-based prefixes, then by common word prefixes.
   */
  groupItemsByPrefix(
    items: Array<{
      baseName: string;
      lines?: { [k: string]: number | undefined };
      size?: { [k: string]: number | undefined };
      other: { [metricType: string]: { [k: string]: number | undefined } };
    }>
  ): Map<
    string,
    Array<{
      baseName: string;
      displayName: string;
      lines?: { [k: string]: number | undefined };
      size?: { [k: string]: number | undefined };
      other: { [metricType: string]: { [k: string]: number | undefined } };
    }>
  > {
    // First pass: group by separator-based prefixes
    const initialGrouped = new Map<
      string,
      Array<{
        baseName: string;
        displayName: string;
        formattedName: string;
        lines?: { [k: string]: number | undefined };
        size?: { [k: string]: number | undefined };
        other: { [metricType: string]: { [k: string]: number | undefined } };
      }>
    >();

    for (const item of items) {
      const formattedName = this.formatFeatureSetName(item.baseName);
      const { prefix, suffix } = this.extractMetricPrefix(formattedName);

      if (!initialGrouped.has(prefix)) {
        initialGrouped.set(prefix, []);
      }
      initialGrouped.get(prefix)!.push({
        ...item,
        displayName: suffix || formattedName,
        formattedName,
      });
    }

    // Second pass: for groups with only one item where displayName equals formattedName,
    // try to find common word prefixes with other similar items
    const finalGrouped = new Map<
      string,
      Array<{
        baseName: string;
        displayName: string;
        lines?: { [k: string]: number | undefined };
        size?: { [k: string]: number | undefined };
        other: { [metricType: string]: { [k: string]: number | undefined } };
      }>
    >();

    // Collect all ungrouped items (single items that weren't split by separator)
    const ungroupedItems: Array<{
      baseName: string;
      displayName: string;
      formattedName: string;
      lines?: { [k: string]: number | undefined };
      size?: { [k: string]: number | undefined };
      other: { [metricType: string]: { [k: string]: number | undefined } };
    }> = [];

    for (const [prefix, groupItems] of initialGrouped) {
      if (groupItems.length === 1 && groupItems[0].displayName === groupItems[0].formattedName) {
        // This item wasn't split by a separator, might need word-based grouping
        ungroupedItems.push(groupItems[0]);
      } else {
        // Already properly grouped
        finalGrouped.set(
          prefix,
          groupItems.map((item) => ({
            baseName: item.baseName,
            displayName: item.displayName,
            lines: item.lines,
            size: item.size,
            other: item.other,
          }))
        );
      }
    }

    // Try to find common word prefixes among ungrouped items
    if (ungroupedItems.length > 1) {
      const wordPrefixGroups = new Map<string, typeof ungroupedItems>();

      // Sort by name to help with prefix detection
      ungroupedItems.sort((a, b) => a.formattedName.localeCompare(b.formattedName));

      // Try to group consecutive items with common word prefixes
      let i = 0;
      while (i < ungroupedItems.length) {
        const currentItem = ungroupedItems[i];
        const potentialGroup = [currentItem];

        // Look ahead for items that might share a common prefix
        let j = i + 1;
        while (j < ungroupedItems.length) {
          const nextItem = ungroupedItems[j];
          const commonPrefix = this.findCommonWordPrefix([currentItem.formattedName, nextItem.formattedName]);

          if (commonPrefix) {
            potentialGroup.push(nextItem);
            j++;
          } else {
            break;
          }
        }

        if (potentialGroup.length > 1) {
          // Found a group with common word prefix
          const commonPrefix = this.findCommonWordPrefix(potentialGroup.map((item) => item.formattedName));
          if (commonPrefix) {
            if (!wordPrefixGroups.has(commonPrefix)) {
              wordPrefixGroups.set(commonPrefix, []);
            }
            for (const item of potentialGroup) {
              // Remove the common prefix from the display name
              const suffix = item.formattedName.substring(commonPrefix.length).trim();
              wordPrefixGroups.get(commonPrefix)!.push({
                ...item,
                displayName: suffix || item.formattedName,
              });
            }
            i = j;
            continue;
          }
        }

        // No group found, add as single item
        if (!finalGrouped.has(currentItem.formattedName)) {
          finalGrouped.set(currentItem.formattedName, [
            {
              baseName: currentItem.baseName,
              displayName: currentItem.displayName,
              lines: currentItem.lines,
              size: currentItem.size,
              other: currentItem.other,
            },
          ]);
        }
        i++;
      }

      // Add word-prefix groups to final result
      for (const [prefix, groupItems] of wordPrefixGroups) {
        finalGrouped.set(
          prefix,
          groupItems.map((item) => ({
            baseName: item.baseName,
            displayName: item.displayName,
            lines: item.lines,
            size: item.size,
            other: item.other,
          }))
        );
      }
    } else {
      // Only one or zero ungrouped items, add them directly
      for (const item of ungroupedItems) {
        finalGrouped.set(item.formattedName, [
          {
            baseName: item.baseName,
            displayName: item.displayName,
            lines: item.lines,
            size: item.size,
            other: item.other,
          },
        ]);
      }
    }

    return finalGrouped;
  }

  /**
   * Renders the hero section with project icon, title, and description (similar to ProjectActions).
   */
  renderHeroSection(
    infoSet: ProjectInfoSet | undefined,
    projectTitle: string,
    projectCreator?: string,
    projectDescription?: string
  ): JSX.Element {
    const project = this.props.project;

    // Determine the icon to display
    let iconContent: JSX.Element;

    // Try to get icon from infoSet (for loaded reports)
    const iconBase64 = infoSet?.info?.defaultIcon;

    if (iconBase64 && iconBase64.length > 100) {
      iconContent = (
        <img alt="Project icon" src={`data:image/png;base64,${iconBase64}`} style={{ imageRendering: "pixelated" }} />
      );
    } else if (project?.previewImageBase64) {
      iconContent = (
        <img
          alt="Project preview"
          src={`data:image/png;base64,${project.previewImageBase64}`}
          style={{ imageRendering: "pixelated" }}
        />
      );
    } else {
      // Default fallback image
      const imgSrc =
        CreatorToolsHost.theme === CreatorToolsThemeStyle.dark
          ? `${CreatorToolsHost.contentWebRoot}res/images/templates/redflower_lightbg.png`
          : `${CreatorToolsHost.contentWebRoot}res/images/templates/redflower_darkbg.png`;
      iconContent = <img alt="Project preview" src={imgSrc} style={{ imageRendering: "pixelated" }} />;
    }

    // Get description from infoSet or project
    const rawDescription =
      projectDescription ||
      infoSet?.info?.defaultBehaviorPackDescription ||
      infoSet?.info?.defaultResourcePackDescription;
    const displayCreator = projectCreator || (project?.creator ? project.creator : undefined);

    // Helper to check if a value looks like a loc key
    const looksLikeLocKey = (value: string | undefined): boolean => {
      return !!value && value.includes(".") && !value.includes(" ") && value.length < 100;
    };

    // Render title - use LocTokenBox if it looks like a loc key and we have a project
    const renderTitle = () => {
      if (project && looksLikeLocKey(projectTitle)) {
        return <LocTokenBox project={project} value={projectTitle} creatorTools={this.props.creatorTools} />;
      }
      return <>{projectTitle}</>;
    };

    // Render description - use LocTokenBox if it looks like a loc key and we have a project
    const renderDescription = () => {
      if (!rawDescription) return null;
      if (project && looksLikeLocKey(rawDescription)) {
        return <LocTokenBox project={project} value={rawDescription} creatorTools={this.props.creatorTools} />;
      }
      return <>{rawDescription}</>;
    };

    return (
      <div className="pid-hero">
        <div className="pid-heroContent">
          <div className="pid-heroImage">{iconContent}</div>
          <div className="pid-heroText">
            <div className="pid-titleRow">
              <h1 className="pid-heroTitle">{renderTitle()}</h1>
            </div>
            {displayCreator && <div className="pid-heroCreator">by {displayCreator}</div>}
            {rawDescription && <p className="pid-heroDescription">{renderDescription()}</p>}
          </div>
        </div>
      </div>
    );
  }

  /**
   * Renders the stats bar showing content counts (similar to ProjectActions).
   */
  renderStatsBar(): JSX.Element | null {
    const project = this.props.project;
    if (!project) return null;

    const stats = [
      { icon: faCube, label: "Mob Types", count: project.getItemsByType(ProjectItemType.entityTypeBehavior).length },
      { icon: faCubes, label: "Block Types", count: project.getItemsByType(ProjectItemType.blockTypeBehavior).length },
      {
        icon: faLayerGroup,
        label: "Item Types",
        count: project.getItemsByType(ProjectItemType.itemTypeBehavior).length,
      },
      {
        icon: faCode,
        label: "Scripts",
        count: project.getItemsByType(ProjectItemType.ts).length + project.getItemsByType(ProjectItemType.js).length,
      },
      { icon: faImage, label: "Textures", count: project.getItemsByType(ProjectItemType.texture).length },
      { icon: faFileCode, label: "Functions", count: project.getItemsByType(ProjectItemType.MCFunction).length },
    ].filter((s) => s.count > 0);

    if (stats.length === 0) return null;

    return (
      <div className="pid-statsBar">
        {stats.map((stat, index) => (
          <div className="pid-stat" key={index}>
            <FontAwesomeIcon icon={stat.icon} className="pid-statIcon" />
            <span className="pid-statCount">{stat.count}</span>
            <span className="pid-statLabel">{stat.label}</span>
          </div>
        ))}
      </div>
    );
  }

  /**
   * Renders categorized statistics as collapsible cards with a grid layout.
   * Combines related metrics (like .lines and .size) into single entries.
   */
  renderCategorizedStats(featureSets: {
    [key: string]: { [measureName: string]: number | undefined } | undefined;
  }): JSX.Element {
    const grouped = this.groupFeatureSetsByCategory(featureSets);

    const categoryCards: JSX.Element[] = [];

    for (const [categoryKey, categoryInfo] of Object.entries(STAT_CATEGORIES)) {
      const items = grouped[categoryKey];
      if (!items || items.length === 0) continue;

      const isExpanded = this.state.expandedCategories[categoryKey] || false;

      categoryCards.push(
        <div className="pis-statCard" key={categoryKey}>
          <div
            className="pis-statCardHeader"
            onClick={() => this._toggleCategory(categoryKey)}
            style={{ cursor: "pointer" }}
          >
            <div className="pis-statCardTitle">
              <span>{categoryInfo.icon}</span>
              <span>{categoryInfo.title}</span>
              <span className="pis-sectionBadge">{items.length}</span>
            </div>
            <span className={`pis-sectionToggle ${isExpanded ? "pis-expanded" : ""}`} />
          </div>

          {isExpanded && <div className="pis-sectionContent">{this.renderGroupedItems(items)}</div>}
        </div>
      );
    }

    return <div className="pis-statsGrid">{categoryCards}</div>;
  }

  /**
   * Renders items grouped by their common prefix into sub-cards.
   */
  renderGroupedItems(
    items: Array<{
      baseName: string;
      lines?: { [k: string]: number | undefined };
      size?: { [k: string]: number | undefined };
      other: { [metricType: string]: { [k: string]: number | undefined } };
    }>
  ): JSX.Element[] {
    const groupedByPrefix = this.groupItemsByPrefix(items);
    const result: JSX.Element[] = [];

    // Sort prefixes alphabetically
    const sortedPrefixes = Array.from(groupedByPrefix.keys()).sort();

    for (const prefix of sortedPrefixes) {
      const groupItems = groupedByPrefix.get(prefix)!;

      // If only one item with this prefix, or prefix equals the full display name, render inline
      if (groupItems.length === 1 && (!groupItems[0].displayName || groupItems[0].displayName === prefix)) {
        result.push(this.renderSingleItem(groupItems[0], prefix, `single-${prefix}`));
      } else {
        // Multiple items with same prefix - create a sub-card
        result.push(
          <div className="pis-prefixGroup" key={`group-${prefix}`}>
            <div className="pis-prefixHeader">{prefix}</div>
            <div className="pis-prefixContent">
              {groupItems.map((item, idx) =>
                this.renderSingleItem(item, item.displayName || item.baseName, `${prefix}-${idx}`, prefix)
              )}
            </div>
          </div>
        );
      }
    }

    return result;
  }

  /**
   * Strips a prefix from a name if present.
   * Handles both " - " and ": " separators.
   */
  stripPrefix(name: string, prefix: string): string {
    if (!prefix) return name;

    // Check for " - " separator (e.g., "Texture Images - Vanilla Coverage")
    const dashPrefix = prefix + " - ";
    if (name.startsWith(dashPrefix)) {
      return name.substring(dashPrefix.length);
    }

    // Check for " – " separator (en-dash)
    const enDashPrefix = prefix + " – ";
    if (name.startsWith(enDashPrefix)) {
      return name.substring(enDashPrefix.length);
    }

    // Check for ": " separator (e.g., "Texture Images: Coverage")
    const colonPrefix = prefix + ": ";
    if (name.startsWith(colonPrefix)) {
      return name.substring(colonPrefix.length);
    }

    // Check for just the prefix followed by space (word prefix)
    const spacePrefix = prefix + " ";
    if (name.startsWith(spacePrefix)) {
      return name.substring(spacePrefix.length);
    }

    return name;
  }

  /**
   * Renders a single stat item (with lines/size card or simple metrics).
   * Groups "other" metrics by common prefix for cleaner display.
   * @param groupPrefix Optional prefix of the parent group - if provided, metric names will have this prefix stripped
   */
  renderSingleItem(
    item: {
      baseName: string;
      displayName?: string;
      lines?: { [k: string]: number | undefined };
      size?: { [k: string]: number | undefined };
      other: { [metricType: string]: { [k: string]: number | undefined } };
    },
    displayName: string,
    keyPrefix: string,
    groupPrefix?: string
  ): JSX.Element {
    const elements: JSX.Element[] = [];

    // Check if we have combined lines/size stats
    const hasLines = item.lines && item.lines["total"] !== undefined;
    const hasSize = item.size && item.size["total"] !== undefined;

    if (hasLines || hasSize) {
      const fileCount =
        hasLines && item.lines
          ? item.lines["instanceCount"] || 1
          : hasSize && item.size
            ? item.size["instanceCount"] || 1
            : 1;

      const lineTotal = hasLines && item.lines ? item.lines["total"] || 0 : 0;
      const sizeTotal = hasSize && item.size ? item.size["total"] || 0 : 0;

      elements.push(
        <div className="pis-statItemCard" key={`${keyPrefix}-combined`}>
          <div className="pis-statItemHeader">
            <span className="pis-statItemName">{displayName}</span>
            <span className="pis-statItemFileCount">{this.formatCount(fileCount, "file")}</span>
          </div>
          <div className="pis-statItemMetrics">
            {hasLines && (
              <div className="pis-statMetric">
                <span className="pis-metricValue">{Utilities.addCommasToNumber(lineTotal)}</span>
                <span className="pis-metricLabel">lines (across {this.formatCount(fileCount, "item")})</span>
              </div>
            )}
            {hasSize && (
              <div className="pis-statMetric">
                <span className="pis-metricValue">{this.formatBytes(sizeTotal)}</span>
                <span className="pis-metricLabel">bytes (across {this.formatCount(fileCount, "item")})</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Collect all "other" metrics with their display names and values
    const otherMetrics: Array<{ displayName: string; value: string; key: string }> = [];

    for (const [metricKey, metricData] of Object.entries(item.other)) {
      if (!metricData) continue;

      const hasDetailedStats = metricData["total"] !== undefined && metricData["instanceCount"] !== undefined;

      if (hasDetailedStats) {
        const total = metricData["total"] || 0;
        const instanceCount = metricData["instanceCount"] || 1;
        let metricDisplayName = this.formatFeatureSetName(metricKey);
        // Strip group prefix if provided
        if (groupPrefix) {
          metricDisplayName = this.stripPrefix(metricDisplayName, groupPrefix);
        }

        otherMetrics.push({
          displayName: metricDisplayName,
          value: `${this.getDataSummary(total)} (${this.formatCount(instanceCount, "file")})`,
          key: `${keyPrefix}-${metricKey}`,
        });
      } else {
        // Simple key-value stats
        const entries = Object.entries(metricData).filter(([, val]) => typeof val === "number");

        for (const [measureName, measureVal] of entries) {
          let metricDisplayName = `${this.formatFeatureSetName(metricKey)}: ${Utilities.humanifyJsName(measureName)}`;
          // Strip group prefix if provided
          if (groupPrefix) {
            metricDisplayName = this.stripPrefix(metricDisplayName, groupPrefix);
          }

          otherMetrics.push({
            displayName: metricDisplayName,
            value: String(this.getDataSummary(measureVal)),
            key: `${keyPrefix}-${metricKey}-${measureName}`,
          });
        }
      }
    }

    // Group other metrics by common prefix
    if (otherMetrics.length > 0) {
      const groupedMetrics = this.groupMetricsByPrefix(otherMetrics);
      elements.push(...this.renderGroupedMetrics(groupedMetrics, keyPrefix));
    }

    // Wrap in a fragment if multiple elements, otherwise return single element
    if (elements.length === 0) {
      return <div key={keyPrefix} />;
    }
    if (elements.length === 1) {
      return elements[0];
    }
    return <div key={keyPrefix}>{elements}</div>;
  }

  /**
   * Groups metrics by their common word prefix.
   */
  groupMetricsByPrefix(
    metrics: Array<{ displayName: string; value: string; key: string }>
  ): Map<string, Array<{ displayName: string; shortName: string; value: string; key: string }>> {
    const grouped = new Map<string, Array<{ displayName: string; shortName: string; value: string; key: string }>>();

    // Sort metrics alphabetically to help with prefix detection
    const sortedMetrics = [...metrics].sort((a, b) => a.displayName.localeCompare(b.displayName));

    // First, try to find groups of metrics with common word prefixes
    const processed = new Set<number>();

    for (let i = 0; i < sortedMetrics.length; i++) {
      if (processed.has(i)) continue;

      const currentMetric = sortedMetrics[i];
      const potentialGroup = [{ index: i, metric: currentMetric }];

      // Look for other metrics that share a common word prefix
      for (let j = i + 1; j < sortedMetrics.length; j++) {
        if (processed.has(j)) continue;

        const otherMetric = sortedMetrics[j];
        const commonPrefix = this.findCommonWordPrefix([currentMetric.displayName, otherMetric.displayName]);

        if (commonPrefix && commonPrefix.split(/\s+/).length >= 2) {
          potentialGroup.push({ index: j, metric: otherMetric });
        }
      }

      if (potentialGroup.length >= 2) {
        // Found a group with common prefix
        const allNames = potentialGroup.map((p) => p.metric.displayName);
        const commonPrefix = this.findCommonWordPrefix(allNames);

        if (commonPrefix) {
          if (!grouped.has(commonPrefix)) {
            grouped.set(commonPrefix, []);
          }

          for (const { index, metric } of potentialGroup) {
            processed.add(index);
            const shortName = metric.displayName.substring(commonPrefix.length).trim() || metric.displayName;
            grouped.get(commonPrefix)!.push({
              ...metric,
              shortName: shortName.startsWith(":") ? shortName.substring(1).trim() : shortName,
            });
          }
        }
      }
    }

    // Add remaining ungrouped metrics
    for (let i = 0; i < sortedMetrics.length; i++) {
      if (processed.has(i)) continue;

      const metric = sortedMetrics[i];
      // Use the full display name as the "prefix" for ungrouped items
      if (!grouped.has(metric.displayName)) {
        grouped.set(metric.displayName, []);
      }
      grouped.get(metric.displayName)!.push({
        ...metric,
        shortName: metric.displayName,
      });
    }

    return grouped;
  }

  /**
   * Renders grouped metrics as sub-cards or inline items.
   */
  renderGroupedMetrics(
    groupedMetrics: Map<string, Array<{ displayName: string; shortName: string; value: string; key: string }>>,
    keyPrefix: string
  ): JSX.Element[] {
    const result: JSX.Element[] = [];
    const sortedPrefixes = Array.from(groupedMetrics.keys()).sort();

    for (const prefix of sortedPrefixes) {
      const metrics = groupedMetrics.get(prefix)!;

      if (metrics.length === 1 && metrics[0].shortName === metrics[0].displayName) {
        // Single ungrouped metric - render inline
        const metric = metrics[0];
        result.push(
          <div className="pis-statItem" key={metric.key}>
            <span className="pis-statLabel">{metric.displayName}</span>
            <span className="pis-statValue">{metric.value}</span>
          </div>
        );
      } else if (metrics.length === 1) {
        // Single metric with a prefix - still render inline with short name
        const metric = metrics[0];
        result.push(
          <div className="pis-statItem" key={metric.key}>
            <span className="pis-statLabel">{metric.displayName}</span>
            <span className="pis-statValue">{metric.value}</span>
          </div>
        );
      } else {
        // Multiple metrics with same prefix - create a sub-card
        result.push(
          <div className="pis-prefixGroup" key={`${keyPrefix}-group-${prefix}`}>
            <div className="pis-prefixHeader">{prefix}</div>
            <div className="pis-prefixContent">
              {metrics.map((metric) => (
                <div className="pis-statItem" key={metric.key}>
                  <span className="pis-statLabel">{metric.shortName}</span>
                  <span className="pis-statValue">{metric.value}</span>
                </div>
              ))}
            </div>
          </div>
        );
      }
    }

    return result;
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

  private _showAllFilters() {
    this.setState({
      selectedInfoSet: this.state.selectedInfoSet,
      menuState: this.state.menuState,
      lastExportKey: this.state.lastExportKey,
      lastExportFunction: this.state.lastExportFunction,
      lastExportData: this.state.lastExportData,
      viewMode: this.state.viewMode,
      displayErrors: true,
      displaySuccess: true,
      maxItems: this.state.maxItems,
      displayWarnings: true,
      displayRecommendation: true,
      displayFailure: true,
      displayInfo: true,
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
    telemetry.trackEvent({
      name: TelemetryEvents.INSPECTOR_ITEMS_OPENED,
      properties: {
        [TelemetryProperties.PREVIOUS_VIEW]:
          this.state.viewMode === ProjectInfoDisplayMode.summary ? "summary" : "items",
      },
    });

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

  _handleSuiteChange(event: SelectChangeEvent<string>) {
    let targetedSuite = ProjectInfoSuite.defaultInDevelopment;
    const value = event.target.value;

    if (value === SuiteTitles[1]) {
      targetedSuite = ProjectInfoSuite.currentPlatformVersions;
    } else if (value === SuiteTitles[2]) {
      targetedSuite = ProjectInfoSuite.cooperativeAddOn;
    } else if (value === SuiteTitles[3]) {
      targetedSuite = ProjectInfoSuite.sharing;
    } else if (value === SuiteTitles[4]) {
      targetedSuite = ProjectInfoSuite.sharingStrict;
    }

    if (targetedSuite !== this.props.creatorTools.preferredSuite) {
      this.props.creatorTools.preferredSuite = targetedSuite;
      this.props.creatorTools.save();
    }

    telemetry.trackEvent({
      name: TelemetryEvents.INSPECTOR_SUITE_CHANGED,
      properties: {
        [TelemetryProperties.OLD_VALUE]: SuiteTitles[this.state.activeSuite] || "Unknown",
        [TelemetryProperties.NEW_VALUE]: SuiteTitles[targetedSuite] || "Unknown",
      },
    });

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
    telemetry.trackEvent({
      name: TelemetryEvents.INSPECTOR_SUMMARY_OPENED,
      properties: {
        [TelemetryProperties.PREVIOUS_VIEW]: this.state.viewMode === ProjectInfoDisplayMode.info ? "items" : "summary",
      },
    });

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

  /**
   * Handles keyboard navigation for tabs following WAI-ARIA best practices.
   * Arrow keys move between tabs, Home/End go to first/last tab.
   */
  private _handleTabKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const tabs = ["summary", "items"] as const;
    const currentIndex = this.state.viewMode === ProjectInfoDisplayMode.summary ? 0 : 1;

    let newIndex;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        // Move to next tab, wrap to first if at end
        newIndex = (currentIndex + 1) % tabs.length;
        event.preventDefault();
        break;
      case "ArrowLeft":
      case "ArrowUp":
        // Move to previous tab, wrap to last if at beginning
        newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        event.preventDefault();
        break;
      case "Home":
        // Move to first tab
        newIndex = 0;
        event.preventDefault();
        break;
      case "End":
        // Move to last tab
        newIndex = tabs.length - 1;
        event.preventDefault();
        break;
      default:
        return;
    }

    if (newIndex !== currentIndex) {
      // Switch to the new tab
      if (newIndex === 0) {
        this._setSummaryMode();
      } else {
        this._setInfoMode();
      }

      // Focus the new tab button
      const tabId = newIndex === 0 ? "pid-tab-summary" : "pid-tab-items";
      const tabElement = document.getElementById(tabId);
      if (tabElement) {
        tabElement.focus();
      }
    }
  }

  private _handleExportMenuOpen(event: React.MouseEvent<HTMLElement>) {
    let menuVal = ProjectInfoDisplayMenuState.noMenu;
    let anchorEl: HTMLElement | null = null;

    if (this.state.menuState === ProjectInfoDisplayMenuState.noMenu) {
      menuVal = ProjectInfoDisplayMenuState.exportMenu;
      anchorEl = event.currentTarget;
    }

    this.setState({
      menuState: menuVal,
      exportMenuAnchorEl: anchorEl,
    });
  }

  private _handleExportMenuClose() {
    this.setState({
      menuState: ProjectInfoDisplayMenuState.noMenu,
      exportMenuAnchorEl: null,
    });
  }

  private _setNewExportKey(
    exportKey: string,
    exportFunction: (() => Promise<void>) | undefined,
    exportData: undefined
  ) {
    window.setTimeout(() => {
      this.setState({
        lastExportKey: exportKey,
        lastExportFunction: exportFunction,
        lastExportData: exportData,
      });
    }, 2);
  }

  private async _downloadHtmlReport() {
    if (this.props.project === null || this.state.selectedInfoSet === undefined) {
      return;
    }

    const date = new Date();
    const projName = this.props.project ? this.props.project.simplifiedName : "report";

    const reportHtml = this.state.selectedInfoSet.getReportHtml(projName, projName, date.getTime().toString());

    saveAs(new Blob([reportHtml]), projName + " " + SuiteTitles[this.state.activeSuite] + ".html");

    this._setNewExportKey("htmlReport", this._downloadHtmlReport, undefined);
  }

  private async _downloadCsvReport() {
    if (this.props.project === null || this.state.selectedInfoSet === undefined) {
      return;
    }

    const pisLines = this.state.selectedInfoSet.getItemCsvLines();

    const projName = this.props.project ? this.props.project.name : "report";
    const csvContent = ProjectInfoSet.CommonCsvHeader + "\n" + pisLines.join("\n");

    saveAs(new Blob([csvContent]), projName + " " + SuiteTitles[this.state.activeSuite] + ".csv");

    this._setNewExportKey("csvFile", this._downloadCsvReport, undefined);
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

  _handleSearchTermChanged(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.props.creatorTools === null || this.state == null) {
      return;
    }

    this.setState({
      searchTerm: e.target.value,
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
    const colors = getThemeColors();
    let contentAreaHeightSmall = "calc(100vh - " + (this.props.heightOffset + 120) + "px)";
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

    const allFiltersOn =
      this.state.displayErrors &&
      this.state.displayWarnings &&
      this.state.displayRecommendation &&
      this.state.displayInfo &&
      this.state.displaySuccess &&
      this.state.displayFailure;
    const isCompactFilters = width < 1116;
    const errorCount = countsByType[InfoItemType.error] + countsByType[InfoItemType.internalProcessingError];
    const warningCount = countsByType[InfoItemType.warning];
    const recommendationCount = countsByType[InfoItemType.recommendation];
    const successCount = countsByType[InfoItemType.testCompleteSuccess];
    const failureCount = countsByType[InfoItemType.testCompleteFail];

    const toolbarItems = [
      {
        chip: (
          <McChip
            variant="green"
            selected={allFiltersOn}
            onClick={this._showAllFilters}
            ariaLabel="Show all filter types"
            title="Show all item types"
          >
            All
          </McChip>
        ),
        key: "showAllFilter",
      },
      {
        chip: (
          <McChip
            variant="error"
            selected={this.state.displayErrors}
            onClick={this._toggleErrorFilter}
            count={errorCount > 0 ? errorCount : undefined}
            ariaLabel={`Filter by errors${errorCount > 0 ? `, ${errorCount} items` : ""}`}
            title="Toggle whether error items show"
          >
            {isCompactFilters ? "Err" : "Errors"}
          </McChip>
        ),
        key: "errorFilter",
      },
      {
        chip: (
          <McChip
            variant="warning"
            selected={this.state.displayWarnings}
            onClick={this._toggleWarningFilter}
            count={warningCount > 0 ? warningCount : undefined}
            ariaLabel={`Filter by warnings${warningCount > 0 ? `, ${warningCount} items` : ""}`}
            title="Toggle whether warning items show"
          >
            {isCompactFilters ? "Warn" : "Warnings"}
          </McChip>
        ),
        key: "warningFilter",
      },
      {
        chip: (
          <McChip
            variant="recommendation"
            selected={this.state.displayRecommendation}
            onClick={this._toggleRecommendationFilter}
            count={recommendationCount > 0 ? recommendationCount : undefined}
            ariaLabel={`Filter by recommendations${recommendationCount > 0 ? `, ${recommendationCount} items` : ""}`}
            title="Toggle whether recommendation items show"
          >
            {isCompactFilters ? "Tips" : "Recommendations"}
          </McChip>
        ),
        key: "recoFilter",
      },
      {
        chip: (
          <McChip
            variant="info"
            selected={this.state.displayInfo}
            onClick={this._toggleInfoFilter}
            ariaLabel="Filter by info"
            title="Toggle whether information items show"
          >
            {isCompactFilters ? "Info" : "Information"}
          </McChip>
        ),
        key: "infoFilter",
      },
      {
        chip: (
          <McChip
            variant="passed"
            selected={this.state.displaySuccess}
            onClick={this._toggleSuccessFilter}
            count={successCount > 0 ? successCount : undefined}
            ariaLabel={`Filter by passed items${successCount > 0 ? `, ${successCount} items` : ""}`}
            title="Toggle whether passed items show"
          >
            {isCompactFilters ? "Pass" : "Passed"}
          </McChip>
        ),
        key: "successFilter",
      },
      {
        chip: (
          <McChip
            variant="error"
            selected={this.state.displayFailure}
            onClick={this._toggleFailureFilter}
            count={failureCount > 0 ? failureCount : undefined}
            ariaLabel={`Filter by failed items${failureCount > 0 ? `, ${failureCount} items` : ""}`}
            title="Toggle whether failed items show"
          >
            {isCompactFilters ? "Fail" : "Failed"}
          </McChip>
        ),
        key: "failureFilter",
      },
    ];

    let title: string | undefined = undefined;
    let titleIsLocKey = false;

    if (this.props.project) {
      // Prefer the project's display title (user-friendly name) over pack metadata
      title = this.props.project.loc.getTokenValueOrDefault(this.props.project.title);
    } else if (this.props.file && this.state.selectedInfoSet) {
      const info = this.state.selectedInfoSet.info as any;
      title = info["cardTitle"] ? info["cardTitle"] : info.defaultResourcePackName;
      // Check if title looks like a loc key (contains dot, no spaces, short)
      titleIsLocKey = !!title && title.includes(".") && !title.includes(" ") && title.length < 100;
    } else {
      title = "Report";
    }

    let outer = <></>;
    let rowCount = 0;
    const isSummaryView = this.state.viewMode === ProjectInfoDisplayMode.summary;
    const activePanelId = isSummaryView ? "pid-tabpanel-summary" : "pid-tabpanel-items";
    const activeTabId = isSummaryView ? "pid-tab-summary" : "pid-tab-items";
    const inactivePanelId = isSummaryView ? "pid-tabpanel-items" : "pid-tabpanel-summary";
    const inactiveTabId = isSummaryView ? "pid-tab-items" : "pid-tab-summary";
    const inactivePanel = <div role="tabpanel" id={inactivePanelId} aria-labelledby={inactiveTabId} hidden />;

    if (this.state.isLoading) {
      outer = (
        <div
          className="pid-areaOuter"
          role="tabpanel"
          id={activePanelId}
          aria-labelledby={activeTabId}
          style={{
            backgroundColor: colors.background3,
            color: colors.foreground3,
          }}
        >
          <div
            className="pid-validating"
            style={{
              color: colors.foreground3,
            }}
          >
            Please wait — checking your project for issues...{" "}
            {this.state.loadStatus ? "(" + this.state.loadStatus + ")" : ""}
          </div>
        </div>
      );
    } else if (this.state.viewMode === ProjectInfoDisplayMode.summary) {
      let summaryKeyVals = undefined;

      // Get the info set for use throughout the summary view
      let infoSet: ProjectInfoSet | undefined = this.props.indevInfoSet;
      if (infoSet === undefined) {
        infoSet = this.state.selectedInfoSet;
      }

      if ((this.props.file || this.props.data) && this.state.selectedInfoSet) {
        summaryKeyVals = this.state.selectedInfoSet.info as { [index: string]: any };
      } else if (this.props.indevInfoSet && this.props.indevInfoSet.info.featureSets) {
        summaryKeyVals = this.props.indevInfoSet.info as { [index: string]: any };
      }

      // Detail rows for the collapsible detailed metrics section
      const detailRows: JSX.Element[] = [];

      if (summaryKeyVals) {
        const keys = Object.keys(summaryKeyVals);
        keys.sort();

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

        // Only add the Key Items section if there are actual rows to display
        if (rows.length > 0) {
          lines.push(<div className="pis-areaHeader">Key Items</div>);
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
        }

        if (infoSet) {
          let rowCount = 2;

          if (infoSet.info.featureSets) {
            const featNames = Object.keys(infoSet.info.featureSets);
            featNames.sort();

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
                      {this.formatFeatureSetName(featNameAdj)}
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
                          <div>{this.formatFeatureSetName(featName) + " " + Utilities.humanifyJsName(measureName)}</div>
                        </td>
                      );
                      cells.push(
                        <td className="pis-itemDataCell" key={featName + measureName + "dataB"}>
                          <div className="pis-itemData">{this.getDataSummary(measureVal)}</div>
                        </td>
                      );
                      if (cells.length > 0) {
                        detailRows.push(<tr key={"detailRow" + rowCount}>{cells}</tr>);
                        rowCount++;
                      }
                    }
                  }
                }
              }
            }
            // Details are now rendered in the collapsible section below
          }
        }
      }

      outer = (
        <div
          className="pid-areaOuter"
          role="tabpanel"
          id={activePanelId}
          aria-labelledby={activeTabId}
          style={{
            maxHeight: height > 300 ? contentAreaHeightSmall : "inherit",
          }}
        >
          {/* Hero Section - Project Overview */}
          {this.renderHeroSection(
            infoSet,
            title || "Project",
            this.props.project?.creator,
            this.props.project?.description
          )}

          {/* Stats Bar - Quick content counts */}
          {this.renderStatsBar()}

          <div className="pid-summaryArea">
            <div className="pis-searchArea">
              <TextField
                aria-labelledby="dssp-pathlabel"
                value={this.state.searchTerm}
                onChange={this._handleSearchTermChanged}
                placeholder="🔍 Search statistics..."
                size="small"
                variant="outlined"
                fullWidth
              />
            </div>

            {/* Key Items Section - only show if there's content */}
            {lines.length > 0 && (
              <div
                className="pis-sectionCard"
                style={{
                  backgroundColor:
                    CreatorToolsHost.theme === CreatorToolsThemeStyle.dark
                      ? "rgba(255, 255, 255, 0.02)"
                      : "rgba(0, 0, 0, 0.02)",
                }}
              >
                <div className="pis-areaHeader">Project Information</div>
                <div className="pis-summaryArea">{lines}</div>
              </div>
            )}

            {/* Content Summary - Grouped by Category */}
            {infoSet && infoSet.info.featureSets && (
              <div
                className="pis-sectionCard"
                style={{
                  backgroundColor:
                    CreatorToolsHost.theme === CreatorToolsThemeStyle.dark
                      ? "rgba(255, 255, 255, 0.02)"
                      : "rgba(0, 0, 0, 0.02)",
                }}
              >
                <div className="pis-contentSummaryHeader">Content Statistics</div>
                {this.renderCategorizedStats(infoSet.info.featureSets)}
              </div>
            )}

            {/* Detailed Metrics - Collapsible */}
            {detailRows.length > 0 && (
              <div className="pis-detailsSection">
                <div className="pis-detailsToggle" onClick={this._toggleDetails}>
                  <span className={`pis-sectionToggle ${this.state.showDetails ? "pis-expanded" : "pis-collapsed"}`} />
                  <span>Detailed Metrics ({detailRows.length} items)</span>
                </div>
                {this.state.showDetails && (
                  <div className="pis-detailsContent">
                    <table className="pis-detailTable">
                      <tbody>{detailRows}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    } else {
      let itemsShown = 0;
      const itemRows = [];
      if (this.state && this.state.selectedInfoSet && this.props.indevInfoSet) {
        const items = this.state.selectedInfoSet.items.slice();

        // Sort order priority map matching filter chip order:
        // Errors (0) → Warnings (1) → Recommendations (2) → Info (3) → Passed (4) → Failed (5)
        const itemTypeSortOrder: { [key: number]: number } = {
          [InfoItemType.error]: 0,
          [InfoItemType.internalProcessingError]: 0, // Group with errors
          [InfoItemType.warning]: 1,
          [InfoItemType.recommendation]: 2,
          [InfoItemType.info]: 3,
          [InfoItemType.featureAggregate]: 3, // Group with info
          [InfoItemType.testCompleteSuccess]: 4,
          [InfoItemType.testCompleteFail]: 5,
          [InfoItemType.testCompleteNoApplicableItemsFound]: 3, // Group with info
        };

        items.sort((a: ProjectInfoItem, b: ProjectInfoItem): number => {
          // First: sort by item type category (matching filter chip order)
          const aTypeOrder = itemTypeSortOrder[a.itemType] ?? 99;
          const bTypeOrder = itemTypeSortOrder[b.itemType] ?? 99;
          if (aTypeOrder !== bTypeOrder) {
            return aTypeOrder - bTypeOrder;
          }

          // Second: sort alphabetically by generator ID (validation error code)
          if (a.generatorId !== b.generatorId) {
            return a.generatorId.localeCompare(b.generatorId);
          }

          // Third: sort by generator index within the same generator
          if (a.generatorIndex !== b.generatorIndex) {
            // sort summary results which should be consistently < 10 across tests (e.g., test success or fail)
            // to the bottom in their category
            if ((a.generatorIndex < 10 && b.generatorIndex > 10) || (b.generatorIndex < 10 && a.generatorIndex > 10)) {
              return b.generatorIndex - a.generatorIndex;
            }
            return a.generatorIndex - b.generatorIndex;
          }

          // Fourth: sort by project path
          if (a.projectItem?.projectPath && b.projectItem?.projectPath) {
            return a.projectItem?.projectPath.localeCompare(b.projectItem?.projectPath);
          }

          // Fifth: sort by message
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
        <div
          className="pid-areaOuter"
          role="tabpanel"
          id={activePanelId}
          aria-labelledby={activeTabId}
          style={{
            maxHeight: height > 300 ? contentAreaHeightSmall : "inherit",
          }}
        >
          <div className="pid-filterToolbar">
            <Stack direction="row" spacing={1} aria-label="Filter actions" className="pid-filterActions">
              {toolbarItems.map((item) => (
                <div key={item.key} className="pid-filterControl">
                  {item.chip}
                </div>
              ))}
            </Stack>
          </div>
          {errorCount === 0 && failureCount === 0 && itemRows.length > 0 && successCount > 0 && (
            <div
              className="pid-successBanner"
              style={{
                backgroundColor: warningCount > 0 ? "rgba(237, 108, 2, 0.12)" : "rgba(46, 125, 50, 0.12)",
                border: warningCount > 0 ? "2px solid #ed6c02" : "2px solid #4caf50",
                borderRadius: "2px",
                padding: "12px 16px",
                margin: "8px 0",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
              role="status"
              aria-label={warningCount > 0 ? "Checks passed with warnings" : "All checks passed"}
            >
              <span style={{ fontSize: "24px" }}>{warningCount > 0 ? "⚠️" : "✅"}</span>
              <div>
                <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                  {warningCount > 0 ? "Your add-on has some warnings to review" : "Your add-on looks great!"}
                </div>
                <div style={{ fontSize: "12px", marginTop: "2px" }}>
                  {warningCount > 0
                    ? `${successCount} checks passed with ${warningCount} warning${warningCount !== 1 ? "s" : ""} to review.`
                    : `All ${successCount} checks passed. Ready to export and test in Minecraft!`}
                </div>
              </div>
            </div>
          )}
          <div
            className="pid-tableWrapper"
            style={{
              overflowY: height > 300 ? "auto" : "inherit",
            }}
            tabIndex={height > 300 ? 0 : -1}
            onScroll={this._handleListScroll}
          >
            <table
              className="pid-area"
              style={{
                backgroundColor: colors.background3,
                color: colors.foreground3,
              }}
              cellPadding={0}
              cellSpacing={0}
            >
              <thead>
                <tr
                  className="pid-headerRow"
                  style={{
                    backgroundColor: colors.background3,
                    color: colors.foreground3,
                  }}
                >
                  <th className="pid-headerCell pid-headerTypeCell">Type</th>
                  <th className="pid-headerCell">Check</th>
                  <th className="pid-headerCell">Message</th>
                  <th className="pid-headerCell">File</th>
                  <th className="pid-headerCell pid-headerActionsCell">Details</th>
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
          backgroundColor: colors.background1,
          color: colors.foreground1,
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
          <h2 className="pid-title">
            Project Inspector for{" "}
            {titleIsLocKey && this.props.project ? (
              <LocTokenBox
                project={this.props.project}
                value={title || "Project"}
                creatorTools={this.props.creatorTools}
              />
            ) : (
              title
            )}
          </h2>
          <div className="pid-toolArea">
            <div
              className="pid-topToolbar"
              role="tablist"
              aria-label="Inspector views"
              onKeyDown={this._handleTabKeyDown}
            >
              <button
                onClick={this._setSummaryMode}
                role="tab"
                id="pid-tab-summary"
                aria-selected={this.state.viewMode === ProjectInfoDisplayMode.summary}
                aria-controls="pid-tabpanel-summary"
                tabIndex={this.state.viewMode === ProjectInfoDisplayMode.summary ? 0 : -1}
                className="pid-hiddenButton"
              >
                <SummaryTabLabel
                  theme={this.props.theme}
                  isSelected={this.state.viewMode === ProjectInfoDisplayMode.summary}
                  isCompact={width < 1100}
                />
              </button>
              <button
                onClick={this._setInfoMode}
                role="tab"
                id="pid-tab-items"
                aria-selected={this.state.viewMode === ProjectInfoDisplayMode.info}
                aria-controls="pid-tabpanel-items"
                tabIndex={this.state.viewMode === ProjectInfoDisplayMode.info ? 0 : -1}
                className="pid-hiddenButton"
              >
                <InfoTabLabel
                  theme={this.props.theme}
                  isSelected={this.state.viewMode === ProjectInfoDisplayMode.info}
                  isCompact={width < 1100}
                />
              </button>
            </div>
            <div className="pid-suiteTitle" id="pid-suiteTitle">
              Suite:
            </div>
            <div className="pid-suiteDropdown">
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <Select
                  aria-labelledby="pid-suiteTitle"
                  value={SuiteTitles[this.state.activeSuite] || ""}
                  onChange={this._handleSuiteChange}
                >
                  {SuiteTitles.map((title) => (
                    <MenuItem key={title} value={title}>
                      {title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
            <div className="pid-actionToolbar">
              <Stack direction="row" spacing={0.5} aria-label="Report actions">
                {!this.state.lastExportKey ? (
                  <>
                    <Button size="small" onClick={this._handleExportMenuOpen} title="Deploy">
                      <DownloadLabel isCompact={width < 1116} />
                    </Button>
                    <Menu
                      anchorEl={this.state.exportMenuAnchorEl}
                      open={this.state.menuState === ProjectInfoDisplayMenuState.exportMenu}
                      onClose={this._handleExportMenuClose}
                    >
                      <MenuItem onClick={this._downloadHtmlReport}>
                        <FontAwesomeIcon icon={faFileInvoice} className="fa-lg" style={{ marginRight: 8 }} />
                        HTML Report
                      </MenuItem>
                      <MenuItem onClick={this._downloadCsvReport}>
                        <FontAwesomeIcon icon={faFileCsv} className="fa-lg" style={{ marginRight: 8 }} />
                        CSV File
                      </MenuItem>
                    </Menu>
                  </>
                ) : (
                  <>
                    <Button
                      size="small"
                      onClick={() => {
                        this.state.lastExportFunction?.();
                      }}
                      title={
                        this.state.lastExportKey === "htmlReport"
                          ? "Get an HTML full report of this content."
                          : "Get an CSV file of errors and items."
                      }
                    >
                      <CustomLabel
                        icon={
                          <FontAwesomeIcon
                            icon={this.state.lastExportKey === "htmlReport" ? faFileInvoice : faFileCsv}
                            className="fa-lg"
                          />
                        }
                        text={this.state.lastExportKey === "htmlReport" ? "HTML Report" : "CSV File"}
                        isCompact={false}
                      />
                    </Button>
                    <IconButton size="small" onClick={this._handleExportMenuOpen} title="Export Options" aria-label="Export options">
                      <DownArrowLabel />
                    </IconButton>
                    <Menu
                      anchorEl={this.state.exportMenuAnchorEl}
                      open={this.state.menuState === ProjectInfoDisplayMenuState.exportMenu}
                      onClose={this._handleExportMenuClose}
                    >
                      <MenuItem onClick={this._downloadHtmlReport}>
                        <FontAwesomeIcon icon={faFileInvoice} className="fa-lg" style={{ marginRight: 8 }} />
                        HTML Report
                      </MenuItem>
                      <MenuItem onClick={this._downloadCsvReport}>
                        <FontAwesomeIcon icon={faFileCsv} className="fa-lg" style={{ marginRight: 8 }} />
                        CSV File
                      </MenuItem>
                    </Menu>
                  </>
                )}
              </Stack>
            </div>
          </div>
          {outer}
          {inactivePanel}
        </div>
      </div>
    );
  }
}
