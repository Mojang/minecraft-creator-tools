import * as React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEyeSlash, faSave } from "@fortawesome/free-regular-svg-icons";
import {
  faCircleCheck,
  faCircleQuestion,
  faCircleXmark,
  faHome,
  faFileExport,
  faEdit,
  faFile,
  faArrowLeft,
  faPlus,
  faBoxOpen,
  faCube,
  faFolderTree,
  faColumns,
  faMagic,
  faVideo,
  faScrewdriverWrench,
  faPowerOff,
  faGlobe,
  faCircleInfo,
  faStop,
  faServer,
  faPlay,
  faSortDown,
  faGear,
  faPlug,
  faComputer,
  faCode,
  faLinkSlash,
  faCircleExclamation,
  faCircleArrowUp,
  faBoltLightning,
  faImage,
  faCow,
  faDownload,
  faListDots,
} from "@fortawesome/free-solid-svg-icons";

import "./Labels.css";
import { ThemeInput } from "@fluentui/react-northstar";
import { IconProp } from "@fortawesome/fontawesome-svg-core";
import CartoApp, { CartoThemeStyle } from "../app/CartoApp";

export interface ICompactableLabelProps {
  isCompact: boolean;
}

export interface ISelectableLabelProps {
  isCompact: boolean;
  theme: ThemeInput<any>;
  isSelected: boolean;
}

export interface ISelectableLabelValueProps extends ISelectableLabelProps {
  value?: string | number;
}

export interface ICustomLabelProps {
  text: string;
  icon: IconProp | JSX.Element;
  isCompact: boolean;
}

export interface ISelectableCustomLabelProps extends ICustomLabelProps {
  theme: ThemeInput<any>;
  isSelected: boolean;
}

export const ExportLabel: React.FC<React.HTMLAttributes<HTMLSpanElement>> = () => (
  <span className="label">
    <FontAwesomeIcon icon={faFileExport} className="fa-lg" />
  </span>
);

export const MCPackLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label label-toolbar3">
    <FontAwesomeIcon icon={faBoxOpen} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Share</span> : <></>}
    <FontAwesomeIcon icon={faSortDown} className="fa-lg label-arrow" />
  </span>
);

export const RemoteMinecraftLabel: React.FC<
  React.HTMLAttributes<HTMLSpanElement> & {
    isCompact: boolean;
    theme: ThemeInput<any>;
    isSelected: boolean;
    isWebServer: boolean;
  }
> = (props: { isCompact: boolean; theme: ThemeInput<any>; isSelected: boolean; isWebServer: boolean }) => (
  <span
    className={props.isSelected ? "label-tab" : "label-deseltab"}
    style={{
      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background1
        : props.theme.siteVariables?.colorScheme.brand.background,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background1
        : props.theme.siteVariables?.colorScheme.brand.background,
      color: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background1
        : props.theme.siteVariables?.colorScheme.brand.foreground6,
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
    }}
  >
    <FontAwesomeIcon icon={faPlug} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">{props.isWebServer ? "Login" : "Remote"}</span> : <></>}
  </span>
);

export const DedicatedServerMinecraftLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => (
  <span
    className={props.isSelected ? "label-tab" : "label-deseltab"}
    style={{
      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
      color: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.foreground6,
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
    }}
  >
    <FontAwesomeIcon icon={faPlug} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Server</span> : <></>}
  </span>
);

export const WebSocketMinecraftLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => (
  <span
    className={props.isSelected ? "label-tab" : "label-deseltab"}
    style={{
      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
      color: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.foreground6,
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
    }}
  >
    <FontAwesomeIcon icon={faPlug} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Minecraft Windows app</span> : <></>}
  </span>
);

export const ConnectModeLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => (
  <span
    className={props.isSelected ? "label-tab" : "label-deseltab"}
    style={{
      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
      color: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.foreground6,
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
    }}
  >
    <FontAwesomeIcon icon={faCircleInfo} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Mode</span> : <></>}
  </span>
);

export const WorldSettingsLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => (
  <span
    className={props.isSelected ? "label-tab" : "label-deseltab"}
    style={{
      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
      color: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.foreground6,
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
    }}
  >
    <FontAwesomeIcon icon={faGlobe} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">World</span> : <></>}
  </span>
);

export const ToolEditorLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => (
  <span
    className={props.isSelected ? "label-tab" : "label-deseltab"}
    style={{
      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
      color: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.foreground6,
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
    }}
  >
    <FontAwesomeIcon icon={faScrewdriverWrench} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Tools</span> : <></>}
  </span>
);

