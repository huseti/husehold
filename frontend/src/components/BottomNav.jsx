import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PackingListIcon from './icons/packingListIcons';
import VoucherIcon from './icons/voucherIcons';
import {
  ShoppingMenuIcon, TasksMenuIcon, CookingMenuIcon, RecipesMenuIcon, AnalyticsMenuIcon, MoreTabIcon, SettingsMenuIcon,
} from './icons/navIcons';
import LogoTile from './LogoTile';
import MemberAvatar from './MemberAvatar';
import AvatarPreviewModal from './AvatarPreviewModal';
import { useMyMember } from '../hooks/useMyMember';
import { logout } from '../utils/session';

// Tab icons are outlines, filled when active (see navIcons.jsx).
const TABS = [
  { to: '/shopping', labelKey: 'nav.tabShopping', Icon: ShoppingMenuIcon },
  { to: '/tasks', labelKey: 'nav.tabTasks', Icon: TasksMenuIcon },
  { to: '/cooking-plan', labelKey: 'nav.cookingPlan', Icon: CookingMenuIcon },
  { to: '/recipes', labelKey: 'nav.recipes', Icon: RecipesMenuIcon },
];

// Everything else sits behind "More", opened as a sheet above the bar.
const MORE_LINKS = [
  { to: '/packing-lists', labelKey: 'nav.packingLists', icon: <PackingListIcon /> },
  { to: '/vouchers', labelKey: 'nav.vouchers', icon: <VoucherIcon /> },
  { to: '/analytics', labelKey: 'nav.analytics', icon: <AnalyticsMenuIcon /> },
];
const SETTINGS_LINK = { to: '/settings', labelKey: 'common.systemSettings', icon: <SettingsMenuIcon /> };

// '/' only matches itself; every other tab also covers its sub-pages
// (e.g. /cooking-plan-config belongs to the cooking plan tab).
const matches = (pathname, to) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

// Phone navigation -- the only bar on phones (the top navbar is laptop-only):
// app logo (= Start, no label) · Einkauf · Haushalt · Kochplan · Rezepte · Mehr.
// "Mehr" opens a sheet with your profile (+ logout), the remaining pages and
// the settings.
export default function BottomNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);
  const [member, setMember] = useMyMember();

  useEffect(() => { setMoreOpen(false); }, [pathname]);

  const moreActive = moreOpen || [...MORE_LINKS, SETTINGS_LINK].some((l) => matches(pathname, l.to));
  const name = member ? (member.user.first_name || member.user.username) : null;

  const tabClass = 'flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 text-xs leading-tight no-underline';
  // Active tab: white label and a light pill behind the icon (Material 3 style),
  // so it reads at a glance on the dark bar.
  const tabContent = (active, icon, label) => (
    <>
      <span className={`flex items-center justify-center h-8 w-12 rounded-full text-2xl transition-colors ${active ? 'bg-white/20 text-white' : 'text-eucalyptus-100'}`}>
        {icon}
      </span>
      <span className={active ? 'text-white font-semibold' : 'text-eucalyptus-100'}>{label}</span>
    </>
  );

  const sheetLink = (l) => (
    <Link
      key={l.to}
      to={l.to}
      className={`flex items-center gap-3 px-3 py-3 rounded-lg no-underline ${
        matches(pathname, l.to)
          ? 'bg-eucalyptus-50 text-eucalyptus-800 font-semibold'
          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      <span className="text-xl text-eucalyptus-600 dark:text-eucalyptus-400">{l.icon}</span>
      {t(l.labelKey)}
    </Link>
  );

  const homeActive = !moreOpen && pathname === '/';

  return (
    <div className="md:hidden print:hidden">
      {moreOpen && (
        <div className="fade-in fixed inset-0 z-30 bg-black/40" onClick={() => setMoreOpen(false)} aria-hidden="true" />
      )}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 bg-eucalyptus-800 dark:bg-eucalyptus-950 shadow-[0_-2px_8px_rgba(0,0,0,0.12)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label={t('common.menu')}
      >
        {moreOpen && (
          <div className="sheet-up absolute inset-x-0 bottom-full bg-white dark:bg-gray-800 rounded-t-2xl shadow-xl px-3 pt-3 pb-2 max-h-[75dvh] overflow-y-auto">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" aria-hidden="true" />

            <div className="flex items-center gap-3 px-3 pb-3 mb-2 border-b border-gray-200 dark:border-gray-700">
              <MemberAvatar member={member} sizeClass="h-12 w-12 !text-lg" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{name}</p>
                <button
                  type="button"
                  onClick={() => { setShowAvatar(true); setMoreOpen(false); }}
                  disabled={!member}
                  className="block text-sm text-eucalyptus-700 dark:text-eucalyptus-300 hover:underline disabled:opacity-50"
                >
                  {t('common.editImage')}
                </button>
                <button
                  type="button"
                  onClick={() => logout(navigate)}
                  className="block text-sm text-red-600 dark:text-red-400 hover:underline mt-0.5"
                >
                  {t('common.logout')}
                </button>
              </div>
            </div>

            {MORE_LINKS.map(sheetLink)}

            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              {sheetLink(SETTINGS_LINK)}
            </div>
          </div>
        )}

        <div className="flex">
          {/* Start: just the logo, as tall as icon + label of the other tabs */}
          <Link
            to="/"
            className="flex-none w-16 flex items-center justify-center pt-2 pb-1.5"
            aria-label={t('nav.tabHome')}
            aria-current={homeActive ? 'page' : undefined}
          >
            <LogoTile
              sizeClass="h-11 w-11"
              className={`transition-shadow ${homeActive ? 'ring-2 ring-white ring-offset-2 ring-offset-eucalyptus-800 dark:ring-offset-eucalyptus-950' : ''}`}
            />
          </Link>
          {TABS.map((item) => {
            const active = !moreOpen && matches(pathname, item.to);
            return (
              <Link key={item.to} to={item.to} className={tabClass} aria-current={active ? 'page' : undefined}>
                {tabContent(active, <item.Icon active={active} />, t(item.labelKey))}
              </Link>
            );
          })}
          <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} className={tabClass}>
            {tabContent(moreActive, <MoreTabIcon active={moreActive} />, t('nav.tabMore'))}
          </button>
        </div>
      </nav>

      {showAvatar && member && (
        <AvatarPreviewModal member={member} onClose={() => setShowAvatar(false)} onChanged={setMember} />
      )}
    </div>
  );
}
