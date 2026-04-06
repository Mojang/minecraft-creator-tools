import * as React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileCode, faSave } from "@fortawesome/free-regular-svg-icons";
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
  faCheck,
  faUserEdit,
} from "@fortawesome/free-solid-svg-icons";

import "./Labels.css";
import { IconProp } from "@fortawesome/fontawesome-svg-core";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../../../app/CreatorToolsHost";
import { mcColors } from "../../../../hooks/theme/mcColors";
import IProjectTheme from "../../../../types/IProjectTheme";

/**
 * Helper function to get label colors based on selection state.
 * Uses Minecraft-styled colors: selected = green, deselected = stone gray.
 */
function getLabelColors(isSelected: boolean) {
  return {
    borderColor: isSelected ? "#1e4d14" : "#131313",
    color: isSelected ? "#ffffff" : "#d0d0d0",
    backgroundColor: isSelected ? "#52a535" : "#3a3a3a",
  };
}

export interface ICompactableLabelProps {
  isCompact: boolean;
}

export interface ISelectableLabelProps {
  isCompact: boolean;
  theme: IProjectTheme;
  isSelected: boolean;
}

export interface ISelectableLabelValueProps extends ISelectableLabelProps {
  value?: string | number;
}

export interface ICustomLabelProps {
  text: string;
  icon: React.ReactNode;
  isCompact: boolean;
}

export interface ICustomIconLabelProps {
  text: string;
  icon: IconProp;
  isCompact: boolean;
}

export interface ISelectableCustomLabelProps extends ICustomLabelProps {
  theme: IProjectTheme;
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
    {!props.isCompact ? <span className="label-text">Export</span> : <></>}
    <FontAwesomeIcon icon={faSortDown} className="fa-lg label-arrow" />
  </span>
);

export const RemoteMinecraftLabel: React.FC<
  React.HTMLAttributes<HTMLSpanElement> & {
    isCompact: boolean;
    theme: IProjectTheme;
    isSelected: boolean;
    isWebServer: boolean;
    connectedName?: string;
  }
> = (props: {
  isCompact: boolean;
  theme: IProjectTheme;
  isSelected: boolean;
  isWebServer: boolean;
  connectedName?: string;
}) => {
  let labelText = props.isWebServer ? "Login" : "Remote";
  if (props.connectedName) {
    labelText = props.connectedName;
  }
  const colors = getLabelColors(props.isSelected);
  return (
    <span
      className={props.isSelected ? "label-tab" : "label-deseltab"}
      style={{
        borderLeftColor: colors.borderColor,
        borderRightColor: colors.borderColor,
        color: colors.color,
        backgroundColor: colors.backgroundColor,
      }}
    >
      <FontAwesomeIcon icon={faPlug} className="fa-lg" />
      {!props.isCompact ? <span className="label-text">{labelText}</span> : <></>}
    </span>
  );
};

export const DedicatedServerMinecraftLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => {
  const colors = getLabelColors(props.isSelected);
  return (
    <span
      className={props.isSelected ? "label-tab" : "label-deseltab"}
      style={{
        borderLeftColor: colors.borderColor,
        borderRightColor: colors.borderColor,
        color: colors.color,
        backgroundColor: colors.backgroundColor,
      }}
    >
      <FontAwesomeIcon icon={faPlug} className="fa-lg" />
      {!props.isCompact ? <span className="label-text">Server</span> : <></>}
    </span>
  );
};

export const WebSocketMinecraftLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => {
  const colors = getLabelColors(props.isSelected);
  return (
    <span
      className={props.isSelected ? "label-tab" : "label-deseltab"}
      style={{
        borderLeftColor: colors.borderColor,
        borderRightColor: colors.borderColor,
        color: colors.color,
        backgroundColor: colors.backgroundColor,
      }}
    >
      <FontAwesomeIcon icon={faPlug} className="fa-lg" />
      {!props.isCompact ? <span className="label-text">Minecraft Windows app</span> : <></>}
    </span>
  );
};

