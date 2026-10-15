import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AccountMenu from './AccountMenu';
import MoreMenu from './MoreMenu';
import BottomNav from './BottomNav';
import LogoTile from './LogoTile';
import {
  ShoppingMenuIcon, TasksMenuIcon, CookingMenuIcon, RecipesMenuIcon,
} from './icons/navIcons';

export default function Navbar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const navLinks = [
    { to: '/shopping', label: t('nav.shopping'), Icon: ShoppingMenuIcon },
    { to: '/tasks', label: t('nav.tasks'), Icon: TasksMenuIcon },
    { to: '/cooking-plan', label: t('nav.cookingPlan'), Icon: CookingMenuIcon },
    { to: '/recipes', label: t('nav.recipes'), Icon: RecipesMenuIcon },
  ];

  return (
    <>
      {/* Laptop/tablet only -- phones navigate with the bottom bar (BottomNav).
          Dark eucalyptus so navigation stands apart from the light content;
          sticky and slightly see-through with a blur, like iOS bars. */}
      <nav className="hidden md:block sticky top-0 z-30 bg-eucalyptus-800/95 dark:bg-eucalyptus-950/95 backdrop-blur-md shadow-md print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex justify-between items-center gap-3">
          <Link to="/" className="flex-shrink-0" aria-label={t('nav.dashboard')}>
            <LogoTile />
          </Link>

          <div className="flex items-center gap-1 min-w-0">
            {navLinks.map((link) => {
              const active = pathname.startsWith(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors no-underline ${
                    active
                      ? 'bg-white/15 text-white font-semibold hover:text-white'
                      : 'text-eucalyptus-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="text-lg"><link.Icon active={active} /></span>
                  {link.label}
                </Link>
              );
            })}
            <MoreMenu />
          </div>

          <AccountMenu />
        </div>
      </nav>
      <BottomNav />
    </>
  );
}
