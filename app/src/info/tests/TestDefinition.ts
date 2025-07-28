import ProjectItem from "../../app/ProjectItem";
import { InfoItemType } from "../IInfoItemData";
import ProjectInfoItem from "../ProjectInfoItem";

export type TestDefinition = {
  id: number;
  title: string;
  severity?: InfoItemType;
  projectItem?: ProjectItem;
  defaultMessage?: string;
};

export function resultFromTest(
  test: TestDefinition,
  generatorId: string,
  message?: string,
  projectItem?: ProjectItem,
  data?: string
) {
  return new ProjectInfoItem(
    test.severity || InfoItemType.error,
    generatorId,
    test.id,
    message ?? test.defaultMessage ?? test.title,
    projectItem,
    data
  );
}

// Can be returned to show this check does apply to this case
export function notApplicable(): ProjectInfoItem[] {
  return [];
}

// confirms a result has been returned and/or filters nulls in a way the compiler will understand
export function isResult(value: ProjectInfoItem | null | undefined): value is ProjectInfoItem {
  return !!value;
}
