import ProjectItem from "../../app/ProjectItem";
import { InfoItemType } from "../IInfoItemData";
import ProjectInfoItem from "../ProjectInfoItem";

export type TestDefinition = {
  id: number;
  title: string;
  severity?: InfoItemType;
  projectItem?: ProjectItem;
  defaultMessage?: string;
  generatorId?: string;
};

export function resultFromTestWithMessage(
  test: TestDefinition,
  generatorId: string,
  message?: string,
  projectItem?: ProjectItem
) {
  return new ProjectInfoItem(
    test.severity || InfoItemType.error,
    generatorId,
    test.id,
    message ?? test.defaultMessage ?? test.title,
    projectItem
  );
}

export function resultFromTest(
  test: TestDefinition,
  {
    id,
    message,
    item,
    data,
  }: {
    id?: string;
    message?: string;
    item?: ProjectItem;
    data?: string | boolean | number | number[];
  }
) {
  return new ProjectInfoItem(
    test.severity || InfoItemType.error,
    test.generatorId || id || "",
    test.id,
    message ?? test.defaultMessage ?? test.title,
    item,
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

export function getTestTitleById(record: Record<string | number, TestDefinition>, testId: number) {
  return Object.values(record).find((test) => test.id === testId)?.title || `Unknown Test: ${testId}`;
}
