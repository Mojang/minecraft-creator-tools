// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ISimpleReference from "../core/ISimpleReference";
import ICondition from "./ICondition";
import IFormDefinition from "./IFormDefinition";

export enum FieldExperienceType {
  text = 1,
  dropdown = 2,
  slider = 3,
}

export enum FieldVisualExperience {
  normal = 0,
  deemphasized = 1,
}

export enum FieldDataType {
  int = 0,
  boolean = 1,
  string = 2,
  float = 3,
  stringEnum = 4,
  intEnum = 5,
  intBoolean = 6,
  number = 7,
  stringLookup = 8,
  intValueLookup = 9,
  long = 10,
  point3 = 11,
  intPoint3 = 12,
  longFormString = 13, // typically will support very long strings. Mostly this is just a visual thing.
  keyedObjectCollection = 14, // { "foo": {x: 1, z: 3}, "bar": {x:10, y: 4} }
  objectArray = 15, // [ { x: 1, id: "alpha", z: 3}, { x: 1, id: "bravo", z: 3} ]
  object = 16,
  stringArray = 17,
  intRange = 18,
  floatRange = 19,
  minecraftFilter = 20,
  percentRange = 21,
  minecraftEventTrigger = 22,
  longFormStringArray = 23,
  keyedStringCollection = 24, // { "foo": "blah", "barg" : "borg" }
  version = 25,
  uuid = 26,
}

export default interface IField {
  id: string;
  altId?: string;
  groupId?: string;
  title: string;
  description?: string;
  undefinedIfEmpty?: boolean;
  subForm?: IFormDefinition;
  allowedKeys?: string[];
  subFields?: { [keyName: string]: IField };
  objectArrayToSubFieldKey?: string;
  objectArrayTitleFieldKey?: string;
  matchObjectArrayLengthToSubFieldLength?: boolean;
  matchObjectArrayToSubFieldKey?: boolean;
  fixedLength?: number;
  lookupId?: string;
  maxLength?: number;
  newItemPrototype?: any;
  allowCreateDelete?: boolean;
  readOnly?: boolean;
  forceString?: boolean;
  minValue?: number;
  maxValue?: number;
  suggestedMinValue?: number;
  suggestedMaxValue?: number;
  validity?: ICondition[];
  visibility?: ICondition[];
  defaultValue?: string | number | boolean;
  additionalIndent?: number;
  visualExperience?: FieldVisualExperience;
  experienceType?: FieldExperienceType;
  dataType: FieldDataType;
  choices?: ISimpleReference[];
}