export const ConnectModeLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => {
  const colors = getLabelColors(props.isSelected);
  return (
    <span
      className={props.isSelected ? "label-tab" : "label-deseltab"}
      style={{
        borderLeftColor: colors.borderColor,
        borderRightColor: colors.borderColor,
        color: colors.color,
        backgroundColor: colors.backgroundColor,
      }}
    >
      <FontAwesomeIcon icon={faCircleInfo} className="fa-lg" />
      {!props.isCompact ? <span className="label-text">Mode</span> : <></>}
    </span>
  );
};

export const WorldSettingsLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => {
  const colors = getLabelColors(props.isSelected);
  return (
    <span
      className={props.isSelected ? "label-tab" : "label-deseltab"}
      style={{
        borderLeftColor: colors.borderColor,
        borderRightColor: colors.borderColor,
        color: colors.color,
        backgroundColor: colors.backgroundColor,
      }}
    >
      <FontAwesomeIcon icon={faGlobe} className="fa-lg" />
      {!props.isCompact ? <span className="label-text">Server Settings</span> : <></>}
    </span>
  );
};

export const InteractLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => {
  const colors = getLabelColors(props.isSelected);
  return (
    <span
      className={props.isSelected ? "label-tab" : "label-deseltab"}
      style={{
        borderLeftColor: colors.borderColor,
        borderRightColor: colors.borderColor,
        color: colors.color,
        backgroundColor: colors.backgroundColor,
      }}
    >
      <FontAwesomeIcon icon={faUserEdit} className="fa-lg" />
      {!props.isCompact ? <span className="label-text">Interact</span> : <></>}
    </span>
  );
};

export const ToolEditorLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => {
  const colors = getLabelColors(props.isSelected);
  return (
    <span
      className={props.isSelected ? "label-tab" : "label-deseltab"}
      style={{
        borderLeftColor: colors.borderColor,
        borderRightColor: colors.borderColor,
        color: colors.color,
        backgroundColor: colors.backgroundColor,
      }}
    >
      <FontAwesomeIcon icon={faScrewdriverWrench} className="fa-lg" />
      {!props.isCompact ? <span className="label-text">Tools</span> : <></>}
    </span>
  );
};

export const DocumentationTypesLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => {
  const colors = getLabelColors(props.isSelected);
  return (
    <span
      className={props.isSelected ? "label-tab" : "label-deseltab"}
      style={{
        borderLeftColor: colors.borderColor,
        borderRightColor: colors.borderColor,
        color: colors.color,
        backgroundColor: colors.backgroundColor,
      }}
    >
      <FontAwesomeIcon icon={faCode} className="fa-lg" />
      {!props.isCompact ? <span className="label-text">Types</span> : <></>}
    </span>
  );
};

export const CustomSelectableDropdownLabel: React.FC<
  React.HTMLAttributes<HTMLSpanElement> & ISelectableCustomLabelProps
> = (props: ISelectableCustomLabelProps) => {
  const colors = getLabelColors(props.isSelected);
  const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;
  return (
    <span
      className={"label-dropdown"}
      style={{
        borderColor: props.isSelected ? colors.borderColor : "inherit",
        color: props.isSelected ? mcColors.green4 : "inherit",
        fontWeight: props.isSelected ? "bold" : "normal",
        textDecoration: props.isSelected ? "underline" : "none",
        backgroundColor: props.isSelected ? colors.backgroundColor : "inherit",
      }}
    >
      {props.icon}
      {!props.isCompact ? <span className="label-text">{props.text}</span> : <></>}
    </span>
  );
};

export const CustomSelectableLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableCustomLabelProps> = (
  props: ISelectableCustomLabelProps
) => {
  const colors = getLabelColors(props.isSelected);
  return (
    <span
      className={props.isSelected ? "label-tab" : "label-deseltab"}
      style={{
        borderColor: colors.borderColor,
        color: colors.color,
        fontWeight: props.isSelected ? "bold" : "normal",
        textDecoration: props.isSelected ? "underline" : "none",
        backgroundColor: colors.backgroundColor,
      }}
    >
      {props.icon}
      {!props.isCompact ? <span className="label-text">{props.text}</span> : <></>}
    </span>
  );
};

