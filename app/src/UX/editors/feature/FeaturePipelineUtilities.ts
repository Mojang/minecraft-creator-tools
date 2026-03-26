// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * FEATURE PIPELINE UTILITIES
 * ==========================
 *
 * This module provides utilities for building and navigating feature hierarchies.
 *
 * CONCEPTS:
 * - Feature Rules trigger features and define placement conditions
 * - Composite Features (aggregate, sequence, scatter, etc.) reference other features
 * - Terminal Features (single_block, ore, tree, etc.) directly place content
 *
 * HIERARCHY STRUCTURE:
 * - A FeaturePipelineNode represents one node in the feature hierarchy
 * - The hierarchy can be built from any starting point (feature rule or feature)
 * - Walking up finds parent rules/features that reference this item
 * - Walking down finds child features that this item references
 *
 * USAGE:
 * - buildFeaturePipeline() creates the full hierarchy from a starting item
 * - findRootNodes() finds all feature rules that ultimately trigger this feature
 * - flattenPipeline() converts the tree to a flat list for iteration
 */

import Project from "../../../app/Project";
import ProjectItem from "../../../app/ProjectItem";
import { ProjectItemType } from "../../../app/IProjectItemData";
import FeatureDefinition from "../../../minecraft/FeatureDefinition";
import FeatureRuleDefinition from "../../../minecraft/FeatureRuleDefinition";

/**
 * Represents a single node in the feature pipeline hierarchy.
 */
export interface IFeaturePipelineNode {
  /** The project item for this node */
  item: ProjectItem;

  /** The type of node */
  nodeType: "featureRule" | "feature";

  /** The identifier of this feature/rule */
  id: string;

  /** Short display name (without namespace) */
  shortId: string;

  /** The specific feature type (e.g., "scatter_feature", "aggregate_feature") */
  featureType?: string;

  /** Child nodes that this node references (can include unfulfilled references) */
  children: FeaturePipelineNode[];

  /** Parent nodes that reference this node */
  parents: FeaturePipelineNode[];

  /** For weighted_random_feature, the weight of this child */
  weight?: number;

  /** Whether this is an unfulfilled reference (feature not found in project) */
  isUnfulfilled?: boolean;

  /** If unfulfilled, whether it's a vanilla reference */
  isVanillaReference?: boolean;

  /** The referenced feature ID (for unfulfilled nodes) */
  referencedId?: string;

  /** Depth in the tree from the root */
  depth: number;
}

/**
 * Represents an unfulfilled feature reference.
 */
export interface IUnfulfilledFeatureNode {
  nodeType: "unfulfilledFeature";
  referencedId: string;
  isVanillaReference: boolean;
  weight?: number;
  depth: number;
  parents: IFeaturePipelineNode[];
  children: IUnfulfilledFeatureNode[];
}

export type FeaturePipelineNode = IFeaturePipelineNode | IUnfulfilledFeatureNode;

/**
 * Result of building a feature pipeline.
 */
export interface IFeaturePipeline {
  /** All root nodes (typically feature rules, or orphan features) */
  roots: FeaturePipelineNode[];

  /** The node corresponding to the starting item */
  startingNode: FeaturePipelineNode | undefined;

  /** All nodes in the pipeline (flat list) */
  allNodes: FeaturePipelineNode[];

  /** Any unfulfilled feature references */
  unfulfilledReferences: IUnfulfilledFeatureNode[];
}

/**
 * Gets the short ID from a full identifier (removes namespace).
 */
export function getShortId(id: string): string {
  if (!id) return "";
  const colonIndex = id.indexOf(":");
  return colonIndex >= 0 ? id.substring(colonIndex + 1) : id;
}

/**
 * Gets the feature type string from a FeatureDefinition.
 */
export function getFeatureTypeFromDefinition(featureDef: FeatureDefinition): string | undefined {
  return featureDef.typeString;
}

/**
 * Builds the complete feature pipeline hierarchy starting from a given item.
 * This walks both up (to find parent rules/features) and down (to find child features).
 */
export async function buildFeaturePipeline(project: Project, startingItem: ProjectItem): Promise<IFeaturePipeline> {
  const visitedItems = new Set<string>();
  const allNodes: FeaturePipelineNode[] = [];
  const unfulfilledReferences: IUnfulfilledFeatureNode[] = [];
  const nodeMap = new Map<string, FeaturePipelineNode>();

  // Ensure dependencies are calculated for the starting item
  await startingItem.ensureDependencies();

  // Build the starting node
  const startingNode = await buildNodeFromItem(
    project,
    startingItem,
    0,
    visitedItems,
    nodeMap,
    allNodes,
    unfulfilledReferences
  );

  // Find all roots by walking up from the starting node
  const roots = await findRootNodes(project, startingNode, visitedItems, nodeMap, allNodes, unfulfilledReferences);

  return {
    roots,
    startingNode,
    allNodes,
    unfulfilledReferences,
  };
}

