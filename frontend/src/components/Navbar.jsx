import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import logoIcon from '../assets/logo-icon.png';
import AccountMenu from './AccountMenu';
import MoreMenu from './MoreMenu';
import HamburgerIcon from './icons/hamburgerIcon';
import CloseIcon from './icons/closeIcon';
import TaskIcon from './icons/taskIcons';
import { TasksMenuIcon, RecipesMenuIcon } from './icons/navIcons';

export default function Navbar() {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { to: '/shopping', label: t('nav.shopping'), icon: <TaskIcon icon="shopping" /> },
    { to: '/tasks', label: t('nav.tasks'), icon: <TasksMenuIcon /> },
    { to: '/cooking-plan', label: t('nav.cookingPlan'), icon: <TaskIcon icon="cooking" /> },
    { to: '/recipes', label: t('nav.recipes'), icon: <RecipesMenuIcon /> },
  ];

  return (
    <nav className="bg-eucalyptus-50 dark:bg-gray-800 shadow-sm border-b border-eucalyptus-200 dark:border-gray-700 print:hidden">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center gap-3">
        <Link to="/" className="flex-shrink-0">
          <img src={logoIcon} alt={t('common.appName')} className="h-10 w-10" />
        </Link>

        {/* Desktop nav: visible only on md+ */}
        <div className="hidden md:flex items-center gap-3 min-w-0">
          <div className="space-x-4 flex items-center overflow-x-auto">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} className="flex items-center gap-1.5 text-eucalyptus-700 dark:text-eucalyptus-300 hover:text-eucalyptus-900 dark:hover:text-eucalyptus-100 hover:font-semibold whitespace-nowrap transition-colors">
                <span className="text-lg">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>
          <MoreMenu />
        </div>

        {/* Mobile hamburger: visible only on < md */}
        <div className="flex md:hidden items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-eucalyptus-700 dark:text-eucalyptus-300 hover:text-eucalyptus-900 dark:hover:text-eucalyptus-100 p-2"
            aria-label={t('common.menu')}
          >
            {mobileMenuOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>
        </div>

        <AccountMenu />
      </div>

      {/* Mobile drawer: slides in from top */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-eucalyptus-50 dark:bg-gray-800 border-t border-eucalyptus-200 dark:border-gray-700 px-4 py-3 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 py-2 text-eucalyptus-700 dark:text-eucalyptus-300 hover:text-eucalyptus-900 dark:hover:text-eucalyptus-100 hover:font-semibold transition-colors"
            >
              <span className="text-lg">{link.icon}</span>
              {link.label}
            </Link>
          ))}
          <div className="border-t border-eucalyptus-200 dark:border-gray-700 pt-2 mt-2">
            <MoreMenu />
          </div>
        </div>
      )}
    </nav>
  );
}
