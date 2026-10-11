// Navbar menu icons from Phosphor (MIT), "fill" weight -- same treatment as
// taskIcons.jsx, which also supplies the shopping and cooking menu icons.
import { ClipboardText } from '@phosphor-icons/react/dist/csr/ClipboardText';
import { BookOpen } from '@phosphor-icons/react/dist/csr/BookOpen';
import { ChartBar } from '@phosphor-icons/react/dist/csr/ChartBar';

const fill = (Component) => function NavIcon({ className = '', ...props }) {
  return <Component weight="fill" size="1em" className={className} aria-hidden="true" {...props} />;
};

export const TasksMenuIcon = fill(ClipboardText);
export const RecipesMenuIcon = fill(BookOpen);
export const AnalyticsMenuIcon = fill(ChartBar);
