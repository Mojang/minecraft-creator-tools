import IFile from '../../../storage/IFile';
import IPersistable from '../../types/IPersistable';

export default interface IFileProps
{
    file : IFile;
    setActivePersistable? : (persistObject : IPersistable) => void;
}