export const CustomTabLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableCustomLabelProps> = (
  props: ISelectableCustomLabelProps
) => {
  const colors = getLabelColors(props.isSelected);
  return (
    <span
      className={props.isSelected ? "label-tab" : "label-deseltab"}
      style={{
        borderLeftColor: colors.borderColor,
        borderRightColor: colors.borderColor,
        color: props.isSelected ? mcColors.green4 : colors.color,
        fontWeight: props.isSelected ? "bold" : "normal",
        textDecoration: props.isSelected ? "underline" : "none",
        backgroundColor: colors.backgroundColor,
      }}
    >
      {props.icon}
      {!props.isCompact ? <span className="label-text">{props.text}</span> : <></>}
    </span>
  );
};

export const UnassociatedDocumentationLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => {
  const colors = getLabelColors(props.isSelected);
  return (
    <span
      className={props.isSelected ? "label-tab" : "label-deseltab"}
      style={{
        borderLeftColor: colors.borderColor,
        borderRightColor: colors.borderColor,
        color: colors.color,
        backgroundColor: colors.backgroundColor,
      }}
    >
      <FontAwesomeIcon icon={faLinkSlash} className="fa-lg" />
      {!props.isCompact ? <span className="label-text">Unlinked Docs</span> : <></>}
    </span>
  );
};

export const ViewLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label label-toolbar3">
    <FontAwesomeIcon icon={faColumns} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">View</span> : <></>}
    <FontAwesomeIcon icon={faSortDown} className="fa-lg label-arrow" />
  </span>
);

export const ItemActionsLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICustomIconLabelProps> = (
  props: ICustomIconLabelProps
) => (
  <span className="label label-toolbar3">
    <FontAwesomeIcon icon={props.icon} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">{props.text}</span> : <></>}
    <FontAwesomeIcon icon={faSortDown} className="fa-lg label-arrow" />
  </span>
);

export const ConnectLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label label-toolbar">
    <FontAwesomeIcon icon={faServer} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Minecraft</span> : <></>}
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
    {!props.isCompact ? <span className="label-text">Download Backup</span> : <></>}
  </span>
);

export const LocalFolderLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label label-toolbar">
    <FontAwesomeIcon icon={faComputer} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Open Project Folder</span> : <></>}
  </span>
);

export const DownloadLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label label-toolbar">
    <FontAwesomeIcon icon={faDownload} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Download Report</span> : <></>}
    <FontAwesomeIcon icon={faSortDown} className="fa-lg label-arrow" />
  </span>
);

export const ServerStartLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label">
    <FontAwesomeIcon icon={faPowerOff} className="fa-lg" />
    <span className="label-text">Start</span>
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
    {!props.isCompact ? <span className="label-text">Start server</span> : <></>}
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

export const CustomDropdownLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICustomLabelProps> = (
  props: ICustomLabelProps
) => (
  <span className="label label-toolbar3">
    {props.icon}
    {!props.isCompact ? <span className="label-text">{props.text}</span> : <></>}
    <FontAwesomeIcon icon={faSortDown} className="fa-lg label-arrow" />
  </span>
);

export const CustomLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICustomLabelProps> = (
  props: ICustomLabelProps
) => (
  <div className="label label-toolbar3">
    <div className="label-iconGrid">{props.icon}</div>
    {!props.isCompact ? <span className="label-text">{props.text}</span> : <></>}
  </div>
);

export const CustomSlimLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICustomLabelProps> = (
  props: ICustomLabelProps
) => (
  <div className="label-slim label-toolbar-slim">
    <div className="label-iconGrid">{props.icon}</div>
    {!props.isCompact ? <span className="label-text">{props.text}</span> : <></>}
  </div>
);

export const DeployLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label label-toolbar3">
    <FontAwesomeIcon icon={faPlay} className="fa-lg label-rpad" />
    {!props.isCompact ? <span className="label-text">Test</span> : <></>}
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

