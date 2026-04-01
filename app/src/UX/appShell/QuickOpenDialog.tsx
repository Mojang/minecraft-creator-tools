import { Component, createRef } from "react";
import { Dialog, DialogContent, TextField, List, ListItem, ListItemButton, ListItemText } from "@mui/material";
import Project from "../../app/Project";
import ProjectItem from "../../app/ProjectItem";
import ProjectItemUtilities from "../../app/ProjectItemUtilities";
import StorageUtilities from "../../storage/StorageUtilities";

interface IQuickOpenDialogProps {
  project: Project;
  onItemSelected: (item: ProjectItem) => void;
  onClose: () => void;
}

interface IQuickOpenDialogState {
  filter: string;
  selectedIndex: number;
}

/**
 * Quick-open palette for rapidly navigating to project items via Ctrl+P.
 * Filters the project item list as the user types.
 */
export default class QuickOpenDialog extends Component<IQuickOpenDialogProps, IQuickOpenDialogState> {
  private _inputRef = createRef<HTMLInputElement>();

  constructor(props: IQuickOpenDialogProps) {
    super(props);
    this.state = { filter: "", selectedIndex: 0 };
    this._handleFilterChange = this._handleFilterChange.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
  }

  componentDidMount() {
    setTimeout(() => this._inputRef.current?.focus(), 100);
  }

  _handleFilterChange(e: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ filter: e.target.value, selectedIndex: 0 });
  }

  _handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      this.props.onClose();
      return;
    }

    const items = this._getFilteredItems();

    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.setState((prev) => ({
        selectedIndex: Math.min(prev.selectedIndex + 1, items.length - 1),
      }));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.setState((prev) => ({
        selectedIndex: Math.max(prev.selectedIndex - 1, 0),
      }));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = items[this.state.selectedIndex];
      if (selected) {
        this.props.onItemSelected(selected);
      }
    }
  }

  _getFilteredItems(): ProjectItem[] {
    const items = this.props.project.items;
    const filter = this.state.filter.toLowerCase();
    const results: ProjectItem[] = [];

    for (const item of items) {
      if (item.projectPath === undefined || item.projectPath === null) continue;
      const name = item.projectPath || "";
      const typeName = ProjectItemUtilities.getDescriptionForType(item.itemType);
      const searchText = (name + " " + typeName).toLowerCase();

      if (!filter || searchText.includes(filter)) {
        results.push(item);
      }
      if (results.length >= 20) break;
    }

    return results;
  }

  render() {
    const items = this._getFilteredItems();

    return (
      <Dialog
        open={true}
        onClose={this.props.onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { position: "fixed", top: "15%", m: 0, borderRadius: "4px" } }}
      >
        <DialogContent sx={{ p: 1 }}>
          <TextField
            inputRef={this._inputRef}
            fullWidth
            placeholder="Type to search project items..."
            value={this.state.filter}
            onChange={this._handleFilterChange}
            onKeyDown={this._handleKeyDown}
            variant="outlined"
            size="small"
            autoFocus
            sx={{ mb: 1 }}
            aria-label="Search project items"
          />
          <List dense sx={{ maxHeight: 320, overflow: "auto" }}>
            {items.map((item, i) => {
              const name = StorageUtilities.getLeafName(item.projectPath || "");
              const typeName = ProjectItemUtilities.getDescriptionForType(item.itemType);
              return (
                <ListItem key={item.projectPath || i} disablePadding>
                  <ListItemButton
                    selected={i === this.state.selectedIndex}
                    onClick={() => this.props.onItemSelected(item)}
                  >
                    <ListItemText
                      primary={name}
                      secondary={typeName}
                      primaryTypographyProps={{ fontSize: "0.875rem" }}
                      secondaryTypographyProps={{ fontSize: "0.75rem" }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
            {items.length === 0 && (
              <ListItem>
                <ListItemText
                  primary="No matching items"
                  primaryTypographyProps={{ fontSize: "0.875rem", textAlign: "center" }}
                />
              </ListItem>
            )}
          </List>
        </DialogContent>
      </Dialog>
    );
  }
}