/**
 * Builds a pipeline node from a project item.
 */
async function buildNodeFromItem(
  project: Project,
  item: ProjectItem,
  depth: number,
  visitedItems: Set<string>,
  nodeMap: Map<string, FeaturePipelineNode>,
  allNodes: FeaturePipelineNode[],
  unfulfilledReferences: IUnfulfilledFeatureNode[]
): Promise<FeaturePipelineNode | undefined> {
  const itemPath = item.projectPath || "";

  // Check if we've already processed this item
  if (nodeMap.has(itemPath)) {
    return nodeMap.get(itemPath);
  }

  // Mark as visited to prevent infinite loops
  if (visitedItems.has(itemPath)) {
    return undefined;
  }
  visitedItems.add(itemPath);

  // Ensure item content is loaded
  if (!item.isContentLoaded) {
    await item.loadContent();
  }

  // Ensure dependencies are calculated
  await item.ensureDependencies();

  let node: IFeaturePipelineNode | undefined;

  if (item.itemType === ProjectItemType.featureRuleBehavior) {
    if (item.primaryFile) {
      const ruleDef = await FeatureRuleDefinition.ensureOnFile(item.primaryFile);
      if (ruleDef) {
        node = {
          item,
          nodeType: "featureRule",
          id: ruleDef.id || "",
          shortId: getShortId(ruleDef.id || ""),
          children: [],
          parents: [],
          depth,
        };
      }
    }
  } else if (item.itemType === ProjectItemType.featureBehavior) {
    if (item.primaryFile) {
      const featureDef = await FeatureDefinition.ensureOnFile(item.primaryFile);
      if (featureDef) {
        node = {
          item,
          nodeType: "feature",
          id: featureDef.id || "",
          shortId: getShortId(featureDef.id || ""),
          featureType: featureDef.typeString,
          children: [],
          parents: [],
          depth,
        };
      }
    }
  }

  if (!node) {
    return undefined;
  }

  nodeMap.set(itemPath, node);
  allNodes.push(node);

  // Build child nodes from childItems relationships
  if (item.childItems) {
    for (const rel of item.childItems) {
      if (rel.childItem.itemType === ProjectItemType.featureBehavior) {
        const childNode = await buildNodeFromItem(
          project,
          rel.childItem,
          depth + 1,
          visitedItems,
          nodeMap,
          allNodes,
          unfulfilledReferences
        );

        if (childNode) {
          node.children.push(childNode);
          if ("parents" in childNode) {
            childNode.parents.push(node);
          }
        }
      }
    }
  }

  // Add unfulfilled references
  if (item.unfulfilledRelationships) {
    for (const unrel of item.unfulfilledRelationships) {
      if (unrel.itemType === ProjectItemType.featureBehavior) {
        const unfulfilledNode: IUnfulfilledFeatureNode = {
          nodeType: "unfulfilledFeature",
          referencedId: unrel.path,
          isVanillaReference: unrel.isVanillaDependent || false,
          depth: depth + 1,
          parents: [node],
          children: [] as never[],
        };

        node.children.push(unfulfilledNode);
        unfulfilledReferences.push(unfulfilledNode);
        allNodes.push(unfulfilledNode);
      }
    }
  }

  return node;
}

/**
 * Finds all root nodes by walking up from the starting node.
 * Root nodes are typically feature rules, or features that have no parents.
 */
async function findRootNodes(
  project: Project,
  startingNode: FeaturePipelineNode | undefined,
  visitedItems: Set<string>,
  nodeMap: Map<string, FeaturePipelineNode>,
  allNodes: FeaturePipelineNode[],
  unfulfilledReferences: IUnfulfilledFeatureNode[]
): Promise<FeaturePipelineNode[]> {
  if (!startingNode || startingNode.nodeType === "unfulfilledFeature") {
    return startingNode ? [startingNode] : [];
  }

  const roots: FeaturePipelineNode[] = [];
  const item = startingNode.item;

  // Check if this item has parent items (items that reference it)
  if (item.parentItems && item.parentItems.length > 0) {
    for (const rel of item.parentItems) {
      const parentItem = rel.parentItem;

      if (
        parentItem.itemType === ProjectItemType.featureRuleBehavior ||
        parentItem.itemType === ProjectItemType.featureBehavior
      ) {
        const parentNode: FeaturePipelineNode | undefined = await buildNodeFromItem(
          project,
          parentItem,
          startingNode.depth - 1,
          visitedItems,
          nodeMap,
          allNodes,
          unfulfilledReferences
        );

        if (parentNode && parentNode.nodeType !== "unfulfilledFeature") {
          // Add this node as a child of the parent
          if (!parentNode.children.includes(startingNode)) {
            parentNode.children.push(startingNode);
          }
          if (!startingNode.parents.includes(parentNode)) {
            startingNode.parents.push(parentNode);
          }

          // Recursively find roots from the parent
          const parentRoots = await findRootNodes(
            project,
            parentNode,
            visitedItems,
            nodeMap,
            allNodes,
            unfulfilledReferences
          );

          roots.push(...parentRoots);
        }
      }
    }
  }

  // If no parents found, this is a root
  if (roots.length === 0) {
    roots.push(startingNode);
  }

  // Deduplicate roots
  const uniqueRoots: FeaturePipelineNode[] = [];
  const seenIds = new Set<string>();

  for (const root of roots) {
    const id = root.nodeType === "unfulfilledFeature" ? root.referencedId : root.item.projectPath;
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      uniqueRoots.push(root);
    }
  }

  return uniqueRoots;
}

