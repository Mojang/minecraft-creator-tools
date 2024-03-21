// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import BlockLocation from "./BlockLocation";

/**
 * Contains data resulting from a navigation operation,
 * including whether the navigation is possible and the path of
 * navigation.
 */
export class NavigationResult {
  /**
   * Whether the navigation result contains a full path,
   * including to the requested destination.
   */
  readonly "isFullPath": boolean;
  /**
   * A set of block locations that comprise the navigation route.
   */
  get path(): BlockLocation[] {
    return [];
  }
}
