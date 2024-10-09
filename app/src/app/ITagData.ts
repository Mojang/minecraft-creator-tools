export default interface ITagData {
  [category: string]: ITagList;
}

export interface ITagList {
  [tag: string]: string[];
}
