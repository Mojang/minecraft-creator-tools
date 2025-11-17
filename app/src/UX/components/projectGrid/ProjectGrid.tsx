import { Box, Card, CardContent, Grid, Paper, TextField, Typography } from "@mui/material";
import TemplateCard from "./TemplateCard";
import SnippetCard from "./SnippetCard";
import useGallery from "../../hooks/gallery/UseGallery";
import { useState, useEffect } from "react";
import { AppGalleryActionEvent } from "../../pages/home/HomeActions";
import useGalleryActions from "../../hooks/gallery/UseGalleryActions";
import TextButton from "../../shared/components/inputs/textButton/TextButton";
import useTelemetry from "../../../analytics/useTelemetry";

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
      <Paper sx={{ p: 2, height: "100%" }}>
        <TextField
          label="Search template projects and code snippets"
          variant="outlined"
          aria-label="template search"
          sx={{ mb: 2, color: "#FFFFFF", width: "100%" }}
          onChange={(ev) => setSearchQuery(ev.target.value)}
        />
        <Typography hidden={isSearchMode} variant="h5">
          <Box
            component="img"
            role="img"
            src="./res/images/headers/starttemplate_w.png"
            alt="Information Icon"
            aria-hidden="true"
            sx={{
              maxWidth: "100%",
              mt: 3,
              mr: 0.5,
            }}
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
        <Box marginTop={1} display="flex" justifyContent="flex-end">
          <TextButton hidden={!isMoreTemplates} onClick={fetchMoreTemplates}>
            <Typography color="secondary">See more...</Typography>
          </TextButton>
        </Box>
        <Typography hidden={isSearchMode} variant="h5">
          <Box
            component="img"
            role="img"
            src="./res/images/headers/exploresnippets_w.png"
            alt="Information Icon"
            aria-hidden="true"
            sx={{
              maxWidth: "100%",
              top: 3,
              position: "relative",
              mt: 3,
              mb: 0.1,
              mr: 0.5,
            }}
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
        <Box marginTop={1} display="flex" justifyContent="flex-end">
          <TextButton color="secondary" hidden={!isMoreSnippets} onClick={fetchMoreSnippets}>
            <Typography color="secondary">See more...</Typography>
          </TextButton>
        </Box>
      </Paper>
    </>
  );
}
