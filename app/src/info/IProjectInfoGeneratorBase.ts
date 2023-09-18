export interface IProjectUpdaterReference {
  updaterId: string;
  updaterIndex: number;
  action: string;
}

export interface IProjectInfoTopicData {
  title: string;
  updaters?: IProjectUpdaterReference[];
}

export default interface IProjectInfoGeneratorBase {
  id: string;
  title: string;
  getTopicData(topicId: number): IProjectInfoTopicData | undefined;
}
