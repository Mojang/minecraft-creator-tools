import { IFilterClause } from "./IFilterClause";

export interface IFilter extends IFilterClause {
  any_of?: IFilter[];
  all_of?: IFilter[];
}
