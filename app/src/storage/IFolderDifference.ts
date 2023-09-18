import IFolder from "./IFolder";

export enum FolderDifferenceType
{
    none = 0,
    fileContentsDifferent = 1,
    fileListDifferent = 2,
    fileListAndContentsDifferent = 3,
    folderAdded = 4,
    folderAddedAndFileContentsDifferent = 5,
    folderAddedAndFileListDifferent = 6,
    folderAddedAndFileListAndContentsDifferent = 7,
    folderDeleted = 8,
    folderDeletedAndFileContentsDifferent = 9,
    folderDeletedAndFileListDifferent = 10,
    folderDeletedAndFileListAndContentsDifferent = 11,
    folderListDifferent = 12,
    folderListDifferentAndFileContentsDifferent = 13,
    folderListDifferentAndFileListDifferent = 14,
    folderListDifferentAndFileListAndContentsDifferent = 15
}

export default interface IFolderDifference
{
    type : FolderDifferenceType;
    original? : IFolder;
    updated? : IFolder;
    path : string;
}