export const DocumentationTypesLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => (
  <span
    className={props.isSelected ? "label-tab" : "label-deseltab"}
    style={{
      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
      color: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.foreground6,
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
    }}
  >
    <FontAwesomeIcon icon={faCode} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Types</span> : <></>}
  </span>
);

export const CustomTabLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableCustomLabelProps> = (
  props: ISelectableCustomLabelProps
) => (
  <span
    className={props.isSelected ? "label-tab" : "label-deseltab"}
    style={{
      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
      color: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.foreground6,
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background2
        : props.theme.siteVariables?.colorScheme.brand.background1,
    }}
  >
    {props.icon}
    {!props.isCompact ? <span className="label-text">{props.text}</span> : <></>}
  </span>
);

export const UnassociatedDocumentationLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => (
  <span
    className={props.isSelected ? "label-tab" : "label-deseltab"}
    style={{
      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background2,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background2,
      color: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.foreground6,
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background1
        : props.theme.siteVariables?.colorScheme.brand.background2,
    }}
  >
    <FontAwesomeIcon icon={faLinkSlash} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Unlinked Docs</span> : <></>}
  </span>
);

export const ViewLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label label-toolbar3">
    <FontAwesomeIcon icon={faColumns} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">View</span> : <></>}
    <FontAwesomeIcon icon={faSortDown} className="fa-lg label-arrow" />
  </span>
);

export const ConnectLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label label-toolbar">
    <FontAwesomeIcon icon={faServer} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Servers</span> : <></>}
  </span>
);

export const NewLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label label-toolbar">
    <FontAwesomeIcon icon={faFile} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Open</span> : <></>}
  </span>
);

export const ExportBackupLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label label-toolbar">
    <FontAwesomeIcon icon={faFileExport} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Backup</span> : <></>}
  </span>
);

export const LocalFolderLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label label-toolbar">
    <FontAwesomeIcon icon={faComputer} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Folder</span> : <></>}
  </span>
);

export const DownloadLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label label-toolbar">
    <FontAwesomeIcon icon={faDownload} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Download</span> : <></>}
    <FontAwesomeIcon icon={faSortDown} className="fa-lg label-arrow" />
  </span>
);

export const ServerStartLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label">
    <FontAwesomeIcon icon={faPowerOff} className="fa-lg" />
    <span className="label">Start</span>
  </span>
);

export const ServerStartingLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label">
    <span className="label-light label-yellow">&#160;</span>
    <FontAwesomeIcon icon={faPowerOff} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">(starting...)</span> : <></>}
  </span>
);

export const ServerInitializingLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label">
    <span className="label-light label-yellow">&#160;</span>
    <FontAwesomeIcon icon={faPowerOff} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">(loading...)</span> : <></>}
  </span>
);

export const ServerInitializedLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label">
    <span className="label-light label-yellow">&#160;</span>
    <FontAwesomeIcon icon={faPowerOff} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Ready to connect</span> : <></>}
  </span>
);

export const ServerStoppingLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label">
    <span className="label-light label-yellow">&#160;</span>
    <FontAwesomeIcon icon={faPowerOff} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">(stopping...)</span> : <></>}
  </span>
);
export const ServerStopLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label">
    <FontAwesomeIcon icon={faStop} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Stop</span> : <></>}
  </span>
);

export const ServerRestartLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label">
    <span className="label-light label-green">&#160;</span>
    <FontAwesomeIcon icon={faServer} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Restart</span> : <></>}
  </span>
);

export const BackLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label">
    <FontAwesomeIcon icon={faArrowLeft} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Back</span> : <></>}
  </span>
);

export const EditLabel: React.FC<React.HTMLAttributes<HTMLSpanElement>> = () => (
  <span className="label label-toolbar3">
    <FontAwesomeIcon icon={faEdit} className="fa-lg" />
    <span className="label-text">Edit this copy</span>
  </span>
);

export const OpenInMinecraftLabel: React.FC<React.HTMLAttributes<HTMLSpanElement>> = () => (
  <span className="label label-toolbar3">
    <FontAwesomeIcon icon={faPlay} className="fa-lg" />
    <span className="label-text">Open in Minecraft</span>
  </span>
);

export const TopsMapLabel: React.FC<React.HTMLAttributes<HTMLSpanElement>> = () => (
  <span className="label label-toolbar3">
    <span className="label-text">Tops</span>
  </span>
);

