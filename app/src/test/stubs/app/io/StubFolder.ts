import IFolder from "../../../../storage/IFolder";

export function createStubFolder() {
  return {
    isLoaded: true,
    files: {},
    folders: {},
    load: async () => {},
    name: "root",
    fullPath: "/root",
    errorStatus: undefined,
  } as unknown as IFolder;
}
