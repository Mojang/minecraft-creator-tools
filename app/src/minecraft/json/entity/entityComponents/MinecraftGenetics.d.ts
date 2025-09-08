// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:genetics
 * 
 * minecraft:genetics Samples

Goat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/goat.json

"minecraft:genetics": {
  "mutation_rate": 0.02,
  "genes": [
    {
      "name": "goat_variant",
      "use_simplified_breeding": true,
      "allele_range": {
        "range_min": 1,
        "range_max": 100
      },
      "genetic_variants": [
        {
          "main_allele": {
            "range_min": 1,
            "range_max": 2
          },
          "birth_event": {
            "event": "minecraft:born_screamer",
            "target": "self"
          }
        },
        {
          "main_allele": {
            "range_min": 3,
            "range_max": 100
          },
          "birth_event": {
            "event": "minecraft:born_default",
            "target": "self"
          }
        }
      ]
    }
  ]
}


Panda - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/panda.json

"minecraft:genetics": {
  "mutation_rate": 0.03125,
  "genes": [
    {
      "name": "panda_variant",
      "allele_range": {
        "range_min": 0,
        "range_max": 15
      },
      "genetic_variants": [
        {
          "main_allele": 0,
          "birth_event": {
            "event": "minecraft:panda_lazy",
            "target": "self"
          }
        },
        {
          "main_allele": 1,
          "birth_event": {
            "event": "minecraft:panda_worried",
            "target": "self"
          }
        },
        {
          "main_allele": 2,
          "birth_event": {
            "event": "minecraft:panda_playful",
            "target": "self"
          }
        },
        {
          "main_allele": 3,
          "birth_event": {
            "event": "minecraft:panda_aggressive",
            "target": "self"
          }
        },
        {
          "both_allele": {
            "range_min": 4,
            "range_max": 7
          },
          "birth_event": {
            "event": "minecraft:panda_weak",
            "target": "self"
          }
        },
        {
          "both_allele": {
            "range_min": 8,
            "range_max": 9
          },
          "birth_event": {
            "event": "minecraft:panda_brown",
            "target": "self"
          }
        }
      ]
    }
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Genetics (minecraft:genetics)
 * Defines the way a mob's genes and alleles are passed on to its
 * offspring, and how those traits manifest in the child. Compatible
 * parent genes are crossed together, the alleles are handed down
 * from the parents to the child, and any matching genetic variants fire
 * off JSON events to modify the child and express the traits.
 */
export default interface MinecraftGenetics {

  /**
   * @remarks
   * The list of genes that this entity has and will cross with a
   * partner during breeding.
   * 
   * Sample Values:
   * Goat: [{"name":"goat_variant","use_simplified_breeding":true,"allele_range":{"range_min":1,"range_max":100},"genetic_variants":[{"main_allele":{"range_min":1,"range_max":2},"birth_event":{"event":"minecraft:born_screamer","target":"self"}},{"main_allele":{"range_min":3,"range_max":100},"birth_event":{"event":"minecraft:born_default","target":"self"}}]}]
   *
   */
  genes?: MinecraftGeneticsGenes[];

  /**
   * @remarks
   * Chance that an allele will be replaced with a random one instead of
   * the parent's allele during birth.
   */
  mutation_rate?: number;

}


/**
 * The list of genes that this entity has and will cross with a
 * partner during breeding.
 */
export interface MinecraftGeneticsGenes {

  /**
   * @remarks
   * The range of positive integer allele values for this gene. Spawned
   * mobs will have a random number in this range assigned to 
   * them.
   */
  allele_range?: number;

  /**
   * @remarks
   * The list of genetic variants for this gene. These check for
   * particular allele combinations and fire events when all of them
   * are satisfied.
   */
  genetic_variants?: MinecraftGeneticsGenesGeneticVariants[];

  /**
   * @remarks
   * If this value is non-negative, overrides the chance for this gene
   * that an allele will be replaced with a random one instead of
   * the parent's allele during birth. Non-negative values greater than
   * `1` will be the same as the value `1`.
   */
  mutation_rate?: number;

  /**
   * @remarks
   * The name of the gene.
   */
  name?: string;

  /**
   * @remarks
   * If true, mobs spawned from breeding will always inherit main
   * alleles from parents' main alleles and hidden alleles from the
   * hidden ones.
   */
  use_simplified_breeding?: string;

}


/**
 * The list of genetic variants for this gene. These check for
 * particular allele combinations and fire events when all of them
 * are satisfied.
 */
export interface MinecraftGeneticsGenesGeneticVariants {

  /**
   * @remarks
   * Event to run when this mob is created and matches the allele
   * conditions.
   */
  birth_event?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * If this value is non-negative, compare both the mob's main and
   * hidden alleles with this value for a match with both. Can also be
   * a range of integers.
   */
  both_allele?: number;

  /**
   * @remarks
   * If this value is non-negative, compare both the mob's main and
   * hidden alleles with this value for a match with either. Can also
   * be a range of integers.
   */
  either_allele?: number;

  /**
   * @remarks
   * If this value is non-negative, compare the mob's hidden allele with
   * this value for a match. Can also be a range of integers.
   */
  hidden_allele?: number;

  /**
   * @remarks
   * If this value is non-negative, compare the mob's main allele with
   * this value for a match. Can also be a range of integers.
   */
  main_allele?: number;

}