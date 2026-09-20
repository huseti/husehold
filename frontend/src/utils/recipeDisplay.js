const FRACTIONS = [
  [0, ''], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'], [1, ''],
];

// Scaling a recipe from 4 to 3 servings should read "1½ Zwiebeln", not
// "1.125" -- so small amounts snap to the nearest common kitchen fraction
// and big ones to a whole number.
export function formatQuantity(value) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (n >= 100) return String(Math.round(n / 5) * 5);
  if (n >= 10) return String(Math.round(n));

  const whole = Math.floor(n);
  const remainder = n - whole;
  const [fractionValue, glyph] = FRACTIONS.reduce(
    (best, candidate) => (Math.abs(candidate[0] - remainder) < Math.abs(best[0] - remainder) ? candidate : best),
  );
  if (fractionValue === 1) return String(whole + 1);
  if (fractionValue === 0) return whole > 0 ? String(whole) : '¼';
  return `${whole > 0 ? whole : ''}${glyph}`;
}

export function scaleQuantity(quantity, fromServings, toServings) {
  if (quantity === null || quantity === undefined || quantity === '') return null;
  if (!fromServings) return Number(quantity);
  return (Number(quantity) * toServings) / fromServings;
}

const UNICODE_FRACTIONS = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

function parseQuantityToken(token) {
  const cleaned = token.replace(',', '.');
  if (UNICODE_FRACTIONS[cleaned]) return UNICODE_FRACTIONS[cleaned];
  if (/^\d+\/\d+$/.test(cleaned)) {
    const [a, b] = cleaned.split('/').map(Number);
    return b ? a / b : null;
  }
  const withGlyph = cleaned.match(/^(\d+)([¼½¾⅓⅔])$/);
  if (withGlyph) return Number(withGlyph[1]) + UNICODE_FRACTIONS[withGlyph[2]];
  const n = Number(cleaned);
  return Number.isFinite(n) && cleaned !== '' ? n : null;
}

// Turns a pasted ingredient line ("200 g Spaghetti", "1,5 EL Öl", "½ Bund
// Petersilie", "Salz") into { quantity, unit, name } so a list copied from a
// website can be dropped straight into the recipe form. Only recognizes
// units that exist in the household's unit list; anything else stays part
// of the name.
export function parseIngredientLine(line, units) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  // "400g" -> "400" "g"
  const glued = tokens[0].match(/^(\d+(?:[.,]\d+)?)([^\d\s.,/]+)$/);
  if (glued) tokens.splice(0, 1, glued[1], glued[2]);

  let quantity = null;
  let index = 0;
  const first = parseQuantityToken(tokens[0]);
  if (first !== null) {
    quantity = first;
    index = 1;
    // "1 1/2" or "1 ½" -- a whole number followed by a fraction token.
    const second = tokens[1] !== undefined ? parseQuantityToken(tokens[1]) : null;
    if (second !== null && second < 1 && Number.isInteger(first)) {
      quantity = first + second;
      index = 2;
    }
  }

  let unit = null;
  if (quantity !== null && tokens[index] !== undefined && tokens.length > index + 1) {
    const candidate = tokens[index].replace(/\.$/, '').toLowerCase();
    unit = units.find((u) => [u.abbreviation_de, u.abbreviation_en, u.name_de, u.name_en]
      .some((spelling) => spelling && spelling.toLowerCase() === candidate)) || null;
    if (unit) index += 1;
  }

  const name = tokens.slice(index).join(' ');
  if (!name) return null;
  return { quantity, unit: unit ? unit.id : null, name };
}