export const HelpLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ICompactableLabelProps> = (
  props: ICompactableLabelProps
) => (
  <span className="label label-toolbar3">
    <FontAwesomeIcon icon={faCircleQuestion} className="fa-lg" />
    {!props.isCompact ? <span className="label-text">Help</span> : <></>}
    <FontAwesomeIcon icon={faSortDown} className="fa-lg label-arrow" />
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

export const CheckIcon: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => {
  const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;
  return (
    <span
      className={"label-toggle-icon" + (props.isSelected ? " label-toggle-on" : " label-toggle-off")}
      style={{
        borderColor: props.isSelected ? mcColors.green4 : isDark ? mcColors.gray4 : mcColors.gray2,
        color: props.isSelected ? mcColors.green4 : isDark ? mcColors.gray3 : mcColors.gray4,
        backgroundColor: props.isSelected
          ? isDark
            ? "rgba(82, 165, 53, 0.25)"
            : "rgba(82, 165, 53, 0.2)"
          : isDark
            ? mcColors.gray5
            : mcColors.white,
      }}
    >
      {props.isSelected ? <FontAwesomeIcon icon={faCheck} className="fa-sm" /> : <></>}
    </span>
  );
};
export const AdvancedFilesIcon: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => {
  const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;
  return (
    <span
      className={"label-toggle-icon" + (props.isSelected ? " label-toggle-on" : " label-toggle-off")}
      style={{
        borderColor: props.isSelected ? mcColors.green4 : isDark ? mcColors.gray4 : mcColors.gray2,
        color: props.isSelected ? mcColors.green4 : isDark ? mcColors.gray3 : mcColors.gray4,
        backgroundColor: props.isSelected
          ? isDark
            ? "rgba(82, 165, 53, 0.25)"
            : "rgba(82, 165, 53, 0.2)"
          : isDark
            ? mcColors.gray5
            : mcColors.white,
      }}
    >
      <FontAwesomeIcon icon={faFileCode} className="fa-sm" />
    </span>
  );
};

export const FunctionsIcon: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => {
  const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;
  return (
    <span
      className={"label-toggle-icon" + (props.isSelected ? " label-toggle-on" : " label-toggle-off")}
      style={{
        borderColor: props.isSelected ? mcColors.green4 : isDark ? mcColors.gray4 : mcColors.gray2,
        color:
          (!isDark && !props.isSelected) || (isDark && props.isSelected)
            ? mcColors.functionsDark
            : mcColors.functionsLight,
        backgroundColor: props.isSelected
          ? isDark
            ? "rgba(82, 165, 53, 0.25)"
            : "rgba(82, 165, 53, 0.2)"
          : isDark
            ? mcColors.gray5
            : mcColors.white,
      }}
    >
      <FontAwesomeIcon icon={faBoltLightning} className="fa-sm" />
    </span>
  );
};

export const AssetsIcon: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => {
  const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;
  return (
    <span
      className={"label-toggle-icon" + (props.isSelected ? " label-toggle-on" : " label-toggle-off")}
      style={{
        borderColor: props.isSelected ? mcColors.green4 : isDark ? mcColors.gray4 : mcColors.gray2,
        color:
          (!isDark && !props.isSelected) || (isDark && props.isSelected) ? mcColors.assetsDark : mcColors.assetsLight,
        backgroundColor: props.isSelected
          ? isDark
            ? "rgba(82, 165, 53, 0.25)"
            : "rgba(82, 165, 53, 0.2)"
          : isDark
            ? mcColors.gray5
            : mcColors.white,
      }}
    >
      <FontAwesomeIcon icon={faImage} className="fa-sm" />
    </span>
  );
};

export const TypesIcon: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => {
  const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;
  return (
    <span
      className={"label-toggle-icon" + (props.isSelected ? " label-toggle-on" : " label-toggle-off")}
      style={{
        borderColor: props.isSelected ? mcColors.green4 : isDark ? mcColors.gray4 : mcColors.gray2,
        color:
          (!isDark && !props.isSelected) || (isDark && props.isSelected) ? mcColors.typesDark : mcColors.typesLight,
        backgroundColor: props.isSelected
          ? isDark
            ? "rgba(82, 165, 53, 0.25)"
            : "rgba(82, 165, 53, 0.2)"
          : isDark
            ? mcColors.gray5
            : mcColors.white,
      }}
    >
      <FontAwesomeIcon icon={faCow} className="fa-sm" />
    </span>
  );
};

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
) => {
  const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;
  return (
    <span
      className={props.isSelected ? "mc-tab mc-tab--selected" : "mc-tab"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "12px 8px",
        background: "transparent",
        border: "none",
        fontSize: "14px",
        cursor: "pointer",
        position: "relative",
        fontWeight: props.isSelected ? 600 : 400,
        color: props.isSelected ? (isDark ? mcColors.white : mcColors.gray6) : isDark ? mcColors.gray2 : mcColors.gray5,
      }}
    >
      <FontAwesomeIcon icon={faListDots} style={{ fontSize: "16px" }} />
      {!props.isCompact && <span>Items</span>}
      {props.isSelected && (
        <span
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "3px",
            backgroundColor: mcColors.green4,
            borderRadius: "2px 2px 0 0",
          }}
        />
      )}
    </span>
  );
};

