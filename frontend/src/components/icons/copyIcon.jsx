// Copy icon (Phosphor, MIT, fill).
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';

export default function CopyIcon({ className = '', ...props }) {
  return <Copy weight="fill" size="1em" className={className} aria-hidden="true" {...props} />;
}
