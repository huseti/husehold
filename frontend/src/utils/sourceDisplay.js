// Recipe.source is free text ("Rezept von Mama", "Kochbuch Jamie Oliver") or a
// web link -- only the latter should render as a clickable link in the UI.
export function asClickableUrl(source) {
  if (!source) return null;
  try {
    const url = new URL(source.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
