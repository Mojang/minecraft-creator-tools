import IDocScriptEnumValue from "./IDocScriptEnumConstant";

export default interface IDocScriptEnum {
  raw_tsdoc_text?: string;
  raw_script_text?: string;
  ts_has_comments?: boolean;
  ts_has_remarks?: boolean;
  is_prerelease?: boolean;
  is_script_generated?: boolean;
  disallowed_in_read_only?: boolean;
  constants: IDocScriptEnumValue[];
  name: string;
}
