// Print / save-as-PDF icon (Phosphor, MIT, fill).
import { Printer } from '@phosphor-icons/react/dist/csr/Printer';

export default function PrintIcon({ className = '', ...props }) {
  return <Printer weight="fill" size="1em" className={className} aria-hidden="true" {...props} />;
}
