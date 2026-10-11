// Icons for search/filter fields (Phosphor, MIT) -- bold magnifier, filled funnel.
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Funnel } from '@phosphor-icons/react/dist/csr/Funnel';

export function SearchIcon({ className = '', ...props }) {
  return <MagnifyingGlass weight="bold" size="1em" className={className} aria-hidden="true" {...props} />;
}

export function FilterIcon({ className = '', ...props }) {
  return <Funnel weight="fill" size="1em" className={className} aria-hidden="true" {...props} />;
}
