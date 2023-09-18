

export default interface IPersistable
{
    persist() : Promise<void>;
}