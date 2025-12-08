// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import esprima from "esprima-next";
import ProjectInfoSet from "./ProjectInfoSet";
import ContentIndex from "../core/ContentIndex";
import ProjectInfoUtilities from "./ProjectInfoUtilities";
import { ProjectItemType } from "../app/IProjectItemData";
import Log from "../core/Log";
import { InfoItemType } from "./IInfoItemData";
import Database from "../minecraft/Database";

export const CommonTerms = [
  "undefined",
  "type",
  "name",
  "error",
  "equals",
  "value",
  "length",
  "index",
  "String",
  "number",
  "width",
  "height",
  "count",
  "event",
  "string",
  "text",
  "object",
];

export const CommonTermsSet = new Set(CommonTerms);

export enum ScriptInfoGeneratorTest {
  apisUsed = 101,
}

export interface IScriptTokenInfo {}

export default class ScriptInfoGenerator implements IProjectInfoGenerator {
  id = "SCRIPT";
  title = "Script";
  canAlwaysProcess = true;
  minecraftTokens: { [name: string]: IScriptTokenInfo } = {};
  generatedTokens = false;

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(ScriptInfoGeneratorTest, topicId),
    };
  }

  async _generateTokens() {
    await Database.loadStable20ScriptTypes();
    const typeDefs = Database.stable20TypeDefs;

    if (typeDefs) {
      for (const typeDef of typeDefs.typeDefs) {
        const typeDefContent = typeDef.content.join("\n");

        let name = typeDef.name;
        this.minecraftTokens[name] = {
          typeDef: typeDef,
        };

        const slashIndex = name.indexOf("/");

        if (slashIndex >= 0) {
          this.minecraftTokens[name.substring(0, slashIndex)] = {
            typeDef: typeDef,
          };
          this.minecraftTokens[name.substring(slashIndex + 1)] = {
            typeDef: typeDef,
          };
        }

        const tokens = this.getAllTokens(typeDefContent);

        for (const tok of tokens) {
          this.minecraftTokens[tok] = {
            typeDef: typeDef,
          };
        }
      }
    }
  }

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    const scriptTokensPi = new ProjectInfoItem(
      InfoItemType.featureAggregate,
      this.id,
      ScriptInfoGeneratorTest.apisUsed,
      ProjectInfoUtilities.getTitleFromEnum(ScriptInfoGeneratorTest, ScriptInfoGeneratorTest.apisUsed)
    );

    items.push(scriptTokensPi);

    if (!this.generatedTokens) {
      await this._generateTokens();
    }

    await Database.loadStable20ScriptTypes();

    const itemsCopy = project.getItemsCopy();

    for (let i = 0; i < itemsCopy.length; i++) {
      const pi = itemsCopy[i];

      if (pi.itemType === ProjectItemType.js) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          if (!pi.primaryFile.isContentLoaded) {
            await pi.primaryFile.loadContent();
          }

          const content = pi.primaryFile.content;

          if (content && typeof content === "string") {
            this.parseJsContent(scriptTokensPi, content);
          }
        }
      }
    }

    return items;
  }

  getAllTokens(content: string) {
    const tokens: string[] = [];
    const tokensSet = new Set<string>();

    try {
      const results = esprima.tokenize(content);

      if (results) {
        for (const token of results) {
          if ((token.type === "Identifier" || token.type === "String") && token.value && token.value.length > 3) {
            let tok = token.value.trim();

            if (tok.startsWith("'") && tok.endsWith("'")) {
              tok = tok.substring(1, tok.length - 1);
            } else if (tok.startsWith("'") && tok.endsWith("'")) {
              tok = tok.substring(1, tok.length - 1);
            }

            if (token.type === "Identifier" && tok !== "from" && !tokensSet.has(tok) && !CommonTermsSet.has(tok)) {
              tokens.push(tok);
              tokensSet.add(tok);
            } else if (
              token.type === "String" &&
              !CommonTermsSet.has(tok) &&
              (tok.startsWith("minecraft:") || tok.startsWith("@minecraft")) &&
              !tokensSet.has(tok)
            ) {
              tokens.push(tok);
              tokensSet.add(tok);
            }
          }
        }
      }
    } catch (e) {
      Log.debugAlert("JS parsing error:" + e);
    }

    return tokens;
  }

  parseJsContent(scriptTokensPi: ProjectInfoItem, content: string) {
    let tokens = this.getAllTokens(content);

    for (const token of tokens) {
      if (this.minecraftTokens[token] !== undefined) {
        scriptTokensPi.incrementFeature(token);
      }
    }
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    const scriptItems = infoSet.getItems(this.id, ScriptInfoGeneratorTest.apisUsed);
    info.apisUsed = [];
    const apisUsedSet = new Set<string>();

    for (const scriptItem of scriptItems) {
      let scriptTokens = scriptItem.featureSets;

      if (scriptTokens) {
        for (const scriptToken in scriptTokens) {
          if (!apisUsedSet.has(scriptToken) && !CommonTermsSet.has(scriptToken)) {
            info.apisUsed.push(scriptToken);
            apisUsedSet.add(scriptToken);
          }
        }
      }
    }

    info.apisUsed.sort();
  }
}
