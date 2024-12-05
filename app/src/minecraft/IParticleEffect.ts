// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface IParticleEffectWrapper {
  format_version: string;
  particle_effect: IParticleEffect;
}

export interface IParticleEffect {
  description: IParticleEffectDescription;
}

export interface IParticleEffectDescription {
  identifier: string;
  basic_render_parameters: IParticleEffectBasicRenderParameters;
}

export interface IParticleEffectBasicRenderParameters {
  material?: string;
  texture?: string;
}
