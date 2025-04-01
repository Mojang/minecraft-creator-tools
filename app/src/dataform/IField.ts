// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ISimpleReference from "../core/ISimpleReference";
import ICondition from "./ICondition";
import IFormDefinition, { IFormSample } from "./IFormDefinition";

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
  keyedBooleanCollection = 27, // { "foo": true, "blah": false}
  keyedStringArrayCollection = 28, // { "foo": ["blah", "alpha"], "barg" : ["borg"] }
  arrayOfKeyedStringCollection = 29, // [ { "blah": "alpha", "blaz": "blay" }, {"barg": "borg"} ]
  keyedKeyedStringArrayCollection = 30, // { "alpha":  { "foo": ["blah", "alpha"], "barg" : ["borg"] } }
  keyedNumberCollection = 31, // { "foo": 17, "blah": 43 }
  numberArray = 32,
  checkboxListAsStringArray = 33,
  molang = 34,
  molangArray = 35,
  point2 = 36,
  localizableString = 37,
  keyedNumberArrayCollection = 38, // { "foo": [255, 0.0, 2555], "barg" : [128, 0, 0] }
}

export enum FieldValueHumanify {
  none = 0,
  general = 1,
  minecraft = 2,
}

export default interface IField {
  id: string;
  altId?: string;
  groupId?: string;
  title?: string;
  description?: string;
  note?: string;
  note2?: string;
  note3?: string;
  undefinedIfEmpty?: boolean;
  subForm?: IFormDefinition;
  subFormId?: string;
  allowedKeys?: string[];
  subFields?: { [keyName: string]: IField };
  objectArrayToSubFieldKey?: string;
  objectArrayTitleFieldKey?: string;
  matchObjectArrayLengthToSubFieldLength?: boolean;
  matchObjectArrayToSubFieldKey?: boolean;
  fixedLength?: number;
  keyDescription?: string;
  lookupId?: string;
  minLength?: number;
  maxLength?: number;
  newItemPrototype?: any;
  noun?: string;
  allowCreateDelete?: boolean;
  readOnly?: boolean;
  displayTitle?: boolean;
  forceString?: boolean;
  minValue?: number;
  maxValue?: number;
  step?: number;
  humanifyValues?: FieldValueHumanify;
  hideSamples?: boolean;
  suggestedMinValue?: number;
  suggestedMaxValue?: number;
  tags?: string[];
  isRequired?: boolean;
  validity?: ICondition[];
  visibility?: ICondition[];
  defaultValue?: string | number | boolean | number[] | string[];
  additionalIndent?: number;
  visualExperience?: FieldVisualExperience;
  experienceType?: FieldExperienceType;
  dataType: FieldDataType;
  alternates?: IField[];
  mustMatchChoices?: boolean;
  choices?: ISimpleReference[];
  samples?: { [path: string]: IFormSample[] };
}
