// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * WorldsDialog - Backup World Management Dialog
 *
 * This dialog displays all managed worlds from the WorldBackupManager system,
 * allowing admins to view world metadata, version history, and perform
 * backup/restore operations.
 *
 * Features:
 * - List all managed worlds with metadata (name, size, last accessed)
 * - Indicate which world is currently used by the active slot
 * - Show version history (backups) for selected world
 * - Download backups as .mcworld files
 * - Restore backups to the current slot (with confirmation if slot is running)
 */

import { Component } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Divider,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload, faUndo, faGlobe, faCheck, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import CreatorTools from "../../app/CreatorTools";
import "./WorldsDialog.css";
import IProjectTheme from "../types/IProjectTheme";

/**
 * World summary from the API
 */
interface IWorldSummary {
  worldId: string;
  friendlyName: string;
  description?: string;
  createdAt: string;
  lastModified: string;
  backupCount: number;
  totalBytes?: number;
  latestBackupTimestamp?: number;
  isActiveWorld?: boolean;
  slotPort?: number;
}

/**
 * Backup info from the API
 */
interface IBackupInfo {
  timestamp: number;
  type: string;
  description?: string;
  fileCount: number;
  totalBytes: number;
  createdAt: string;
}

interface IWorldsDialogProps {
  creatorTools: CreatorTools;
  isOpen: boolean;
  onClose: () => void;
  theme: IProjectTheme;
  currentSlot: number;
  currentSlotWorldId?: string;
  isSlotRunning: boolean;
  onRestartRequired?: () => Promise<void>;
}

interface IWorldsDialogState {
  isLoading: boolean;
  worlds: IWorldSummary[];
  selectedWorldId?: string;
  backups: IBackupInfo[];
  loadingBackups: boolean;
  error?: string;
  showRestoreConfirm: boolean;
  restoreTimestamp?: number;
  isRestoring: boolean;
}

export default class WorldsDialog extends Component<IWorldsDialogProps, IWorldsDialogState> {
  constructor(props: IWorldsDialogProps) {
    super(props);

    this._handleWorldSelected = this._handleWorldSelected.bind(this);
    this._handleDownloadBackup = this._handleDownloadBackup.bind(this);
    this._handleRestoreBackup = this._handleRestoreBackup.bind(this);
    this._handleConfirmRestore = this._handleConfirmRestore.bind(this);
    this._handleCancelRestore = this._handleCancelRestore.bind(this);

    this.state = {
      isLoading: true,
      worlds: [],
      backups: [],
      loadingBackups: false,
      showRestoreConfirm: false,
      isRestoring: false,
    };
  }

  componentDidMount() {
    if (this.props.isOpen) {
      this._loadWorlds();
    }
  }

  componentDidUpdate(prevProps: IWorldsDialogProps) {
    if (this.props.isOpen && !prevProps.isOpen) {
      this._loadWorlds();
    }
  }

  private _getApiUrl(): string {
    const baseUrl = this.props.creatorTools.fullRemoteServerUrl;
    return baseUrl ? baseUrl : "/";
  }

