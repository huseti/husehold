const EXPIRING_SOON_MONTHS = 6;

export function isExpiringSoon(voucher) {
  if (!voucher.valid_until || voucher.is_expired || voucher.is_archived) return false;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() + EXPIRING_SOON_MONTHS);
  return new Date(voucher.valid_until) <= cutoff;
}
