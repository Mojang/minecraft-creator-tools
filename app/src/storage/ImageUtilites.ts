import { Exifr } from "exifr";
import IFile from "./IFile";
import StorageUtilities from "./StorageUtilities";

/*
  Parses an image file, returning an any object with various metadata such as width and height

  available data is based on image format, see Exifr docs for info
*/
export async function parseImageMetadata(file: IFile): Promise<any | null> {
  try {
    if (!file.isContentLoaded) {
      await file.loadContent();
    }
    const imageReader = new Exifr();
    const fileData = StorageUtilities.getContentsAsBinary(file);

    if (!fileData) {
      return null;
    }

    return await imageReader.read(fileData).then(() => imageReader.parse());
  } catch (error) {
    console.error(error);
    return null;
  }
}

export function isPackIcon(file?: IFile | null): boolean {
  return !!file && file.name.includes("pack_icon") && file.name.endsWith(".png");
}

export function isWorldIcon(file?: IFile): boolean {
  return !!file && file.name.includes("world_icon") && file.name.endsWith(".jpeg");
}
