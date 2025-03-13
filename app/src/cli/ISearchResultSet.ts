export default interface ISearchResultSet {
  searchTerm: string;
  results: ISearchResult[];
}

export interface ISearchResult {
  match: string;
  terms?: string[];
  value?: string;
  result: string;
  annotationCategory?: string;
}
