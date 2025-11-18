// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:redstone_producer
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Redstone Producer (minecraft:redstone_producer)
 * If added to a block, indicates that it produces a redstone 
 * signal.
 */
export default interface MinecraftRedstoneProducer {

  /**
   * @remarks
   * The list of faces that are considered connected to the circuit. If
   * a face is not connected, it will not provide power to the block
   * touching that face. By default, all faces are connected.
   */
  connected_faces?: MinecraftRedstoneProducerConnectedFaces| string;

  /**
   * @remarks
   * The strength of the redstone signal produced by this block. Valid
   * values are from 0 to 15, where 0 means no signal and 15 is the
   * maximum signal strength.
   */
  power: number;

  /**
   * @remarks
   * The block touching this face will become strongly powered with
   * the signal level strength of 'power'. Strongly powered blocks will
   * power adjacent blocks. By default, the block will not strongly power
   * any face.
   */
  strongly_powered_face?: string;

  /**
   * @remarks
   * If true, the `strongly_powered_face` and `connected_faces` properties
   * will be rotated according to the 'minecraft:transformation' 
   * component.
   */
  transform_relative?: boolean;

}


export enum MinecraftRedstoneProducerConnectedFaces {
  north = `north`,
  east = `east`,
  south = `south`,
  west = `west`,
  up = `up`,
  down = `down`
}