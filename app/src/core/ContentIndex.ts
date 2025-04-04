// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IAnnotatedValue } from "./AnnotatedValue";
import IContextIndexData from "./IContentIndexData";
import Log from "./Log";
import Utilities from "./Utilities";
import esprima from "esprima-next";

export enum AnnotationCategory {
  blockTextureReferenceSource = "a",
  blockTypeDependent = "b",
  entityComponentDependent = "c",
  blockComponentDependent = "d",
  entityTypeDependent = "e",
  entityFilter = "f",
  entityComponentDependentInGroup = "g",
  blockTextureReferenceDependent = "h",
  itemTypeDependent = "i",
  itemComponentDependent = "j",
  itemTextureReferenceSource = "k",
  featureSource = "l",
  featureDependent = "m",
  featureRuleSource = "n",
  blockComponentDependentInPermutation = "p",
  storagePathDependent = "s",
  textureFile = "t",
  entityEvent = "v",
  blockTypeSource = "B",
  entityTypeSource = "E",
  itemTypeSource = "I",
  itemTextureSource = "J",
  blockSounds = "L",
  musicDefinitionSource = "M",
  entitySounds = "N",
  interactiveSounds = "R",
  jsSource = "S",
  terrainTextureSource = "T",
  soundDefinitionSource = "U",
  individualEventSoundsSource = "V",
  worldProperty = "W",
  experiment = "X",
}

const AvoidTermList = ["__proto__", "prototype", "[[Prototype]]"];

export interface IAnnotatedIndexData {
  n: number;
  a: string;
}

export interface IContentIndex {
  getDescendentStrings(term: string): Promise<{ [fullKey: string]: IAnnotatedValue[] | undefined } | undefined>;
  getMatches(
    searchString: string,
    wholeTermSearch?: boolean,
    withAnnotation?: AnnotationCategory[]
  ): Promise<IAnnotatedValue[] | undefined>;
  startLength: number;
}

