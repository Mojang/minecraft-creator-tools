import { Box, Button, Card, CardContent, Collapse, Grid, Paper, Typography } from "@mui/material";
import TemplateCard from "./TemplateCard";
import SnippetCard from "./SnippetCard";
import CommandBar from "../../components/commandBar/CommandBar";
import useGallery from "../../hooks/gallery/UseGallery";
import { useState, useEffect, useCallback } from "react";
import { AppGalleryActionEvent } from "../HomeActions";
import useGalleryActions from "../../hooks/gallery/UseGalleryActions";
import TextButton from "../../shared/components/inputs/textButton/TextButton";
import useTelemetry from "../../../analytics/useTelemetry";
import { mcColors } from "../../hooks/theme/mcColors";
import { useIntl } from "react-intl";
import CreatorToolsHost from "../../../app/CreatorToolsHost";
import { useCreatorTools } from "../../contexts/creatorToolsContext/CreatorToolsContext";
import type Project from "../../../app/Project";
import GettingStartedBanner from "./GettingStartedBanner";
import AddOnOverview from "./AddOnOverview";
import { PostCreateAction } from "../../../app/IProjectSeed";
import GoalWizardDialog from "./GoalWizardDialog";

interface ProjectGridProps {
  onAppGalleryAction: AppGalleryActionEvent;
  onSetProject?: (project: Project) => void;
  /** Called after a command executes that may have modified the project list. */
  onProjectsChanged?: () => void;
}

