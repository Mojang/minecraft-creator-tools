export default interface IStorageObject {
  name: string;
  storageRelativePath: string;
  fullPath: string;
  manager?: any;
  tag?: any;
}
