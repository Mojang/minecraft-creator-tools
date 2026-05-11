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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
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