export default function ProjectGrid({ onAppGalleryAction, onSetProject, onProjectsChanged }: ProjectGridProps) {
  const [searchQuery, setSearchQuery] = useState<string>();
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const { trackPageView } = useTelemetry();
  const intl = useIntl();

  const gallery = useGallery({ query: searchQuery, initialSize: 8, pageSize: 20 });
  const [onOpenSnippet, onNewProject] = useGalleryActions(onAppGalleryAction);
  const [creatorTools, creatorToolsLoading] = useCreatorTools();
  const [isRefreshingTemplates, setIsRefreshingTemplates] = useState(false);
  const [showGettingStarted, setShowGettingStarted] = useState(!creatorTools.disableFirstRun);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [goalDialogMounted, setGoalDialogMounted] = useState(false);
  const [pendingGoalAction, setPendingGoalAction] = useState<PostCreateAction | undefined>();

  const [
    templates,
    snippets,
    fetchMoreTemplates,
    fetchMoreSnippets,
    isMoreTemplates,
    isMoreSnippets,
    refreshGallery,
    galleryData,
  ] = gallery;
  const isSearchMode = !!searchQuery;
  const isAdvancedExpanded = isSearchMode || showAdvancedTools;

  // Re-evaluate the banner once creatorTools finishes loading persisted settings.
  // The initial useState may read disableFirstRun before data is available.
  useEffect(() => {
    if (!creatorToolsLoading && creatorTools.disableFirstRun) {
      setShowGettingStarted(false);
    }
  }, [creatorToolsLoading, creatorTools.disableFirstRun]);

  useEffect(() => {
    trackPageView({ name: "ProjectGrid" });
  }, [trackPageView]);

  const handleRefreshTemplates = async () => {
    setIsRefreshingTemplates(true);
    try {
      await refreshGallery();
    } finally {
      setIsRefreshingTemplates(false);
    }
  };

  const handleUseOfflineTemplates = async () => {
    creatorTools.contentRoot = CreatorToolsHost.contentWebRoot || "";
    await handleRefreshTemplates();
  };

  const handleGoalSelected = useCallback((action: PostCreateAction) => {
    setPendingGoalAction(action);
    setGoalDialogMounted(true);
    setGoalDialogOpen(true);
  }, []);

  const handleGoalDialogClose = useCallback(() => {
    setGoalDialogOpen(false);
    setTimeout(() => setGoalDialogMounted(false), 300);
  }, []);

  // Find the addonStarter template for goal-based creation
  const addonStarterTemplate = galleryData?.items.find((item) => item.id === "addonStarter");

  return (
    <>
      {goalDialogMounted && addonStarterTemplate && pendingGoalAction && (
        <GoalWizardDialog
          goalAction={pendingGoalAction}
          addonStarterTemplate={addonStarterTemplate}
          open={goalDialogOpen}
          close={handleGoalDialogClose}
          onNewProject={onNewProject}
        />
      )}
      <Paper
        sx={(theme) => ({
          p: { xs: 2, md: 3, lg: 4 },
          height: "100%",
          borderRadius: 1,
          border: theme.palette.mode === "dark" ? `2px solid ${mcColors.gray5}` : `2px solid ${mcColors.gray2}`,
          background:
            theme.palette.mode === "dark"
              ? `linear-gradient(180deg, ${mcColors.gray5} 0%, ${mcColors.gray6} 100%)`
              : `linear-gradient(180deg, #ffffff 0%, ${mcColors.gray1} 100%)`,
        })}
      >
        {!isSearchMode && <AddOnOverview />}
        {showGettingStarted && !isSearchMode && <GettingStartedBanner onGoalSelected={handleGoalSelected} />}
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="caption"
            sx={(theme) => ({
              display: "block",
              mb: 1,
              color: theme.palette.text.secondary,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              fontWeight: 600,
            })}
          >
            {intl.formatMessage({ id: "home.project_grid.search_label" })}
          </Typography>
          <CommandBar
            onSearchQueryChange={setSearchQuery}
            onSetProject={onSetProject}
            onProjectsChanged={onProjectsChanged}
          />
        </Box>
        <Typography hidden={isSearchMode} variant="h5" component="h2" sx={{ position: "relative" }}>
          <Box
            component="span"
            sx={{
              position: "absolute",
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: "hidden",
              clip: "rect(0, 0, 0, 0)",
              whiteSpace: "nowrap",
              border: 0,
            }}
          >
            {intl.formatMessage({ id: "home.project_grid.start_template_alt" })}
          </Box>
          <Box
            component="img"
            role="presentation"
            src={CreatorToolsHost.contentWebRoot + "res/images/headers/starttemplate_w.png"}
            alt=""
            aria-hidden="true"
            sx={(theme) => ({
              maxWidth: "100%",
              mt: 3,
              mr: 0.5,
              filter: theme.palette.mode === "light" ? "invert(1)" : "none",
            })}
          />
        </Typography>
        <Typography hidden={isSearchMode} variant="body1" sx={{ mb: 3 }}>
          {intl.formatMessage({ id: "home.project_grid.starters_description" })}
        </Typography>
        <Grid direction="row" container spacing={{ xs: 2, md: 2.5, lg: 3 }}>
          {templates.length === 0 ? (
            <Grid item xs={12}>
              <Card variant="outlined" sx={{ minHeight: 12 }}>
                <CardContent>
                  <Typography textAlign="center" sx={{ fontWeight: 600 }}>
                    {intl.formatMessage({ id: "home.project_grid.templates_load_error" })}
                  </Typography>
                  <Typography
                    textAlign="center"
                    variant="body2"
                    sx={(theme) => ({ mt: 1, mb: 2, color: theme.palette.text.secondary })}
                  >
                    {intl.formatMessage({ id: "home.project_grid.templates_offline_message" })}
                  </Typography>
                  <Box display="flex" justifyContent="center" gap={1.5} flexWrap="wrap">
                    <Button
                      variant="contained"
                      onClick={handleRefreshTemplates}
                      disabled={isRefreshingTemplates}
                      size="small"
                    >
                      {isRefreshingTemplates
                        ? intl.formatMessage({ id: "home.project_grid.refreshing_templates" })
                        : intl.formatMessage({ id: "home.project_grid.refresh_templates" })}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={handleUseOfflineTemplates}
                      disabled={isRefreshingTemplates}
                      size="small"
                    >
                      {intl.formatMessage({ id: "home.project_grid.use_offline_templates" })}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ) : (
            (() => {
              // Group templates into "Starter" vs "More". Prefer the `difficulty`
              // metadata when set; otherwise fall back to a simple first-4 split.
              const hasDifficulty = templates.some((t) => !!t.difficulty);
              const starterTemplates = hasDifficulty
                ? templates.filter((t) => !t.difficulty || t.difficulty === "beginner")
                : templates.slice(0, 4);
              const moreTemplates = hasDifficulty
                ? templates.filter((t) => t.difficulty && t.difficulty !== "beginner")
                : templates.slice(4);

              const renderSection = (sectionTemplates: typeof templates, headingKey: string, keyPrefix: string) =>
                sectionTemplates.length === 0 ? null : (
                  <>
                    <Grid item xs={12} key={`${keyPrefix}-heading`}>
                      <Typography
                        variant="overline"
                        component="h3"
                        sx={(theme) => ({
                          mt: keyPrefix === "starter" ? 0 : 1,
                          mb: 0.5,
                          color: theme.palette.text.secondary,
                          fontWeight: 700,
                          letterSpacing: "0.5px",
                        })}
                      >
                        {intl.formatMessage({ id: headingKey })}
                      </Typography>
                    </Grid>
                    {sectionTemplates.map((template, i) => (
                      <Grid item key={`${keyPrefix}-${i}`} xs={12} sm={6} lg={3}>
                        <TemplateCard template={template} onNewProject={onNewProject} />
                      </Grid>
                    ))}
                  </>
                );

              return (
                <>
                  {renderSection(starterTemplates, "home.project_grid.section_starter", "starter")}
                  {renderSection(moreTemplates, "home.project_grid.section_more", "more")}
                </>
              );
            })()
          )}
        </Grid>
        <Box marginTop={2} display="flex" justifyContent="flex-end">
          <TextButton
            hidden={!isMoreTemplates}
            onClick={fetchMoreTemplates}
            sx={(theme) => {
              const isDark = theme.palette.mode === "dark";
              return {
                px: 2,
                py: 0.75,
                borderRadius: 0,
                border: isDark ? `2px solid ${mcColors.green4}4d` : `2px solid ${mcColors.green5}4d`,
                bgcolor: isDark ? `${mcColors.green4}1a` : `${mcColors.green4}1a`,
                transition: "none",
                "@media (prefers-reduced-motion: no-preference)": {
                  transition: "all 0.15s ease-in-out",
                },
                "&:hover": {
                  bgcolor: isDark ? `${mcColors.green4}33` : `${mcColors.green4}33`,
                  borderColor: isDark ? mcColors.green4 : mcColors.green5,
                  transform: "translateX(4px)",
                },
              };
            }}
          >
            <Typography
              sx={(theme) => ({
                fontWeight: 600,
                color: theme.palette.mode === "dark" ? mcColors.green2 : mcColors.green5,
              })}
            >
              {intl.formatMessage({ id: "home.project_grid.see_more_templates" })}
            </Typography>
          </TextButton>
        </Box>
        <Box
          sx={(theme) => ({
            mt: 4,
            pt: 3,
            borderTop: `1px solid ${theme.palette.mode === "dark" ? mcColors.gray5 : mcColors.gray2}`,
          })}
        >
          {!isSearchMode && (
            <Button
              variant="outlined"
              color="secondary"
              size="small"
              onClick={() => setShowAdvancedTools((value) => !value)}
              sx={{ mt: 2 }}
            >
              {intl.formatMessage({
                id: isAdvancedExpanded
                  ? "home.project_grid.hide_advanced_tools"
                  : "home.project_grid.show_advanced_tools",
              })}
            </Button>
          )}
          <Collapse in={isAdvancedExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ mt: 2.5 }}></Box>
            <Typography hidden={isSearchMode} variant="h5" component="h2" sx={{ position: "relative" }}>
              <Box
                component="span"
                sx={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: "hidden",
                  clip: "rect(0, 0, 0, 0)",
                  whiteSpace: "nowrap",
                  border: 0,
                }}
              >
                {intl.formatMessage({ id: "home.project_grid.explore_snippets_alt" })}
              </Box>
              <Box
                component="img"
                role="presentation"
                src={CreatorToolsHost.contentWebRoot + "res/images/headers/exploresnippets_w.png"}
                alt=""
                aria-hidden="true"
                sx={(theme) => ({
                  maxWidth: "100%",
                  top: 3,
                  position: "relative",
                  mt: 3,
                  mb: 0.1,
                  mr: 0.5,
                  filter: theme.palette.mode === "light" ? "invert(1)" : "none",
                })}
              />
            </Typography>
            <Typography hidden={isSearchMode} variant="body1" sx={{ mb: 2 }}>
              {intl.formatMessage({ id: "home.project_grid.snippets_description" })}
            </Typography>
            <Grid direction="row" container spacing={{ xs: 1, lg: 2 }}>
              {snippets.length === 0 ? (
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ minHeight: 12 }}>
                    <CardContent>
                      <Typography textAlign="center">
                        {intl.formatMessage({ id: "home.project_grid.no_snippets" })}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ) : (
                snippets.map((snippet) => (
                  <Grid item key={snippet.id} xs={12} sm={6} lg={3}>
                    <SnippetCard snippet={snippet} onOpen={onOpenSnippet} />
                  </Grid>
                ))
              )}
            </Grid>
            <Box marginTop={2} display="flex" justifyContent="flex-end">
              <TextButton
                color="secondary"
                hidden={!isMoreSnippets}
                onClick={fetchMoreSnippets}
                sx={(theme) => {
                  const isDark = theme.palette.mode === "dark";
                  return {
                    px: 2,
                    py: 0.75,
                    borderRadius: 0,
                    border: isDark ? `2px solid ${mcColors.stoneLight}4d` : `2px solid ${mcColors.stone}4d`,
                    bgcolor: isDark ? `${mcColors.stone}33` : `${mcColors.stone}1a`,
                    transition: "none",
                    "@media (prefers-reduced-motion: no-preference)": {
                      transition: "all 0.15s ease-in-out",
                    },
                    "&:hover": {
                      bgcolor: isDark ? `${mcColors.stone}66` : `${mcColors.stone}33`,
                      borderColor: isDark ? mcColors.stoneLight : mcColors.stone,
                      transform: "translateX(4px)",
                    },
                  };
                }}
              >
                <Typography
                  sx={(theme) => ({
                    fontWeight: 600,
                    color: theme.palette.mode === "dark" ? mcColors.stoneLight : mcColors.stoneDark,
                  })}
                >
                  {intl.formatMessage({ id: "home.project_grid.see_more_snippets" })}
                </Typography>
              </TextButton>
            </Box>
          </Collapse>
        </Box>
      </Paper>
    </>
  );
}
