// Navigation icons from Phosphor (MIT). In the nav bars a tab's icon is drawn
// as an outline ("regular") and filled only for the active page -- the usual
// iOS/Material pattern; everywhere else (menus, empty states) they stay "fill",
// like the flat single-color task icons in taskIcons.jsx.
import { ShoppingCart } from '@phosphor-icons/react/dist/csr/ShoppingCart';
import { ClipboardText } from '@phosphor-icons/react/dist/csr/ClipboardText';
import { ForkKnife } from '@phosphor-icons/react/dist/csr/ForkKnife';
import { BookOpen } from '@phosphor-icons/react/dist/csr/BookOpen';
import { ChartBar } from '@phosphor-icons/react/dist/csr/ChartBar';
import { SquaresFour } from '@phosphor-icons/react/dist/csr/SquaresFour';
import { GearSix } from '@phosphor-icons/react/dist/csr/GearSix';

const navIcon = (Component) => function NavIcon({ active = true, className = '', ...props }) {
  return <Component weight={active ? 'fill' : 'regular'} size="1em" className={className} aria-hidden="true" {...props} />;
};

export const ShoppingMenuIcon = navIcon(ShoppingCart);
export const TasksMenuIcon = navIcon(ClipboardText);
export const CookingMenuIcon = navIcon(ForkKnife);
export const RecipesMenuIcon = navIcon(BookOpen);
export const AnalyticsMenuIcon = navIcon(ChartBar);
export const MoreTabIcon = navIcon(SquaresFour);
export const SettingsMenuIcon = navIcon(GearSix);
