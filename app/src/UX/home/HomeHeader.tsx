import "./HomeHeader.css";
import { constants } from "../../core/Constants";
import CreatorToolsHost from "../../app/CreatorToolsHost";
import { Box, IconButton, Tooltip } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSun, faMoon } from "@fortawesome/free-solid-svg-icons";
import { mcColors } from "../hooks/theme/mcColors";
import { useIntl } from "react-intl";

/** Placeholder background matching the dominant color of the banner image (bg-wool-*.png),
 *  so the header doesn't flash a different color before the image loads. */
const BANNER_PLACEHOLDER_COLOR = "#6C748B";

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
        backgroundColor: BANNER_PLACEHOLDER_COLOR,
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
          style={{
            // The banner PNG is white pixel-art letters with thin black outlines on a
            // transparent background — designed for dark wool. On the light wool
            // backdrop this produces a low-contrast title (white-on-light-grey, well
            // below 4.5:1). Inverting in light mode flips the white fill to black
            // and the black outline to white, restoring 4.5:1+ contrast against the
            // light texture without requiring a separate light-mode asset.
            filter: isDark ? "none" : "invert(1)",
          }}
          onError={(e) => {
            // currentTarget can be null if the <img> was unmounted before the
            // browser dispatched the error event (e.g. user navigated away
            // while the banner was still loading).
            const target = e.currentTarget;
            if (!target) {
              return;
            }
            target.style.display = "none";
            if (target.parentElement) {
              target.parentElement.textContent = "Minecraft Creator Tools";
              target.parentElement.style.fontSize = "20px";
              target.parentElement.style.fontWeight = "700";
            }
          }}
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
          {intl.formatMessage({ id: "common.docs" })}
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
          {intl.formatMessage({ id: "common.github" })}
        </a>
        {showModeButton && (
          <>
            <span key="lightsp">&nbsp;&nbsp;/&nbsp;&nbsp;</span>
            <Tooltip
              title={
                isDark
                  ? intl.formatMessage({ id: "home.header.light_mode" })
                  : intl.formatMessage({ id: "home.header.dark_mode" })
              }
            >
              <IconButton
                key="themeToggle"
                onClick={toggleThemeMode}
                aria-label={
                  isDark
                    ? intl.formatMessage({ id: "home.header.light_mode" })
                    : intl.formatMessage({ id: "home.header.dark_mode" })
                }
                aria-pressed={isDark}
                size="small"
                sx={{
                  color: textColor,
                  border: `1px solid ${isDark ? mcColors.gray3 : mcColors.gray4}`,
                  borderRadius: 1,
                  width: 32,
                  height: 32,
                  ml: 0.5,
                  verticalAlign: "middle",
                  "&:hover": {
                    backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                  },
                  "&:focus-visible": {
                    outline: `2px solid ${mcColors.green4}`,
                    outlineOffset: 2,
                  },
                }}
              >
                <FontAwesomeIcon icon={isDark ? faSun : faMoon} style={{ fontSize: "14px" }} />
              </IconButton>
            </Tooltip>
          </>
        )}
      </div>
      <div className="hhdr-mobileLinks" style={{ color: textColor }}>
        <a
          href="https://learn.microsoft.com/minecraft/creator/documents/mctoolsoverview/"
          target="_blank"
          rel="noreferrer noopener"
        >
          {intl.formatMessage({ id: "common.docs" })}
        </a>
        {showModeButton && (
          <IconButton
            onClick={toggleThemeMode}
            aria-label={
              isDark
                ? intl.formatMessage({ id: "home.header.light_mode" })
                : intl.formatMessage({ id: "home.header.dark_mode" })
            }
            aria-pressed={isDark}
            size="small"
            sx={{ color: textColor, minWidth: 44, minHeight: 44 }}
          >
            <FontAwesomeIcon icon={isDark ? faSun : faMoon} />
          </IconButton>
        )}
      </div>
    </Box>
  );
}
