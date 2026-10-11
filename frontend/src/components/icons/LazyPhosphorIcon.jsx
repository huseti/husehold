import { useEffect, useState } from 'react';
import { loadPhosphorLibrary, loadedPhosphorLibrary } from '../../utils/phosphorLibrary';

// Renders any Phosphor icon by name, loading the full library on first use.
// Until it's loaded (or for an unknown name) an empty 1em box keeps the layout stable.
export default function LazyPhosphorIcon({ name, fallback = null, className = '', ...props }) {
  const [library, setLibrary] = useState(loadedPhosphorLibrary);

  useEffect(() => {
    if (library) return undefined;
    let cancelled = false;
    loadPhosphorLibrary().then((mod) => { if (!cancelled) setLibrary(mod); });
    return () => { cancelled = true; };
  }, [library]);

  const Component = library?.[name];
  if (Component) return <Component weight="fill" size="1em" className={className} aria-hidden="true" {...props} />;
  if (library && fallback) return fallback;
  return <span className={`inline-block ${className}`} style={{ width: '1em', height: '1em' }} aria-hidden="true" />;
}
