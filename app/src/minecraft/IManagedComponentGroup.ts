// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IManagedComponent from "./IManagedComponent";

export default interface IManagedComponentGroup {
  [name: string]: IManagedComponent | undefined;
}
