import { Component } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./ProjectMap.css";
import { ThemeInput } from "@fluentui/react-northstar";
import { ProjectEditorAction, ProjectEditorMode } from "./ProjectEditorUtilities";
import { Background, Controls, Edge, MiniMap, Node, ReactFlow } from "@xyflow/react";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../app/CreatorToolsHost";
import ProjectItemNode from "./ProjectItemNode";
import ProjectItemRelationshipEdge from "./ProjectItemRelationshipEdge";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import { ProjectItemType } from "../app/IProjectItemData";
import ProjectItem from "../app/ProjectItem";

interface IProjectMapProps extends IAppProps {
  project: Project;
  theme: ThemeInput<any>;
  heightOffset: number;
  sourceItem?: ProjectItem;
  onActionRequested?: (action: ProjectEditorAction) => void;
  onModeChangeRequested?: (mode: ProjectEditorMode) => void;
}

interface IProjectMapState {
  context?: ProjectMapRenderContext;
}

export class ProjectMapRenderContext {
  nodes: Node[] = [];
  edges: Edge[] = [];
  columnY: number[] = [];
  itemsAdded: { [name: string]: Node } = {};
}

// Visual column constants
const COLUMN_BEHAVIOR = 4;
const COLUMN_RESOURCE = 6;
const COLUMN_RESOURCE_RELATED = 7;
const COLUMN_BEHAVIOR_RELATED = 3;
const COLUMN_DEFAULT = 5;
const MAX_VISUAL_COLUMNS = 10;

// Layout constants
const COLUMN_X_STEP = 200;
const NODE_Y_STEP = 60;
const PRIMARY_BEHAVIOR_COLUMN = 4;
const PRIMARY_RESOURCE_COLUMN = 6;
const BEHAVIOR_SIDE_COLUMN_MIN = 0;
const BEHAVIOR_SIDE_COLUMN_MAX = 2;
const RESOURCE_SIDE_COLUMN_MIN = 7;
const RESOURCE_SIDE_COLUMN_MAX = 9;
const COLUMN_Y_SYNC_THRESHOLD = 240;
const COLUMN_Y_SYNC_OFFSET = 200;

export default class ProjectMap extends Component<IProjectMapProps, IProjectMapState> {
  constructor(props: IProjectMapProps) {
    super(props);

    this.state = {};
  }

  /*
    The general algorithm to lay this out these relationships: 

    Lay cards into visual "columns", separated by ~400px  
    At column 4, put the entity/item/block type (typically the highest conceptual level). 
    Have subsidiary things (e.g., spawn rules) flow to the left so they will end up in column 3, 2, 1
    At column 6, put the Entity/Item/Block "resource equivalents" of visual resource pack stuff (typically the highest concept). 
    Have subsidary things (e.g., render controllers) flow to the right so they will end up in column 6. Subsidary things to that (e.g., textures) will end up
    in column 7.
    Not sure why column 5 is unused, maybe we'll put something in that.

    We're kind of making a call that the max conceptual hierarchy for behaviors is 3 (cols 1-4) and resources is 3 (cols 6-9). We don't want to go too wide, either, 
    so I guess this is a reasonable balance.
  */

  getTargetColumn(projectItem: ProjectItem): number {
    if (
      projectItem.itemType === ProjectItemType.entityTypeBehavior ||
      projectItem.itemType === ProjectItemType.itemTypeBehavior ||
      projectItem.itemType === ProjectItemType.blockTypeBehavior
    ) {
      return COLUMN_BEHAVIOR;
    }

    if (
      projectItem.itemType === ProjectItemType.attachableResourceJson ||
      projectItem.itemType === ProjectItemType.entityTypeResource
    ) {
      return COLUMN_RESOURCE;
    }

    if (ProjectItemUtilities.isResourceRelated(projectItem.itemType)) {
      return COLUMN_RESOURCE_RELATED;
    }

    if (ProjectItemUtilities.isBehaviorRelated(projectItem.itemType)) {
      return COLUMN_BEHAVIOR_RELATED;
    }

    return COLUMN_DEFAULT;
  }

  componentDidMount() {
    this._generateContext();
  }

