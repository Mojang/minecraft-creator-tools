/*
  Collects a AsyncIterable into an array with an optional filter predicate
*/
export async function filterAsync<TItem>(
  iterable: AsyncIterable<TItem>,
  predicate?: (item: TItem) => boolean
): Promise<TItem[]> {
  const results: TItem[] = [];
  for await (const item of iterable) {
    if (predicate && predicate(item)) {
      results.push(item);
    }
  }

  return results;
}
