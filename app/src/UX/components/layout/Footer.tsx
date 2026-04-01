import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import TextButton from "../../shared/components/inputs/textButton/TextButton";
import useTelemetry from "../../../analytics/useTelemetry";
import { TelemetryEvents, TelemetryProperties } from "../../../analytics/TelemetryConstants";
import { CircularProgress, Theme, useMediaQuery } from "@mui/material";
import { constants } from "../../../core/Constants";
import Utilities from "../../../core/Utilities";
import CreatorToolsHost from "../../../app/CreatorToolsHost";
import { useState } from "react";
import { useIntl } from "react-intl";

interface FooterProps {
  isApp?: boolean;
  onSaveBackups: () => Promise<void>;
}

export default function Footer({ isApp, onSaveBackups }: FooterProps) {
  const [exporting, setExporting] = useState(false);
  const fullSized = useMediaQuery((theme: Theme) => theme.breakpoints.up("lg"));
  const intl = useIntl();

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
    label: termsUrl
      ? intl.formatMessage({ id: "home.footer.terms_of_use" })
      : intl.formatMessage({ id: "home.footer.license" }),
    url: termsUrl || constants.repositoryUrl + "/blob/main/LICENSE.md",
  };

  const privacyUrl = domWindow?.creatorToolsSite?.privacyUrl;
  const showManageCookies =
    domWindow?.manageConsent && domWindow?.siteConsent && domWindow?.siteConsent.isConsentRequired;
  const trademarkUrl = domWindow.creatorToolsSite?.trademarksUrl;
  // Only show browser storage warning when the Web File System API is NOT available,
  // meaning the user is genuinely limited to browser-only storage.
  const isBrowserOnly = !isApp && typeof (window as any).showDirectoryPicker !== "function";
  const storageMessage = isBrowserOnly
    ? intl.formatMessage({ id: "home.footer.storage_message_browser" })
    : isApp
      ? intl.formatMessage({ id: "home.footer.storage_message_app" })
      : "";
  const docsUrl = "https://learn.microsoft.com/minecraft/creator/documents/mctoolsoverview/";
  const githubUrl = constants.repositoryUrl;
  const reportUrl = Utilities.ensureEndsWithSlash(constants.repositoryUrl + "/issues/new");
  const noticeUrl = constants.homeUrl + "/docs/notice.html";

  return (
    <Box
      component="footer"
      sx={(theme) => {
        const isDark = theme.palette.mode === "dark";
        return {
          py: 0.2,
          px: 1,
          pt: 1,
          pb: 1.2,
          display: "flex",
          borderTop: `1px solid ${theme.palette.divider}`,
          alignItems: "start",
          flexDirection: fullSized ? "row" : "column",
          backgroundColor: isDark ? theme.palette.background.default : theme.palette.background.default,
          m: "0",
        };
      }}
    >
      <Typography
        fontSize={13}
        variant="body2"
        sx={(theme) => {
          return {
            color: theme.palette.info.main,
            "& a": {
              color: theme.palette.info.main,
              textDecoration: "underline",
              "&:hover": {
                color: theme.palette.text.secondary,
              },
            },
          };
        }}
      >
        <Box
          component="img"
          role="img"
          src={CreatorToolsHost.contentWebRoot + "res/images/icons/info.png"}
          alt={intl.formatMessage({ id: "home.footer.info_icon_alt" })}
          aria-hidden="true"
          width={15}
          height={15}
          sx={(theme) => ({
            top: 3,
            position: "relative",
            mr: 0.5,
            filter: theme.palette.mode === "dark" ? "none" : "invert(1)",
          })}
        />
        {storageMessage && <>{storageMessage}&nbsp;</>}
        <TextButton onClick={saveBackup} sx={{ textDecoration: "underline" }}>
          {exporting ? (
            <CircularProgress size={12} color="inherit" />
          ) : (
            intl.formatMessage({ id: "home.footer.save_backups" })
          )}
        </TextButton>
        &nbsp;|&nbsp;
        <Link href={docsUrl} target="_blank" rel="noreferrer noopener">
          {intl.formatMessage({ id: "home.footer.docs" })}
        </Link>
        &nbsp;|&nbsp;
        <Link href={githubUrl} target="_blank" rel="noreferrer noopener">
          {intl.formatMessage({ id: "home.footer.github" })}
        </Link>
        &nbsp;|&nbsp;
        <Link href={reportUrl} target="_blank" rel="noreferrer noopener">
          {intl.formatMessage({ id: "home.footer.report_issue" })}
        </Link>
      </Typography>
      <Box sx={{ ml: "auto" }} />
      <Typography
        fontSize={13}
        sx={(theme) => {
          return {
            color: theme.palette.info.main,
            "& a": {
              color: theme.palette.info.main,
              textDecoration: "underline",
              "&:hover": {
                color: theme.palette.text.secondary,
              },
            },
          };
        }}
      >
        {intl.formatMessage({ id: "home.footer.copyright" })}&nbsp;|&nbsp;
        {intl.formatMessage({ id: "home.footer.version" }, { version: constants.version })}&nbsp;|&nbsp;
        <Link href={terms.url} target="_blank" rel="noreferrer noopener" onClick={() => trackLinkClick(terms.label)}>
          {terms.label}
        </Link>
        &nbsp;|&nbsp;
        {privacyUrl && (
          <>
            <Link href={privacyUrl} target="_blank" rel="noreferrer noopener" onClick={() => trackLinkClick("Privacy")}>
              {intl.formatMessage({ id: "home.footer.privacy" })}
            </Link>
            &nbsp;|&nbsp;
          </>
        )}
        {showManageCookies && (
          <>
            <TextButton sx={{ textDecoration: "underline" }} onClick={onManageConsent}>
              {intl.formatMessage({ id: "home.footer.manage_cookies" })}
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
              {intl.formatMessage({ id: "home.footer.trademarks" })}
            </Link>
            &nbsp;|&nbsp;
          </>
        )}
        <Link href={noticeUrl} target="_blank" rel="noreferrer noopener" onClick={() => trackLinkClick("Attribution")}>
          {intl.formatMessage({ id: "home.footer.attribution" })}
        </Link>
      </Typography>
    </Box>
  );
}
