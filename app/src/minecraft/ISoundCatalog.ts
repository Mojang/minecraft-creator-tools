// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface ISoundCatalog {
  block_sounds?: ISoundEventCatalog;
  entity_sounds?: IEntitySounds;
  individual_event_sounds?: IEntitySoundIndividuals;
  interactive_sounds?: IInteractiveSounds;
}

export interface IInteractiveSounds {
  block_sounds?: ISoundEventCatalog;
  entity_sounds?: IEntitySounds;
}

export interface IEntitySounds {
  defaults?: ISoundEventSet;
  entities: ISoundEventCatalog;
}

export interface ISoundEventCatalog {
  [name: string]: ISoundEventSet;
}

export interface ISoundEventSet {
  volume?: number;
  pitch?: number | number[];
  events: { [name: string]: string | ISoundEvent };
}

export interface IEntitySoundIndividuals {
  events: { [name: string]: ISoundEvent | string };
}

export interface ISoundEvent {
  volume?: number;
  sound: string;
  pitch?: number | number[];
}
