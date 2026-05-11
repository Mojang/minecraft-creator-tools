/*
  Standardizes titles for forms

  * Capitalizes lowercase words
  * reduces delimiters (_, :) into spaces
  * Separates camel case
  
  e.g: FooBar:hello_world => Foo Bar Hello World
*/
export function normalizeTitle(title?: string) {
  if (!title) {
    return "[UNKNOWN]";
  }

  // Strip common namespace prefixes (e.g., "minecraft:spawns_on_surface" → "spawns_on_surface")
  title = title.replace(/^minecraft:/i, "");

  return title
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/_|:| /g)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
}

export function normalizeSelectItem(item?: unknown) {
  if (!item) {
    return "[UNKNOWN]";
  }

  if (typeof item === "string") {
    return normalizeTitle(item);
  }

  if (typeof item === "number") {
    return item;
  }

  // Fallback case - This should hopefully never happen
  console.warn(`unable to format select item: ${item}`);
  return "[SELECT ITEM]";
}
