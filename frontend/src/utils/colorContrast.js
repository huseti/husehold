// Text on a user-picked background color (recipe labels): white on dark colors,
// near-black on light ones (yellow, light green, ...), whichever has the higher
// WCAG contrast ratio.
const DARK_TEXT = '#111827'; // gray-900
const LIGHT_TEXT = '#ffffff';

function luminance(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function readableTextColor(hex) {
  if (!/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex || '')) return LIGHT_TEXT;
  const l = luminance(hex);
  const onWhite = 1.05 / (l + 0.05);
  const onDark = (l + 0.05) / (luminance(DARK_TEXT) + 0.05);
  return onDark > onWhite ? DARK_TEXT : LIGHT_TEXT;
}

// Inline style for a filled pill in the given color.
export const pillStyle = (hex) => ({ backgroundColor: hex, color: readableTextColor(hex) });
