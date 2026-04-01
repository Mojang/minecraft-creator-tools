/**
 * =============================================================================
 * COMMAND INPUT COMPONENT
 * =============================================================================
 *
 * Interactive command input with autocomplete support.
 * Features:
 * - Tab completion from command providers
 * - Command history navigation with up/down arrows
 * - Visual autocomplete suggestions
 * - Prompt customization
 * =============================================================================
 */

import React, { useState, useCallback, useEffect } from "react";
import { Box, Text, useInput, Key } from "ink";
import TextInput from "ink-text-input";
import { ICommandSuggestion, CommandProviderRegistry } from "../commands/ICommandProvider";

interface CommandInputProps {
  /** Command provider registry for autocomplete */
  registry: CommandProviderRegistry;
  /** Callback when command is submitted */
  onSubmit: (command: string) => void;
  /** Prompt text */
  prompt?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Command history */
  history?: string[];
}

export const CommandInput: React.FC<CommandInputProps> = ({
  registry,
  onSubmit,
  prompt = "> ",
  placeholder = "Enter command...",
  disabled = false,
  history = [],
}) => {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<ICommandSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [savedInput, setSavedInput] = useState("");
  const [reverseSearchMode, setReverseSearchMode] = useState(false);
  const [reverseSearchQuery, setReverseSearchQuery] = useState("");
  const [reverseSearchResult, setReverseSearchResult] = useState<string | undefined>(undefined);
  // Update suggestions when input changes
  useEffect(() => {
    if (value.length > 0) {
      const newSuggestions = registry.getSuggestions(value, value.length);
      setSuggestions(newSuggestions.slice(0, 8)); // Limit to 8 suggestions
      setShowSuggestions(newSuggestions.length > 0);
      setSelectedSuggestion(0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [value, registry]);

  // Reverse search - find matching history entry when query changes
  useEffect(() => {
    if (!reverseSearchMode || reverseSearchQuery.length === 0) {
      setReverseSearchResult(undefined);
      return;
    }
    const lowerQuery = reverseSearchQuery.toLowerCase();
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].toLowerCase().includes(lowerQuery)) {
        setReverseSearchResult(history[i]);
        return;
      }
    }
    setReverseSearchResult(undefined);
  }, [reverseSearchQuery, history, reverseSearchMode]);

  // Handle input changes
  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
    setHistoryIndex(-1);
  }, []);

  // Handle command submission
  const handleSubmit = useCallback(
    (submittedValue: string) => {
      if (submittedValue.trim().length > 0) {
        onSubmit(submittedValue.trim());
        setValue("");
        setShowSuggestions(false);
        setHistoryIndex(-1);
      }
    },
    [onSubmit]
  );

  // Handle keyboard input for special keys
  useInput(
    (input: string, key: Key) => {
      if (disabled) return;

      // Reverse search mode key handling
      if (reverseSearchMode) {
        if (key.return) {
          if (reverseSearchResult) {
            setValue(reverseSearchResult);
          }
          setReverseSearchMode(false);
          setReverseSearchQuery("");
          return;
        }
        if (key.escape) {
          setReverseSearchMode(false);
          setReverseSearchQuery("");
          return;
        }
        if (key.backspace || key.delete) {
          setReverseSearchQuery((prev) => prev.slice(0, -1));
          return;
        }
        if (input && !key.ctrl && !key.meta && input.length === 1) {
          setReverseSearchQuery((prev) => prev + input);
          return;
        }
        if (input === "r" && key.ctrl) {
          if (reverseSearchResult && reverseSearchQuery.length > 0) {
            const lowerQuery = reverseSearchQuery.toLowerCase();
            const currentIdx = history.indexOf(reverseSearchResult);
            for (let i = currentIdx - 1; i >= 0; i--) {
              if (history[i].toLowerCase().includes(lowerQuery)) {
                setReverseSearchResult(history[i]);
                return;
              }
            }
          }
          return;
        }
        return;
      }

      // Ctrl+R - reverse history search
      if (input === "r" && key.ctrl) {
        if (!reverseSearchMode) {
          setReverseSearchMode(true);
          setReverseSearchQuery("");
          setReverseSearchResult(undefined);
          setShowSuggestions(false);
        }
        return;
      }

      // Tab - accept suggestion
      if (key.tab && suggestions.length > 0) {
        const suggestion = suggestions[selectedSuggestion];
        if (suggestion) {
          setValue(suggestion.value);
          setShowSuggestions(false);
        }
        return;
      }

      // Up arrow - navigate suggestions or history
      if (key.upArrow) {
        if (showSuggestions && suggestions.length > 0) {
          // Navigate suggestions
          setSelectedSuggestion((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        } else if (history.length > 0) {
          // Navigate history
          if (historyIndex === -1) {
            setSavedInput(value);
          }
          const newIndex = Math.min(historyIndex + 1, history.length - 1);
          setHistoryIndex(newIndex);
          setValue(history[history.length - 1 - newIndex] || "");
        }
        return;
      }

      // Down arrow - navigate suggestions or history
      if (key.downArrow) {
        if (showSuggestions && suggestions.length > 0) {
          // Navigate suggestions
          setSelectedSuggestion((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        } else if (historyIndex > -1) {
          // Navigate history
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          if (newIndex === -1) {
            setValue(savedInput);
          } else {
            setValue(history[history.length - 1 - newIndex] || "");
          }
        }
        return;
      }

      // Ctrl+W - delete last word (readline standard)
      if (input === "w" && key.ctrl) {
        setValue((prev) => {
          const trimmed = prev.trimEnd();
          const lastSpace = trimmed.lastIndexOf(" ");
          if (lastSpace === -1) return "";
          return trimmed.substring(0, lastSpace + 1);
        });
        return;
      }

      // Ctrl+U - clear current input line (readline standard)
      if (input === "u" && key.ctrl) {
        setValue("");
        return;
      }

      // Escape - hide suggestions
      if (key.escape) {
        if (showSuggestions) {
          setShowSuggestions(false);
        } else {
          setValue("");
        }
        return;
      }

    },
    { isActive: !disabled }
  );

  return (
    <Box flexDirection="column">
      {/* Suggestions dropdown */}
      {!reverseSearchMode && showSuggestions && suggestions.length > 0 && (
        <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} marginBottom={1}>
          <Text dimColor>Tab to complete, ↑↓ to navigate</Text>
          {suggestions.map((suggestion, index) => (
            <Box key={suggestion.value}>
              <Text color={index === selectedSuggestion ? "cyan" : undefined} bold={index === selectedSuggestion}>
                {index === selectedSuggestion ? "▶ " : "  "}
                {suggestion.display}
              </Text>
              {suggestion.description && <Text dimColor> - {suggestion.description}</Text>}
            </Box>
          ))}
        </Box>
      )}

      {/* Input line */}
      <Box>
        {reverseSearchMode ? (
          <>
            <Text color="yellow">(reverse-i-search)</Text>
            <Text dimColor>`{reverseSearchQuery}`</Text>
            <Text>: </Text>
            <Text color={reverseSearchResult ? "cyan" : "red"}>
              {reverseSearchResult || "(no match)"}
            </Text>
          </>
        ) : (
          <>
            <Text color="green" bold>
              {prompt}
            </Text>
            {disabled ? (
              <Text dimColor>{placeholder}</Text>
            ) : (
              <TextInput value={value} onChange={handleChange} onSubmit={handleSubmit} placeholder={placeholder} />
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

export default CommandInput;
