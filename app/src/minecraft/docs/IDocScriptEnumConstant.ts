import IDocClassType from "./IDocClassType";

export default interface IDocScriptEnumConstant {
  is_read_only: boolean;
  is_static: boolean;
  name: string;
  type: IDocClassType;
  value: string | number;
  raw_tsdoc_text?: string;
  raw_script_text?: string;
  ts_has_comments?: boolean;
  ts_has_remarks?: boolean;
  is_prerelease?: boolean;
  is_script_generated?: boolean;
  disallowed_in_read_only?: boolean;
}