  private _getAuthHeaders(): Record<string, string> {
    const token = this.props.creatorTools.remoteServerAuthToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async _loadWorlds(): Promise<void> {
    this.setState({ isLoading: true, error: undefined });

    try {
      const response = await axios.get(this._getApiUrl() + "api/worlds", {
        headers: this._getAuthHeaders(),
      });

      const worlds: IWorldSummary[] = response.data.worlds || [];

      // Sort by last modified (most recent first)
      worlds.sort((a, b) => {
        const dateA = a.latestBackupTimestamp || new Date(a.lastModified).getTime();
        const dateB = b.latestBackupTimestamp || new Date(b.lastModified).getTime();
        return dateB - dateA;
      });

      // Determine which world to select
      const selectedWorldId = this.props.currentSlotWorldId || (worlds.length > 0 ? worlds[0].worldId : undefined);
      const selectedWorld = worlds.find((w) => w.worldId === selectedWorldId);

      this.setState({
        isLoading: false,
        worlds,
        // Auto-select the current slot's world if available
        selectedWorldId,
      });

      // Load backups for the selected world (skip for synthetic active worlds that have no backups)
      if (selectedWorldId && selectedWorld && !selectedWorld.isActiveWorld) {
        this._loadBackups(selectedWorldId);
      }
    } catch (err: any) {
      this.setState({
        isLoading: false,
        error: err.message || "Failed to load worlds",
      });
    }
  }

  private async _loadBackups(worldId: string): Promise<void> {
    this.setState({ loadingBackups: true, backups: [] });

    try {
      const response = await axios.get(this._getApiUrl() + `api/worlds/${worldId}/backups`, {
        headers: this._getAuthHeaders(),
      });

      const backups: IBackupInfo[] = response.data.backups || [];

      // Sort by timestamp (most recent first)
      backups.sort((a, b) => b.timestamp - a.timestamp);

      this.setState({ loadingBackups: false, backups });
    } catch (err: any) {
      this.setState({
        loadingBackups: false,
        error: err.message || "Failed to load backups",
      });
    }
  }

  private _handleWorldSelected(index: number): void {
    const world = this.state.worlds[index];
    if (world) {
      this.setState({ selectedWorldId: world.worldId, backups: [] });
      // Skip loading backups for synthetic active worlds that have no backups yet
      if (!world.isActiveWorld) {
        this._loadBackups(world.worldId);
      }
    }
  }

  private async _handleDownloadBackup(worldId: string, timestamp: number): Promise<void> {
    try {
      const world = this.state.worlds.find((w) => w.worldId === worldId);
      const fileName = world
        ? `${world.friendlyName.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}.mcworld`
        : `world_${timestamp}.mcworld`;

      // Open download URL in new tab
      const downloadUrl =
        this._getApiUrl() +
        `api/worlds/${worldId}/backups/${timestamp}/export?token=${encodeURIComponent(
          this.props.creatorTools.remoteServerAuthToken || ""
        )}`;

      window.open(downloadUrl, "_blank");
    } catch (err: any) {
      this.setState({ error: err.message || "Failed to download backup" });
    }
  }

  private _handleRestoreBackup(timestamp: number): void {
    // If the selected world is the current slot's world and the slot is running,
    // show confirmation dialog
    if (this.state.selectedWorldId === this.props.currentSlotWorldId && this.props.isSlotRunning) {
      this.setState({ showRestoreConfirm: true, restoreTimestamp: timestamp });
    } else {
      // Proceed directly
      this._performRestore(timestamp);
    }
  }

  private async _handleConfirmRestore(): Promise<void> {
    if (this.state.restoreTimestamp !== undefined) {
      await this._performRestore(this.state.restoreTimestamp);
    }
    this.setState({ showRestoreConfirm: false, restoreTimestamp: undefined });
  }

  private _handleCancelRestore(): void {
    this.setState({ showRestoreConfirm: false, restoreTimestamp: undefined });
  }

  private async _performRestore(timestamp: number): Promise<void> {
    if (!this.state.selectedWorldId) return;

    this.setState({ isRestoring: true });

    try {
      await axios.post(
        this._getApiUrl() + `api/worlds/${this.state.selectedWorldId}/backups/${timestamp}/restore`,
        { slot: this.props.currentSlot },
        { headers: this._getAuthHeaders() }
      );

      // If we restored to the active slot while it was running, restart it
      if (
        this.state.selectedWorldId === this.props.currentSlotWorldId &&
        this.props.isSlotRunning &&
        this.props.onRestartRequired
      ) {
        await this.props.onRestartRequired();
      }

      this.setState({ isRestoring: false });

      // Reload backups to show any changes
      this._loadBackups(this.state.selectedWorldId);
    } catch (err: any) {
      this.setState({
        isRestoring: false,
        error: err.message || "Failed to restore backup",
      });
    }
  }

  private _formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  private _formatDate(dateStr: string | number | undefined): string {
    if (dateStr === undefined || dateStr === null || dateStr === "") {
      return "—";
    }
    const date = typeof dateStr === "number" ? new Date(dateStr) : new Date(dateStr);
    if (isNaN(date.getTime())) {
      return "—";
    }
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  }

  render() {
    const selectedWorld = this.state.worlds.find((w) => w.worldId === this.state.selectedWorldId);

    const worldListItems = this.state.worlds.map((world, index) => {
      const isCurrentSlotWorld = world.worldId === this.props.currentSlotWorldId || world.isActiveWorld;
      return {
        key: world.worldId,
        header: (
          <div className="wdl-worldHeader">
            <span className="wdl-worldName">{world.friendlyName}</span>
            {isCurrentSlotWorld && (
              <span
                className="wdl-currentSlotIndicator"
                title={world.isActiveWorld ? `Active on slot ${world.slotPort}` : "Currently used by active slot"}
              >
                <FontAwesomeIcon icon={faCheck} className="fa-sm" /> Active
              </span>
            )}
          </div>
        ),
        content: (
          <div className="wdl-worldInfo">
            {world.isActiveWorld ? (
              <span>Slot {world.slotPort} • No backups yet</span>
            ) : (
              <>
                <span>
                  {world.backupCount} backup{world.backupCount !== 1 ? "s" : ""}
                </span>
                {world.totalBytes !== undefined && <span> • {this._formatBytes(world.totalBytes)}</span>}
              </>
            )}
          </div>
        ),
        className: this.state.selectedWorldId === world.worldId ? "wdl-worldSelected" : "",
      };
    });

    const backupListItems = this.state.backups.map((backup) => ({
      key: backup.timestamp,
      header: (
        <div className="wdl-backupHeader">
          <span className="wdl-backupDate">{this._formatDate(backup.timestamp)}</span>
          <span className="wdl-backupType">{backup.type}</span>
        </div>
      ),
      content: (
        <div className="wdl-backupInfo">
          <span>{backup.fileCount} files</span>
          <span> • {this._formatBytes(backup.totalBytes)}</span>
          {backup.description && <span> • {backup.description}</span>}
        </div>
      ),
      actions: (
        <div className="wdl-backupActions">
          <IconButton
            size="small"
            title="Download as .mcworld"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              this._handleDownloadBackup(this.state.selectedWorldId!, backup.timestamp);
            }}
          >
            <FontAwesomeIcon icon={faDownload} />
          </IconButton>
          <IconButton
            size="small"
            title="Restore this backup to current slot"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              this._handleRestoreBackup(backup.timestamp);
            }}
            disabled={this.state.isRestoring}
          >
            <FontAwesomeIcon icon={faUndo} />
          </IconButton>
        </div>
      ),
    }));

    const selectedIndex = this.state.worlds.findIndex((w) => w.worldId === this.state.selectedWorldId);

    return (
      <>
        <Dialog
          open={this.props.isOpen}
          onClose={this.props.onClose}
          maxWidth={false}
          PaperProps={{ sx: { width: "950px", maxWidth: "95vw" } }}
        >
          <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            Worlds
            <IconButton aria-label="Close" onClick={this.props.onClose} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <div className="wdl-content">
              {this.state.isLoading ? (
                <div className="wdl-loading">
                  <CircularProgress size={24} /> <span>Loading worlds...</span>
                </div>
              ) : this.state.error ? (
                <div className="wdl-error">
                  <FontAwesomeIcon icon={faExclamationTriangle} /> {this.state.error}
                </div>
              ) : (
                <div className="wdl-mainContent">
                  {/* Left panel: World list */}
                  <div className="wdl-worldListPanel">
                    <Typography variant="subtitle1" fontWeight="bold">
                      <FontAwesomeIcon icon={faGlobe} /> All Worlds
                    </Typography>
                    {this.state.worlds.length === 0 ? (
                      <div className="wdl-noWorlds">No worlds found</div>
                    ) : (
                      <List className="wdl-worldList">
                        {worldListItems.map((item, index) => (
                          <ListItem key={item.key} disablePadding className={item.className}>
                            <ListItemButton
                              selected={index === selectedIndex}
                              onClick={() => this._handleWorldSelected(index)}
                            >
                              <ListItemText primary={item.header} secondary={item.content} />
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </div>

                  <Divider orientation="vertical" flexItem />

                  {/* Right panel: World details and backups */}
                  <div className="wdl-detailPanel">
                    {selectedWorld ? (
                      <>
                        <div className="wdl-worldDetails">
                          <Typography variant="h6" fontWeight="bold">
                            {selectedWorld.friendlyName}
                          </Typography>
                          {selectedWorld.description && (
                            <Typography variant="body2" className="wdl-description">
                              {selectedWorld.description}
                            </Typography>
                          )}
                          <div className="wdl-metadata">
                            <div className="wdl-metaRow">
                              <span className="wdl-metaLabel">Created:</span>
                              <span>{this._formatDate(selectedWorld.createdAt)}</span>
                            </div>
                            <div className="wdl-metaRow">
                              <span className="wdl-metaLabel">Last Modified:</span>
                              <span>{this._formatDate(selectedWorld.lastModified)}</span>
                            </div>
                            <div className="wdl-metaRow">
                              <span className="wdl-metaLabel">World ID:</span>
                              <span className="wdl-worldId">{selectedWorld.worldId}</span>
                            </div>
                          </div>
                        </div>

                        <Divider />

                        <div className="wdl-backupsSection">
                          <Typography variant="subtitle1" fontWeight="bold">
                            Version History ({selectedWorld.backupCount} backups)
                          </Typography>
                          {this.state.loadingBackups ? (
                            <div>
                              <CircularProgress size={20} /> <span>Loading backups...</span>
                            </div>
                          ) : this.state.backups.length === 0 ? (
                            <div className="wdl-noBackups">No backups available</div>
                          ) : (
                            <List className="wdl-backupList">
                              {backupListItems.map((item) => (
                                <ListItem key={item.key} secondaryAction={item.actions}>
                                  <ListItemText primary={item.header} secondary={item.content} />
                                </ListItem>
                              ))}
                            </List>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="wdl-noSelection">Select a world to view details</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={this.props.onClose} size="small">
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Confirmation dialog for restore on running slot */}
        <Dialog open={this.state.showRestoreConfirm} onClose={this._handleCancelRestore}>
          <DialogTitle>Confirm Restore</DialogTitle>
          <DialogContent>
            <div className="wdl-confirmContent">
              <FontAwesomeIcon icon={faExclamationTriangle} className="wdl-warningIcon" />
              <p>This operation will restart the current slot to apply the restored backup.</p>
              <p>Are you sure you want to proceed?</p>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={this._handleCancelRestore} size="small">
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={this._handleConfirmRestore}
              disabled={this.state.isRestoring}
              size="small"
            >
              Restore and Restart
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }
}