export const PlusMapLevelLabel: React.FC<React.HTMLAttributes<HTMLSpanElement>> = () => (
  <span className="label label-toolbar3">
    <span className="label-text">+</span>
  </span>
);

export const MinusMapLevelLabel: React.FC<React.HTMLAttributes<HTMLSpanElement>> = () => (
  <span className="label label-toolbar3">
    <span className="label-text">-</span>
  </span>
);

export const TeleportInMinecraftLabel: React.FC<React.HTMLAttributes<HTMLSpanElement>> = () => (
  <span className="label label-toolbar3">
    <FontAwesomeIcon icon={faMagic} className="fa-lg" />
    <span className="label-text">Teleport</span>
  </span>
);

export const DownArrowLabel: React.FC<React.HTMLAttributes<HTMLSpanElement>> = () => (
  <span className="label-arrowouter">
    <FontAwesomeIcon icon={faSortDown} className="fa-lg label-arrow" />
  </span>
);

export const CustomLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICustomLabelProps> = (
  props: ICustomLabelProps
) => (
  <span className="label label-toolbar3">
    {props.icon}
    {!props.isCompact ? <span className="label-text">{props.text}</span> : <></>}
  </span>
);

export const DeployLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label label-toolbar3">
    <FontAwesomeIcon icon={faPlay} className="fa-lg label-rpad" />
    {!props.isCompact ? <span className="label-text">Run</span> : <></>}
    <FontAwesomeIcon icon={faSortDown} className="fa-lg label-arrow" />
  </span>
);

export const PushToMinecraftLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label">
    <FontAwesomeIcon icon={faPlay} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Deploy to Minecraft</span> : <></>}
  </span>
);

export const SaveLabel: React.FC<React.HTMLAttributes<HTMLSpanElement>> = () => (
  <span className="label-text">
    <FontAwesomeIcon icon={faSave} className="fa-lg" />
  </span>
);

export const OpenInExplorerLabel: React.FC<React.HTMLAttributes<HTMLSpanElement>> = () => (
  <span className="label-text">
    <FontAwesomeIcon icon={faFolderTree} className="fa-lg" />
  </span>
);

export const SettingsLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label label-toolbar">
    <FontAwesomeIcon icon={faGear} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Settings</span> : <></>}
  </span>
);

export const VideoLabel: React.FC<React.HTMLAttributes<HTMLSpanElement>> = () => (
  <span className="label">
    <FontAwesomeIcon icon={faVideo} className="fa-lg" />
  </span>
);

export const HomeLabel: React.FC<React.HTMLAttributes<HTMLSpanElement>> = () => (
  <span className="label label-toolbar">
    <FontAwesomeIcon icon={faHome} className="fa-lg" />
  </span>
);

export const AddLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label">
    <FontAwesomeIcon icon={faPlus} className="fa-lg" />
    {!props.isCompact ? <span className="label">Add</span> : <></>}
  </span>
);

export const EyeSlashLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => (
  <span
    className={props.isSelected ? "label-button label-selected" : "label-button"}
    style={{
      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background4,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background4,
      color: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.foreground6,
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background4
        : props.theme.siteVariables?.colorScheme.brand.background1,
    }}
  >
    <FontAwesomeIcon icon={faEyeSlash} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Hidden</span> : <></>}
  </span>
);

export const FunctionsLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => (
  <span
    className={props.isSelected ? "label-button label-selected" : "label-button"}
    style={{
      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background4,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background4,
      color:
        (CartoApp.theme === CartoThemeStyle.light && !props.isSelected) ||
        (CartoApp.theme === CartoThemeStyle.dark && props.isSelected)
          ? "#774444"
          : "#FFCCCC",
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background4
        : props.theme.siteVariables?.colorScheme.brand.background1,
    }}
  >
    <FontAwesomeIcon icon={faBoltLightning} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Scripts/Functions</span> : <></>}
  </span>
);

export const AssetsLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => (
  <span
    className={props.isSelected ? "label-button label-selected" : "label-button"}
    style={{
      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background4,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background4,
      color:
        (CartoApp.theme === CartoThemeStyle.light && !props.isSelected) ||
        (CartoApp.theme === CartoThemeStyle.dark && props.isSelected)
          ? "#446D44"
          : "#C9EDC9",
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background4
        : props.theme.siteVariables?.colorScheme.brand.background1,
    }}
  >
    <FontAwesomeIcon icon={faImage} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Scripts/Functions</span> : <></>}
  </span>
);

