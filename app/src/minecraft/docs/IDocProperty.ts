// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IDocTypeReference from "./IDocTypeReference";

export default interface IDocProperty {
  is_read_only: boolean;
  raw_tsdoc_text?: string;
  raw_script_text?: string;
  ts_has_comments?: boolean;
  ts_has_remarks?: boolean;
  is_prerelease?: boolean;
  is_script_generated?: boolean;
  disallowed_in_read_only?: boolean;
  name: string;
  type: IDocTypeReference;
}
