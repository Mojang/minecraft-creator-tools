/****
 *
 * separates an single array into an array of successes and an array of fails
 * success is based on the truthiness of an predicate function
 *
 *
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