export const SummaryTabLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelProps> = (
  props: ISelectableLabelProps
) => {
  const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;
  return (
    <span
      className={props.isSelected ? "mc-tab mc-tab--selected" : "mc-tab"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "12px 8px",
        background: "transparent",
        border: "none",
        fontSize: "14px",
        cursor: "pointer",
        position: "relative",
        fontWeight: props.isSelected ? 600 : 400,
        color: props.isSelected ? (isDark ? mcColors.white : mcColors.gray6) : isDark ? mcColors.gray2 : mcColors.gray5,
      }}
      title="Summary"
    >
      <FontAwesomeIcon icon={faCircleInfo} style={{ fontSize: "16px" }} />
      {!props.isCompact && <span>Summary</span>}
      {props.isSelected && (
        <span
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "3px",
            backgroundColor: mcColors.green4,
            borderRadius: "2px 2px 0 0",
          }}
        />
      )}
    </span>
  );
};

export const WarningFilterLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelValueProps> = (
  props: ISelectableLabelValueProps
) => {
  // Theme-aware colors for WCAG AA compliance (4.5:1 contrast ratio minimum)
  const isLightTheme = CreatorToolsHost.theme === CreatorToolsThemeStyle.light;
  const activeColor = isLightTheme ? "#8b6914" : "#ffd54f"; // Dark amber for light, bright yellow for dark
  const inactiveColor = isLightTheme ? "#777777" : "#888888";
  // Subtle background tints — selected gets a light wash, unselected is transparent
  const selectedBg = isLightTheme ? "rgba(255, 180, 0, 0.12)" : "rgba(255, 193, 7, 0.10)";
  const unselectedBg = "transparent";
  const borderColor = isLightTheme ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.15)";
  return (
    <span
      className="filter-chip"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 12px",
        borderRadius: "2px", // Blocky Minecraft style
        fontSize: "14px",
        fontWeight: props.isSelected ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.15s ease",
        backgroundColor: props.isSelected ? selectedBg : unselectedBg,
        color: props.isSelected ? activeColor : inactiveColor,
        border: props.isSelected ? `2px solid ${activeColor}` : `1px solid ${borderColor}`,
      }}
      role="checkbox"
      aria-checked={props.isSelected}
      aria-label={`Filter by warnings${props.value ? `, ${props.value} items` : ""}`}
    >
      <FontAwesomeIcon icon={faCircleQuestion} style={{ fontSize: "14px" }} aria-hidden="true" />
      {!props.isCompact && <span>Warning{props.value ? ` (${props.value})` : ""}</span>}
    </span>
  );
};

export const RecommendationsFilterLabel: React.FC<
  React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelValueProps
