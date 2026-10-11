// The full Phosphor library (~1500 icons) is only needed by the icon picker
// and for icons picked from it, so it's loaded on demand into its own chunk
// instead of the main bundle (curated icons import single files directly).
let library = null;
let pending = null;

const NOT_ICONS = new Set(['IconBase', 'IconContext', 'SSRBase']);

export function loadPhosphorLibrary() {
  if (!pending) {
    pending = import('@phosphor-icons/react').then((mod) => {
      library = mod;
      return mod;
    });
  }
  return pending;
}

export function loadedPhosphorLibrary() {
  return library;
}

export function phosphorIconNames(mod) {
  return Object.keys(mod).filter((name) => /^[A-Z]/.test(name) && !NOT_ICONS.has(name)).sort();
}

// Curated keys are lowercase ("cleaning"); picked Phosphor names are PascalCase ("Vacuum").
export function isPhosphorName(icon) {
  return typeof icon === 'string' && /^[A-Z]/.test(icon);
}
