/****
 *
 * separates an single array into an array of successes and an array of fails
 * success is based on the truthiness of an predicate function
 *
 * successes are the first value of the return tuple
 *****/
export function filterAndSeparate<TItem>(items: TItem[], predicate: (item: TItem) => boolean) {
  const truthy: TItem[] = [];
  const falsey: TItem[] = [];

  for (const item of items) {
    if (predicate(item)) {
      truthy.push(item);
    } else {
      falsey.push(item);
    }
  }

  return [truthy, falsey] as const;
}

/*
  from an array of items, returns of all duplicates found
*/
export function findDuplicates<TItem>(items: TItem[]) {
  return items.filter((item, index) => items.indexOf(item) !== index);
}
