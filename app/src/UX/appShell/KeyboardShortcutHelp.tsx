import { Component } from "react";
import { Dialog, DialogTitle, DialogContent, IconButton, Box, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

interface IKeyboardShortcutHelpProps {
  onClose: () => void;
}

interface ShortcutEntry {
  keys: string;
  description: string;
}

interface ShortcutCategory {
  title: string;
  shortcuts: ShortcutEntry[];
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: "Ctrl+P", description: "Quick Open (find files)" },
      { keys: "Ctrl+G", description: "Go to line" },
      { keys: "Ctrl+Tab", description: "Cycle through open tabs" },
      { keys: "Ctrl+W", description: "Close current editor tab" },
      { keys: "Ctrl+Shift+W", description: "Close all open tabs" },
      { keys: "Home button", description: "Return to project list" },
    ],
  },
  {
    title: "Editing",
    shortcuts: [
      { keys: "Ctrl+S", description: "Save project" },
      { keys: "Ctrl+Z", description: "Undo" },
      { keys: "Ctrl+Y", description: "Redo" },
      { keys: "Ctrl+/", description: "Toggle line comment" },
      { keys: "Ctrl+D", description: "Add next occurrence to selection" },
      { keys: "Alt+Up / Alt+Down", description: "Move current line up/down" },
      { keys: "Ctrl+Space", description: "Trigger IntelliSense suggestions" },
      { keys: "F12", description: "Go to definition" },
    ],
  },
  {
    title: "Project",
    shortcuts: [
      { keys: "F3", description: "Export project" },
      { keys: "F5", description: "Deploy to Minecraft" },
    ],
  },
  {
    title: "View Modes",
    shortcuts: [
      { keys: "Alt+1", description: "Switch to Focused Mode" },
      { keys: "Alt+2", description: "Switch to Full Mode" },
      { keys: "Alt+3", description: "Switch to Raw Mode" },
    ],
  },
  {
    title: "Search",
    shortcuts: [
      { keys: "Ctrl+Shift+F", description: "Search across all project files" },
      { keys: "Ctrl+E", description: "Toggle search" },
    ],
  },
  {
    title: "Help",
    shortcuts: [{ keys: "?  or  Ctrl+/", description: "Show this dialog" }],
  },
];

/**
 * Keyboard shortcut help overlay dialog.
 * Shows all available shortcuts in categorized tables.
 * Triggered by pressing '?' (outside text inputs), Ctrl+/, or from the overflow menu.
 */
export default class KeyboardShortcutHelp extends Component<IKeyboardShortcutHelpProps> {
  constructor(props: IKeyboardShortcutHelpProps) {
    super(props);
    this._handleKeyDown = this._handleKeyDown.bind(this);
  }

  componentDidMount() {
    window.addEventListener("keydown", this._handleKeyDown);
  }

  componentWillUnmount() {
    window.removeEventListener("keydown", this._handleKeyDown);
  }

  _handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      this.props.onClose();
    }
  }

  render() {
    return (
      <Dialog
        open={true}
        onClose={this.props.onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "4px",
            maxHeight: "80vh",
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            pb: 1,
          }}
        >
          <Typography variant="h6" component="span">
            Keyboard Shortcuts
          </Typography>
          <IconButton onClick={this.props.onClose} size="small" aria-label="Close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          {SHORTCUT_CATEGORIES.map((category) => (
            <Box key={category.title} sx={{ mb: 2 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  mb: 0.5,
                  textTransform: "uppercase",
                  fontSize: "0.7rem",
                  letterSpacing: "0.05em",
                  opacity: 0.7,
                }}
              >
                {category.title}
              </Typography>
              <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {category.shortcuts.map((shortcut) => (
                    <Box
                      component="tr"
                      key={shortcut.keys}
                      sx={{
                        "&:hover": { backgroundColor: "action.hover" },
                      }}
                    >
                      <Box
                        component="td"
                        sx={{
                          py: 0.5,
                          pr: 2,
                          width: "40%",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {shortcut.keys.split("  or  ").map((key, i, arr) => (
                          <span key={key}>
                            <Box
                              component="kbd"
                              sx={{
                                display: "inline-block",
                                px: 0.75,
                                py: 0.25,
                                fontSize: "0.8rem",
                                fontFamily: '"Noto Sans", monospace',
                                fontWeight: 500,
                                lineHeight: 1.4,
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: "4px",
                                backgroundColor: "action.selected",
                              }}
                            >
                              {key}
                            </Box>
                            {i < arr.length - 1 && (
                              <Typography component="span" variant="caption" sx={{ mx: 0.5, opacity: 0.6 }}>
                                or
                              </Typography>
                            )}
                          </span>
                        ))}
                      </Box>
                      <Box
                        component="td"
                        sx={{
                          py: 0.5,
                          fontSize: "0.85rem",
                        }}
                      >
                        {shortcut.description}
                      </Box>
                    </Box>
                  ))}
                </tbody>
              </Box>
            </Box>
          ))}
        </DialogContent>
      </Dialog>
    );
  }
}
