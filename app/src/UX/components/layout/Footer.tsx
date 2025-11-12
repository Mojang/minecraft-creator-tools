import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import TextButton from "../../shared/components/inputs/textButton/TextButton";
import useTelemetry from "../../../analytics/useTelemetry";
import { TelemetryEvents, TelemetryProperties } from "../../../analytics/TelemetryConstants";
import { CircularProgress, Theme, useMediaQuery } from "@mui/material";
import { constants } from "../../../core/Constants";
import Utilities from "../../../core/Utilities";
import { useState } from "react";

interface FooterProps {
  isApp?: boolean;
  onSaveBackups: () => Promise<void>;
}

export default function Footer({ isApp, onSaveBackups }: FooterProps) {
  const [exporting, setExporting] = useState(false);
  const fullSized = useMediaQuery((theme: Theme) => theme.breakpoints.up("lg"));

  const domWindow: any = window;
  const { trackEvent } = useTelemetry();

  const onManageConsent = () => {
    domWindow?.manageConsent?.();
  };

  const trackLinkClick = (linkName: string) => {
    trackEvent({
      name: TelemetryEvents.MENU_ITEM_SELECTED,
      properties: {
        [TelemetryProperties.MENU_ITEM]: linkName,
        [TelemetryProperties.LOCATION]: "footer",
      },
    });
  };

  const saveBackup = async () => {
    setExporting(true);
    await onSaveBackups();
    setExporting(false);
  };

  const termsUrl = domWindow?.creatorToolsSite?.termsOfUseUrl;
  const terms = {
    label: termsUrl ? "Terms of use" : "License",
    url: termsUrl || constants.repositoryUrl + "/blob/main/LICENSE.md",
  };

  const privacyUrl = domWindow?.creatorToolsSite?.privacyUrl;
  const showManageCookies =
    domWindow?.manageConsent && domWindow?.siteConsent && domWindow?.siteConsent.isConsentRequired;
  const trademarkUrl = domWindow.creatorToolsSite?.trademarksUrl;
  const storageMessage = isApp
    ? "Projects are saved in <Documents> - Minecraft Creator Tools."
    : "Take care: projects are saved in your device browser's storage.";
  const docsUrl = "https://learn.microsoft.com/minecraft/creator/documents/mctoolsoverview/";
  const githubUrl = constants.repositoryUrl;
  const reportUrl = Utilities.ensureEndsWithSlash(constants.repositoryUrl + "/issues/new");
  const noticeUrl = constants.homeUrl + "/docs/notice.html";

  return (
    <Box
      component="footer"
      sx={{
        py: 0.2,
        px: 1,
        pt: 1,
        pb: 1.2,
        display: "flex",
        borderTop: "1px solid",
        borderColor: "divider",
        alignItems: "start",
        flexDirection: fullSized ? "row" : "column",
        backgroundColor: "primary.main",
        m: "0",
      }}
    >
      <Typography
        fontSize={13}
        variant="body2"
        // there seems to be an issue where the color is overridden by the northstar theme, so we'll set it explicitly
        sx={{ color: (theme) => theme.palette.info.main }}
      >
        <Box
          component="img"
          role="img"
          src="./res/images/icons/info.png"
          alt="Information Icon"
          aria-hidden="true"
          width={15}
          height={15}
          sx={{
            top: 3,
            position: "relative",
            mr: 0.5,
          }}
        />
        {storageMessage}&nbsp;
        <TextButton onClick={saveBackup} sx={{ textDecoration: "underline" }}>
          {exporting ? <CircularProgress size={12} color="inherit" /> : "Save backups"}
        </TextButton>
        &nbsp;|&nbsp;
        <Link href={docsUrl} target="_blank" rel="noreferrer noopener">
          Docs
        </Link>
        &nbsp;|&nbsp;
        <Link href={githubUrl} target="_blank" rel="noreferrer noopener">
          GitHub
        </Link>
        &nbsp;|&nbsp;
        <Link href={reportUrl} target="_blank" rel="noreferrer noopener">
          Report an issue
        </Link>
      </Typography>
      <Box sx={{ ml: "auto" }} />
      <Typography fontSize={13} sx={{ color: (theme) => theme.palette.info.main }}>
        © 2025 Mojang AB&nbsp;|&nbsp;version {constants.version} - early preview&nbsp;|&nbsp;
        <Link href={terms.url} target="_blank" rel="noreferrer noopener">
          {terms.label}
        </Link>
        &nbsp;|&nbsp;
        {privacyUrl && (
          <>
            <Link href={privacyUrl} target="_blank" rel="noreferrer noopener" onClick={() => trackLinkClick("Privacy")}>
              Privacy and Cookies
            </Link>
            &nbsp;|&nbsp;
          </>
        )}
        {showManageCookies && (
          <>
            <TextButton sx={{ textDecoration: "underline" }} onClick={onManageConsent}>
              Manage Cookies
            </TextButton>
            &nbsp;|&nbsp;
          </>
        )}
        {trademarkUrl && (
          <>
            <Link
              href={trademarkUrl}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => trackLinkClick("Trademarks")}
            >
              Trademarks
            </Link>
            &nbsp;|&nbsp;
          </>
        )}
        <Link href={noticeUrl} target="_blank" rel="noreferrer noopener" onClick={() => trackLinkClick("Attribution")}>
          Attribution
        </Link>
      </Typography>
    </Box>
  );
}
