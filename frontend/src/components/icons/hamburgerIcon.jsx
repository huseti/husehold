// Mobile menu toggle (Phosphor, MIT, bold).
import { List } from '@phosphor-icons/react/dist/csr/List';

export default function HamburgerIcon({ className = '' }) {
  return <List weight="bold" size="1.5rem" className={className} aria-hidden="true" />;
}