/**
 * Flattens a pipeline tree into a list, preserving depth information.
 */
export function flattenPipeline(roots: FeaturePipelineNode[]): FeaturePipelineNode[] {
  const result: FeaturePipelineNode[] = [];
  const visited = new Set<FeaturePipelineNode>();

  function visit(node: FeaturePipelineNode, depth: number) {
    if (visited.has(node)) return;
    visited.add(node);

    // Update depth
    if (node.nodeType !== "unfulfilledFeature") {
      node.depth = depth;
    }

    result.push(node);

    for (const child of node.children) {
      visit(child, depth + 1);
    }
  }

  for (const root of roots) {
    visit(root, 0);
  }

  return result;
}

/**
 * Gets a human-readable name for a feature type.
 */
export function getFeatureTypeName(featureType: string | undefined): string {
  if (!featureType) return "Feature";

  const typeNames: Record<string, string> = {
    aggregate_feature: "Aggregate",
    sequence_feature: "Sequence",
    weighted_random_feature: "Weighted Random",
    scatter_feature: "Scatter",
    search_feature: "Search",
    snap_to_surface_feature: "Snap to Surface",
    surface_relative_threshold_feature: "Surface Threshold",
    vegetation_patch_feature: "Vegetation Patch",
    single_block_feature: "Single Block",
    ore_feature: "Ore",
    tree_feature: "Tree",
    geode_feature: "Geode",
    structure_template_feature: "Structure Template",
    cave_carver_feature: "Cave Carver",
    underwater_cave_carver_feature: "Underwater Cave",
    nether_cave_carver_feature: "Nether Cave",
    fossil_feature: "Fossil",
    growing_plant_feature: "Growing Plant",
    multiface_feature: "Multiface",
    partially_exposed_blob_feature: "Blob",
    sculk_patch_feature: "Sculk Patch",
    rect_layout: "Rect Layout",
    scan_surface: "Scan Surface",
    beards_and_shavers: "Beards & Shavers",
  };

  return typeNames[featureType] || featureType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Gets an icon name for a feature type (FontAwesome icon names).
 */
export function getFeatureTypeIcon(featureType: string | undefined): string {
  if (!featureType) return "cube";

  const typeIcons: Record<string, string> = {
    aggregate_feature: "layer-group",
    sequence_feature: "list-ol",
    weighted_random_feature: "dice",
    scatter_feature: "spray-can",
    search_feature: "search",
    snap_to_surface_feature: "arrows-down-to-line",
    surface_relative_threshold_feature: "arrow-down",
    vegetation_patch_feature: "seedling",
    single_block_feature: "cube",
    ore_feature: "gem",
    tree_feature: "tree",
    geode_feature: "diamond",
    structure_template_feature: "building",
    cave_carver_feature: "mountain",
    underwater_cave_carver_feature: "water",
    nether_cave_carver_feature: "fire",
    fossil_feature: "bone",
    growing_plant_feature: "leaf",
    multiface_feature: "expand",
    partially_exposed_blob_feature: "circle",
    sculk_patch_feature: "bacteria",
  };

  return typeIcons[featureType] || "cube";
}

/**
 * Checks if a feature type is a composite type (references other features).
 */
export function isCompositeFeatureType(featureType: string | undefined): boolean {
  if (!featureType) return false;

  const compositeTypes = [
    "aggregate_feature",
    "sequence_feature",
    "weighted_random_feature",
    "scatter_feature",
    "search_feature",
    "snap_to_surface_feature",
    "surface_relative_threshold_feature",
    "vegetation_patch_feature",
  ];

  return compositeTypes.includes(featureType);
}
