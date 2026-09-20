// Labels, meal types and units carry a German name (required) and an
// optional English one; English UI falls back to German when it's blank.
const isEnglish = (lang) => (lang || '').startsWith('en');

export function localizedName(item, lang) {
  if (!item) return '';
  return (isEnglish(lang) && item.name_en) || item.name_de;
}

// Short form for use next to a quantity: "EL"/"tbsp", falling back to the
// full name for units without an abbreviation ("Prise"/"Pinch").
export function unitLabel(unit, lang) {
  if (!unit) return '';
  if (isEnglish(lang) && (unit.abbreviation_en || unit.name_en)) {
    return unit.abbreviation_en || unit.name_en;
  }
  return unit.abbreviation_de || unit.name_de;
}
