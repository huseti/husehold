import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import logoIcon from '../assets/logo-icon.png';
import AccountMenu from './AccountMenu';
import MoreMenu from './MoreMenu';

export default function Navbar() {
  const { t } = useTranslation();

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center gap-3">
        {/* Clicking the logo is the way back to the dashboard -- no separate
            "Übersicht" link needed in the row below. */}
        <Link to="/" className="flex-shrink-0">
          <img src={logoIcon} alt={t('common.appName')} className="h-10 w-10" />
        </Link>
        {/* MoreMenu is a sibling of, not nested inside, the overflow-x-auto
            row below -- overflow-x-auto without an explicit overflow-y
            implicitly computes overflow-y as auto too, which would clip
            MoreMenu's absolutely-positioned dropdown down to an empty,
            scrollable sliver. */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="space-x-4 flex items-center overflow-x-auto">
            <Link to="/shopping" className="text-gray-600 hover:text-gray-900">{t('nav.shopping')}</Link>
            <Link to="/tasks" className="text-gray-600 hover:text-gray-900">{t('nav.tasks')}</Link>
            <Link to="/cooking-plan" className="text-gray-600 hover:text-gray-900">{t('nav.cookingPlan')}</Link>
            <Link to="/recipes" className="text-gray-600 hover:text-gray-900">{t('nav.recipes')}</Link>
          </div>
          <MoreMenu />
        </div>
        {/* Pinned outside the scrollable link row above so it stays visible
            on narrow screens instead of scrolling off with the rest. */}
        <AccountMenu />
      </div>
    </nav>
  );
}
