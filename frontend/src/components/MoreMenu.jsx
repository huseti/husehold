import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const LINKS = [
  { to: '/packing-lists', labelKey: 'nav.packingLists' },
  { to: '/vouchers', labelKey: 'nav.vouchers' },
  { to: '/analytics', labelKey: 'nav.analytics' },
];

// Same open/click-outside-to-close pattern as AccountMenu -- groups the
// lower-traffic pages so the main nav row doesn't grow with every new domain.
export default function MoreMenu() {
  const { t } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = LINKS.some((l) => l.to === location.pathname);

  return (
    <div className="relative flex-shrink-0" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 ${isActive ? 'text-gray-900 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
      >
        {t('nav.more')} <span className="text-xs">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-44 bg-white rounded-lg shadow-lg border py-1 z-20">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              {t(l.labelKey)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
