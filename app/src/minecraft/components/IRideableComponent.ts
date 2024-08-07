// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ISeat from "./ISeat";

export default interface IRideableComponent {
  seatCount: number;
  crouchingSkipInteract: boolean;
  interactText: string;
  familyTypes: string[];
  controllingSeat: number;
  pullInEntities: boolean;
  riderCanInteract: boolean;
  seats: ISeat[];
}