> = (props: ISelectableLabelValueProps) => {
  // Theme-aware colors for WCAG AA compliance (4.5:1 contrast ratio minimum)
  const isLightTheme = CreatorToolsHost.theme === CreatorToolsThemeStyle.light;
  const activeColor = isLightTheme ? "#0d4a6f" : "#5dade2"; // Darker blue for light, bright blue for dark
  const inactiveColor = isLightTheme ? "#777777" : "#888888";
  // Subtle background tints — selected gets a light wash, unselected is transparent
  const selectedBg = isLightTheme ? "rgba(52, 152, 219, 0.12)" : "rgba(93, 173, 226, 0.10)";
  const unselectedBg = "transparent";
  const borderColor = isLightTheme ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.15)";
  return (
    <span
      className="filter-chip"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 12px",
        borderRadius: "2px", // Blocky Minecraft style
        fontSize: "14px",
        fontWeight: props.isSelected ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.15s ease",
        backgroundColor: props.isSelected ? selectedBg : unselectedBg,
        color: props.isSelected ? activeColor : inactiveColor,
        border: props.isSelected ? `2px solid ${activeColor}` : `1px solid ${borderColor}`,
      }}
      role="checkbox"
      aria-checked={props.isSelected}
      aria-label={`Filter by recommendations${props.value ? `, ${props.value} items` : ""}`}
    >
      <FontAwesomeIcon icon={faCircleArrowUp} style={{ fontSize: "14px" }} aria-hidden="true" />
      {!props.isCompact && <span>Recommendations{props.value ? ` (${props.value})` : ""}</span>}
    </span>
  );
};

export const ErrorFilterLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelValueProps> = (
  props: ISelectableLabelValueProps
) => {
  // Theme-aware colors for WCAG AA compliance (4.5:1 contrast ratio minimum)
  const isLightTheme = CreatorToolsHost.theme === CreatorToolsThemeStyle.light;
  const activeColor = isLightTheme ? "#922b21" : "#ff6b6b"; // Darker red for light, bright red for dark
  const inactiveColor = isLightTheme ? "#777777" : "#888888";
  // Subtle background tints — selected gets a light wash, unselected is transparent
  const selectedBg = isLightTheme ? "rgba(231, 76, 60, 0.12)" : "rgba(255, 107, 107, 0.10)";
  const unselectedBg = "transparent";
  const borderColor = isLightTheme ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.15)";
  return (
    <span
      className="filter-chip"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 12px",
        borderRadius: "2px", // Blocky Minecraft style
        fontSize: "14px",
        fontWeight: props.isSelected ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.15s ease",
        backgroundColor: props.isSelected ? selectedBg : unselectedBg,
        color: props.isSelected ? activeColor : inactiveColor,
        border: props.isSelected ? `2px solid ${activeColor}` : `1px solid ${borderColor}`,
      }}
      role="checkbox"
      aria-checked={props.isSelected}
      aria-label={`Filter by errors${props.value ? `, ${props.value} items` : ""}`}
    >
      <FontAwesomeIcon icon={faCircleExclamation} style={{ fontSize: "14px" }} aria-hidden="true" />
      {!props.isCompact && <span>Errors{props.value ? ` (${props.value})` : ""}</span>}
    </span>
  );
};

export const InfoFilterLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelValueProps> = (
  props: ISelectableLabelValueProps
) => {
  // Theme-aware colors for WCAG AA compliance (4.5:1 contrast ratio minimum)
  const isLightTheme = CreatorToolsHost.theme === CreatorToolsThemeStyle.light;
  const activeColor = isLightTheme ? "#3d3d3d" : "#bdc3c7"; // Very dark gray for light, light gray for dark
  const inactiveColor = isLightTheme ? "#777777" : "#888888";
  // Subtle background tints — selected gets a light wash, unselected is transparent
  const selectedBg = isLightTheme ? "rgba(127, 140, 141, 0.10)" : "rgba(189, 195, 199, 0.08)";
  const unselectedBg = "transparent";
  const borderColor = isLightTheme ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.15)";
  return (
    <span
      className="filter-chip"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 12px",
        borderRadius: "2px", // Blocky Minecraft style
        fontSize: "14px",
        fontWeight: props.isSelected ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.15s ease",
        backgroundColor: props.isSelected ? selectedBg : unselectedBg,
        color: props.isSelected ? activeColor : inactiveColor,
        border: props.isSelected ? `2px solid ${activeColor}` : `1px solid ${borderColor}`,
      }}
      role="checkbox"
      aria-checked={props.isSelected}
      aria-label={`Filter by info${props.value ? `, ${props.value} items` : ""}`}
    >
      <FontAwesomeIcon icon={faCircleInfo} style={{ fontSize: "14px" }} aria-hidden="true" />
      {!props.isCompact && <span>Info{props.value ? ` (${props.value})` : ""}</span>}
    </span>
  );
};

