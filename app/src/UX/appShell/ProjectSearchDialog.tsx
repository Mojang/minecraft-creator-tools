/**
 * ProjectSearchDialog.tsx
 *
 * Project-wide text search dialog (Ctrl+Shift+F).
 * Searches across all text-based project items and displays results
 * with file name, line number, and matching text preview.
 * Clicking a result navigates to the file and highlights the match.
 */

import { Component, createRef } from "react";
import {
  Dialog,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  InputAdornment,
  IconButton,
} from "@mui/material";
import Project from "../../app/Project";
import ProjectItem from "../../app/ProjectItem";
import StorageUtilities from "../../storage/StorageUtilities";
import { IContentIndex } from "../../core/ContentIndex";

export interface ISearchResult {
  item: ProjectItem;
  line: number;
  column: number;
  lineText: string;
  matchStart: number;
  matchEnd: number;
}

interface IProjectSearchDialogProps {
  project: Project;
  contentIndex?: IContentIndex;
  onResultSelected: (item: ProjectItem, line: number, column: number) => void;
  onClose: () => void;
}

interface IProjectSearchDialogState {
  query: string;
  replaceText: string;
  showReplace: boolean;
  results: ISearchResult[];
  selectedIndex: number;
  isSearching: boolean;
  caseSensitive: boolean;
  useRegex: boolean;
  totalFilesSearched: number;
  replacedCount: number;
  showOptions: boolean;
  liveRegionText: string;
  regexError?: string;
}

const MAX_RESULTS = 200;
const SEARCH_DEBOUNCE_MS = 200;
const LIVE_REGION_DEBOUNCE_MS = 300;

