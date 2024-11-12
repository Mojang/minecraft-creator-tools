import Storage from "../storage/Storage";

export default class DirectoryStorage extends Storage {
  static getEntriesAsPromise(dirEntry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
    return new Promise((resolve, reject) => {
      const result: FileSystemEntry[] = [];
      const reader = dirEntry.createReader();
      const doBatch = () => {
        reader.readEntries((entries) => {
          if (entries.length > 0) {
            entries.forEach((e) => result.push(e));
            doBatch();
          } else {
            resolve(result);
          }
        }, reject);
      };
      doBatch();
    });
  }

  async processDirectory(dirEntry: FileSystemDirectoryEntry) {
    // const results = await DirectoryStorage.getEntriesAsPromise(dirEntry);
  }
}
