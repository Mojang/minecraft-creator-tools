/**
 * ItemAnnotationUtilities - Utility functions for working with ItemAnnotationCollection
 *
 * ARCHITECTURE OVERVIEW:
 * Previously, the getAnnotationsForStorageObject function was duplicated in:
 * - FileExplorer.tsx (as getAnnotationsForFolder)
 * - FileExplorerFolder.tsx
 * - FileExplorerContainerFile.tsx
 *
 * This utility consolidates that logic into a single, reusable function.
 */

import IStorageObject from "../../storage/IStorageObject";
import IFolder from "../../storage/IFolder";
import ItemAnnotationCollection from "./ItemAnnotationCollection";

/**
 * Filters an ItemAnnotationCollection to only include annotations
 * that belong to a specific storage object (file or folder) based on path prefix.
 *
 * @param annotations - The full annotation collection to filter
 * @param storageObject - The file or folder to get annotations for
 * @returns A new annotation collection containing only matching annotations,
 *          or undefined if no source annotations exist
 *
 * @example
 * const folderAnnotations = getAnnotationsForStorageObject(allAnnotations, myFolder);
 * // Returns annotations where path starts with myFolder.storageRelativePath
 */
export function getAnnotationsForStorageObject(
  annotations: ItemAnnotationCollection | undefined,
  storageObject: IStorageObject
): ItemAnnotationCollection | undefined {
  if (!annotations) {
    return undefined;
  }

  const result: ItemAnnotationCollection = {};
  const basePath = storageObject.storageRelativePath;

  for (const path in annotations) {
    if (path.startsWith(basePath)) {
      result[path] = annotations[path];
    }
  }

  return result;
}

/**
 * Filters an ItemAnnotationCollection to only include annotations
 * that belong within a folder subtree.
 *
 * This is an alias for getAnnotationsForStorageObject but with a more
 * descriptive name for folder-specific usage.
 *
 * @param annotations - The full annotation collection to filter
 * @param folder - The folder to get annotations for
 * @returns A new annotation collection containing only matching annotations
 */
export function getAnnotationsForFolder(
  annotations: ItemAnnotationCollection | undefined,
  folder: IFolder
): ItemAnnotationCollection | undefined {
  return getAnnotationsForStorageObject(annotations, folder);
}

/**
 * Checks if an annotation collection has any annotations.
 *
 * @param annotations - The annotation collection to check
 * @returns true if there are any annotations, false otherwise
 */
export function hasAnnotations(annotations: ItemAnnotationCollection | undefined): boolean {
  if (!annotations) {
    return false;
  }

  for (const path in annotations) {
    if (annotations[path] && annotations[path].length > 0) {
      return true;
    }
  }

  return false;
}