export const TypesLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => (
  <span
    className={props.isSelected ? "label-button label-selected" : "label-button"}
    style={{
      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background4,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background4,
      color:
        (CartoApp.theme === CartoThemeStyle.light && !props.isSelected) ||
        (CartoApp.theme === CartoThemeStyle.dark && props.isSelected)
          ? "#444477"
          : "#DADAFF",
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background4
        : props.theme.siteVariables?.colorScheme.brand.background1,
    }}
  >
    <FontAwesomeIcon icon={faCow} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Types</span> : <></>}
  </span>
);

export const ExcludeEdgesLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label">
    <FontAwesomeIcon icon={faCube} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Hide edges</span> : <></>}
  </span>
);

export const InfoTabLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => (
  <span
    className={props.isSelected ? "label-button label-selected" : "label-button"}
    role="tab"
    style={{
      width: !props.isCompact ? "130px" : "",
      fontWeight: props.isSelected ? "bold" : "normal",
      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background2,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background2,
      color: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.foreground4
        : props.theme.siteVariables?.colorScheme.brand.foreground1,
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background4
        : props.theme.siteVariables?.colorScheme.brand.background1,
    }}
  >
    <span
      style={{
        borderBottom: props.isSelected ? "solid 2px" : "solid 0px",
        padding: "4px",
        borderColor: props.isSelected ? props.theme.siteVariables?.colorScheme.brand.foreground4 : "transparent",
      }}
    >
      <FontAwesomeIcon icon={faListDots} className="fa-lg" />
      {!props.isCompact ? <span className="label-text">Items</span> : <></>}
    </span>
  </span>
);

export const SummaryTabLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => (
  <span
    className={props.isSelected ? "label-button label-selected" : "label-button"}
    style={{
      width: !props.isCompact ? "130px" : "",

      fontWeight: props.isSelected ? "bold" : "normal",
      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background2,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background2,
      color: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.foreground4
        : props.theme.siteVariables?.colorScheme.brand.foreground1,
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background4
        : props.theme.siteVariables?.colorScheme.brand.background1,
    }}
    role="tab"
    title="Summary"
  >
    {" "}
    <span
      style={{
        borderBottom: props.isSelected ? "solid 2px" : "solid 0px",
        padding: "4px",
        borderColor: props.isSelected ? props.theme.siteVariables?.colorScheme.brand.foreground4 : "transparent",
      }}
    >
      <FontAwesomeIcon icon={faCircleInfo} className="fa-lg" />
      {!props.isCompact ? <span className="label-text">Summary</span> : <></>}
    </span>
  </span>
);

export const WarningFilterLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelValueProps> = (
  props: ISelectableLabelValueProps
) => (
  <span
    className={props.isSelected ? "label-button label-selected" : "label-button"}
    style={{
      fontWeight: props.isSelected ? "bold" : "normal",
      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background2,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background2,
      color: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.foreground4
        : props.theme.siteVariables?.colorScheme.brand.foreground1,
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background4
        : props.theme.siteVariables?.colorScheme.brand.background1,
    }}
  >
    {" "}
    <span
      style={{
        borderBottom: props.isSelected ? "solid 2px" : "solid 0px",
        padding: "4px",
        borderColor: props.isSelected ? props.theme.siteVariables?.colorScheme.brand.foreground4 : "transparent",
      }}
    >
      <FontAwesomeIcon icon={faCircleQuestion} className="fa-lg" />
      {!props.isCompact ? (
        <span className="label-text">Warning{props.value ? " (" + props.value + ")" : ""}</span>
      ) : (
        <></>
      )}
    </span>
  </span>
);

export const RecommendationsFilterLabel: React.FC<
  React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelValueProps
> = (props: ISelectableLabelValueProps) => (
  <span
    className={props.isSelected ? "label-button label-selected" : "label-button"}
    style={{
      fontWeight: props.isSelected ? "bold" : "normal",
      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background2,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background2,
      color: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.foreground4
        : props.theme.siteVariables?.colorScheme.brand.foreground1,
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background4
        : props.theme.siteVariables?.colorScheme.brand.background1,
    }}
  >
    {" "}
    <span
      style={{
        borderBottom: props.isSelected ? "solid 2px" : "solid 0px",
        padding: "4px",
        borderColor: props.isSelected ? props.theme.siteVariables?.colorScheme.brand.foreground4 : "transparent",
      }}
    >
      <FontAwesomeIcon icon={faCircleArrowUp} className="fa-lg" />
      {!props.isCompact ? (
        <span className="label-text">Recommendations{props.value ? " (" + props.value + ")" : ""}</span>
      ) : (
        <></>
      )}
    </span>
  </span>
);

