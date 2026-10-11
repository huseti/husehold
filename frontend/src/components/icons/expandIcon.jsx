// "Open in highlight mode" icon (Phosphor, MIT, bold -- the corners glyph has no fill variant worth using).
import { CornersOut } from '@phosphor-icons/react/dist/csr/CornersOut';

export default function ExpandIcon({ className = '', ...props }) {
  return <CornersOut weight="bold" size="1em" className={className} aria-hidden="true" {...props} />;
}
