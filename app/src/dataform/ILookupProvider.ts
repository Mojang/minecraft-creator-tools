import ISimpleReference from "../core/ISimpleReference";

export default interface ILookupProvider {
  getLookupChoices(lookupId: string): Promise<ISimpleReference[] | undefined>;
}
