// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IAnnotatedValue } from "./AnnotatedValue";
import IContextIndexData from "./IContentIndexData";
import Log from "./Log";
import Utilities from "./Utilities";
import esprima from "esprima-next";

export enum AnnotationCategories {
  blockTypeDependent = "b",
  entityComponentDependent = "c",
  blockComponentDependent = "d",
  entityTypeDependent = "e",
  experiment = "E",
  itemTypeDependent = "i",
  itemComponentDependent = "j",
  entityComponentDependentInGroup = "g",
  blockComponentDependentInPermutation = "p",
  storagePathDependent = "s",
  entityTypeSource = "E",
  blockTypeSource = "B",
  itemTypeSource = "I",
  jsSource = "S",
  worldProperty = "W",
}

const AvoidTermList = ["__proto__", "prototype", "[[Prototype]]"];

export interface IAnnotatedIndexData {
  n: number;
  a: string;
}

export interface IContentIndex {
  getDescendentStrings(term: string): Promise<{ [fullKey: string]: IAnnotatedValue[] } | undefined>;
  getMatches(searchString: string): Promise<IAnnotatedValue[] | undefined>;
  startLength: number;
}

export default class ContentIndex implements IContentIndex {
  #data: IContextIndexData = {
    items: [],
    trie: {},
  };

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

  getAll(): { [fullKey: string]: IAnnotatedValue[] } {
    const results: { [fullKey: string]: IAnnotatedValue[] } = {};

    this._appendToResults("", this.#data.trie, results);

    return results;
  }

  _isTermToAvoid(term: string) {
    return AvoidTermList.includes(term);
  }

  _appendToResults(prefix: string, node: any, results: { [fullKey: string]: IAnnotatedValue[] }) {
    for (const token in node) {
      const subNode = node[token];

      if (subNode) {
        if (token === "±" || token === "$") {
          const arr = subNode;

          if (arr.constructor === Array) {
            if (!this._isTermToAvoid(prefix)) {
              results[prefix] = this.getValuesFromIndexArray(arr);
            }
          }
        } else if (subNode.constructor === Array) {
          if (!this._isTermToAvoid(prefix + token)) {
            results[prefix + token] = this.getValuesFromIndexArray(subNode);
          }
        } else {
          this._appendToResults(prefix + token, subNode, results);
        }
      }
    }
  }

  mergeFrom(index: ContentIndex, newItem: string) {
    const all = index.getAll();

    for (const fullKey in all) {
      const annVals = all[fullKey];

      let annVal: string | undefined = undefined;

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

  getValuesFromIndexArray(indices: (IAnnotatedIndexData | number)[]) {
    const results: IAnnotatedValue[] = [];

    if (!indices) {
      return results;
    }

    for (const index of indices) {
      if (typeof index === "object") {
        const indexN = (index as IAnnotatedIndexData).n;
        if (indexN >= 0 && indexN < this.#data.items.length) {
          results.push({ value: this.#data.items[indexN], annotation: (index as IAnnotatedIndexData).a });
        }
      } else if (index >= 0 && index < this.#data.items.length) {
        results.push({ value: this.#data.items[index], annotation: undefined });
      }
    }

    return results;
  }

  loadFromData(data: IContextIndexData) {
    this.#data = data;
  }

  async getMatches(searchString: string) {
    searchString = searchString.trim().toLowerCase();

    const terms = searchString.split(" ");
    let termWasSearched = false;

    let andResults: number[] | undefined = undefined;

    for (const term of terms) {
      if (term.length > 3) {
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

    return this.getValuesFromIndexArray(andResults);
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

    const results: { [fullKey: string]: IAnnotatedValue[] } = {};

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
        const nextStart = term[termIndex] + term[termIndex + 1];

        for (const item in curNode) {
          // we've found part of our string in this node

          if (item.startsWith(nextStart) && curNode[item] !== undefined) {
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
    }

    return undefined;
  }

  insertArray(key: string, items: IAnnotatedValue[]) {
    for (const item of items) {
      this.insert(key, item.value, item.annotation);
    }
  }

  insert(key: string, item: string, annotationChar?: string) {
    if (Utilities.isNumericIsh(key) || key.length > 40) {
      return;
    }

    // since we treat ± as special, ban usage of ± in strings.
    key = key.replace(/±/gi, "").toLowerCase().trim();

    let keyIndex = 0;
    let curNode: any = this.#data.trie;
    let parentNode: any = curNode;
    let curNodeIndex: string | undefined = undefined;
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
            if (item[itemIndex] !== key[keyIndex] && itemIndex < item.length && keyIndex < key.length) {
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