export default class ContentIndex implements IContentIndex {
  #data: IContextIndexData = {
    items: [],
    trie: {},
  };

  #iteration: number = Math.floor(Math.random() * 1000000);

  get iteration() {
    return this.#iteration;
  }

  set iteration(newIteration: number) {
    this.#iteration = newIteration;
  }

  static getAnnotationCategoryKeys() {
    const keys: string[] = [];

    for (const key in AnnotationCategory) {
      keys.push(key.toLowerCase());
    }

    return keys;
  }

  static getAnnotationCategoryFromLongString(longStr: string) {
    longStr = longStr.toLowerCase();

    for (const key in AnnotationCategory) {
      if (key.toLowerCase() === longStr) {
        return (AnnotationCategory as { [keyName: string]: string })[key];
      }
    }

    return undefined;
  }

  get data() {
    return this.#data;
  }

  get startLength() {
    return 4;
  }

  setItems(items: string[]) {
    this.#data.items = items;
  }

  setTrie(trie: {}) {
    this.#data.trie = trie;
  }

  getAll(withAnnotation?: AnnotationCategory[]): { [fullKey: string]: IAnnotatedValue[] } {
    const results: { [fullKey: string]: IAnnotatedValue[] } = {};

    this._appendToResults("", this.#data.trie, results, withAnnotation);

    return results;
  }

  _isTermToAvoid(term: string) {
    return AvoidTermList.includes(term);
  }

  _appendToResults(
    prefix: string,
    node: any,
    results: { [fullKey: string]: IAnnotatedValue[] | undefined },
    withAnnotation?: AnnotationCategory[]
  ) {
    for (const token in node) {
      const subNode = node[token];

      if (subNode) {
        if (token === "±" || token === "$") {
          const arr = subNode;

          if (arr.constructor === Array) {
            if (!this._isTermToAvoid(prefix)) {
              let res = this.getValuesFromIndexArray(arr, withAnnotation);

              if (res) {
                results[prefix] = res;
              }
            }
          }
        } else if (subNode.constructor === Array) {
          if (!this._isTermToAvoid(prefix + token)) {
            let res = this.getValuesFromIndexArray(subNode, withAnnotation);

            if (res) {
              results[prefix + token] = res;
            }
          }
        } else {
          this._appendToResults(prefix + token, subNode, results, withAnnotation);
        }
      }
    }
  }

  mergeFrom(index: ContentIndex, newItem: string) {
    const all = index.getAll();

    for (const fullKey in all) {
      const annVals = all[fullKey];

      let annVal: string | undefined;

      for (const subVal of annVals) {
        if (subVal.annotation) {
          if (!annVal) {
            annVal = subVal.annotation;
          } else if (annVal.indexOf(subVal.annotation) < 0) {
            annVal += subVal.annotation;
          }
        }
      }

      this.insert(fullKey, newItem, annVal);
    }
  }

  static processResultValues(annotatedValues: IAnnotatedValue[] | undefined, withAnyAnnotation?: AnnotationCategory[]) {
    if (!annotatedValues) {
      return undefined;
    }

    if (withAnyAnnotation) {
      let newAnnotatedValues: IAnnotatedValue[] = [];

      for (const annV of annotatedValues) {
        if (annV.annotation && withAnyAnnotation.includes(annV.annotation as AnnotationCategory)) {
          newAnnotatedValues.push(annV);
        }
      }

      annotatedValues = newAnnotatedValues;
    }

    return annotatedValues;
  }

  getValuesFromIndexArray(
    indices: (IAnnotatedIndexData | number)[],
    withAnnotation?: AnnotationCategory[]
  ): IAnnotatedValue[] | undefined {
    let results: IAnnotatedValue[] = [];

    if (!indices) {
      return undefined;
    }

    if (Utilities.arrayHasNegativeAndIsNumeric(indices)) {
      indices = Utilities.decodeSequentialRunLengthUsingNegative(indices as number[]);
    }

    for (const index of indices) {
      if (typeof index === "object") {
        const indexN = (index as IAnnotatedIndexData).n;
        if (indexN >= 0 && indexN < this.#data.items.length) {
          const annotate = index.a;

          if (!withAnnotation || withAnnotation.includes(annotate as AnnotationCategory)) {
            results.push({ value: this.#data.items[indexN], annotation: (index as IAnnotatedIndexData).a });
          }
        }
      } else if (index >= 0 && index < this.#data.items.length && !withAnnotation) {
        results.push({ value: this.#data.items[index], annotation: undefined });
      }
    }

    if (results.length === 0) {
      return undefined;
    }

    return results;
  }

  loadFromData(data: IContextIndexData) {
    this.#data = data;
  }

  hasPathMatches(pathEnd: string) {
    pathEnd = pathEnd.toLowerCase();

    const lastPeriodEnd = pathEnd.lastIndexOf(".");

    if (lastPeriodEnd >= 0) {
      pathEnd = pathEnd.substring(0, lastPeriodEnd);
    }

    for (let path of this.data.items) {
      if (path.startsWith("/")) {
        const lastPeriod = path.lastIndexOf(".");

        if (lastPeriod >= 0) {
          path = path.substring(0, lastPeriod);
        }

        if (path.endsWith(pathEnd)) {
          return true;
        }
      }
    }

    return false;
  }

  async getMatches(searchString: string, wholeTermSearch?: boolean, withAnyAnnotation?: AnnotationCategory[]) {
    searchString = searchString.trim().toLowerCase();

    let terms = [searchString];

    if (!wholeTermSearch) {
      terms = searchString.split(" ");
    }

    let termWasSearched = false;

    let andResults: number[] | undefined;

    for (const term of terms) {
      if (term.length > 1) {
        const results = this.getTermMatch(term);
        termWasSearched = true;

        if (results && results.length) {
          if (andResults === undefined) {
            andResults = results;
          } else {
            const newArr = [];

            for (let num of results) {
              if (andResults.includes(num)) {
                newArr.push(num);
              }
            }
          }
        }
      }
    }

    if (andResults === undefined || andResults.length === 0) {
      if (termWasSearched) {
        return [];
      }

      return undefined;
    }

    let annotatedValues = ContentIndex.processResultValues(this.getValuesFromIndexArray(andResults), withAnyAnnotation);

    if (!annotatedValues) {
      return undefined;
    }

    return annotatedValues.sort((a: IAnnotatedValue, b: IAnnotatedValue) => {
      let aTermMatches = 0;
      let bTermMatches = 0;
      const aVal = a.value.toLowerCase();
      const bVal = b.value.toLowerCase();

      for (const term of terms) {
        if (aVal.startsWith(term)) {
          aTermMatches += 5;
        } else if (aVal.includes(term)) {
          aTermMatches++;
        }

        if (bVal.startsWith(term)) {
          bTermMatches += 5;
        } else if (bVal.includes(term)) {
          bTermMatches++;
        }
      }

      if (aTermMatches === bTermMatches) {
        return a.value.localeCompare(b.value);
      }

      return bTermMatches - aTermMatches;
    });
  }

  getTermMatchStrings(term: string) {
    const results = this.getTermMatch(term);

    if (results === undefined) {
      return results;
    }

    return this.getValuesFromIndexArray(results);
  }

  async getDescendentStrings(term: string) {
    let termIndex = 0;
    let curNode: any = this.#data.trie;

    const results: { [fullKey: string]: IAnnotatedValue[] | undefined } = {};

    let hasAdvanced = true;
    let termSubstr = "";

    while (termIndex < term.length && hasAdvanced) {
      hasAdvanced = false;
      if (curNode.constructor === Array) {
        return undefined;
      }

      let nextNode = curNode[term[termIndex]];
      if (nextNode) {
        curNode = nextNode;
        termIndex++;

        termSubstr = term.substring(0, termIndex);
        hasAdvanced = true;
      } else {
        let nextStart = term[termIndex];

        for (const item in curNode) {
          // we've found part of our string in this node

          if (item.startsWith(nextStart) && curNode[item] !== undefined) {
            let itemIndex = 0;
            hasAdvanced = true;
            curNode = curNode[item];
            termSubstr = term.substring(0, termIndex) + item;

            while (termIndex < term.length && itemIndex < item.length && item[itemIndex] === term[termIndex]) {
              itemIndex++;
              termIndex++;
            }

            break;
          }
        }
      }
    }

    if (termIndex < term.length) {
      const termStub = term.substring(termIndex);

      for (const childNodeName in curNode) {
        if (childNodeName.startsWith(termStub) && curNode[childNodeName]) {
          this._appendToResults(term.substring(0, termIndex) + childNodeName, curNode[childNodeName], results);
        }
      }
    } else {
      if (curNode.constructor === Array) {
        results[termSubstr] = this.getValuesFromIndexArray(curNode);
      } else if (curNode["±"] !== undefined) {
        this._appendToResults(termSubstr, curNode, results);
      }
    }

    return results;
  }

  getTermMatch(term: string) {
    let termIndex = 0;
    let curNode: any = this.#data.trie;

    let hasAdvanced = true;
    while (termIndex < term.length && hasAdvanced) {
      hasAdvanced = false;
      if (curNode.constructor === Array) {
        return undefined;
      }

      let nextNode = curNode[term[termIndex]];
      if (nextNode) {
        curNode = nextNode;
        termIndex++;
        hasAdvanced = true;
      } else {
        let nextStart = term[termIndex];

        if (termIndex < term.length - 1) {
          nextStart += term[termIndex + 1];
        }

        for (const item in curNode) {
          // we've found part of our string in this node

          if (item.startsWith(nextStart) && curNode[item] !== undefined && !hasAdvanced) {
            let itemIndex = 0;
            hasAdvanced = true;
            curNode = curNode[item];

            while (termIndex < term.length && itemIndex < item.length && item[itemIndex] === term[termIndex]) {
              itemIndex++;
              termIndex++;
            }
          }
        }
      }
    }

    if (termIndex < term.length) {
      return undefined;
    }

    if (curNode.constructor === Array) {
      return curNode;
    } else if (curNode["±"] !== undefined) {
      return curNode["±"];
    } else {
      const arr: number[] = [];

      this.aggregateIndices(curNode, arr);

      return arr;
    }
  }

  aggregateIndices(curNode: any, arr: number[]) {
    for (const childNodeName in curNode) {
      const childNode = curNode[childNodeName];

      if (childNode) {
        if (childNode.constructor === Array) {
          for (const num of childNode) {
            if (!arr.includes(num)) {
              arr.push(num);
            }
          }
        } else if (childNode["±"] !== undefined) {
          for (const num of childNode["±"]) {
            if (!arr.includes(num)) {
              arr.push(num);
            }
          }
        } else {
          this.aggregateIndices(childNode, arr);
        }
      }
    }
  }

  insertArray(key: string, items: IAnnotatedValue[]) {
    for (const item of items) {
      this.insert(key, item.value, item.annotation);
    }
  }

  insert(key: string, item: string, annotationChar?: string) {
    if (Utilities.isNumericIsh(key) || key.length > 70) {
      return;
    }

    // since we treat ± as special, ban usage of ± in strings.
    key = key.replace(/±/gi, "").toLowerCase().trim();

    let keyIndex = 0;
    let curNode: any = this.#data.trie;
    let parentNode: any = curNode;
    let curNodeIndex: string | undefined;
    let dataIndex = -1;
    let curIndex = 0;

    for (const itemCand of this.#data.items) {
      if (itemCand === item) {
        dataIndex = curIndex;
        break;
      }

      curIndex++;
    }

    if (dataIndex < 0) {
      dataIndex = this.#data.items.length;
      this.#data.items.push(item);
    }

    let hasAdvanced = true;
    while (keyIndex < key.length && hasAdvanced) {
      hasAdvanced = false;
      if (curNode.constructor !== Array) {
        for (const item in curNode) {
          // we've found part of our string in this node
          if (item.startsWith(key[keyIndex]) && curNode[item] !== undefined) {
            // && curNode[item].constructor !== Array) {
            let itemIndex = 0;
            hasAdvanced = true;
            curNodeIndex = item;
            parentNode = curNode;
            curNode = curNode[item];

            while (keyIndex < key.length && itemIndex < item.length && item[itemIndex] === key[keyIndex]) {
              itemIndex++;
              keyIndex++;
            }

            // if we're in the middle of a string like "subset", and we're trying add the word "subpar",
            // create a new node called "sub" and place "set" underneath it.
            // also support the case where we're adding "sub" but "subset" already exists (keyIndex === key.length)
            if (item[itemIndex] !== key[keyIndex] && itemIndex < item.length && keyIndex <= key.length) {
              parentNode[curNodeIndex] = undefined;
              curNodeIndex = item.substring(0, itemIndex);

              let newNode: any = {};

              parentNode[curNodeIndex] = newNode;

              const term = item.substring(itemIndex);

              if (!this._isTermToAvoid(term)) {
                newNode[term] = curNode;
              }

              curNode = newNode;
            }

            break;
          }
        }
      }
    }

    // we've reached the end of the trie; we need to add a new node
    if (keyIndex < key.length) {
      // if parent node was a leaf array, switch to an object
      if (curNode.constructor === Array && curNodeIndex) {
        parentNode[curNodeIndex] = {};
        parentNode[curNodeIndex]["±"] = curNode;

        curNode = parentNode[curNodeIndex];
      }

      const substr = key.substring(keyIndex);

      if (substr !== "±") {
        if (!this._isTermToAvoid(substr)) {
          // create a new leaf array
          curNode[substr] = this.ensureAnnotatedContentInArray([], dataIndex, annotationChar);
        }
      }
    } else {
      if (curNode.constructor === Array && curNodeIndex) {
        if (!this._isTermToAvoid(curNodeIndex)) {
          parentNode[curNodeIndex] = this.ensureAnnotatedContentInArray(curNode, dataIndex, annotationChar);
        }
      } else {
        if (curNode["±"] === undefined) {
          curNode["±"] = [];
        }

        curNode["±"] = this.ensureAnnotatedContentInArray(curNode["±"], dataIndex, annotationChar);
      }
    }
  }

  ensureAnnotatedContentInArray(arr: (IAnnotatedIndexData | number)[], dataIndex: number, annotationChar?: string) {
    try {
      for (const item of arr) {
        if (typeof item === "object") {
          if ((item as IAnnotatedIndexData).n === dataIndex) {
            if (annotationChar) {
              if (!(item as IAnnotatedIndexData).a) {
                (item as IAnnotatedIndexData).a = annotationChar;
              } else {
                if ((item as IAnnotatedIndexData).a.indexOf(annotationChar) < 0) {
                  (item as IAnnotatedIndexData).a += annotationChar;
                }
              }
            }

            return arr;
          }
        } else if (item === dataIndex) {
          if (!annotationChar) {
            return arr;
          }

          // convert simple number to annotated object
          const newArr = [];

          for (const existItem of arr) {
            if (existItem !== dataIndex) {
              newArr.push(existItem);
            }
          }

          newArr.push({ n: dataIndex, a: annotationChar });

          return newArr;
        }
      }

      if (annotationChar) {
        arr.push({ n: dataIndex, a: annotationChar });
      } else {
        arr.push(dataIndex);
      }
    } catch (e) {
      console.warn("Error ensuring annotated content: " + e + "|" + arr + "|" + JSON.stringify(arr));
    }

    return arr;
  }

  parseJsContent(sourcePath: string, content: string) {
    try {
      const results = esprima.tokenize(content);

      if (results) {
        for (const token of results) {
          if (token.type === "Identifier" && token.value && token.value.length > 3) {
            if (token.value !== "from") {
              this.insert(token.value.toLowerCase(), sourcePath, "S");
            }
          }
        }
      }
    } catch (e) {
      Log.debugAlert("JS parsing error:" + e);
    }
  }

  parseTextContent(sourcePath: string, content: string) {
    const dictionaryOfTerms: { [term: string]: boolean | undefined } = {};

    let curWord = "";

    content = content.toLowerCase();

    for (let i = 0; i < content.length; i++) {
      const curChar = content[i];

      if (
        curChar === "{" ||
        curChar === "}" ||
        curChar === " " ||
        curChar === "\r" ||
        curChar === "\n" ||
        curChar === "\t" ||
        curChar === "(" ||
        curChar === ")" ||
        curChar === "[" ||
        curChar === "]" ||
        curChar === ":" ||
        curChar === '"' ||
        curChar === "'"
      ) {
        if (curWord.length > 0) {
          if (curWord.length > 3 && !Utilities.isNumericIsh(curWord)) {
            dictionaryOfTerms[curWord] = true;
          }
          curWord = "";
        }
      } else {
        curWord += content[i];
      }
    }

    for (const term in dictionaryOfTerms) {
      this.insert(term, sourcePath);
    }
  }

  parseJsonContent(sourcePath: string, content: string) {
    const dictionaryOfTerms: { [term: string]: boolean | undefined } = {};

    let curWord = "";

    content = content.toLowerCase();

    for (let i = 0; i < content.length; i++) {
      const curChar = content[i];

      if (
        curChar === "{" ||
        curChar === "}" ||
        curChar === " " ||
        curChar === "\r" ||
        curChar === "\n" ||
        curChar === "\t" ||
        curChar === "(" ||
        curChar === ")" ||
        curChar === "[" ||
        curChar === "]" ||
        curChar === ":" ||
        curChar === '"' ||
        curChar === "'"
      ) {
        if (curWord.length > 0) {
          if (curWord.length > 3 && !Utilities.isNumericIsh(curWord)) {
            dictionaryOfTerms[curWord] = true;
          }
          curWord = "";
        }
      } else {
        curWord += content[i];
      }
    }

    for (const term in dictionaryOfTerms) {
      this.insert(term, sourcePath);
    }
  }
}