export const ErrorFilterLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelValueProps> = (
  props: ISelectableLabelValueProps
) => (
  <span
    className={props.isSelected ? "label-button label-selected" : "label-button"}
    style={{
      fontWeight: props.isSelected ? "bold" : "normal",
      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background2,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background2,
      color: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.foreground4
        : props.theme.siteVariables?.colorScheme.brand.foreground1,
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background4
        : props.theme.siteVariables?.colorScheme.brand.background1,
    }}
  >
    {" "}
    <span
      style={{
        borderBottom: props.isSelected ? "solid 2px" : "solid 0px",
        padding: "4px",
        borderColor: props.isSelected ? props.theme.siteVariables?.colorScheme.brand.foreground4 : "transparent",
      }}
    >
      <FontAwesomeIcon icon={faCircleExclamation} className="fa-lg" />
      {!props.isCompact ? (
        <span className="label-text">Errors{props.value ? " (" + props.value + ")" : ""}</span>
      ) : (
        <></>
      )}
    </span>
  </span>
);

export const InfoFilterLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelValueProps> = (
  props: ISelectableLabelValueProps
) => (
  <span
    className={props.isSelected ? "label-button label-selected" : "label-button"}
    style={{
      fontWeight: props.isSelected ? "bold" : "normal",
      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background2,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background2,
      color: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.foreground4
        : props.theme.siteVariables?.colorScheme.brand.foreground1,
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background4
        : props.theme.siteVariables?.colorScheme.brand.background1,
    }}
  >
    <span
      style={{
        borderBottom: props.isSelected ? "solid 2px" : "solid 0px",
        padding: "4px",
        borderColor: props.isSelected ? props.theme.siteVariables?.colorScheme.brand.foreground4 : "transparent",
      }}
    >
      <FontAwesomeIcon icon={faCircleInfo} className="fa-lg" />
      {!props.isCompact ? <span className="label-text">Info{props.value ? " (" + props.value + ")" : ""}</span> : <></>}
    </span>
  </span>
);

export const SuccessFilterLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelValueProps> = (
  props: ISelectableLabelValueProps
) => (
  <span
    className={props.isSelected ? "label-button label-selected" : "label-button"}
    style={{
      fontWeight: props.isSelected ? "bold" : "normal",

      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background2,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background2,
      color: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.foreground4
        : props.theme.siteVariables?.colorScheme.brand.foreground1,
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background4
        : props.theme.siteVariables?.colorScheme.brand.background1,
    }}
  >
    <span
      style={{
        borderBottom: props.isSelected ? "solid 2px" : "solid 0px",
        padding: "4px",
        borderColor: props.isSelected ? props.theme.siteVariables?.colorScheme.brand.foreground4 : "transparent",
      }}
    >
      <FontAwesomeIcon icon={faCircleCheck} className="fa-lg" />
      {!props.isCompact ? (
        <span className="label-text">Success{props.value ? " (" + props.value + ")" : ""}</span>
      ) : (
        <></>
      )}
    </span>
  </span>
);

export const FailureFilterLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelValueProps> = (
  props: ISelectableLabelValueProps
) => (
  <span
    className={props.isSelected ? "label-button label-selected" : "label-button"}
    style={{
      fontWeight: props.isSelected ? "bold" : "normal",

      borderLeftColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background2,
      borderRightColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background
        : props.theme.siteVariables?.colorScheme.brand.background2,
      color: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.foreground4
        : props.theme.siteVariables?.colorScheme.brand.foreground1,
      backgroundColor: props.isSelected
        ? props.theme.siteVariables?.colorScheme.brand.background4
        : props.theme.siteVariables?.colorScheme.brand.background1,
    }}
  >
    <span
      style={{
        borderBottom: props.isSelected ? "solid 2px" : "solid 0px",
        padding: "4px",
        borderColor: props.isSelected ? props.theme.siteVariables?.colorScheme.brand.foreground4 : "transparent",
      }}
    >
      <FontAwesomeIcon icon={faCircleXmark} className="fa-lg" />
      {!props.isCompact ? (
        <span className="label-text">Failure{props.value ? " (" + props.value + ")" : ""}</span>
      ) : (
        <></>
      )}
    </span>
  </span>
);
