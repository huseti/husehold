// Packing list icon from Phosphor (MIT), "fill" weight -- same treatment as taskIcons.jsx.
import { Suitcase } from '@phosphor-icons/react/dist/csr/Suitcase';

export default function PackingListIcon({ className = '', ...props }) {
  return <Suitcase weight="fill" size="1em" className={className} aria-hidden="true" {...props} />;
}