export const SuccessFilterLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelValueProps> = (
  props: ISelectableLabelValueProps
) => {
  // Theme-aware colors for WCAG AA compliance (4.5:1 contrast ratio minimum)
  const isLightTheme = CreatorToolsHost.theme === CreatorToolsThemeStyle.light;
  const activeColor = isLightTheme ? "#145a32" : "#2ecc71"; // Darker green for light, bright green for dark
  const inactiveColor = isLightTheme ? "#777777" : "#888888";
  // Subtle background tints — selected gets a light wash, unselected is transparent
  const selectedBg = isLightTheme ? "rgba(39, 174, 96, 0.12)" : "rgba(46, 204, 113, 0.10)";
  const unselectedBg = "transparent";
  const borderColor = isLightTheme ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.15)";
  return (
    <span
      className="filter-chip"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 12px",
        borderRadius: "2px", // Blocky Minecraft style
        fontSize: "14px",
        fontWeight: props.isSelected ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.15s ease",
        backgroundColor: props.isSelected ? selectedBg : unselectedBg,
        color: props.isSelected ? activeColor : inactiveColor,
        border: props.isSelected ? `2px solid ${activeColor}` : `1px solid ${borderColor}`,
      }}
      role="checkbox"
      aria-checked={props.isSelected}
      aria-label={`Filter by passed items${props.value ? `, ${props.value} items` : ""}`}
    >
      <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: "14px" }} aria-hidden="true" />
      {!props.isCompact && <span>Passed{props.value ? ` (${props.value})` : ""}</span>}
    </span>
  );
};

export const FailureFilterLabel: React.FC<React.HTMLAttributes<HTMLSpanElement> & ISelectableLabelValueProps> = (
  props: ISelectableLabelValueProps
) => {
  // Theme-aware colors for WCAG AA compliance (4.5:1 contrast ratio minimum)
  const isLightTheme = CreatorToolsHost.theme === CreatorToolsThemeStyle.light;
  const activeColor = isLightTheme ? "#7b241c" : "#ff7675"; // Darker red for light, bright coral for dark
  const inactiveColor = isLightTheme ? "#777777" : "#888888";
  // Subtle background tints — selected gets a light wash, unselected is transparent
  const selectedBg = isLightTheme ? "rgba(192, 57, 43, 0.12)" : "rgba(231, 76, 60, 0.10)";
  const unselectedBg = "transparent";
  const borderColor = isLightTheme ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.15)";
  return (
    <span
      className="filter-chip"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 12px",
        borderRadius: "2px", // Blocky Minecraft style
        fontSize: "14px",
        fontWeight: props.isSelected ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.15s ease",
        backgroundColor: props.isSelected ? selectedBg : unselectedBg,
        color: props.isSelected ? activeColor : inactiveColor,
        border: props.isSelected ? `2px solid ${activeColor}` : `1px solid ${borderColor}`,
      }}
      role="checkbox"
      aria-checked={props.isSelected}
      aria-label={`Filter by failed items${props.value ? `, ${props.value} items` : ""}`}
    >
      <FontAwesomeIcon icon={faCircleXmark} style={{ fontSize: "14px" }} aria-hidden="true" />
      {!props.isCompact && <span>Failed{props.value ? ` (${props.value})` : ""}</span>}
    </span>
  );
};
