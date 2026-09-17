import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import logoIcon from '../assets/logo-icon.png';

export default function Navbar() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="flex-shrink-0">
          <img src={logoIcon} alt={t('common.appName')} className="h-10 w-10" />
        </Link>
        <div className="space-x-4 flex items-center overflow-x-auto">
          <Link to="/" className="text-gray-600 hover:text-gray-900">{t('nav.dashboard')}</Link>
          <Link to="/shopping" className="text-gray-600 hover:text-gray-900">{t('nav.shopping')}</Link>
          <Link to="/recipes" className="text-gray-600 hover:text-gray-900">{t('nav.recipes')}</Link>
          <Link to="/cooking-plan" className="text-gray-600 hover:text-gray-900">{t('nav.cookingPlan')}</Link>
          <Link to="/tasks" className="text-gray-600 hover:text-gray-900">{t('nav.tasks')}</Link>
          <Link to="/settings" className="text-gray-600 hover:text-gray-900">{t('nav.settings')}</Link>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            {t('common.logout')}
          </button>
        </div>
      </div>
    </nav>
  );
}
