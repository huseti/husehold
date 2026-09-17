import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import logoIcon from '../assets/logo-icon.png';
import AccountMenu from './AccountMenu';

export default function Navbar() {
  const { t } = useTranslation();

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center gap-3">
        <Link to="/" className="flex-shrink-0">
          <img src={logoIcon} alt={t('common.appName')} className="h-10 w-10" />
        </Link>
        <div className="space-x-4 flex items-center overflow-x-auto min-w-0">
          <Link to="/" className="text-gray-600 hover:text-gray-900">{t('nav.dashboard')}</Link>
          <Link to="/shopping" className="text-gray-600 hover:text-gray-900">{t('nav.shopping')}</Link>
          <Link to="/recipes" className="text-gray-600 hover:text-gray-900">{t('nav.recipes')}</Link>
          <Link to="/cooking-plan" className="text-gray-600 hover:text-gray-900">{t('nav.cookingPlan')}</Link>
          <Link to="/tasks" className="text-gray-600 hover:text-gray-900">{t('nav.tasks')}</Link>
        </div>
        {/* Pinned outside the scrollable link row above so it stays visible
            on narrow screens instead of scrolling off with the rest. */}
        <AccountMenu />
      </div>
    </nav>
  );
}
