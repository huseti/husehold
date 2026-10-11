// Warning icon flagging a voucher expiring soon (Phosphor, MIT, fill); `title` becomes the tooltip.
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';

export default function ExpiringSoonIcon({ className = '', title, ...props }) {
  return <Warning weight="fill" size="1em" alt={title} className={`flex-shrink-0 ${className}`} {...props} />;
}
