// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default class ModuleConfig {
  permissionsAllowedModules: string[] = [];
  variables: { [name: string]: string | number | boolean } | undefined;
  secrets: { [name: string]: string | number | boolean } | undefined;
}
