/**
 * Types and enums for WorldView that can be imported without pulling in Babylon.js dependencies.
 */

export enum WorldViewMode {
  mapOnly = 1,
  /** @deprecated Use fullWorldView or worldViewer3D instead */
  smallViewOnLeft = 2,
  /** @deprecated Use fullWorldView or worldViewer3D instead */
  smallViewOnRight = 3,
  /** @deprecated Use fullWorldView or worldViewer3D instead */
  largeViewOnLeft = 4,
  /** @deprecated Use fullWorldView or worldViewer3D instead */
  largeViewOnRight = 5,
  /** @deprecated Use fullWorldView or worldViewer3D instead */
  viewOnBottom = 6,
  /** Full 3D WorldViewer (no map) — renders the entire world with textured chunks */
  fullWorldView = 7,
  /** 3D WorldViewer on the left, map on the right */
  worldViewer3D = 8,
  /** Map on the left, 3D WorldViewer on the right */
  worldViewerMapOnLeft = 9,
}

export enum WorldViewMenuState {
  noMenu = 0,
  viewMenu = 1,
}
