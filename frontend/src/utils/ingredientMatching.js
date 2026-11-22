// Ingredient name helpers shared by the recipe form, the shopping list and
// the recipe view.

// name or alias (case-insensitive) -> ingredient, for the preferred-unit
// pre-selection when an ingredient is typed into a recipe or shopping list.
export function buildIngredientLookup(ingredients) {
  const byName = new Map();
  ingredients.forEach((ingredient) => {
    (ingredient.aliases || []).forEach((alias) => byName.set(alias.name.trim().toLowerCase(), ingredient));
  });
  // Real names win over aliases.
  ingredients.forEach((ingredient) => byName.set(ingredient.name.trim().toLowerCase(), ingredient));
  return (name) => byName.get((name || '').trim().toLowerCase()) || null;
}

// The unit select's next value after the ingredient name changed: fill in
// the ingredient's preferred unit, but only into an empty select or one we
// filled ourselves earlier -- never over a unit someone picked by hand.
// Returns { unit, unitAuto } to merge into the form/line state.
export function preferredUnitUpdate(name, current, unitAuto, lookup) {
  if (current !== '' && current !== null && current !== undefined && !unitAuto) return { unit: current, unitAuto: false };
  const preferred = lookup(name)?.preferred_unit;
  return preferred ? { unit: String(preferred), unitAuto: true } : { unit: '', unitAuto: false };
}

// --- Highlighting ingredients in recipe text ---------------------------

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "Zwiebel(n), in Ringe geschnitten" -> "Zwiebel"; "Mehl (Type 405)" -> "Mehl".
function baseName(name) {
  return name
    .replace(/\((?:n|s|e|en|se|er)\)/gi, '')
    .split(',')[0]
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Spellings to look for in running text: the name itself, a few German
// singular/plural forms, and -- for "Hokkaido-Kürbis" / "rote Linsen" --
// the last word on its own, since instructions usually just say "den Kürbis".
function spellings(name) {
  const base = baseName(name);
  if (base.length < 2) return [];
  const forms = new Set([base]);
  const lower = base.toLowerCase();
  if (lower.endsWith('en') && base.length > 4) { forms.add(base.slice(0, -2)); forms.add(base.slice(0, -1)); }
  else if (lower.endsWith('n') && base.length > 4) forms.add(base.slice(0, -1));
  else if (lower.endsWith('e')) forms.add(`${base}n`);
  if (lower.endsWith('er') && base.length >= 4) forms.add(base.slice(0, -2)); // Eier -> Ei
  const lastWord = base.split(/[\s-]+/).pop();
  if (lastWord && lastWord !== base && lastWord.length >= 4) spellings(lastWord).forEach((f) => forms.add(f));
  return [...forms].filter((f) => f.length >= 2);
}

// Compiles a matcher for one recipe: returns a function that splits a text
// into [{ text }, { text, lineIndexes }] segments, where lineIndexes are the
// recipe lines (indexes into `lines`) the highlighted word refers to. A word
// can point at several lines ("Zwiebel" used twice, or "Kürbis" matching
// both "Hokkaido-Kürbis" and "Butternut-Kürbis").
export function buildIngredientMatcher(lines) {
  const byForm = new Map();
  lines.forEach((line, index) => {
    const names = [line.ingredient_name, ...(line.ingredient_aliases || [])].filter(Boolean);
    names.flatMap(spellings).forEach((form) => {
      const key = form.toLowerCase();
      if (!byForm.has(key)) byForm.set(key, new Set());
      byForm.get(key).add(index);
    });
  });
  if (byForm.size === 0) return (text) => [{ text }];

  // Longest first, so "Hokkaido-Kürbis" wins over "Kürbis". Forms of 4+
  // letters also match a common German ending ("Tomate" -> "Tomaten").
  const alternatives = [...byForm.keys()]
    .sort((a, b) => b.length - a.length)
    .map((form) => (form.length >= 4 ? `${escapeRegex(form)}(?:n|en|e|s|es|er|ern)?` : `${escapeRegex(form)}(?:er|ern)?`));
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join('|')})(?![\\p{L}])`, 'giu');

  const indexesFor = (word) => {
    const lower = word.toLowerCase();
    if (byForm.has(lower)) return byForm.get(lower);
    // Matched with an ending -- find the form it was built from.
    const form = [...byForm.keys()].sort((a, b) => b.length - a.length).find((f) => lower.startsWith(f));
    return form ? byForm.get(form) : new Set();
  };

  return (text) => {
    const segments = [];
    let last = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index > last) segments.push({ text: text.slice(last, match.index) });
      segments.push({ text: match[0], lineIndexes: [...indexesFor(match[0])] });
      last = match.index + match[0].length;
    }
    if (last < text.length) segments.push({ text: text.slice(last) });
    return segments;
  };
}
