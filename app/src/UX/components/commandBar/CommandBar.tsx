/**
 * CommandBar — Unified search-and-command autocomplete input.
 *
 * In search mode (plain text) it delegates filtering to the parent via
 * `onSearchQueryChange`. In command mode (input starts with `/`) it shows
 * autocomplete suggestions from ToolCommandRegistry, executes commands on
 * Enter, and displays output via CommandOutputPanel.
 */

import { Autocomplete, Box, TextField, Typography } from "@mui/material";
import type { Theme, SxProps } from "@mui/material/styles";
import { useState, useEffect, useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { mcColors } from "../../hooks/theme/mcColors";
import { useCreatorTools } from "../../contexts/creatorToolsContext/CreatorToolsContext";
import { ToolCommandRegistry, ToolCommandContextFactory, initializeToolCommands } from "../../../app/toolcommands";
import type { IToolCommandOutput } from "../../../app/toolcommands";
import type Project from "../../../app/Project";
import CommandOutputPanel from "./CommandOutputPanel";

/** Human-readable descriptions for content types shown in /add completions. */
const CONTENT_TYPE_DESCRIPTIONS: Record<string, string> = {
  entity: "Custom mob",
  block: "Custom block type",
  item: "Custom item type",
  script: "Script file",
  function: "Mcfunction command script",
  spawn_rule: "Spawn rule for mobs",
  loot_table: "Loot table definition",
  recipe: "Crafting or smelting recipe",
  biome: "Custom biome definition",
  feature: "World generation feature",
  feature_rule: "Feature placement rule",
  structure: "Structure template",
  animation: "Mob animation",
  animation_controller: "Animation controller",
  render_controller: "Render controller",
  model: "Mob or block model",
  texture: "Texture asset",
  particle: "Particle effect",
  fog: "Fog definition",
  sound: "Sound definition",
};

export interface CommandBarProps {
  /** Called when the user types plain (non-command) text so the parent can filter content. */
  onSearchQueryChange: (query: string | undefined) => void;
  /** Called when a command creates a project and we should switch to the editor. */
  onSetProject?: (project: Project) => void;
  /** Called after a command executes that may have modified the project list. */
  onProjectsChanged?: () => void;
}

/**
 * Builds the `sx` prop for the Autocomplete root.
 *
 * The command bar needs mode-specific styling that goes beyond theme defaults:
 * in command mode it uses a green-tinted background to visually distinguish
 * commands from plain search, and in search mode it uses a neutral background
 * that blends with the surrounding surface.
 */
function getAutocompleteSx(isCommandMode: boolean): SxProps<Theme> {
  return (theme: Theme) => {
    const isDark = theme.palette.mode === "dark";
    return {
      mb: 1,
      width: "100%",
      "& .MuiOutlinedInput-root": {
        backgroundColor: isCommandMode
          ? isDark
            ? `${mcColors.green7}44`
            : `${mcColors.green1}22`
          : isDark
            ? `${mcColors.gray5}88`
            : `${mcColors.gray1}cc`,
        "& fieldset": {
          borderColor: isCommandMode
            ? isDark
              ? mcColors.green5
              : mcColors.green4
            : isDark
              ? mcColors.gray3
              : mcColors.gray3,
          borderWidth: 2,
        },
        "&:hover fieldset": {
          borderColor: isDark ? mcColors.green3 : mcColors.green5,
        },
        "&.Mui-focused fieldset": {
          borderColor: mcColors.green4,
          borderWidth: 2,
        },
      },
    };
  };
}

export default function CommandBar({ onSearchQueryChange, onSetProject, onProjectsChanged }: CommandBarProps) {
  const [creatorTools] = useCreatorTools();
  const intl = useIntl();

  const [commandSuggestions, setCommandSuggestions] = useState<string[]>([]);
  const [commandDescriptions, setCommandDescriptions] = useState<Map<string, string>>(new Map());
  const [inputValue, setInputValue] = useState("");
  const [completionPrefix, setCompletionPrefix] = useState("/");
  const [commandOutput, setCommandOutput] = useState<string[] | null>(null);
  const [noCommandMatch, setNoCommandMatch] = useState(false);

  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commandsInitializedRef = useRef(false);

  const isCommandMode = inputValue.startsWith("/");

  useEffect(() => {
    if (!commandsInitializedRef.current) {
      initializeToolCommands();
      commandsInitializedRef.current = true;
    }
  }, []);

  // Global Ctrl+E / Ctrl+K to focus the bar.
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextEntryTarget =
        !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (isTextEntryTarget) {
        return;
      }

      if (event.ctrlKey && !event.altKey && !event.shiftKey) {
        const key = event.key.toLowerCase();
        if (key === "e" || key === "k") {
          event.preventDefault();
          event.stopPropagation();
          commandInputRef.current?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Clear any pending debounce timer on unmount to avoid state updates after unmount.
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const createCommandOutput = useCallback((): IToolCommandOutput => {
    return {
      info: (msg: string) => creatorTools.notifyStatusUpdate(msg),
      success: (msg: string) => creatorTools.notifyStatusUpdate(msg),
      warn: (msg: string) => creatorTools.notifyStatusUpdate(msg),
      error: (msg: string) => creatorTools.notifyStatusUpdate(msg),
      debug: () => {},
      progress: (current: number, total: number, msg?: string) => {
        const pct = Math.round((current / total) * 100);
        creatorTools.notifyStatusUpdate(`[${pct}%] ${msg || ""}`);
      },
    };
  }, [creatorTools]);

  const getCompletionPrefix = useCallback((text: string): string => {
    const trimmed = text.trimEnd();
    const hasTrailingSpace = text.length > trimmed.length;
    if (hasTrailingSpace) return text;
    const lastSpace = text.lastIndexOf(" ");
    if (lastSpace >= 0) return text.slice(0, lastSpace + 1);
    return text.startsWith("/") ? "/" : "";
  }, []);

  const buildCommandDescriptions = useCallback(
    (suggestions: string[], commandText: string): Map<string, string> => {
      const descMap = new Map<string, string>();
      const withoutSlash = commandText.startsWith("/") ? commandText.slice(1) : commandText;
      const parts = withoutSlash.trim().split(/\s+/);
      const cmdName = parts[0] || "";

      if (parts.length <= 1 && !commandText.trimEnd().includes(" ")) {
        for (const s of suggestions) {
          const name = s.startsWith("/") ? s.slice(1) : s;
          const cmd = ToolCommandRegistry.instance.get(name);
          if (cmd) {
            descMap.set(s, cmd.metadata.description);
          }
        }
        return descMap;
      }

      const cmd = ToolCommandRegistry.instance.get(cmdName);
      if (cmd) {
        for (const s of suggestions) {
          if (s.startsWith("<") && s.endsWith(">")) {
            const argName = s.slice(1, -1);
            const argDef = cmd.metadata.arguments?.find((a) => a.name === argName);
            if (argDef) {
              descMap.set(s, argDef.description);
            }
            continue;
          }

          const contentDesc = CONTENT_TYPE_DESCRIPTIONS[s.toLowerCase()];
          if (contentDesc) {
            descMap.set(s, contentDesc);
            continue;
          }

          const galItem = creatorTools.gallery?.items?.find((item) => item.id === s);
          if (galItem) {
            descMap.set(s, galItem.title);
          }
        }
      }

      return descMap;
    },
    [creatorTools]
  );

  const retrieveToolCommandSuggestions = useCallback(
    async (text: string) => {
      if (!text.startsWith("/")) {
        setCommandSuggestions([]);
        return;
      }

      const output = createCommandOutput();
      const context = ToolCommandContextFactory.createMinimal(creatorTools, output);
      context.scope = "ui";

      const completions = await ToolCommandRegistry.instance.getCompletions(text, text.length, context);
      // Cap the suggestion list. The cap exists so the popup doesn't grow unbounded
      // when a command's argument completer returns thousands of items (e.g. block
      // type IDs). 30 comfortably covers the entire built-in slash-command set
      // (currently 17) with room for additions; argument completers that legitimately
      // need more should paginate / fuzzy-rank inside their own getCompletions.
      const limited = completions.slice(0, 30);

      const prefix = getCompletionPrefix(text);
      const descriptions = buildCommandDescriptions(limited, text);

      setCompletionPrefix(prefix);
      setCommandSuggestions(limited);
      setCommandDescriptions(descriptions);
      setNoCommandMatch(text.length > 1 && limited.length === 0);
    },
    [creatorTools, createCommandOutput, getCompletionPrefix, buildCommandDescriptions]
  );

  const executeToolCommand = useCallback(
    async (commandText: string) => {
      if (!commandText.trim()) return;

      const lines: string[] = [];
      const output: IToolCommandOutput = {
        info: (msg: string) => {
          lines.push(msg);
        },
        success: (msg: string) => {
          lines.push(msg);
        },
        warn: (msg: string) => {
          lines.push(msg);
        },
        error: (msg: string) => {
          lines.push(msg);
        },
        debug: () => {},
        progress: (current: number, total: number, msg?: string) => {
          const pct = Math.round((current / total) * 100);
          lines.push(`[${pct}%] ${msg || ""}`);
        },
      };

      const context = ToolCommandContextFactory.createMinimal(creatorTools, output);
      context.scope = "ui";

      creatorTools.notifyStatusUpdate("Running: " + commandText);

      try {
        const result = await ToolCommandRegistry.instance.execute(commandText, context);
        if (result) {
          if (result.success) {
            creatorTools.notifyStatusUpdate(result.message || "Command completed");
          } else {
            lines.push("Error: " + (result.error?.message || "Command failed"));
            creatorTools.notifyStatusUpdate("Error: " + (result.error?.message || "Command failed"));
          }
        } else {
          const helpHint = " Type /help for available commands.";
          lines.push("Unknown command: " + commandText + "." + helpHint);
          creatorTools.notifyStatusUpdate("Unknown command: " + commandText + "." + helpHint);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        lines.push("Command error: " + msg);
        creatorTools.notifyStatusUpdate("Command error: " + msg);
      }

      if (lines.length > 0) {
        setCommandOutput(lines);
      }

      if (context.project && onSetProject) {
        onSetProject(context.project);
        return;
      }

      if (onProjectsChanged) {
        onProjectsChanged();
      }

      setInputValue("");
      setCommandSuggestions([]);
      setCommandDescriptions(new Map());
    },
    [creatorTools, onSetProject, onProjectsChanged]
  );

  const handleSearchChange = useCallback(
    (newValue: string) => {
      setInputValue(newValue);

      if (newValue.startsWith("/")) {
        onSearchQueryChange(undefined);
        setCommandOutput(null);
        setCommandSuggestions([]);
        setCommandDescriptions(new Map());
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(async () => {
          debounceTimerRef.current = null;
          await retrieveToolCommandSuggestions(newValue);
        }, 100);
      } else {
        setCommandOutput(null);
        setCommandSuggestions([]);
        setCommandDescriptions(new Map());
        setNoCommandMatch(false);
        onSearchQueryChange(newValue || undefined);
      }
    },
    [retrieveToolCommandSuggestions, onSearchQueryChange]
  );

  /** Accept a suggestion: append it to the current prefix and re-fetch completions. */
  const acceptSuggestion = useCallback(
    (match: string) => {
      // Command-name completions already include "/" (e.g. "/add") — use directly
      // to avoid double-slash when completionPrefix is also "/".
      const newValue = match.startsWith("/") ? match + " " : completionPrefix + match + " ";
      setInputValue(newValue);
      setCommandSuggestions([]);
      setTimeout(() => retrieveToolCommandSuggestions(newValue), 50);
    },
    [completionPrefix, retrieveToolCommandSuggestions]
  );

  const handleAutocompleteInputChange = useCallback(
    (_ev: React.SyntheticEvent, newValue: string, reason: string) => {
      if (reason === "input" || reason === "clear") {
        handleSearchChange(newValue);
      }
    },
    [handleSearchChange]
  );

  const handleAutocompleteChange = useCallback(
    (_ev: React.SyntheticEvent, value: string | null) => {
      if (typeof value === "string" && value && isCommandMode) {
        // Ignore hint placeholders like <name> — they're informational only
        if (value.startsWith("<") && value.endsWith(">")) {
          return;
        }
        // Only accept if the value is in the current suggestions to prevent
        // stale completions from corrupting the input.
        if (!commandSuggestions.includes(value)) {
          return;
        }
        acceptSuggestion(value);
      }
    },
    [isCommandMode, commandSuggestions, acceptSuggestion]
  );

  const handleInputKeyDown = useCallback(
    (ev: React.KeyboardEvent) => {
      if (isCommandMode && ev.key === "Tab" && commandSuggestions.length > 0) {
        const highlighted = document.querySelector('[role="option"].Mui-focused');
        const suggestionText = highlighted?.textContent?.split(/\s{2,}/)?.[0]?.trim();
        const match = suggestionText
          ? commandSuggestions.find((s) => suggestionText.startsWith(s))
          : commandSuggestions[0];
        if (match && !(match.startsWith("<") && match.endsWith(">"))) {
          ev.preventDefault();
          acceptSuggestion(match);
        }
      }
      if (ev.key === "Enter" && isCommandMode) {
        const highlightedOption = document.querySelector('[role="option"][aria-selected="true"]');
        if (!highlightedOption) {
          ev.preventDefault();
          executeToolCommand(inputValue);
        }
      }
      if (ev.key === "Escape" && isCommandMode) {
        ev.preventDefault();
        setCommandSuggestions([]);
        setCommandDescriptions(new Map());
      }
    },
    [isCommandMode, commandSuggestions, acceptSuggestion, executeToolCommand, inputValue]
  );

  return (
    <>
      <Autocomplete
        freeSolo
        disableCloseOnSelect
        open={isCommandMode && commandSuggestions.length > 0}
        options={isCommandMode ? commandSuggestions : []}
        inputValue={inputValue}
        onInputChange={handleAutocompleteInputChange}
        onChange={handleAutocompleteChange}
        getOptionLabel={(option) => option}
        filterOptions={(x) => x}
        renderOption={(props, option) => {
          const { key, ...optionProps } = props;
          const desc = commandDescriptions.get(option);
          const isHint = option.startsWith("<") && option.endsWith(">");
          return (
            <li key={key} {...optionProps} style={isHint ? { pointerEvents: "none", opacity: 0.7 } : undefined}>
              <Box sx={{ display: "flex", gap: 1.5, alignItems: "baseline", width: "100%" }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: isHint ? 400 : 600,
                    fontFamily: "monospace",
                    fontStyle: isHint ? "italic" : "normal",
                  }}
                >
                  {option}
                </Typography>
                {desc && (
                  <Typography variant="caption" sx={{ opacity: 0.6 }}>
                    {desc}
                  </Typography>
                )}
              </Box>
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={isCommandMode
              ? intl.formatMessage({ id: "home.project_grid.command_label" })
              : intl.formatMessage({ id: "home.project_grid.search_label" })}
            variant="outlined"
            inputRef={commandInputRef}
            inputProps={{
              ...params.inputProps,
              "aria-label": "search and command bar",
            }}
            onKeyDown={handleInputKeyDown}
          />
        )}
        sx={getAutocompleteSx(isCommandMode)}
      />
      {isCommandMode && noCommandMatch && commandSuggestions.length === 0 && (
        <Typography variant="body2" sx={{ mt: -2, mb: 2, ml: 1, opacity: 0.7, fontStyle: "italic" }}>
          No matching commands. Type /help for a list.
        </Typography>
      )}
      {commandOutput && commandOutput.length > 0 && (
        <CommandOutputPanel lines={commandOutput} onClose={() => setCommandOutput(null)} />
      )}
    </>
  );
}