  async _generateContext() {
    let projectItemsList = undefined;

    await this.props.project.processRelations();

    if (this.props.sourceItem) {
      projectItemsList = ProjectItemUtilities.getRootAncestorItems(this.props.sourceItem);
    } else {
      projectItemsList = this.props.project.getItemsCopy();
    }

    projectItemsList.sort((a, b) => {
      const typeOrderA = ProjectItemUtilities.getSortOrder(a.itemType);
      const typeOrderB = ProjectItemUtilities.getSortOrder(b.itemType);

      if (typeOrderA !== typeOrderB) {
        return typeOrderA - typeOrderB;
      }

      if (a.projectPath && b.projectPath) {
        return a.projectPath.localeCompare(b.projectPath);
      }

      return 0;
    });

    const context = new ProjectMapRenderContext();

    for (let i = 0; i < MAX_VISUAL_COLUMNS; i++) {
      context.columnY[i] = 0;
    }

    for (const projectItem of projectItemsList) {
      if (projectItem.projectPath && projectItem.parentItemCount === 0 && projectItem.childItemCount > 0) {
        this.addItem(context, projectItem);
      }
    }

    this.setState({ context: context });
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";

    if (!this.state || !this.state.context) {
      return <div className="pmap-loading">Loading...</div>;
    }

    return (
      <div className="pmap-container" style={{ height: height }}>
        <ReactFlow
          defaultNodes={this.state.context.nodes}
          edgeTypes={{
            "item-edge": ProjectItemRelationshipEdge,
          }}
          nodeTypes={{
            projectItem: ProjectItemNode,
          }}
          nodesDraggable
          defaultEdges={this.state.context.edges}
          colorMode={CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "dark" : "light"}
        >
          <Controls />
          <MiniMap />
          <Background />
        </ReactFlow>
      </div>
    );
  }

  addItem(context: ProjectMapRenderContext, item: ProjectItem) {
    if (!item.projectPath) {
      return;
    }

    const column = this.getTargetColumn(item);

    if (context.columnY[column] === undefined) {
      context.columnY[column] = 0;
    }

    // is this a primary column?  if yes, then start at a new low Y
    if (column >= PRIMARY_BEHAVIOR_COLUMN && column <= PRIMARY_RESOURCE_COLUMN) {
      context.columnY[column] = Math.max(...context.columnY);

      // don't let the side columns fall too far behind the core columns
      for (let i = BEHAVIOR_SIDE_COLUMN_MIN; i <= BEHAVIOR_SIDE_COLUMN_MAX; i++) {
        if (context.columnY[i] < context.columnY[column] - COLUMN_Y_SYNC_THRESHOLD) {
          context.columnY[i] = context.columnY[column] - COLUMN_Y_SYNC_OFFSET;
        }
      }
      for (let i = RESOURCE_SIDE_COLUMN_MIN; i <= RESOURCE_SIDE_COLUMN_MAX; i++) {
        if (context.columnY[i] < context.columnY[column] - COLUMN_Y_SYNC_THRESHOLD) {
          context.columnY[i] = context.columnY[column] - COLUMN_Y_SYNC_OFFSET;
        }
      }
    }

    context.columnY[column] += NODE_Y_STEP;

    let node = context.nodes.find((n) => n.id === item.projectPath);

    if (!node) {
      node = {
        id: item.projectPath,
        type: "projectItem",
        position: { x: column * COLUMN_X_STEP, y: context.columnY[column] },
        data: {
          label: item.name,
          isSelected: item === this.props.sourceItem,
          targetColumn: column,
          item: item,
          project: this.props.project,
          theme: this.props.theme,
        },
      };

      context.itemsAdded[item.projectPath] = node;
      context.nodes.push(node);

      if (item.childItems) {
        for (const childItem of item.childItems) {
          const relNode = this.addItem(context, childItem.childItem);

          if (relNode) {
            const id = `${item.projectPath}-${childItem.childItem.projectPath}`;

            if (!context.edges.find((e) => e.id === id)) {
              const direction = (relNode.data.targetColumn as number) - column;
              context.edges.push({
                id: id,
                source: item.projectPath,
                type: "item-edge",
                target: relNode.id,
                sourceHandle: column === 4 && direction > 0 ? "sourceRight" : undefined,
                data: {
                  project: this.props.project,
                  direction: direction,
                  description: ProjectItemUtilities.getRelationshipDescription(childItem),
                },
              });
            }
          }
        }
      }
    }

    return node;
  }
}
