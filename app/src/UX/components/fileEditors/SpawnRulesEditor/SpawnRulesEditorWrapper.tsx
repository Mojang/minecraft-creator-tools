/**
 * SPAWN RULES EDITOR WRAPPER
 * ===========================
 *
 * Wraps the spawn rules editing experience with two subtabs:
 * - "Biomes" (default) — SimplifiedSpawnRulesEditor for beginner-friendly biome picking
 * - "Advanced" — the full SchemaEditor-based SpawnRulesEditor for power users
 *
 * Both editors operate on the same IFile. When switching subtabs, the active
 * editor re-reads from the file to pick up changes made in the other view.
 *
 * RELATED FILES:
 * - SimplifiedSpawnRulesEditor.tsx — the biome picker editor
 * - SpawnRulesEditor.tsx — the schema-based advanced editor
 * - EntityTypeEditor.tsx — parent that renders this wrapper in the Spawn tab
 */

import { useCallback, useState } from "react";
import { Stack, Button } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGlobe, faGear } from "@fortawesome/free-solid-svg-icons";
import { CustomTabLabel } from "../../../shared/components/feedback/labels/Labels";
import Project from "../../../../app/Project";
import IFile from "../../../../storage/IFile";
import IPersistable from "../../../types/IPersistable";
import SimplifiedSpawnRulesEditor from "./SimplifiedSpawnRulesEditor";
import SpawnRulesEditor from "./SpawnRulesEditor";
import IProjectTheme from "../../../types/IProjectTheme";
import { getThemeColors } from "../../../hooks/theme/useThemeColors";
import { EditorHeaderChip, EditorHeaderBar } from "../../../appShell/EditorHeader";
import { ProjectItemType } from "../../../../app/IProjectItemData";
import StorageUtilities from "../../../../storage/StorageUtilities";
import Utilities from "../../../../core/Utilities";

type SpawnRulesEditorWrapperProps = {
  project: Project;
  file: IFile;
  setActivePersistable?: (persistable: IPersistable) => void;
  readOnly?: boolean;
  heightOffset?: number;
  theme: IProjectTheme;
};

type SubTab = "biomes" | "advanced";

const SUBTAB_BAR_HEIGHT = 40;

export default function SpawnRulesEditorWrapper({
  project,
  file,
  setActivePersistable,
  readOnly,
  heightOffset,
  theme,
}: SpawnRulesEditorWrapperProps) {
  const [activeTab, setActiveTab] = useState<SubTab>("biomes");

  // Key that forces remount when switching tabs, so the editor re-reads the file
  const [contentKey, setContentKey] = useState(0);

  const colors = getThemeColors();

  const switchTab = useCallback(
    (tab: SubTab) => {
      if (tab === activeTab) return;
      setActiveTab(tab);
      setContentKey((k) => k + 1);
    },
    [activeTab]
  );

  const innerHeightOffset = (heightOffset ?? 0) + SUBTAB_BAR_HEIGHT;

  // Read the spawn-rule identifier (and format version) directly from the file so the
  // header chip stays consistent with the other editor surfaces (Biome, Recipe, etc.)
  // — see `Spawn-rules editor header lacks a content-type badge` finding (C2).
  // We tolerate parse failures: if the file is in an error state we fall back to the
  // file's base name so users still see something meaningful instead of "unknown".
  let spawnRuleId = "";
  let formatVersion: string | undefined;
  try {
    const json = StorageUtilities.getJsonObject(file);
    spawnRuleId = json?.["minecraft:spawn_rules"]?.description?.identifier ?? "";
    formatVersion = typeof json?.format_version === "string" ? json.format_version : undefined;
  } catch {
    // ignored — fall back to file name below
  }
  const headerItemId =
    spawnRuleId || (file.name ? Utilities.humanifyMinecraftName(StorageUtilities.getBaseFromName(file.name)) : "(new spawn rule)");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <EditorHeaderChip itemType={ProjectItemType.spawnRuleBehavior} theme={theme}>
        <EditorHeaderBar
          itemId={headerItemId}
          itemType={ProjectItemType.spawnRuleBehavior}
          typeName="Spawn Rules"
          formatVersion={formatVersion}
        />
      </EditorHeaderChip>

      <div
        style={{
          borderBottom: `1px solid ${colors.sectionBorder}`,
          padding: "4px 8px",
          background: colors.background2,
        }}
      >
        <Stack direction="row" spacing={0.5}>
          <Button onClick={() => switchTab("biomes")} title="Simplified biome picker">
            <CustomTabLabel
              icon={<FontAwesomeIcon icon={faGlobe} className="fa-lg" />}
              text="Biomes"
              isCompact={false}
              isSelected={activeTab === "biomes"}
              theme={theme}
            />
          </Button>
          <Button onClick={() => switchTab("advanced")} title="Full spawn rules editor">
            <CustomTabLabel
              icon={<FontAwesomeIcon icon={faGear} className="fa-lg" />}
              text="Advanced"
              isCompact={false}
              isSelected={activeTab === "advanced"}
              theme={theme}
            />
          </Button>
        </Stack>
      </div>

      <div style={{ flex: 1, overflow: "hidden" }}>
        {activeTab === "biomes" ? (
          <SimplifiedSpawnRulesEditor
            key={`biomes-${contentKey}`}
            project={project}
            file={file}
            setActivePersistable={setActivePersistable}
            readOnly={readOnly}
            heightOffset={innerHeightOffset}
          />
        ) : (
          <SpawnRulesEditor
            key={`advanced-${contentKey}`}
            project={project}
            file={file}
            setActivePersistable={setActivePersistable}
            readOnly={readOnly}
            heightOffset={innerHeightOffset}
          />
        )}
      </div>
    </div>
  );
}
