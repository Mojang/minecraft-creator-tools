// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IProjectScriptState {
  hasScript: boolean;

  hasModule: { [moduleId: string]: boolean };
}