export default class ProjectSearchDialog extends Component<IProjectSearchDialogProps, IProjectSearchDialogState> {
  private _inputRef = createRef<HTMLInputElement>();
  private _searchTimer: ReturnType<typeof setTimeout> | null = null;
  private _liveRegionTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: IProjectSearchDialogProps) {
    super(props);
    const showOptions = localStorage.getItem("mct.searchDialog.showOptions") === "true";
    this.state = {
      query: "",
      replaceText: "",
      showReplace: false,
      results: [],
      selectedIndex: 0,
      isSearching: false,
      caseSensitive: false,
      useRegex: false,
      totalFilesSearched: 0,
      replacedCount: 0,
      showOptions,
      liveRegionText: "",
      regexError: undefined,
    };
    this._handleQueryChange = this._handleQueryChange.bind(this);
    this._handleReplaceTextChange = this._handleReplaceTextChange.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._toggleCaseSensitive = this._toggleCaseSensitive.bind(this);
    this._toggleRegex = this._toggleRegex.bind(this);
    this._toggleReplace = this._toggleReplace.bind(this);
    this._handleReplaceOne = this._handleReplaceOne.bind(this);
    this._handleReplaceAll = this._handleReplaceAll.bind(this);
    this._toggleOptions = this._toggleOptions.bind(this);
    this._clearQuery = this._clearQuery.bind(this);
  }

  componentDidMount() {
    setTimeout(() => this._inputRef.current?.focus(), 100);
  }

  componentDidUpdate(prevProps: IProjectSearchDialogProps, prevState: IProjectSearchDialogState) {
    // Clamp selectedIndex when results change to prevent stale selection
    if (prevState.results !== this.state.results) {
      const newIndex =
        this.state.results.length === 0 ? 0 : Math.min(this.state.selectedIndex, this.state.results.length - 1);
      if (newIndex !== this.state.selectedIndex) {
        this.setState({ selectedIndex: newIndex });
      }

      // Update live region for screen readers
      if (this._liveRegionTimer) {
        clearTimeout(this._liveRegionTimer);
      }
      this._liveRegionTimer = setTimeout(() => {
        const count = this.state.results.length;
        const text = count === 0 ? "No results" : `${count}${count >= MAX_RESULTS ? " or more" : ""} results`;
        this.setState({ liveRegionText: text });
      }, LIVE_REGION_DEBOUNCE_MS);
    }
  }

  componentWillUnmount() {
    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
    }
    if (this._liveRegionTimer) {
      clearTimeout(this._liveRegionTimer);
    }
  }

  _handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const query = e.target.value;
    this.setState({ query, selectedIndex: 0 });

    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
    }

    if (query.length < 2) {
      this.setState({ results: [], totalFilesSearched: 0 });
      return;
    }

    this._searchTimer = setTimeout(() => {
      this._performSearch(query);
    }, SEARCH_DEBOUNCE_MS);
  }

  _handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      // First Escape clears query if non-empty, second Escape closes dialog
      if (this.state.query.length > 0) {
        e.preventDefault();
        this._clearQuery();
      } else {
        this.props.onClose();
      }
      return;
    }

    const results = this.state.results;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.setState((prev) => ({
        selectedIndex: Math.min(prev.selectedIndex + 1, results.length - 1),
      }));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.setState((prev) => ({
        selectedIndex: Math.max(prev.selectedIndex - 1, 0),
      }));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = results[this.state.selectedIndex];
      if (selected) {
        this.props.onResultSelected(selected.item, selected.line, selected.column);
      }
    }
  }

  _toggleCaseSensitive() {
    this.setState(
      (prev) => ({ caseSensitive: !prev.caseSensitive }),
      () => {
        if (this.state.query.length >= 2) {
          this._performSearch(this.state.query);
        }
      }
    );
  }

  _toggleRegex() {
    this.setState(
      (prev) => ({ useRegex: !prev.useRegex }),
      () => {
        if (this.state.query.length >= 2) {
          this._performSearch(this.state.query);
        }
      }
    );
  }

  _handleReplaceTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ replaceText: e.target.value });
  }

  _toggleReplace() {
    this.setState((prev) => ({ showReplace: !prev.showReplace }));
  }

  _toggleOptions() {
    this.setState(
      (prev) => ({ showOptions: !prev.showOptions }),
      () => {
        localStorage.setItem("mct.searchDialog.showOptions", this.state.showOptions.toString());
      }
    );
  }

  _clearQuery() {
    this.setState({ query: "", results: [], selectedIndex: 0, totalFilesSearched: 0 });
    this._inputRef.current?.focus();
  }

  async _handleReplaceOne() {
    const result = this.state.results[this.state.selectedIndex];
    if (!result) return;

    const content = await result.item.getStringContent();
    if (!content) return;

    const lines = content.split("\n");
    const lineIdx = result.line - 1;
    if (lineIdx < 0 || lineIdx >= lines.length) return;

    const line = lines[lineIdx];
    const before = line.substring(0, result.matchStart);
    const after = line.substring(result.matchEnd);
    lines[lineIdx] = before + this.state.replaceText + after;

    const newContent = lines.join("\n");
    const pf = result.item.primaryFile;
    if (pf) {
      pf.setContent(newContent);
    }

    // Re-search to update results
    this.setState((prev) => ({ replacedCount: prev.replacedCount + 1 }));
    await this._performSearch(this.state.query);
  }

  async _handleReplaceAll() {
    const { query, replaceText, caseSensitive, useRegex } = this.state;
    if (!query || query.length < 2) return;

    let replacedTotal = 0;
    const processedItems = new Set<ProjectItem>();

    for (const result of this.state.results) {
      if (processedItems.has(result.item)) continue;
      processedItems.add(result.item);

      const content = await result.item.getStringContent();
      if (!content) continue;

      let newContent: string;
      if (useRegex) {
        try {
          const regex = new RegExp(query, caseSensitive ? "g" : "gi");
          const matches = content.match(regex);
          replacedTotal += matches ? matches.length : 0;
          newContent = content.replace(regex, replaceText);
        } catch {
          continue;
        }
      } else {
        const flags = caseSensitive ? "g" : "gi";
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escapedQuery, flags);
        const matches = content.match(regex);
        replacedTotal += matches ? matches.length : 0;
        newContent = content.replace(regex, replaceText);
      }

      const pf = result.item.primaryFile;
      if (pf) {
        pf.setContent(newContent);
      }
    }

    this.setState((prev) => ({ replacedCount: prev.replacedCount + replacedTotal }));
    await this._performSearch(this.state.query);
  }

  async _performSearch(query: string) {
    this.setState({ isSearching: true });

    const results: ISearchResult[] = [];
    let filesSearched = 0;

    let regex: RegExp | null = null;
    if (this.state.useRegex) {
      try {
        regex = new RegExp(query, this.state.caseSensitive ? "g" : "gi");
        // Clear any previous regex error on success
        if (this.state.regexError) {
          this.setState({ regexError: undefined });
        }
      } catch (err: any) {
        // Invalid regex — show error and no results
        this.setState({ 
          results: [], 
          isSearching: false, 
          totalFilesSearched: 0,
          regexError: err.message 
        });
        return;
      }
    } else {
      // Clear regex error when not in regex mode
      if (this.state.regexError) {
        this.setState({ regexError: undefined });
      }
    }

    const items = this.props.project.items;

    // Use ContentIndex to prioritize candidate items when available
    let prioritizedPaths: Set<string> | undefined;
    if (this.props.contentIndex && query.length >= 3 && !this.state.useRegex) {
      try {
        const indexMatches = await this.props.contentIndex.getMatches(query);
        if (indexMatches && indexMatches.length > 0) {
          prioritizedPaths = new Set(indexMatches.map((m) => m.value));
        }
      } catch {
        // Fall back to full scan on index error
      }
    }

    // Search prioritized items first, then remaining items
    const prioritizedItems: ProjectItem[] = [];
    const remainingItems: ProjectItem[] = [];
    for (const item of items) {
      if (!item.projectPath) continue;
      if (prioritizedPaths && prioritizedPaths.has(item.projectPath)) {
        prioritizedItems.push(item);
      } else {
        remainingItems.push(item);
      }
    }
    const orderedItems = prioritizedPaths ? [...prioritizedItems, ...remainingItems] : items;

    for (const item of orderedItems) {
      if (results.length >= MAX_RESULTS) break;
      if (!item.projectPath) continue;

      // Only search text-based files
      const ext = StorageUtilities.getTypeFromName(item.projectPath);
      if (!this._isTextFile(ext)) continue;

      try {
        const content = await item.getStringContent();
        if (!content) continue;

        filesSearched++;
        const lines = content.split("\n");

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          if (results.length >= MAX_RESULTS) break;

          const line = lines[lineIdx];

          if (regex) {
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(line)) !== null) {
              if (results.length >= MAX_RESULTS) break;
              results.push({
                item,
                line: lineIdx + 1,
                column: match.index + 1,
                lineText: line.trim(),
                matchStart: match.index,
                matchEnd: match.index + match[0].length,
              });
            }
          } else {
            const searchLine = this.state.caseSensitive ? line : line.toLowerCase();
            const searchQuery = this.state.caseSensitive ? query : query.toLowerCase();
            let startPos = 0;

            while (startPos < searchLine.length) {
              const idx = searchLine.indexOf(searchQuery, startPos);
              if (idx === -1) break;
              if (results.length >= MAX_RESULTS) break;

              results.push({
                item,
                line: lineIdx + 1,
                column: idx + 1,
                lineText: line.trim(),
                matchStart: idx,
                matchEnd: idx + query.length,
              });
              startPos = idx + 1;
            }
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    // Only update if query hasn't changed during async search
    if (this.state.query === query) {
      this.setState({ results, isSearching: false, totalFilesSearched: filesSearched, selectedIndex: 0 });
    }
  }

  _isTextFile(ext: string): boolean {
    const textExts = [
      "json",
      "ts",
      "js",
      "mcfunction",
      "molang",
      "lang",
      "txt",
      "md",
      "html",
      "css",
      "xml",
      "yaml",
      "yml",
      "properties",
      "cfg",
      "ini",
      "mcmeta",
      "material",
      "vertex",
      "fragment",
      "geometry",
      "fsh",
      "vsh",
    ];
    return textExts.includes(ext.toLowerCase());
  }

  _truncateLineText(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen - 3) + "...";
  }

  render() {
    const { results, isSearching, totalFilesSearched, query } = this.state;

    return (
      <Dialog
        open={true}
        onClose={this.props.onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            position: "fixed",
            top: "10%",
            m: 0,
            borderRadius: "4px",
            maxHeight: "70vh",
          },
        }}
      >
        <DialogContent sx={{ p: 1.5 }}>
          {/* Live region for screen reader announcements */}
          <div
            aria-live="polite"
            aria-atomic="true"
            style={{
              position: "absolute",
              width: "1px",
              height: "1px",
              overflow: "hidden",
              clip: "rect(0, 0, 0, 0)",
            }}
          >
            {this.state.liveRegionText}
          </div>

          <TextField
            inputRef={this._inputRef}
            fullWidth
            placeholder="Type at least 2 characters to search"
            value={query}
            onChange={this._handleQueryChange}
            onKeyDown={this._handleKeyDown}
            variant="outlined"
            size="small"
            autoFocus
            aria-label="Search across project files"
            InputProps={{
              endAdornment: (
                <>
                  {query.length > 0 && (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={this._clearQuery}
                        edge="end"
                        size="small"
                        aria-label="Clear search"
                        sx={{ mr: isSearching ? 0.5 : 0 }}
                      >
                        ×
                      </IconButton>
                    </InputAdornment>
                  )}
                  {isSearching && (
                    <InputAdornment position="end">
                      <CircularProgress size={18} />
                    </InputAdornment>
                  )}
                </>
              ),
            }}
            sx={{ mb: 0.5 }}
          />

          {this.state.regexError && (
            <Box sx={{ mb: 0.5, px: 1, py: 0.5, backgroundColor: "#ffebee", color: "#c62828", borderRadius: "4px", fontSize: "0.875rem" }}>
              Invalid regex: {this.state.regexError}
            </Box>
          )}

          {this.state.showReplace && (
            <Box sx={{ display: "flex", gap: 0.5, mb: 0.5, alignItems: "center" }}>
              <TextField
                fullWidth
                placeholder="Replace with..."
                value={this.state.replaceText}
                onChange={this._handleReplaceTextChange}
                variant="outlined"
                size="small"
                aria-label="Replace text"
              />
              <Typography
                variant="caption"
                component="button"
                onClick={this._handleReplaceOne}
                sx={{
                  cursor: "pointer",
                  px: 1,
                  py: 0.5,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: "4px",
                  whiteSpace: "nowrap",
                  backgroundColor: "action.hover",
                  "&:hover": { backgroundColor: "action.selected" },
                }}
                title="Replace current match"
              >
                Replace
              </Typography>
              <Typography
                variant="caption"
                component="button"
                onClick={this._handleReplaceAll}
                sx={{
                  cursor: "pointer",
                  px: 1,
                  py: 0.5,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: "4px",
                  whiteSpace: "nowrap",
                  backgroundColor: "action.hover",
                  "&:hover": { backgroundColor: "action.selected" },
                }}
                title="Replace all matches across all files"
              >
                All
              </Typography>
            </Box>
          )}

          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, pl: 0.5 }}>
            <Typography
              variant="caption"
              component="button"
              onClick={this._toggleOptions}
              sx={{
                cursor: "pointer",
                px: 0.5,
                py: 0.25,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "4px",
                backgroundColor: "action.hover",
                "&:hover": { backgroundColor: "action.selected" },
              }}
              title="Toggle search options"
            >
              Options {this.state.showOptions ? "▾" : "▸"}
            </Typography>
            {query.length >= 2 && !isSearching && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
                {results.length}
                {results.length >= MAX_RESULTS ? "+" : ""} results in {totalFilesSearched} files
                {this.state.replacedCount > 0 && ` · ${this.state.replacedCount} replaced`}
              </Typography>
            )}
          </Box>

          {this.state.showOptions && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, pl: 0.5 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={this.state.showReplace}
                    onChange={this._toggleReplace}
                    size="small"
                    sx={{ p: 0.25 }}
                  />
                }
                label={<Typography variant="caption">Replace</Typography>}
                sx={{ m: 0 }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={this.state.caseSensitive}
                    onChange={this._toggleCaseSensitive}
                    size="small"
                    sx={{ p: 0.25 }}
                  />
                }
                label={<Typography variant="caption">Match case</Typography>}
                sx={{ m: 0 }}
              />
              <FormControlLabel
                control={
                  <Checkbox checked={this.state.useRegex} onChange={this._toggleRegex} size="small" sx={{ p: 0.25 }} />
                }
                label={<Typography variant="caption">Regex</Typography>}
                sx={{ m: 0 }}
              />
            </Box>
          )}

          <List dense sx={{ maxHeight: "calc(70vh - 120px)", overflow: "auto" }}>
            {results.map((result, i) => {
              const fileName = StorageUtilities.getLeafName(result.item.projectPath || "");
              const dirPath = StorageUtilities.getFolderPath(result.item.projectPath || "");
              const displayLine = this._truncateLineText(result.lineText, 120);

              return (
                <ListItem key={`${result.item.projectPath}-${result.line}-${result.column}-${i}`} disablePadding>
                  <ListItemButton
                    selected={i === this.state.selectedIndex}
                    onClick={() => this.props.onResultSelected(result.item, result.line, result.column)}
                    sx={{ py: 0.25, px: 1 }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
                          <Typography variant="body2" component="span" fontWeight="bold" sx={{ flexShrink: 0 }}>
                            {fileName}
                          </Typography>
                          <Typography variant="caption" component="span" color="text.secondary" sx={{ flexShrink: 0 }}>
                            :{result.line}
                          </Typography>
                          <Typography
                            variant="caption"
                            component="span"
                            color="text.secondary"
                            sx={{
                              ml: 0.5,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {dirPath}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Typography
                          variant="caption"
                          component="span"
                          fontFamily="monospace"
                          sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "block",
                          }}
                        >
                          {displayLine}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
            {query.length >= 2 && !isSearching && results.length === 0 && (
              <ListItem>
                <ListItemText
                  primary="No results found"
                  primaryTypographyProps={{ fontSize: "0.875rem", textAlign: "center" }}
                />
              </ListItem>
            )}
            {query.length < 2 && query.length > 0 && (
              <ListItem>
                <ListItemText
                  primary="Type at least 2 characters to search"
                  primaryTypographyProps={{ fontSize: "0.875rem", textAlign: "center", color: "text.secondary" }}
                />
              </ListItem>
            )}
          </List>
        </DialogContent>
      </Dialog>
    );
  }
}
