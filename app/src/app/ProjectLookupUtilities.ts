import { AnnotationCategory } from "../core/ContentIndex";
import ISimpleReference from "../core/ISimpleReference";
import LookupUtilities from "./LookupUtilities";
import Project from "./Project";

export default class ProjectLookupUtilities {
  static async getLookup(project: Project, lookupId: string): Promise<ISimpleReference[] | undefined> {
    let simpleRefs: ISimpleReference[] = [];

    await project.ensureInfoSetGenerated();

    switch (lookupId) {
      case "blockType":
        const refs = LookupUtilities.getReferencesFromAnnotatedValues(
          project.infoSet.contentIndex.getAll([AnnotationCategory.blockTypeSource]),
          AnnotationCategory.blockTypeSource,
          "{0} block type from Vanilla Minecraft"
        );

        if (refs) {
          simpleRefs = refs;
        }
        break;

      case "entityType":
        break;

      case "entityTypeEvents":
        break;

      case "difficulty":
        break;

      case "damageCause":
        break;

      case "lootTable":
        break;

      case "entityTypePlusVariants":
        break;
    }

    LookupUtilities.appendReferences(simpleRefs, await LookupUtilities.getLookup(lookupId));

    if (simpleRefs && simpleRefs.length === 0) {
      return undefined;
    }

    return simpleRefs;
  }
}
