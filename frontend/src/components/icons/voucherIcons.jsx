// Voucher icon from Phosphor (MIT), "fill" weight -- same treatment as taskIcons.jsx.
import { Ticket } from '@phosphor-icons/react/dist/csr/Ticket';

export default function VoucherIcon({ className = '', ...props }) {
  return <Ticket weight="fill" size="1em" className={className} aria-hidden="true" {...props} />;
}
