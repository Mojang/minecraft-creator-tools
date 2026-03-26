import "./HomeHeader.css";
import { constants } from "../../core/Constants";
import CreatorToolsHost from "../../app/CreatorToolsHost";
import TextButton from "../shared/components/inputs/textButton/TextButton";
import { Box } from "@mui/material";
import { mcColors } from "../hooks/theme/mcColors";
import { useIntl } from "react-intl";

interface IHomeHeaderProps {
  isApp?: boolean;
  toggleThemeMode?: () => void;
  mode?: "light" | "dark";
}

export default function HomeHeader({ isApp, toggleThemeMode, mode }: IHomeHeaderProps) {
  const intl = useIntl();
  const showModeButton = !isApp && toggleThemeMode && mode;
  const isDark = mode === "dark";
  const textColor = isDark ? mcColors.white : mcColors.gray6;

  return (
    <Box
      sx={{
        py: 0.2,
        px: 1,
        pt: 1,
        pb: 1.2,
        height: "96px",
        display: "flex",
        borderTop: "1px solid",
        borderColor: "divider",
        alignItems: "start",
        flexDirection: "row",
        backgroundColor: "primary.main",
        m: "0",
        backgroundImage: isDark ? "url(./res/images/bg-wool-dark.png)" : "url(./res/images/bg-wool-white.png)",
        color: textColor,
      }}
    >
      <h1 className="hhdr-image-outer">
        <img
          src={CreatorToolsHost.contentWebRoot + "res/images/mctoolsbanner.png"}
          alt={intl.formatMessage({ id: "home.header.logo_alt" })}
          className="hhdr-image"
        ></img>
      </h1>
      <div
        className="hhdr-sublink"
        style={{
          color: textColor,
        }}
      >
        <a
          href={"https://learn.microsoft.com/minecraft/creator/"}
          className="hhdr-docsLink"
          target="_blank"
          rel="noreferrer noopener"
          style={{
            color: textColor,
          }}
        >
          {intl.formatMessage({ id: "home.header.docs" })}
        </a>
        &#160;&#160;/&#160;&#160;
        <a
          href={"https://www.npmjs.com/package/@minecraft/creator-tools"}
          className="hhdr-docsLink"
          target="_blank"
          rel="noreferrer noopener"
          style={{
            color: textColor,
          }}
        >
          {intl.formatMessage({ id: "home.header.command_line" })}
        </a>
        &#160;&#160;/&#160;&#160;
        <a
          href={constants.repositoryUrl}
          target="_blank"
          rel="noreferrer noopener"
          style={{
            color: textColor,
          }}
        >
          {intl.formatMessage({ id: "home.header.github" })}
        </a>
        {showModeButton && (
          <>
            <span key="lightsp">&nbsp;&nbsp;/&nbsp;&nbsp;</span>
            <TextButton
              sx={{ textDecoration: "underline" }}
              key="lightLink"
              style={{
                color: textColor,
              }}
              onClick={toggleThemeMode}
            >
              {isDark
                ? intl.formatMessage({ id: "home.header.light_mode" })
                : intl.formatMessage({ id: "home.header.dark_mode" })}
            </TextButton>
          </>
        )}
      </div>
      <div className="hhdr-mobileLinks" style={{ color: textColor }}>
        <a
          href="https://learn.microsoft.com/minecraft/creator/documents/mctoolsoverview/"
          target="_blank"
          rel="noreferrer noopener"
        >
          {intl.formatMessage({ id: "home.header.docs" })}
        </a>
        {showModeButton && (
          <button onClick={toggleThemeMode}>
            {isDark
              ? intl.formatMessage({ id: "home.header.light_mode" })
              : intl.formatMessage({ id: "home.header.dark_mode" })}
          </button>
        )}
      </div>
    </Box>
  );
}
