import "./HomeHeader.css";
import { ThemeInput } from "@fluentui/react-northstar";
import { constants } from "../core/Constants";
import TextButton from "./shared/components/inputs/textButton/TextButton";
import { Box } from "@mui/material";

interface IHomeHeaderProps {
  isApp?: boolean;
  toggleThemeMode?: () => void;
  mode?: "light" | "dark";
}

export default function HomeHeader({ isApp, toggleThemeMode, mode }: IHomeHeaderProps) {
  const showModeButton = !isApp && toggleThemeMode && mode;
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
        backgroundImage: mode === "dark" ? "url(./res/images/bg-wool-dark.png)" : "url(./res/images/bg-wool-white.png)",
        color: mode === "light" ? "#000000" : "#FFFFFF",
      }}
    >
      <h1 className="hhdr-image-outer">
        <img src="res/images/mctoolsbanner.png" alt="Minecraft Creator Tools" className="hhdr-image"></img>
      </h1>
      <div
        className="hhdr-sublink"
        style={{
          color: mode === "light" ? "#000000" : "#FFFFFF",
        }}
      >
        <a
          href={"https://learn.microsoft.com/minecraft/creator/documents/mctoolsoverview/"}
          className="hhdr-docsLink"
          target="_blank"
          rel="noreferrer noopener"
          style={{
            color: mode === "light" ? "#000000" : "#FFFFFF",
          }}
        >
          Docs
        </a>
        &#160;&#160;/&#160;&#160;
        <a
          href={"https://www.npmjs.com/package/@minecraft/creator-tools"}
          className="hhdr-docsLink"
          target="_blank"
          rel="noreferrer noopener"
          style={{
            color: mode === "light" ? "#000000" : "#FFFFFF",
          }}
        >
          Command Line
        </a>
        &#160;&#160;/&#160;&#160;
        <a
          href={constants.repositoryUrl}
          target="_blank"
          rel="noreferrer noopener"
          style={{
            color: mode === "light" ? "#000000" : "#FFFFFF",
          }}
        >
          GitHub
        </a>
        {showModeButton && (
          <>
            <span key="lightsp">&nbsp;&nbsp;/&nbsp;&nbsp;</span>
            <TextButton
              sx={{ textDecoration: "underline" }}
              key="lightLink"
              style={{
                color: mode === "light" ? "#000000" : "#FFFFFF",
              }}
              onClick={toggleThemeMode}
            >
              {mode === "light" ? "Dark Mode" : "Light Mode"}
            </TextButton>
          </>
        )}
      </div>
    </Box>
  );
}
