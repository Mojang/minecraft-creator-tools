/**
 * SearchCommand - Search content index for matches
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This command uses DistributedContentIndex to search for content
 * matching a specified term. It can search by annotation categories
 * and outputs results in JSON and CSV formats.
 *
 * USAGE:
 * npx mct search <term> [annotationCategory] -i <content-folder>
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import DistributedContentIndex from "../../../storage/DistributedContentIndex";
import ContentIndex, { AnnotationCategory } from "../../../core/ContentIndex";
import NodeStorage from "../../../local/NodeStorage";
import IFile from "../../../storage/IFile";
import ClUtils from "../../ClUtils";

interface ISearchResult {
  match: string;
  result: string;
  annotationCategory?: string;
  value?: string;
  terms?: string[];
}

interface ISearchResultSet {
  searchTerm: string;
  results: ISearchResult[];
}

export class SearchCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "search",
    description: "Uses a content index to perform a search.",
    taskType: TaskType.search,
    aliases: ["s"],
    requiresProjects: false,
    isWriteCommand: false,
    isEditInPlace: false,
    isLongRunning: false,
    category: "Validation",
    arguments: [
      {
        name: "search",
        description: "Search term to use.",
        required: true,
        contextField: "searchTerm",
      },
      {
        name: "annotationCategory",
        description: "Annotation category to search for",
        required: false,
        contextField: "annotationCategory",
      },
    ],
  };

  configure(cmd: Command): void {
    // Arguments are configured via metadata.arguments
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    const searchTerm = context.searchTerm;
    if (!searchTerm) {
      context.log.error("No search term specified.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const workFolder = await ClUtils.getMainWorkFolder(context.taskType, context.inputFolder, context.outputFolder);

    if (!workFolder) {
      context.log.error("No work folder found. Use -i to specify input folder.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const dci = new DistributedContentIndex(workFolder);
    await dci.ensureLoaded();

    let csvResultsFile: IFile | undefined;
    let jsonResultsFile: IFile | undefined;

    if (context.outputFolder) {
      const outputStorage = new NodeStorage(context.outputFolder, "");
      csvResultsFile = outputStorage.rootFolder.ensureFile(searchTerm + ".results.csv");
      jsonResultsFile = outputStorage.rootFolder.ensureFile(searchTerm + ".results.json");
    }

    let annotationCategories: AnnotationCategory[] | undefined;

    const annotationCategoryArg = context.type; // Using type for annotation category
    if (annotationCategoryArg) {
      const category = ContentIndex.getAnnotationCategoryFromLongString(annotationCategoryArg);
      if (category) {
        annotationCategories = [category as AnnotationCategory];
      }
    }

    const descendents = await dci.getDescendentStrings(searchTerm);
    const searchResults: ISearchResultSet = {
      searchTerm: searchTerm,
      results: [],
    };

    context.log.info("Specific Matches:");
    const matches = await dci.getMatches(searchTerm, false, annotationCategories);

    if (!matches || matches.length === 0) {
      context.log.info(`Could not find matches for '${searchTerm}'`);
    } else {
      for (const av of matches) {
        let mess = av.value;

        if (av.annotation) {
          mess += " with annotation " + av.annotation;
        }

        searchResults.results.push({
          match: searchTerm,
          result: av.value,
          annotationCategory: av.annotation,
        });

        context.log.info(mess);
      }
    }

    context.log.info("Child Matches:");
    for (const descendentKey in descendents) {
      if (descendentKey !== searchTerm) {
        context.log.info(`Child Match: '${descendentKey}'`);

        const vals = descendents[descendentKey];

        if (vals) {
          for (const av of vals) {
            let mess = av.value;

            if (av.annotation) {
              mess += " with annotation " + av.annotation;
            }

            searchResults.results.push({
              match: descendentKey,
              result: av.value,
              annotationCategory: av.annotation,
            });

            context.log.info(mess);
          }
        }
      }
    }

    if (jsonResultsFile && csvResultsFile) {
      for (const result of searchResults.results) {
        let match = result.match;

        const equals = match.indexOf("==");

        if (equals >= 0) {
          result.value = match.substring(equals + 2);
          match = match.substring(0, equals);
        }

        result.terms = match.split(".");
      }

      jsonResultsFile.setContent(JSON.stringify(searchResults, undefined, 2));
      await jsonResultsFile.saveContent();

      const csvContents: string[] = ["Match,Term1,Term2,Term3,Term4,Term5,Term6,Results,Annotation"];
      for (const result of searchResults.results) {
        let line = result.match + ",";

        for (let i = 0; i < 6; i++) {
          if (result.terms && result.terms.length > i) {
            line += result.terms[i];
          }
          line += ",";
        }

        if (result.value) {
          line += result.value;
        }
        line += ",";
        line += result.result + "," + result.annotationCategory;
        csvContents.push(line);
      }

      csvResultsFile.setContent(csvContents.join("\n"));
      await csvResultsFile.saveContent();
    }

    if (context.json) {
      // CI consumers want the results as parseable JSON on stdout, not just
      // written to a file. Add the standard schemaVersion + command discriminator.
      context.log.data(
        JSON.stringify({
          schemaVersion: "1.0.0",
          command: "search",
          searchTerm: searchResults.searchTerm,
          resultsCount: searchResults.results.length,
          results: searchResults.results,
        })
      );
    } else {
      context.log.success(`Found ${searchResults.results.length} results for '${searchTerm}'`);
    }
    this.logComplete(context);
  }
}

export const searchCommand = new SearchCommand();
