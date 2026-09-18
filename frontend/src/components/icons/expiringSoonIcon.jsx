// Flat, single-color warning icon flagging a voucher expiring soon -- same
// treatment as taskIcons.jsx/voucherIcons.jsx (single currentColor fill).

export default function ExpiringSoonIcon({ className = '', title, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" className={`flex-shrink-0 ${className}`} {...props}>
      {title && <title>{title}</title>}
      <path d="M12 2 1 21h22L12 2Zm0 6a1 1 0 0 1 1 1v5a1 1 0 0 1-2 0V9a1 1 0 0 1 1-1Zm0 9.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z" />
    </svg>
  );
}
