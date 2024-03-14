// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ISnbtBlock from "./ISnbtBlock";
import ISnbtEntity from "./ISnbtEntity";

export default interface ISnbtContent {
  DataVersion: number;
  size: number[];
  data: ISnbtBlock[];
  entities: ISnbtEntity[];
  palette: string[];
}
