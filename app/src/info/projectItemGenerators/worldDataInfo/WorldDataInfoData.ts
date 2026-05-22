// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export enum WorldDataInfoGeneratorTest {
  unexpectedCommandInMCFunction = 101,
  unexpectedCommandInCommandBlock = 102,
  minX = 103,
  minZ = 104,
  maxX = 105,
  maxZ = 106,
  containsWorldImpactingCommand = 112,
  blocks = 121,
  blockData = 122,
  command = 123,
  executeSubCommand = 124,
  levelDat = 125,
  levelDatExperiments = 126,
  subchunklessChunks = 127,
  chunks = 128,
  commandIsFromOlderMinecraftVersion = 212,
  couldNotProcessWorld = 216,
  errorProcessingWorld = 400,
  unexpectedError = 401,
}

export const MaxWorldRecordsToProcess = 3000000; // very crudely, this equates to about 100K chunks
