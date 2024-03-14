// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IDocProperty from "./IDocProperty";
import IDocClassType from "./IDocClassType";
import IDocFunction from "./IDocFunction";

export default interface IDocClass {
  base_types: IDocClassType[];
  constants: string[];
  functions: IDocFunction[];
  name: string;
  raw_tsdoc_text?: string;
  raw_script_text?: string;
  ts_has_comments?: boolean;
  ts_has_remarks?: boolean;
  is_prerelease?: boolean;
  is_script_generated?: boolean;
  disallowed_in_read_only?: boolean;
  properties: IDocProperty[];
  type: IDocClassType;
}
