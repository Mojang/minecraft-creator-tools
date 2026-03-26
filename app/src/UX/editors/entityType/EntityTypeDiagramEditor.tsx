import { Component } from "react";
import "./EntityTypeDiagramEditor.css";
import "./EntityTypeDiagram.css";
import IAppProps from "../../appShell/IAppProps";
import EntityTypeDefinition from "../../../minecraft/EntityTypeDefinition";
import { Stack, Button, FormControl, Select, MenuItem, SelectChangeEvent } from "@mui/material";
import {
  ReactFlow,
  Controls,
  Background,
  Edge,
  Node,
  NodeChange,
  NodeDimensionChange,
  NodeSelectionChange,
  NodePositionChange,
  Position,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import EntityTypeEventEdge from "./EntityTypeEventEdge";
import Project from "../../../app/Project";
import EntityTypeComponentSetNode from "./EntityTypeComponentSetNode";
import IManagedComponentSetItem from "../../../minecraft/IManagedComponentSetItem";
import EntityTypeEventNode from "./EntityTypeEventNode";
import IEventWrapper from "../../../minecraft/IEventWrapper";
import IEntityAction from "../../../minecraft/IEventAction";
import EventComponentGroupAddEdge from "../event/EventComponentGroupAddEdge";
import EventComponentGroupRemoveEdge from "../event/EventComponentGroupRemoveEdge";
import { CustomLabel } from "../../shared/components/feedback/labels/Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import EventActionDesign from "../event/EventActionDesign";
import ManagedEventActionOrActionSet from "../../../minecraft/ManagedEventActionOrActionSet";
import EntityTypeComponentSetEditor from "./EntityTypeComponentSetEditor";
import EntityTypeComponentSetUtilities from "../../../minecraft/EntityTypeComponentSetUtilities";
import EntityTypeStateEdge from "./EntityTypeStateEdge";
import EntityTypeStateNode from "./EntityTypeStateNode";
import { EntityTypeStateBuilder } from "../../../minecraft/EntityTypeStateBuilder";
import IProjectTheme from "../../types/IProjectTheme";

// ═══════════════════════════════════════════════════════════════════════════
// DIAGRAM LAYOUT CONSTANTS
//
// These control the spacing and positioning of nodes in the entity diagram.
// Larger values = more spacious layout. Adjust for visual clarity.
// ═══════════════════════════════════════════════════════════════════════════

// Column counts for different node types
const DIAGRAM_COLUMN_COUNT = 4;
const DIAGRAM_EVENT_COLUMN_COUNT = 3;
const DIAGRAM_COMPONENT_SET_POSITION_MOD = 6;
const DIAGRAM_COMPONENT_SET_COLUMN_COUNT = 3;

// Event node positioning - generous spacing to avoid overlaps
const DIAGRAM_EVENT_TOPMOUNTED_Y_OFFSET = 280; // Was 180 - more vertical space for top events
const DIAGRAM_EVENT_Y_STEP = 400; // Was 320 - much more vertical spacing between events
const DIAGRAM_EVENT_X_STEP = 700; // Was 600 - wider horizontal spacing
const DIAGRAM_EVENT_TOPMOUNTED_X_OFFSET = -200; // Was -160 - offset for top-mounted events
const DIAGRAM_EVENT_X_OFFSET = 400; // Was 320 - horizontal offset for non-top events
const DIAGRAM_EVENT_Y_DECREMENT = 450; // Was 340 - initial Y gap before events

// Component set (group) positioning - prevent overlaps
const DIAGRAM_COMPONENT_SET_Y_STEP = 180; // Was 120 - more base vertical spacing for groups
const DIAGRAM_COMPONENT_SET_Y_MULTIPLIER = 50; // Was 42 - more Y per connection point
const DIAGRAM_COMPONENT_SET_X_OFFSET = 50; // Horizontal offset to stagger columns
const DIAGRAM_COMPONENT_SET_MIN_GAP = 80; // Minimum gap between component sets

// Unconnected component groups - placed in a sidebar
const DIAGRAM_UNCONNECTED_X_OFFSET = -350; // X offset for unconnected groups (left sidebar)
const DIAGRAM_UNCONNECTED_Y_START = 100; // Starting Y position for unconnected groups

// State diagram positioning
const DIAGRAM_STATE_X_STEP = 700; // Was 600 - wider horizontal spacing
const DIAGRAM_STATE_Y_STEP = 600; // Was 500 - more vertical spacing
const DIAGRAM_STATE_HIDDEN_Y_OFFSET = -1000; // Was -800 - further offset for hidden states

const DIAGRAM_MARKER_WIDTH = 20;
const DIAGRAM_MARKER_HEIGHT = 20;
const DIAGRAM_MARKER_LARGE_WIDTH = 30;
const DIAGRAM_MARKER_LARGE_HEIGHT = 30;

const DIAGRAM_EDITOR_PANE_HEIGHT = 500;

enum EntityTypeDiagramType {
  groupsAndEvents = 0,
  statesAndConnections = 1,
}

const DiagramTypeStrings = ["Groups and events", "States and connections"];

interface IEntityTypeDiagramEditorProps extends IAppProps {
  entityType: EntityTypeDefinition;
  project: Project;
  heightOffset: number;
  theme: IProjectTheme;

  /** When provided, enables an expand button on inline action editors to open them in the full actions tab. */
  onOpenEventFull?: (eventId: string) => void;
}

interface IEntityTypeDiagramEditorState {
  targetEntityTypeId: string;
  groupsAndEventsContext?: EntityTypeGroupsAndEventsDiagramContext;
  activeDiagramType?: EntityTypeDiagramType;
  groupsAndEventsNodes?: Node[];
  groupsAndEventsEdges?: Edge[];
  statesAndConnectionsDefaultNodes?: Node[];
  statesAndConnectionsDefaultEdges?: Edge[];
  statesAndConnectionsNodes?: Node[];
  statesAndConnectionsEdges?: Edge[];
  selectedEntityTypeEvent?: ManagedEventActionOrActionSet;
  selectedEntityTypeEventId?: string;
  selectedComponentSet?: IManagedComponentSetItem;
  selectedGroupState?: string[];
}

export class EntityTypeGroupsAndEventsDiagramContext {
  nodes: Node[] = [];
  edges: Edge[] = [];
  topPosition = 0;
  minEntityEventColumnY: number[] = [];
  maxEntityEventColumnY: number[] = [];
  minComponentSetColumnY: number[] = [];
  maxComponentSetColumnY: number[] = [];
  componentSetPosition: number = 1;
  unconnectedY?: number; // Y position tracker for unconnected component groups (sidebar)
  componentSetsAdded: { [name: string]: Node } = {};
  entityEventsAdded: { [name: string]: Node } = {};
}

export default class EntityTypeDiagramEditor extends Component<
  IEntityTypeDiagramEditorProps,
  IEntityTypeDiagramEditorState
> {
  constructor(props: IEntityTypeDiagramEditorProps) {
    super(props);

    this._handleEventAddComponentGroup = this._handleEventAddComponentGroup.bind(this);
    this._handleEventAddAction = this._handleEventAddAction.bind(this);

    this._handleDiagramTypeChange = this._handleDiagramTypeChange.bind(this);
    this._generateContext = this._generateContext.bind(this);
    this._statesAndConnectionsNodesUpdated = this._statesAndConnectionsNodesUpdated.bind(this);
    this._groupAndEventsNodesUpdated = this._groupAndEventsNodesUpdated.bind(this);
  }

  static getDerivedStateFromProps(props: IEntityTypeDiagramEditorProps, state: IEntityTypeDiagramEditorState) {
    if (state && props && props.entityType && props.entityType.id !== state.targetEntityTypeId) {
      return {
        targetEntityTypeId: props.entityType.id,
        context: undefined,
        selectedEntityTypeEvent: undefined,
        selectedEntityTypeEventId: undefined,
        selectedComponentSet: undefined,
      };
    }

    return null;
  }

  componentDidMount(): void {
    this._generateContext();
  }

  componentDidUpdate(prevProps: IEntityTypeDiagramEditorProps, prevState: IEntityTypeDiagramEditorState) {
    if (prevState && !prevState.groupsAndEventsContext) {
      this._generateContext();
    }
  }

  _statesAndConnectionsNodesUpdated(nodeChanges: NodeChange[]) {
    const nodeSet = this.state.statesAndConnectionsNodes
      ? this.state.statesAndConnectionsNodes
      : this.state.statesAndConnectionsDefaultNodes;

    if (!nodeSet) {
      return;
    }

    let newSelectedGroupState: string[] | undefined = undefined;

    for (const nodeChange of nodeChanges) {
      for (const nodeTarget of nodeSet) {
        if (nodeTarget.id === (nodeChange as any).id) {
          if (nodeChange.type === "position") {
            const pos = (nodeChange as NodePositionChange).position;
            if (pos) {
              nodeTarget.position = pos;
            }
          } else if (nodeChange.type === "select") {
            nodeTarget.selected = (nodeChange as NodeSelectionChange).selected;

            if (nodeTarget.selected) {
              if ((nodeTarget.data as any).componentGroupAddRemoves) {
                newSelectedGroupState = (nodeTarget.data as any).componentGroupAddRemoves;
              }
            }
          } else {
            const dimensionUpdates = (nodeChange as NodeDimensionChange).dimensions;
            if (dimensionUpdates) {
              nodeTarget.width = dimensionUpdates.width;
              nodeTarget.height = dimensionUpdates.height;
            }
          }
          break;
        }
      }
    }

    this.setState({
      groupsAndEventsContext: this.state.groupsAndEventsContext,
      targetEntityTypeId: this.state.targetEntityTypeId,
      activeDiagramType: this.state.activeDiagramType,
      groupsAndEventsNodes: this.state.groupsAndEventsNodes,
      groupsAndEventsEdges: this.state.groupsAndEventsEdges,
      statesAndConnectionsNodes: nodeSet,
      statesAndConnectionsEdges: this.state.statesAndConnectionsEdges,
      selectedEntityTypeEvent: this.state.selectedEntityTypeEvent,
      selectedEntityTypeEventId: this.state.selectedEntityTypeEventId,
      selectedComponentSet: this.state.selectedComponentSet,
      selectedGroupState: newSelectedGroupState,
    });
  }

  _groupAndEventsNodesUpdated(nodeChanges: NodeChange[]) {
    const nodeSet = this.state.groupsAndEventsNodes
      ? this.state.groupsAndEventsNodes
      : this.state.groupsAndEventsContext?.nodes;

    if (!nodeSet) {
      return;
    }

    let newSelectedEntityTypeEvent: ManagedEventActionOrActionSet | undefined = undefined;
    let newSelectedComponentSet: IManagedComponentSetItem | undefined = undefined;
    let newSelectedEntityTypeEventId: string | undefined = undefined;

    let hasSelection = false;

    for (const nodeChange of nodeChanges) {
      for (const nodeTarget of nodeSet) {
        if (nodeTarget.id === (nodeChange as any).id) {
          if (nodeChange.type === "position") {
            const pos = (nodeChange as NodePositionChange).position;
            if (pos) {
              nodeTarget.position = pos;
            }
          } else if (nodeChange.type === "select") {
            hasSelection = true;
            nodeTarget.selected = (nodeChange as NodeSelectionChange).selected;

            if (nodeTarget.selected) {
              if ((nodeTarget.data as any).componentSet) {
                newSelectedComponentSet = (nodeTarget.data as any).componentSet;
              } else if ((nodeTarget.data as any).entityEvent) {
                newSelectedEntityTypeEvent = (nodeTarget.data as any).entityEvent;
                newSelectedEntityTypeEventId = (nodeTarget.data as any).item.id;
              }
            }
          } else {
            const dimensionUpdates = (nodeChange as NodeDimensionChange).dimensions;
            if (dimensionUpdates) {
              nodeTarget.width = dimensionUpdates.width;
              nodeTarget.height = dimensionUpdates.height;
            }
          }
          break;
        }
      }
    }

    if (!hasSelection) {
      newSelectedComponentSet = this.state.selectedComponentSet;
      newSelectedEntityTypeEvent = this.state.selectedEntityTypeEvent;
      newSelectedEntityTypeEventId = this.state.selectedEntityTypeEventId;
    }

    this.setState({
      groupsAndEventsContext: this.state.groupsAndEventsContext,
      targetEntityTypeId: this.state.targetEntityTypeId,
      activeDiagramType: this.state.activeDiagramType,
      groupsAndEventsNodes: nodeSet,
      groupsAndEventsEdges: this.state.groupsAndEventsEdges,
      selectedEntityTypeEvent: newSelectedEntityTypeEvent,
      selectedEntityTypeEventId: newSelectedEntityTypeEventId,
      selectedComponentSet: newSelectedComponentSet,
      selectedGroupState: this.state.selectedGroupState,
    });
  }

  async _generateContext() {
    const context = new EntityTypeGroupsAndEventsDiagramContext();

    for (let i = 0; i < DIAGRAM_COLUMN_COUNT; i++) {
      context.minComponentSetColumnY[i] = 0;
      context.maxComponentSetColumnY[i] = 0;
      context.minEntityEventColumnY[i] = 0;
      context.maxEntityEventColumnY[i] = 0;
    }

    const componentGroupList = this.props.entityType.getCoreAndComponentGroupList();

    for (const componentSet of componentGroupList) {
      await this._generateNodesForComponentSet(context, componentSet);
    }

    for (let i = 0; i < DIAGRAM_COLUMN_COUNT; i++) {
      context.minEntityEventColumnY[i] = Math.min(...context.minEntityEventColumnY);
    }

    for (let i = 0; i < DIAGRAM_COLUMN_COUNT; i++) {
      context.minEntityEventColumnY[i] -= DIAGRAM_EVENT_Y_DECREMENT;
    }

    const eventList = this.props.entityType.getEvents();

    for (const entityEvent of eventList) {
      await this._generateNodesForEvent(context, entityEvent, 0, true);
    }

    const states = await EntityTypeStateBuilder.getStates(this.props.entityType);
    const stateNodes: Node[] = [];
    const stateEdges: Edge[] = [];

    let stateIndex = 0;
    let hiddenStateIndex = 0;

    const stateKeys = states.keys();
    for (const stateId of stateKeys) {
      const state = states.get(stateId);

      if (state && state.isLikely) {
        let xPos = 0;
        let yPos = 0;

        if (state.isLikely) {
          xPos = (stateIndex % DIAGRAM_COLUMN_COUNT) * DIAGRAM_STATE_X_STEP;
          yPos = Math.floor(stateIndex / DIAGRAM_COLUMN_COUNT) * DIAGRAM_STATE_Y_STEP;
          stateIndex++;
        } else {
          xPos = (hiddenStateIndex % DIAGRAM_COLUMN_COUNT) * DIAGRAM_STATE_X_STEP;
          yPos =
            DIAGRAM_STATE_HIDDEN_Y_OFFSET - Math.floor(hiddenStateIndex / DIAGRAM_COLUMN_COUNT) * DIAGRAM_STATE_Y_STEP;
          hiddenStateIndex++;
        }

        const node = {
          id: state.id,
          type: "entity-type-state",
          data: {
            state: state,
            entityType: this.props.entityType,
            isSelected: false,
            componentGroupAddRemoves: state.componentGroupAddRemoves,
            isLikely: state.isLikely,
            project: this.props.project,
            theme: this.props.theme,
            creatorTools: this.props.creatorTools,
          },
          position: { x: xPos, y: yPos },
        };

        for (const conn of state.outboundConnections) {
          if (conn.target && conn.isLikely) {
            const edge = {
              id: conn.source.id + "." + conn.target.id,
              source: conn.source.id,
              sourceHandle: "source",
              type: "entity-type-state-edge",
              target: conn.target.id,
              targetHandle: "target",
              data: {
                project: this.props.project,
                sourceState: state,
                isLikely: conn.isLikely,
                title: conn.title,
              },
            };

            stateEdges.push(edge);
          }
        }

        stateNodes.push(node);
      }
    }

    this.setState({
      groupsAndEventsContext: context,
      targetEntityTypeId: this.props.entityType.id,
      statesAndConnectionsDefaultNodes: stateNodes,
      statesAndConnectionsDefaultEdges: stateEdges,
      groupsAndEventsNodes: context.nodes,
      groupsAndEventsEdges: context.edges,
    });
  }

  async _generateNodesForEvent(
    context: EntityTypeGroupsAndEventsDiagramContext,
    entityEvent: IEventWrapper,
    sourceColumn: number,
    isTopMounted?: boolean
  ) {
    let node = context.entityEventsAdded[entityEvent.id];

    if (!node) {
      let y = 0;
      let targetColumn = sourceColumn % DIAGRAM_EVENT_COLUMN_COUNT;

      if (isTopMounted) {
        // Top-mounted events (main events) go above the component groups
        y = context.minEntityEventColumnY[context.topPosition];
        targetColumn = context.topPosition;
        context.topPosition++;

        if (context.topPosition === DIAGRAM_COLUMN_COUNT) {
          for (let i = 0; i < DIAGRAM_COLUMN_COUNT; i++) {
            context.minEntityEventColumnY[i] -= DIAGRAM_EVENT_TOPMOUNTED_Y_OFFSET;
          }

          context.topPosition = context.topPosition % DIAGRAM_COLUMN_COUNT;
        }
      } else {
        // Non-top events: simple linear layout, always grow downward
        if (targetColumn > 1) {
          targetColumn = 1;
        }

        // Always grow downward to avoid overlaps
        context.maxEntityEventColumnY[targetColumn] += DIAGRAM_EVENT_Y_STEP;
        y = context.maxEntityEventColumnY[targetColumn];
      }

      node = {
        id: entityEvent.id,
        type: "entity-event",
        data: {
          targetColumn: targetColumn,
          item: entityEvent,
          entityType: this.props.entityType,
          entityEvent: new ManagedEventActionOrActionSet(entityEvent.event),
          isSelected: false,
          project: this.props.project,
          theme: this.props.theme,
          creatorTools: this.props.creatorTools,
        },
        position: {
          x:
            targetColumn * DIAGRAM_EVENT_X_STEP +
            (isTopMounted ? DIAGRAM_EVENT_TOPMOUNTED_X_OFFSET : DIAGRAM_EVENT_X_OFFSET),
          y: y,
        },
      };

      context.entityEventsAdded[entityEvent.id] = node;

      context.nodes.push(node);
      const cgAdds = (entityEvent.event as IEntityAction).add?.component_groups;
      const cgRemoves = (entityEvent.event as IEntityAction).remove?.component_groups;

      if (cgAdds) {
        for (const cgAdd of cgAdds) {
          const cgList = this.props.entityType.getComponentGroups();

          for (const cg of cgList) {
            if (cg.id === cgAdd) {
              const cgNode = await this._generateNodesForComponentSet(context, cg);

              if (cgNode) {
                context.edges.push({
                  id: entityEvent.id + "." + cgAdd,
                  source: entityEvent.id,
                  type: "event-component-group-add-edge",
                  target: cg.id,
                  targetHandle: "add",
                  data: {
                    project: this.props.project,
                    position: Position.Bottom,
                    eventId: entityEvent.id,
                    componentGroupId: cgAdd,
                  },
                });
              }
            }
          }
        }
      }

      if (cgRemoves) {
        for (const cgRemove of cgRemoves) {
          const cgList = this.props.entityType.getComponentGroups();

          for (const cg of cgList) {
            if (cg.id === cgRemove) {
              const cgNode = await this._generateNodesForComponentSet(context, cg);

              if (cgNode) {
                context.edges.push({
                  id: entityEvent.id + "." + cgRemove,
                  source: entityEvent.id,
                  type: "event-component-group-remove-edge",
                  target: cg.id,
                  targetHandle: "remove",
                  data: {
                    project: this.props.project,
                    position: Position.Bottom,
                    eventId: entityEvent.id,
                    componentGroupId: cgRemove,
                  },
                });
              }
            }
          }
        }
      }
    }

    return node;
  }

  async _generateNodesForComponentSet(
    context: EntityTypeGroupsAndEventsDiagramContext,
    componentSet: IManagedComponentSetItem
  ) {
    let node = context.componentSetsAdded[componentSet.id];

    const allConnectionPoints = await EntityTypeComponentSetUtilities.getTriggers(
      componentSet,
      componentSet === this.props.entityType
    );

    if (!node) {
      // Calculate node height based on connection points
      // This ensures we reserve enough vertical space for tall nodes
      const nodeHeight = DIAGRAM_COMPONENT_SET_Y_STEP + allConnectionPoints.length * DIAGRAM_COMPONENT_SET_Y_MULTIPLIER;

      const hasConnections = allConnectionPoints.length > 0;
      const isBaseEntity = componentSet === this.props.entityType;

      let x = 0;
      let y = 0;
      let targetColumn = 0;

      if (!hasConnections && !isBaseEntity) {
        // Unconnected component groups go in a left sidebar
        // Initialize unconnected Y tracker if needed
        if (context.unconnectedY === undefined) {
          context.unconnectedY = DIAGRAM_UNCONNECTED_Y_START;
        }

        x = DIAGRAM_UNCONNECTED_X_OFFSET;
        y = context.unconnectedY;
        context.unconnectedY += nodeHeight + DIAGRAM_COMPONENT_SET_MIN_GAP;
        targetColumn = -1; // Mark as sidebar
      } else {
        // Connected component groups use column-based layout
        context.componentSetPosition = (context.componentSetPosition + 1) % DIAGRAM_COMPONENT_SET_POSITION_MOD;
        targetColumn = context.componentSetPosition % DIAGRAM_COMPONENT_SET_COLUMN_COUNT;

        // Always grow downward, accounting for actual node height
        context.maxComponentSetColumnY[targetColumn] += nodeHeight + DIAGRAM_COMPONENT_SET_MIN_GAP;
        y = context.maxComponentSetColumnY[targetColumn];

        // Stagger columns slightly in X to reduce wire crossings
        const xOffset = (targetColumn % 2) * DIAGRAM_COMPONENT_SET_X_OFFSET;
        x = targetColumn * DIAGRAM_EVENT_X_STEP + xOffset;
      }

      node = {
        id: componentSet.id,
        type: "component-set",
        data: {
          targetColumn: targetColumn,
          componentSet: componentSet,
          entityType: this.props.entityType,
          isSelected: false,
          connectionPoints: allConnectionPoints,
          project: this.props.project,
          theme: this.props.theme,
        },
        position: { x: x, y: y },
      };

      context.componentSetsAdded[componentSet.id] = node;

      context.nodes.push(node);
    }

    const events = this.props.entityType.getEvents();

    for (const connPoint of allConnectionPoints) {
      if (connPoint.referenceId && connPoint.path) {
        const ref = connPoint.referenceId;

        for (const entityEvent of events) {
          if (entityEvent.id === ref) {
            const eventNode = await this._generateNodesForEvent(context, entityEvent, (node.data as any).targetColumn);

            if (eventNode) {
              context.edges.push({
                id: connPoint.path + "." + entityEvent.id,
                source: componentSet.id,
                sourceHandle: connPoint.path + (eventNode.position.x > node.position.x ? "R" : "L"),
                type: "entity-type-event-edge",
                target: entityEvent.id,
                data: {
                  project: this.props.project,
                  position: eventNode.position.x > node.position.x ? Position.Right : Position.Left,
                },
              });
            }
          }
        }
      }
    }

    return node;
  }

  async _handleDiagramTypeChange(event: SelectChangeEvent<string>) {
    let newDiagramType = EntityTypeDiagramType.groupsAndEvents;

    if (event.target.value === DiagramTypeStrings[1]) {
      newDiagramType = EntityTypeDiagramType.statesAndConnections;
    }

    this.setState({
      groupsAndEventsContext: this.state.groupsAndEventsContext,
      targetEntityTypeId: this.state.targetEntityTypeId,
      activeDiagramType: newDiagramType,
      groupsAndEventsNodes: this.state.groupsAndEventsNodes,
      groupsAndEventsEdges: this.state.groupsAndEventsEdges,
      selectedEntityTypeEvent: this.state.selectedEntityTypeEvent,
      selectedEntityTypeEventId: this.state.selectedEntityTypeEventId,
      selectedComponentSet: this.state.selectedComponentSet,
    });
  }

  private async _handleEventAddComponentGroup() {
    this.props.entityType.addComponentGroup();

    await this._generateContext();
  }

  private async _handleEventAddAction() {
    this.props.entityType.addEvent();

    await this._generateContext();
  }

  render() {
    if (!this.state || !this.state.groupsAndEventsContext) {
      return <div className="etde-loading">Loading...</div>;
    }

    let paneContents = <></>;
    let containerClassName = "etde-container";

    if (
      this.state.selectedEntityTypeEvent &&
      this.state.selectedEntityTypeEvent.data &&
      this.state.selectedEntityTypeEventId
    ) {
      paneContents = (
        <div className="etde-pane">
          <EventActionDesign
            theme={this.props.theme}
            displayAddRemoveGroups={false}
            displayNarrow={true}
            readOnly={false}
            heightOffset={this.props.heightOffset + 90}
            displayTriggers={false}
            displayHelperText={false}
            id={this.state.selectedEntityTypeEventId}
            entityType={this.props.entityType}
            project={this.props.project}
            creatorTools={this.props.creatorTools}
            event={this.state.selectedEntityTypeEvent.data}
            onOpenFull={this.props.onOpenEventFull}
          />
        </div>
      );
    } else if (this.state.selectedComponentSet) {
      paneContents = (
        <div className="etde-pane">
          <EntityTypeComponentSetEditor
            theme={this.props.theme}
            displayNarrow={true}
            isDefault={this.state.selectedComponentSet === this.props.entityType}
            heightOffset={DIAGRAM_EDITOR_PANE_HEIGHT}
            entityTypeItem={this.props.entityType}
            componentSetItem={this.state.selectedComponentSet}
            project={this.props.project}
            creatorTools={this.props.creatorTools}
          />
        </div>
      );
    } else if (this.state.selectedGroupState) {
      const componentSet = this.props.entityType.getEffectiveComponents(this.state.selectedGroupState);
      paneContents = (
        <div className="etde-pane">
          <EntityTypeComponentSetEditor
            theme={this.props.theme}
            displayNarrow={true}
            isDefault={this.state.selectedComponentSet === this.props.entityType}
            heightOffset={DIAGRAM_EDITOR_PANE_HEIGHT}
            entityTypeItem={this.props.entityType}
            componentSetItem={componentSet}
            project={this.props.project}
            creatorTools={this.props.creatorTools}
          />
        </div>
      );
    } else {
      containerClassName += " etde-container-wide";
    }

    let diagram = <></>;

    if (this.state.activeDiagramType === EntityTypeDiagramType.statesAndConnections) {
      diagram = (
        <ReactFlow
          defaultNodes={this.state.statesAndConnectionsDefaultNodes}
          edgeTypes={{
            "entity-type-state-edge": EntityTypeStateEdge,
          }}
          nodeTypes={{
            "entity-type-state": EntityTypeStateNode,
          }}
          key={"statesAndConnections"}
          fitView
          nodesDraggable
          defaultEdges={this.state.statesAndConnectionsDefaultEdges}
          onNodesChange={this._statesAndConnectionsNodesUpdated}
          colorMode={CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "dark" : "light"}
        >
          <Controls />
          <MiniMap />
          <Background />
        </ReactFlow>
      );
    } else {
      diagram = (
        <ReactFlow
          defaultNodes={this.state.groupsAndEventsContext.nodes}
          edgeTypes={{
            "entity-type-event-edge": EntityTypeEventEdge,
            "event-component-group-add-edge": EventComponentGroupAddEdge,
            "event-component-group-remove-edge": EventComponentGroupRemoveEdge,
          }}
          nodeTypes={{
            "component-set": EntityTypeComponentSetNode,
            "entity-event": EntityTypeEventNode,
          }}
          key={"groupsAndNodes"}
          nodes={this.state.groupsAndEventsNodes}
          edges={this.state.groupsAndEventsEdges}
          fitView
          nodesDraggable
          defaultEdges={this.state.groupsAndEventsContext.edges}
          onNodesChange={this._groupAndEventsNodesUpdated}
          colorMode={CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "dark" : "light"}
        >
          <Controls />
          <MiniMap />
          <Background />
        </ReactFlow>
      );
    }

    return (
      <div className="etde-grid">
        <div className="etde-toolBarArea">
          <div className="etde-dropdownArea">
            <FormControl size="small">
              <Select
                value={DiagramTypeStrings[this.state.activeDiagramType ?? 0]}
                onChange={this._handleDiagramTypeChange}
              >
                {DiagramTypeStrings.map((item, index) => (
                  <MenuItem key={index} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
          <div className="etde-toolBar">
            <Stack direction="row" spacing={1} aria-label="Diagram editing">
              <Button onClick={this._handleEventAddComponentGroup} title="Add component group">
                <CustomLabel
                  isCompact={false}
                  text="Add component group"
                  icon={<FontAwesomeIcon icon={faPlus} className="fa-lg" />}
                />
              </Button>
              <Button onClick={this._handleEventAddAction} title="Add action">
                <CustomLabel
                  isCompact={false}
                  text="Add action"
                  icon={<FontAwesomeIcon icon={faPlus} className="fa-lg" />}
                />
              </Button>
            </Stack>
          </div>
        </div>
        <div className={containerClassName}>{diagram}</div>
        {paneContents}
      </div>
    );
  }
}
