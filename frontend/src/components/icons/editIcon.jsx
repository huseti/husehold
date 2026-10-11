// Edit icon (Phosphor, MIT, fill) -- same glyph as EditGlyph in uiIcons.jsx.
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple';

export default function EditIcon({ className = '', ...props }) {
  return <PencilSimple weight="fill" size="1em" className={className} aria-hidden="true" {...props} />;
}
