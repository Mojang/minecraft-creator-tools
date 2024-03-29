// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IVector3 from "./IVector3";

export default interface IVolume {
  from: IVector3;
  to?: IVector3;
}
