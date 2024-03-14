// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IGeneratorSummary {
  defaultMessage?: string;
  title?: string;
  testCompleteSuccesses?: number;
  testCompleteFails?: number;
  errors?: number;
  warnings?: number;
  internalProcessingErrors?: number;
  recommendations?: number;
}
