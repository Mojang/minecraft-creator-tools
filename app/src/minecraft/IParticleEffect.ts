export interface IParticleEffectWrapper {
  format_version: string;
  particle_effect: IParticleEffect;
}

export interface IParticleEffect {
  description: IParticleEffectDescription;
}

export interface IParticleEffectDescription {
  identifier: string;
  basic_render_parameters: { [identifier: string]: string };
}

export interface IParticleEffectBasicRenderParameters {
  material: string;
  texture: string;
}
