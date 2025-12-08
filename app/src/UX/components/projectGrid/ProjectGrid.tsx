import { Box, Card, CardContent, Grid, Paper, TextField, Typography } from "@mui/material";
import TemplateCard from "./TemplateCard";
import SnippetCard from "./SnippetCard";
import useGallery from "../../hooks/gallery/UseGallery";
import { useState, useEffect } from "react";
import { AppGalleryActionEvent } from "../../pages/home/HomeActions";
import useGalleryActions from "../../hooks/gallery/UseGalleryActions";
import TextButton from "../../shared/components/inputs/textButton/TextButton";
import useTelemetry from "../../../analytics/useTelemetry";
import { mcColors } from "../../hooks/theme/mcColors";

interface ProjectGridProps {
  onAppGalleryAction: AppGalleryActionEvent;
}

export default function ProjectGrid({ onAppGalleryAction }: ProjectGridProps) {
  const [searchQuery, setSearchQuery] = useState<string>();
  const { trackPageView } = useTelemetry();

  const gallery = useGallery({ query: searchQuery, initialSize: 4, pageSize: 20 });
  const [onOpenSnippet, onNewProject] = useGalleryActions(onAppGalleryAction);

  const [templates, snippets, fetchMoreTemplates, fetchMoreSnippets, isMoreTemplates, isMoreSnippets] = gallery;
  const isSearchMode = !!searchQuery;

  useEffect(() => {
    trackPageView({ name: "ProjectGrid" });
  }, [trackPageView]);

  return (
    <>
      <Paper
        sx={(theme) => ({
          p: 2,
          height: "100%",
          borderRadius: 1,
          border: theme.palette.mode === "dark" ? `2px solid ${mcColors.gray5}` : `2px solid ${mcColors.gray2}`,
          background:
            theme.palette.mode === "dark"
              ? `linear-gradient(180deg, ${mcColors.gray5} 0%, ${mcColors.gray6} 100%)`
              : `linear-gradient(180deg, #ffffff 0%, ${mcColors.gray1} 100%)`,
        })}
      >
        <TextField
          label="Search template projects and code snippets"
          variant="outlined"
          aria-label="template search"
          sx={{ mb: 1, color: "#FFFFFF", width: "100%" }}
          onChange={(ev) => setSearchQuery(ev.target.value || undefined)}
        />
        <Typography hidden={isSearchMode} variant="h5" sx={{ position: "relative" }}>
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
            Start from a Template
          </Box>
          <Box
            component="img"
            role="presentation"
            src="./res/images/headers/starttemplate_w.png"
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
        <Typography hidden={isSearchMode} variant="body1" sx={{ mb: 2 }}>
          Choose from a variety of templates to start your new add-on project quickly.
        </Typography>
        <Grid direction="row" container spacing={{ xs: 1, lg: 2 }}>
          {templates.length === 0 ? (
            <Grid item xs={12}>
              <Card variant="outlined" sx={{ minHeight: 12 }}>
                <CardContent>
                  <Typography textAlign="center">No starters found.</Typography>
                </CardContent>
              </Card>
            </Grid>
          ) : (
            templates.map((template, i) => (
              <Grid item key={i} xs={12} sm={6} lg={3}>
                <TemplateCard template={template} onNewProject={onNewProject} />
              </Grid>
            ))
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
                transition: "all 0.15s ease-in-out",
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
              See more templates →
            </Typography>
          </TextButton>
        </Box>
        <Typography hidden={isSearchMode} variant="h5" sx={{ position: "relative" }}>
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
            Explore Snippets
          </Box>
          <Box
            component="img"
            role="presentation"
            src="./res/images/headers/exploresnippets_w.png"
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
          Find code snippets that include the APIs you’re looking to use. Copy and paste them into your project as is or
          use them as a starting point for a broader project.
        </Typography>
        <Grid direction="row" container spacing={{ xs: 1, lg: 2 }}>
          {snippets.length === 0 ? (
            <Grid item xs={12}>
              <Card variant="outlined" sx={{ minHeight: 12 }}>
                <CardContent>
                  <Typography textAlign="center">No snippets found.</Typography>
                </CardContent>
              </Card>
            </Grid>
          ) : (
            snippets.map((snippet, i) => (
              <Grid item key={i} xs={12} sm={6} lg={3}>
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
                transition: "all 0.15s ease-in-out",
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
              See more snippets →
            </Typography>
          </TextButton>
        </Box>
      </Paper>
    </>
  );
}
