import Utilities from "../core/Utilities";

export default class ProjectInfoUtilities {
  static getTitleFromEnum(categoryEnum: { [name: number]: string }, topicId: number) {
    if (categoryEnum[topicId]) {
      return Utilities.humanifyJsName(categoryEnum[topicId]);
    }

    return "General Item " + topicId;
  }
}
